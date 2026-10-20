import { describe, expect, it, vi } from 'vitest';

import { ApiSessionClient } from '@/api/session/sessionClient';
import type { AgentState } from '@/api/types';
import { withConfiguredDaemonTestHome } from '@/daemon/testkit/fakeDaemonLifecycle.testkit';
import {
    bindApiSessionSocketMock,
    createApiSessionSocketStub,
    resolveApiSessionSocketDefaultAck,
} from '@/testkit/backends/apiSessionSocketHarness';
import { createPlainSessionFixture } from '@/testkit/backends/sessionFixtures';
import { ProviderEnforcedPermissionHandler } from './ProviderEnforcedPermissionHandler';

const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));
// Control relay acknowledgement only; the session, router, store and coordinator are real.
vi.mock('socket.io-client', () => ({ io: mockIo }));

describe('ProviderEnforcedPermissionHandler native cancellation', () => {
    it.each(['success', 'error'] as const)(
        'retires one request before its outstanding relay acknowledgement returns %s', async (ackResult) => {
            await withConfiguredDaemonTestHome({ prefix: 'permission-cancellation-' }, async () => {
                let releaseCompletion: (() => void) | undefined;
                let holdCompletion = true;
                const socket = createApiSessionSocketStub({ emitWithAck: (event, payload) => {
                    if (event !== 'update-state' && event !== 'update-metadata') {
                        return resolveApiSessionSocketDefaultAck(event, payload);
                    }
                    // These are the real plain-session socket wire fields.
                    const body = payload as {
                        expectedVersion: number; agentState?: string; metadata?: string;
                    };
                    const acknowledgement = {
                        result: 'success', version: body.expectedVersion + 1,
                        agentState: body.agentState, metadata: body.metadata,
                    };
                    const state: AgentState | null = event === 'update-state' && body.agentState
                        ? JSON.parse(body.agentState) : null;
                    if (holdCompletion && state?.completedRequests?.retired?.status === 'approved') {
                        holdCompletion = false;
                        return new Promise((resolve) => {
                            releaseCompletion = () => resolve(ackResult === 'success'
                                ? acknowledgement : { result: 'error', error: 'fixture write rejected' });
                        });
                    }
                    return acknowledgement;
                } });
                bindApiSessionSocketMock(mockIo, socket);
                const session = new ApiSessionClient('synthetic-token', createPlainSessionFixture({ id: 'cancellation' }));
                const handler = new ProviderEnforcedPermissionHandler(session, { logPrefix: '[CancellationTest]' });
                const input = { command: 'echo fixture' };
                const retired = handler.handleToolCall('retired', 'bash', input);
                const neighbor = handler.handleToolCall('neighbor', 'bash', input);
                let response: Promise<unknown> | undefined;
                void retired.catch(() => {});
                void neighbor.catch(() => {});
                try {
                    await expect.poll(() => session.getAgentStateSnapshot()?.requests?.neighbor).toBeDefined();
                    await session.flush();
                    response = session.rpcHandlerManager.invokeLocal('permission', {
                        id: 'retired', approved: true, decision: 'approved_for_session',
                    });
                    void response.catch(() => {});
                    await expect.poll(() => releaseCompletion).toBeDefined();

                    // Competing remote decisions remain serialized; only local
                    // lifecycle cancellation may supersede the in-flight response.
                    await expect(session.rpcHandlerManager.invokeLocal('permission', {
                        id: 'retired', approved: false, decision: 'denied',
                    })).resolves.toMatchObject({ ok: false, errorCode: 'permission_request_not_found' });
                    expect(handler.cancelPendingRequest('retired', 'Native request ended')).toBe(true);
                    await expect(retired).resolves.toEqual({ decision: 'abort' });
                    // A repeated native callback cannot recover the in-flight approval.
                    await expect(handler.handleToolCall('retired', 'bash', input)).resolves.toEqual({ decision: 'abort' });
                    expect(session.getAgentStateSnapshot()?.requests?.neighbor).toBeDefined();
                    await expect(session.rpcHandlerManager.invokeLocal('permission', {
                        id: 'retired', approved: true,
                    })).resolves.toMatchObject({ ok: false, errorCode: 'permission_request_not_found' });

                    releaseCompletion?.();
                    await expect(response).resolves.toMatchObject({
                        ok: false,
                        errorCode: ackResult === 'success' ? 'permission_request_not_found' : 'permission_response_failed',
                    });
                    await expect.poll(() => session.getAgentStateSnapshot()?.completedRequests?.retired?.status).toBe('canceled');
                    expect(session.getAgentStateSnapshot()?.requests?.retired).toBeUndefined();
                    expect(session.getAgentStateSnapshot()?.requests?.neighbor).toBeDefined();
                    // The losing session-wide approval must not grant a neighboring tool.
                    await session.rpcHandlerManager.invokeLocal('permission', {
                        id: 'neighbor', approved: false, decision: 'denied',
                    });
                    await expect(neighbor).resolves.toEqual({ decision: 'denied' });
                } finally {
                    releaseCompletion?.();
                    await response?.catch(() => {});
                    handler.reset();
                    await Promise.allSettled([retired, neighbor]);
                    await session.close();
                }
            });
        },
    );
});
