import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { existsSync, readFileSync } from 'node:fs';
import type { AddressInfo } from 'node:net';

import { afterEach, describe, expect, it, vi } from 'vitest';
import { STRUCTURED_QUESTION_LIMITS } from '@happier-dev/protocol';
import { bindApiSessionSocketMock, createApiSessionSocketStub, resolveApiSessionSocketDefaultAck } from '@/testkit/backends/apiSessionSocketHarness';
import { ApiSessionClient } from '@/api/session/sessionClient';
import { createPlainSessionFixture } from '@/testkit/backends/sessionFixtures';
import { withConfiguredDaemonTestHome } from '@/daemon/testkit/fakeDaemonLifecycle.testkit';
import { cloneCallableSessionRuntimeControls } from '@/api/session/sessionRuntimeControls';
import { createSessionRecordFixture } from '@/testkit/backends/sessionFixtures';
import { handleAttachCommand } from '@/cli/commands/attach';
import { runOpenCodeProviderAttach } from '../attach/runOpenCodeProviderAttach';
import type { RpcRequest } from '@/api/rpc/types';

const { mockIo } = vi.hoisted(() => ({ mockIo: vi.fn() }));
// Network boundary only: keep command, RPC encryption/registration and provider runtime real.
vi.mock('socket.io-client', () => ({ io: mockIo }));

import { MessageBuffer } from '@/ui/ink/messageBuffer';
import { logger } from '@/ui/logger';
import { createMutableApiSessionClientFixture } from '@/testkit/backends/sessionFixtures';
import { createTestMetadata } from '@/testkit/backends/sessionMetadata';
import { MessageQueue2 } from '@/agent/runtime/modeMessageQueue';
import { combinePermissionModeQueuedPrompts, type PermissionModeQueuedPrompt } from '@/agent/runtime/permission/permissionModeQueuedPrompt';
import type { PermissionMode, Session } from '@/api/types';
import { runPermissionModePromptLoop } from '@/agent/runtime/runPermissionModePromptLoop';
import { createRuntimeOverrideSynchronizers } from '@/agent/runtime/createRuntimeOverrideSynchronizers';
import { ProviderEnforcedPermissionHandler } from '@/agent/permissions/ProviderEnforcedPermissionHandler';
import { createOpenCodeSharedLocalControl } from '../localControl/createOpenCodeSharedLocalControl';
import { createOpenCodeTuiSupervisor } from '../localControl/openCodeTuiSupervisor';
import { registerSessionControlHandlers } from '@/rpc/handlers/sessionControls';
import { encodeBase64, encrypt } from '@/api/encryption';

import { createOpenCodeServerRuntimeClient } from './client';
import { createOpenCodeServerRuntime } from './runtime';
import { importOpenCodeTextHistoryCommitted } from './openCodeSessionMessageImport';

function createSessionHarness() {
  const metadata: Record<string, unknown> = {};
  return {
    sessionId: 'happy_opencode_composed_lifecycle',
    keepAlive: vi.fn(),
    sendAgentMessage: vi.fn(),
    sendSessionEvent: vi.fn(),
    sessionTurnLifecycle: {
      beginTurn: vi.fn(async () => ({ turnId: 'turn-1' })),
      attachProviderTurnId: vi.fn(async () => {}),
      appendTranscriptAnchors: vi.fn(async () => {}),
      completeTurn: vi.fn(async () => {}),
      failTurn: vi.fn(async () => {}),
      cancelTurn: vi.fn(async () => {}),
      endSession: vi.fn(async () => {}),
      markRollbackEligible: vi.fn(async () => {}),
      markRolledBack: vi.fn(async () => {}),
    },
    sendUserTextMessageCommitted: vi.fn(async () => {}),
    sendAgentMessageCommitted: vi.fn(async () => {}),
    ensureMetadataSnapshot: vi.fn(async () => ({ ok: true })),
    getMetadataSnapshot: () => metadata,
    updateMetadata: vi.fn(async (updater: (previous: unknown) => unknown) => {
      const next = updater(metadata);
      if (!next || typeof next !== 'object' || Array.isArray(next)) return;
      for (const key of Object.keys(metadata)) delete metadata[key];
      Object.assign(metadata, next);
    }),
    getLastObservedMessageSeq: () => 0,
  };
}

function sendJson(response: ServerResponse, body: unknown, statusCode = 200): void {
  response.writeHead(statusCode, { 'content-type': 'application/json' });
  response.end(JSON.stringify(body));
}

async function readJsonBody(request: NodeJS.ReadableStream): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? parsed as Record<string, unknown>
    : {};
}

describe('OpenCode client/runtime lifecycle composition', () => {
  const openServers: Array<ReturnType<typeof createServer>> = [];

  afterEach(async () => {
    await Promise.all(openServers.splice(0).map(async (server) => {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }));
  });

  const nativeSessionId = 'ses_eafdf8795ffeZ5vnL1oI89MBn2';
  const directory = 'C:/tc-ach31/disposable';
  // Captured OpenCode 2.0.15 Windows run 8c75d7fd-1e5e-4fae-a309-1ae18f692e70:
  // evidence.jsonl:179,223-224. The terminal form event has no location.
  const nativeForm = (sessionID = nativeSessionId, id = 'frm_13bd1429fa1241fc9b8dde2f69cdc2e0') => ({
    id, sessionID, title: 'tc-ach.4 structured question', fields: [
      { key: 'choice', title: 'Choice', required: true, type: 'string', options: [
        { value: 'local', label: 'Local' }, { value: 'remote', label: 'Remote' },
      ] },
      { key: 'note', title: 'Fixture text', required: true, type: 'string' },
    ],
  });
  const nativePermission = (sessionID = nativeSessionId) => ({
    id: 'per_native', sessionID, action: 'bash', resources: ['pwd'], save: [],
    metadata: { command: 'pwd' }, source: { type: 'tool', messageID: 'msg_permission', id: 'call_native' },
  });
  type RequestFixture = {
    session: ApiSessionClient;
    permissionHandler: ProviderEnforcedPermissionHandler;
    restart: () => Promise<void>;
    emit: (type: string, data: unknown, location?: { directory: string }) => void;
    reconnect: () => void;
    wire: {
      forms: unknown[];
      permissions: unknown[];
      agents: Array<{ id: string; name: string }>;
      replyStatus: number;
      formInventory?: (response: ServerResponse) => void;
      nativeResponse?: (request: IncomingMessage, response: ServerResponse) => void;
      messages?: (response: ServerResponse) => void;
    };
    relay: {
      holdRequestId?: string;
      releaseAck?: () => void;
      holdModeId?: string;
      releaseMetadataAck?: () => void;
    };
    nativeWrites: Array<{ method: string; path: string }>;
    relayMessages: unknown[];
  };

  const withNativeRequests = async (run: (fixture: RequestFixture) => Promise<void>, generation: 'v1' | 'v2' = 'v2') => {
    let events: ServerResponse | null = null;
    const wire: RequestFixture['wire'] = { forms: [], permissions: [], agents: [], replyStatus: 204 };
    const relay: RequestFixture['relay'] = {};
    const nativeWrites: RequestFixture['nativeWrites'] = [];
    const relayMessages: unknown[] = [];
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (generation === 'v1') {
        if (url.pathname === '/global/health') sendJson(response, { healthy: true, version: '1.18.33' });
        else if (url.pathname === '/event') {
          events = response;
          response.writeHead(200, { 'content-type': 'text/event-stream' });
          response.write('data: ' + JSON.stringify({ type: 'server.connected', properties: {} }) + '\n\n');
        } else if (url.pathname === '/question') sendJson(response, wire.forms);
        else if (url.pathname === '/permission') sendJson(response, wire.permissions);
        else if (url.pathname.startsWith('/question/') || url.pathname.startsWith('/permission/')) {
          nativeWrites.push({ method: request.method ?? '', path: url.pathname });
          sendJson(response, false);
        } else if (url.pathname === '/session/' + nativeSessionId) sendJson(response, { id: nativeSessionId, directory });
        else sendJson(response, []);
        return;
      }
      if (url.pathname === '/api/info') sendJson(response, { version: '2.0.15', pid: process.pid, urls: [], paths: {} });
      else if (url.pathname === '/api/event') {
        events = response;
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write('data: ' + JSON.stringify({ type: 'server.connected', data: {} }) + '\n\n');
      } else if (url.pathname === '/api/form') {
        if (wire.formInventory) wire.formInventory(response);
        else sendJson(response, { data: wire.forms });
      } else if (url.pathname === '/api/agent') sendJson(response, { data: wire.agents });
      else if (url.pathname === '/api/permission/request') sendJson(response, { data: wire.permissions });
      else if (url.pathname.includes('/form/') || url.pathname.includes('/permission/')) {
        if (request.method !== 'GET') nativeWrites.push({ method: request.method ?? '', path: url.pathname });
        if (wire.nativeResponse) wire.nativeResponse(request, response);
        else if (wire.replyStatus === 204) response.writeHead(204).end();
        else sendJson(response, { message: 'fixture-private-native-answer' }, wire.replyStatus);
      } else if (url.pathname.endsWith('/message')) {
        if (wire.messages) wire.messages(response);
        else sendJson(response, { data: [], cursor: {} });
      } else if (url.pathname.endsWith('/messages')) sendJson(response, { messages: [], hasMore: false });
      else if (url.pathname === '/api/session/' + nativeSessionId) sendJson(response, { data: { id: nativeSessionId, location: { directory } } });
      else sendJson(response, { data: [] });
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = 'http://127.0.0.1:' + (server.address() as AddressInfo).port;
    await withConfiguredDaemonTestHome({ prefix: 'opencode-request-retirement-', env: {
      HAPPIER_SERVER_URL: baseUrl, HAPPIER_SERVER_URL_LOCAL: baseUrl, HAPPIER_PUBLIC_SERVER_URL: baseUrl,
    } }, async () => {
      // Only provider HTTP/SSE and relay transport/ACK are controlled. All request owners are real.
      const socket = createApiSessionSocketStub({ connected: true, emit: (event, args) => {
        if (event === 'ping' && typeof args[0] === 'function') args[0]();
      }, emitWithAck: (event, payload) => {
        const body = payload as Record<string, unknown>;
        if (event === 'message') relayMessages.push(body.message);
        if (event === 'update-metadata' || event === 'update-state') {
          const ack = { result: 'success', metadata: body.metadata, agentState: body.agentState,
            version: Number(body.expectedVersion) + 1 };
          const state = event === 'update-state' && typeof body.agentState === 'string'
            ? JSON.parse(body.agentState) as { completedRequests?: Record<string, { status?: string }> }
            : null;
          if (relay.holdRequestId && state?.completedRequests?.[relay.holdRequestId]?.status === 'approved') {
            relay.holdRequestId = undefined;
            return new Promise((resolve) => { relay.releaseAck = () => resolve(ack); });
          }
          const metadata = event === 'update-metadata' && typeof body.metadata === 'string'
            ? JSON.parse(body.metadata) as { sessionModesV1?: { availableModes?: Array<{ id: string }> } }
            : null;
          if (relay.holdModeId && metadata?.sessionModesV1?.availableModes?.some((mode) => mode.id === relay.holdModeId)) {
            relay.holdModeId = undefined;
            return new Promise((resolve) => {
              relay.releaseMetadataAck = () => {
                relay.releaseMetadataAck = undefined;
                resolve(ack);
              };
            });
          }
          return ack;
        }
        return resolveApiSessionSocketDefaultAck(event, payload);
      } });
      bindApiSessionSocketMock(mockIo, socket);
      const session = new ApiSessionClient('synthetic-token', createPlainSessionFixture({ id: 'happy_request_retirement' }));
      const permissionHandler = new ProviderEnforcedPermissionHandler(session, { logPrefix: '[test]' });
      const env = { ...process.env, HAPPIER_OPENCODE_CLI_GENERATION: generation, HAPPIER_OPENCODE_SERVER_STATUS_POLL_ENABLED: '0' };
      const runtime = createOpenCodeServerRuntime({ directory, env, session, messageBuffer: new MessageBuffer(), mcpServers: {},
        happierMcpAdmission: { kind: 'not_available_for_execution_run' }, permissionHandler,
        onThinkingChange: () => {}, getPermissionMode: () => 'default' }, {
        createClient: () => createOpenCodeServerRuntimeClient({ directory, baseUrlOverride: baseUrl, env, messageBuffer: new MessageBuffer() }),
      });
      try {
        await runtime.startOrLoad({ resumeId: nativeSessionId });
        await expect.poll(() => events).not.toBeNull();
        await run({ session, permissionHandler, wire, relay, nativeWrites, relayMessages,
          restart: async () => {
            const previousEvents = events;
            await runtime.reset();
            await runtime.startOrLoad({ resumeId: nativeSessionId });
            await expect.poll(() => events !== previousEvents).toBe(true);
          },
          emit: (type, data, location) => events?.write('data: ' + JSON.stringify(generation === 'v2'
            ? { type, data, location } : { type, properties: data }) + '\n\n'),
          reconnect: () => { events?.end(); },
        });
      } finally {
        relay.releaseAck?.();
        relay.releaseMetadataAck?.();
        // Release controlled HTTP boundaries before disposing the real client.
        wire.formInventory = undefined;
        wire.nativeResponse = undefined;
        wire.messages = undefined;
        permissionHandler.reset();
        await runtime.reset();
        await session.close();
        server.closeAllConnections();
      }
    });
  };

  const joinNativeWaiter = async (fixture: RequestFixture, id: string) => {
    await expect.poll(() => fixture.session.getAgentStateSnapshot()?.requests?.[id]).toBeDefined();
    const request = fixture.session.getAgentStateSnapshot()!.requests![id]!;
    const waiter = fixture.permissionHandler.handleToolCall(id, request.tool, request.arguments);
    let settled: Awaited<typeof waiter> | undefined;
    void waiter.then((decision) => { settled = decision; }).catch(() => {});
    void waiter.catch(() => {});
    // Wrap so this helper does not await the pending decision.
    return { waiter, settlement: () => settled };
  };

  const drainNativeEvents = async (fixture: RequestFixture, marker: string) => {
    const mode = { id: marker, name: marker };
    fixture.wire.agents = [mode];
    fixture.emit('agent.updated', {}, { directory });
    await expect.poll(() => fixture.session.getMetadataSnapshot()?.sessionModesV1?.availableModes).toContainEqual(mode);
    await fixture.session.flush();
  };

  const nativeRequestFailureCountSince = (offset: number) => {
    logger.flushSync();
    return readFileSync(logger.getLogPath(), 'utf8').slice(offset).split('opencode_native_request_failed').length - 1;
  };

  const taskStartedCount = (fixture: RequestFixture) => fixture.relayMessages
    .filter((message) => JSON.stringify(message).includes('"type":"task_started"')).length;

  const invalidNativeForm = () => {
    const form = nativeForm();
    // Native text reaches the real shared question validator; no internal handler is stubbed.
    form.fields[0]!.title = 'x'.repeat(STRUCTURED_QUESTION_LIMITS.maxStringLength + 1);
    return form;
  };

  it('tc-ach.31 retries fail-closed rejection until native acknowledgement without duplicating the request', async () => {
    await withNativeRequests(async (fixture) => {
      const form = invalidNativeForm();
      const deliveries: ServerResponse[] = [];
      fixture.wire.forms = [form];
      fixture.wire.nativeResponse = (_request, response) => { deliveries.push(response); };
      const logStart = existsSync(logger.getLogPath()) ? readFileSync(logger.getLogPath(), 'utf8').length : 0;
      try {
        fixture.emit('form.created', { form });
        await expect.poll(() => deliveries.length).toBe(1);
        fixture.emit('form.created', { form });
        await drainNativeEvents(fixture, 'rejection-pending');
        expect(deliveries).toHaveLength(1);
        expect(fixture.session.getAgentStateSnapshot()?.requests?.[form.id]).toBeUndefined();
        expect(taskStartedCount(fixture)).toBe(1);

        sendJson(deliveries[0]!, {}, 503);
        await expect.poll(() => nativeRequestFailureCountSince(logStart)).toBe(1);
        fixture.emit('form.created', { form });
        await expect.poll(() => deliveries.length).toBe(2);
        fixture.emit('form.created', { form });
        await drainNativeEvents(fixture, 'rejection-retry-pending');
        expect(deliveries).toHaveLength(2);
        expect(fixture.wire.forms).toEqual([form]);

        // The provider accepts cancellation only on this second delivery.
        fixture.wire.forms = [];
        deliveries[1]!.writeHead(204).end();
        await drainNativeEvents(fixture, 'rejection-accepted');
        fixture.emit('form.created', { form });
        await drainNativeEvents(fixture, 'rejection-duplicate');
        expect(deliveries).toHaveLength(2);
        expect(taskStartedCount(fixture)).toBe(1);
        expect(fixture.nativeWrites).toEqual([0, 1].map(() => ({
          method: 'DELETE', path: '/api/session/' + nativeSessionId + '/form/' + form.id,
        })));
        expect(fixture.session.getAgentStateSnapshot()?.requests?.[form.id]).toBeUndefined();
      } finally {
        for (const response of deliveries) if (!response.writableEnded) sendJson(response, {}, 503);
      }
    });
  });

  it.each(['resolve', 'reject', 'settled failure'] as const)(
    'tc-ach.31 fences fail-closed rejection across reset with the same native key (%s)', async (retiredOutcome) => {
      await withNativeRequests(async (fixture) => {
        const form = invalidNativeForm();
        const deliveries: ServerResponse[] = [];
        fixture.wire.forms = [form];
        fixture.wire.nativeResponse = (_request, response) => { deliveries.push(response); };
        const logStart = existsSync(logger.getLogPath()) ? readFileSync(logger.getLogPath(), 'utf8').length : 0;
        try {
          fixture.emit('form.created', { form });
          await expect.poll(() => deliveries.length).toBe(1);
          if (retiredOutcome === 'settled failure') {
            sendJson(deliveries[0]!, {}, 503);
            await expect.poll(() => nativeRequestFailureCountSince(logStart)).toBe(1);
            // Clearing unsettled rejection intent must let a fresh valid request reach the owner.
            const successor = nativeForm();
            fixture.wire.forms = [successor];
            await fixture.restart();
            fixture.emit('form.created', { form: successor });
            const successorWaiter = await joinNativeWaiter(fixture, successor.id);
            expect(successorWaiter.settlement()).toBeUndefined();
            expect(deliveries).toHaveLength(1);
            return;
          }

          await fixture.restart();
          fixture.emit('form.created', { form });
          await expect.poll(() => deliveries.length).toBe(2);
          if (retiredOutcome === 'resolve') deliveries[0]!.writeHead(204).end();
          else sendJson(deliveries[0]!, {}, 503);
          await drainNativeEvents(fixture, 'retired-rejection-settled');
          fixture.emit('form.created', { form });
          await drainNativeEvents(fixture, 'new-rejection-still-pending');
          expect(deliveries).toHaveLength(2);

          const failuresBeforeRetry = nativeRequestFailureCountSince(logStart);
          sendJson(deliveries[1]!, {}, 503);
          await expect.poll(() => nativeRequestFailureCountSince(logStart)).toBe(failuresBeforeRetry + 1);
          fixture.emit('form.created', { form });
          await expect.poll(() => deliveries.length).toBe(3);
          fixture.wire.forms = [];
          deliveries[2]!.writeHead(204).end();
          await drainNativeEvents(fixture, 'new-rejection-accepted');
          fixture.emit('form.created', { form });
          await drainNativeEvents(fixture, 'new-rejection-duplicate');
          expect(deliveries).toHaveLength(3);
          // Retired completion must neither release the successor's in-flight guard nor erase
          // its retry intent and cause a second user-action lifecycle to be published.
          expect(taskStartedCount(fixture)).toBe(2);
          expect(fixture.nativeWrites.every((write) => write.method === 'DELETE'
            && write.path === '/api/session/' + nativeSessionId + '/form/' + form.id)).toBe(true);
          expect(fixture.session.getAgentStateSnapshot()?.requests?.[form.id]).toBeUndefined();
        } finally {
          for (const response of deliveries) if (!response.writableEnded) sendJson(response, {}, 503);
        }
      });
    },
  );

  it('tc-ach.31 applies duplicate V2 permission and form frames through one shared pending owner', async () => {
    await withNativeRequests(async (fixture) => {
      await drainNativeEvents(fixture, 'before-streamed-requests');
      const form = nativeForm();
      const permission = nativePermission();
      const replies: Array<{ path: string; body: Record<string, unknown> }> = [];
      fixture.wire.nativeResponse = (request, response) => {
        void readJsonBody(request).then((body) => {
          replies.push({ path: request.url ?? '', body });
          response.writeHead(204).end();
        }).catch(() => response.writeHead(400).end());
      };
      const emitRequests = () => {
        fixture.emit('form.created', { form });
        fixture.emit('permission.asked', permission);
      };
      emitRequests();
      const questionWaiter = await joinNativeWaiter(fixture, form.id);
      const permissionWaiter = await joinNativeWaiter(fixture, permission.source.id);
      // Admission above must come from SSE, before inventories contain either request.
      fixture.wire.forms = [form];
      fixture.wire.permissions = [permission];
      emitRequests();
      await drainNativeEvents(fixture, 'duplicate-requests-pending');
      expect(Object.keys(fixture.session.getAgentStateSnapshot()?.requests ?? {}).sort())
        .toEqual([form.id, permission.source.id].sort());
      expect(fixture.nativeWrites).toEqual([]);
      await fixture.session.rpcHandlerManager.invokeLocal('permission', {
        id: form.id, approved: true, answers: { Choice: 'Remote', 'Fixture text': 'remote-text' },
      });
      await fixture.session.rpcHandlerManager.invokeLocal('permission', { id: permission.source.id, approved: true });
      await expect(questionWaiter.waiter).resolves.toMatchObject({ decision: 'approved' });
      await expect(permissionWaiter.waiter).resolves.toMatchObject({ decision: 'approved' });
      await expect.poll(() => fixture.nativeWrites.length).toBe(2);
      emitRequests();
      await drainNativeEvents(fixture, 'duplicate-requests-completed');
      expect(fixture.nativeWrites).toEqual(expect.arrayContaining([
        { method: 'POST', path: '/api/session/' + nativeSessionId + '/form/' + form.id + '/reply' },
        { method: 'POST', path: '/api/session/' + nativeSessionId + '/permission/' + permission.id + '/reply' },
      ]));
      expect(fixture.nativeWrites).toHaveLength(2);
      expect(replies).toEqual(expect.arrayContaining([
        { path: '/api/session/' + nativeSessionId + '/form/' + form.id + '/reply',
          body: { answer: { choice: 'remote', note: 'remote-text' } } },
        { path: '/api/session/' + nativeSessionId + '/permission/' + permission.id + '/reply',
          body: { decision: 'once' } },
      ]));
      expect(fixture.session.getAgentStateSnapshot()?.requests?.[form.id]).toBeUndefined();
      expect(fixture.session.getAgentStateSnapshot()?.requests?.[permission.source.id]).toBeUndefined();
    });
  });

  it.each([
    { kind: 'question', boundary: 'native cancellation', child: false },
    { kind: 'question', boundary: 'relay acknowledgement pending', child: false },
    { kind: 'question', boundary: 'local reply', child: true },
    { kind: 'permission', boundary: 'local reply', child: false },
    { kind: 'permission', boundary: 'child termination', child: true },
    { kind: 'question', boundary: 'reconnect inventory', child: false },
    { kind: 'permission', boundary: 'reconnect inventory', child: false },
  ] as const)('tc-ach.31 retires only the exact $kind ($boundary, child=$child)', async ({ kind, boundary, child }) => {
    await withNativeRequests(async (fixture) => {
      const { session, wire, emit, relay, nativeWrites } = fixture;
      const targetSession = child ? 'ses_child' : nativeSessionId;
      const form = nativeForm(targetSession);
      const permission = nativePermission(targetSession);
      const localId = kind === 'question' ? form.id : permission.source.id;
      const nativeId = kind === 'question' ? form.id : permission.id;
      if (child) emit('session.tool.progress', {
        sessionID: nativeSessionId, assistantMessageID: 'msg_parent', id: 'call_subagent', name: 'subagent',
        input: { background: true }, metadata: { sessionID: targetSession, status: 'running' },
      });
      if (kind === 'question') {
        wire.forms = [form];
        emit('form.created', { form });
      } else {
        wire.permissions = [permission];
        emit('permission.asked', permission);
      }
      const { waiter, settlement } = await joinNativeWaiter(fixture, localId);
      // A same-session native neighbor survives terminal events and directory lifecycle refreshes.
      const neighbor = nativeForm(nativeSessionId, 'frm_neighbor');
      wire.forms.push(neighbor);
      emit('form.created', { form: neighbor });
      await joinNativeWaiter(fixture, neighbor.id);
      await session.flush();
      emit(kind === 'question' ? 'form.cancelled' : 'permission.replied', kind === 'question'
        ? { id: nativeId, sessionID: 'ses_unrelated' }
        : { requestID: nativeId, sessionID: 'ses_unrelated', reply: 'reject' });
      emit('location.shutdown', {}, { directory });
      const scopeBarrier = nativeForm(nativeSessionId, 'frm_scope_barrier');
      wire.forms.push(scopeBarrier);
      emit('form.created', { form: scopeBarrier });
      await joinNativeWaiter(fixture, scopeBarrier.id);
      expect(session.getAgentStateSnapshot()?.requests?.[localId]).toBeDefined();

      let response: Promise<unknown> | undefined;
      if (boundary === 'relay acknowledgement pending') {
        relay.holdRequestId = localId;
        response = session.rpcHandlerManager.invokeLocal('permission', {
          id: localId, approved: true, answers: { Choice: 'Remote', 'Fixture text': 'remote-text' },
        });
        void response.catch(() => {});
        await expect.poll(() => relay.releaseAck).toBeDefined();
      }
      if (boundary === 'reconnect inventory') {
        wire.forms = [neighbor, scopeBarrier];
        wire.permissions = [];
        fixture.reconnect();
      }
      else if (boundary === 'child termination') emit('session.execution.succeeded', { sessionID: targetSession });
      else {
        emit(kind === 'question' ? (boundary === 'local reply' ? 'form.replied' : 'form.cancelled') : 'permission.replied',
          kind === 'question'
            ? { id: nativeId, sessionID: targetSession, ...(boundary === 'local reply' ? { answer: { choice: 'local', note: 'local-text' } } : {}) }
            : { requestID: nativeId, sessionID: targetSession, reply: 'once' });
        emit('location.shutdown', {}, { directory });
      }
      // Native retirement must settle before a held relay ACK can complete.
      // Event cases retain the old inventory row until settlement: a refresh must not mask
      // missing form/permission terminal-event wiring.
      await expect.poll(settlement).toEqual({ decision: 'abort' });
      await expect(waiter).resolves.toEqual({ decision: 'abort' });
      wire.forms = [neighbor, scopeBarrier];
      wire.permissions = [];
      relay.releaseAck?.();
      await response?.catch(() => {});
      await expect.poll(() => session.getAgentStateSnapshot()?.completedRequests?.[localId]).toMatchObject({ status: 'canceled' });
      expect(session.getAgentStateSnapshot()?.requests?.[localId]).toBeUndefined();
      expect(session.getAgentStateSnapshot()?.requests?.[neighbor.id]).toBeDefined();
      const late = session.rpcHandlerManager.invokeLocal('permission', {
        id: localId, approved: true, ...(kind === 'question' ? { answers: { Choice: 'Remote', 'Fixture text': 'late-text' } } : {}),
      });
      if (kind === 'question') await expect(late).rejects.toThrow();
      else await expect(late).resolves.toMatchObject({ ok: false });
      expect(nativeWrites).toEqual([]);
    });
  });

  it.each(['reconnect', 'agent.updated'] as const)(
    'tc-ach.31 retires a native form while catalog metadata ACK is pending (%s)', async (trigger) => {
      await withNativeRequests(async (fixture) => {
        const { wire, relay, session, emit, nativeWrites } = fixture;
        const form = nativeForm();
        const neighbor = nativeForm(nativeSessionId, 'frm_metadata_ack_neighbor');
        // Keep both rows in every inventory so only the terminal event can retire the form.
        wire.forms = [form, neighbor];
        emit('form.created', { form });
        const { settlement } = await joinNativeWaiter(fixture, form.id);
        emit('form.created', { form: neighbor });
        const neighborWaiter = await joinNativeWaiter(fixture, neighbor.id);
        await session.flush();

        // A new native mode identifies the real catalog publication, excluding unrelated metadata writes.
        const mode = { id: 'metadata-ack-fixture', name: 'Metadata ACK fixture' };
        wire.agents = [mode];
        relay.holdModeId = mode.id;
        if (trigger === 'reconnect') fixture.reconnect();
        else emit(trigger, {}, { directory });
        await expect.poll(() => relay.releaseMetadataAck).toBeDefined();
        expect(session.getMetadataSnapshot()?.sessionModesV1?.availableModes).not.toContainEqual(mode);

        try {
          emit('form.cancelled', { id: form.id, sessionID: nativeSessionId });
          // This must settle while the catalog producer is still awaiting its relay ACK.
          await expect.poll(settlement).toEqual({ decision: 'abort' });
          await expect.poll(() => session.getAgentStateSnapshot()?.completedRequests?.[form.id]).toMatchObject({ status: 'canceled' });
          expect(session.getAgentStateSnapshot()?.requests?.[form.id]).toBeUndefined();
          expect(session.getAgentStateSnapshot()?.requests?.[neighbor.id]).toBeDefined();
          expect(neighborWaiter.settlement()).toBeUndefined();
          expect(relay.releaseMetadataAck).toBeDefined();
          expect(nativeWrites).toEqual([]);
        } finally {
          relay.releaseMetadataAck?.();
          // Drain the real publication and queued cancellation even when the pre-ACK assertion fails.
          await expect.poll(() => session.getMetadataSnapshot()?.sessionModesV1?.availableModes).toContainEqual(mode);
          await expect.poll(settlement).toEqual({ decision: 'abort' });
          await session.flush();
        }
      });
    },
  );

  it('tc-ach.31 ignores stale inventory rows and preserves a request created during the read', async () => {
    await withNativeRequests(async (fixture) => {
      const { wire, emit, session } = fixture;
      const form = nativeForm();
      wire.forms = [form];
      emit('form.created', { form });
      const { settlement } = await joinNativeWaiter(fixture, form.id);
      let pendingInventory: ServerResponse | undefined;
      wire.formInventory = (response) => { pendingInventory = response; };
      fixture.reconnect();
      await expect.poll(() => pendingInventory).toBeDefined();
      try {
        emit('form.cancelled', { id: form.id, sessionID: nativeSessionId });
        await expect.poll(settlement).toEqual({ decision: 'abort' });
        const neighbor = nativeForm(nativeSessionId, 'frm_new_during_inventory');
        emit('form.created', { form: neighbor });
        await joinNativeWaiter(fixture, neighbor.id);
        // The old response both contains a retired row and omits the new live row.
        wire.formInventory = undefined;
        sendJson(pendingInventory!, { data: [form] });
        // A following authoritative inventory provides an observable completion barrier.
        wire.forms = [neighbor, nativeForm(nativeSessionId, 'frm_inventory_barrier')];
        fixture.reconnect();
        await joinNativeWaiter(fixture, 'frm_inventory_barrier');
        expect(session.getAgentStateSnapshot()?.requests?.[form.id]).toBeUndefined();
        expect(session.getAgentStateSnapshot()?.requests?.[neighbor.id]).toBeDefined();
        expect(fixture.nativeWrites).toEqual([]);
      } finally {
        if (!pendingInventory?.writableEnded) pendingInventory?.end();
      }
    });
  });

  it('tc-ach.31 fences cancellation while permission tool lookup is pending', async () => {
    await withNativeRequests(async (fixture) => {
      let lookup: ServerResponse | undefined;
      fixture.wire.messages = (response) => { lookup = response; };
      const permission = nativePermission();
      fixture.wire.permissions = [permission];
      fixture.emit('permission.asked', permission);
      await expect.poll(() => lookup).toBeDefined();
      try {
        fixture.emit('permission.replied', { sessionID: nativeSessionId, requestID: permission.id, reply: 'reject' });
        fixture.wire.permissions = [];
        const barrier = nativeForm(nativeSessionId, 'frm_after_terminal_event');
        fixture.emit('form.created', { form: barrier });
        await joinNativeWaiter(fixture, barrier.id);
        fixture.wire.messages = undefined;
        sendJson(lookup!, { data: [], cursor: {} });
        // Drain the provider read and real publication queue via a fresh inventory request.
        fixture.wire.forms = [barrier, nativeForm(nativeSessionId, 'frm_lookup_barrier')];
        fixture.reconnect();
        await joinNativeWaiter(fixture, 'frm_lookup_barrier');
        expect(fixture.session.getAgentStateSnapshot()?.requests?.[permission.source.id]).toBeUndefined();
        expect(fixture.nativeWrites).toEqual([]);
      } finally {
        if (!lookup?.writableEnded) lookup?.end();
      }
    });
  });

  it.each(['question', 'permission'] as const)('tc-ach.31 exposes failed native %s application without replaying it', async (kind) => {
    await withNativeRequests(async (fixture) => {
      const form = nativeForm();
      const permission = nativePermission();
      const localId = kind === 'question' ? form.id : permission.source.id;
      fixture.wire.forms = kind === 'question' ? [form] : [];
      fixture.wire.permissions = kind === 'permission' ? [permission] : [];
      fixture.wire.replyStatus = 404;
      const logStart = existsSync(logger.getLogPath()) ? readFileSync(logger.getLogPath(), 'utf8').length : 0;
      fixture.emit(kind === 'question' ? 'form.created' : 'permission.asked', kind === 'question' ? { form } : permission);
      await joinNativeWaiter(fixture, localId);
      // This ACK completes the projection; it does not certify native application.
      await fixture.session.rpcHandlerManager.invokeLocal('permission', {
        id: localId, approved: true, ...(kind === 'question' ? { answers: { Choice: 'Remote', 'Fixture text': 'remote-text' } } : {}),
      });
      await expect.poll(() => {
        logger.flushSync();
        return readFileSync(logger.getLogPath(), 'utf8').slice(logStart);
      }).toContain('opencode_native_request_failed');
      const diagnostic = readFileSync(logger.getLogPath(), 'utf8').slice(logStart);
      expect(diagnostic).not.toContain('fixture-private-native-answer');
      await fixture.session.flush();
      const messages = JSON.stringify(fixture.relayMessages);
      expect(messages).toContain('OpenCode did not confirm');
      expect(messages).not.toContain('tool-result');
      // Reconnect must not turn the cached remote decision into an automatic retry.
      fixture.wire.forms.push(nativeForm(nativeSessionId, 'frm_failure_barrier'));
      fixture.reconnect();
      await joinNativeWaiter(fixture, 'frm_failure_barrier');
      expect(fixture.nativeWrites).toHaveLength(1);
    });
  });

  it('tc-ach.31 preserves V1 terminal identities and treats a false native reply as failure', async () => {
    await withNativeRequests(async (fixture) => {
      const question = { id: 'q_v1', sessionID: nativeSessionId,
        questions: [{ question: 'Continue?', header: 'Continue', options: [] }] };
      fixture.wire.forms = [question];
      fixture.emit('question.asked', question);
      const { settlement } = await joinNativeWaiter(fixture, question.id);
      fixture.emit('question.rejected', { sessionID: nativeSessionId, requestID: question.id });
      await expect.poll(settlement).toEqual({ decision: 'abort' });
      expect(fixture.nativeWrites).toEqual([]);

      const permission = { id: 'p_v1', sessionID: nativeSessionId, permission: 'bash', patterns: ['pwd'], always: [],
        metadata: { command: 'pwd' }, tool: { callID: 'call_v1', messageID: 'msg_v1' } };
      fixture.wire.forms = [];
      fixture.wire.permissions = [permission];
      const logStart = existsSync(logger.getLogPath()) ? readFileSync(logger.getLogPath(), 'utf8').length : 0;
      fixture.emit('permission.asked', permission);
      await joinNativeWaiter(fixture, permission.tool.callID);
      await fixture.session.rpcHandlerManager.invokeLocal('permission', { id: permission.tool.callID, approved: true });
      await expect.poll(() => {
        logger.flushSync();
        return readFileSync(logger.getLogPath(), 'utf8').slice(logStart);
      }).toContain('opencode_native_request_failed');
      expect(fixture.nativeWrites).toEqual([{ method: 'POST', path: '/permission/p_v1/reply' }]);
    }, 'v1');
  });

  it('tc-ach.31 keeps live requests on incomplete inventory and still applies a current answer', async () => {
    await withNativeRequests(async (fixture) => {
      const form = nativeForm();
      fixture.wire.forms = [form];
      fixture.emit('form.created', { form });
      const { settlement } = await joinNativeWaiter(fixture, form.id);
      const logStart = existsSync(logger.getLogPath()) ? readFileSync(logger.getLogPath(), 'utf8').length : 0;
      fixture.wire.formInventory = (response) => sendJson(response, { data: [{}] });
      fixture.reconnect();
      await expect.poll(() => {
        logger.flushSync();
        return readFileSync(logger.getLogPath(), 'utf8').slice(logStart);
      }).toContain('opencode_request_inventory_failed');
      expect(settlement()).toBeUndefined();
      expect(fixture.session.getAgentStateSnapshot()?.requests?.[form.id]).toBeDefined();
      await fixture.session.rpcHandlerManager.invokeLocal('permission', {
        id: form.id, approved: true, answers: { Choice: 'Remote', 'Fixture text': 'remote-text' },
      });
      await expect.poll(() => fixture.nativeWrites.length).toBe(1);
      await expect.poll(() => JSON.stringify(fixture.relayMessages)).toContain('tool-result');
      expect(fixture.nativeWrites[0]).toEqual({ method: 'POST', path: '/api/session/' + nativeSessionId + '/form/' + form.id + '/reply' });
    });
  });

  it.each(['history', 'sidechain'] as const)('commits distinct opaque import identities without losing messages ($0)', async (kind) => {
    const server = createServer((_request, response) => sendJson(response, { messages: [], hasMore: false }));
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await withConfiguredDaemonTestHome({ prefix: 'opencode-import-identities-',
      env: { HAPPIER_SERVER_URL: baseUrl, HAPPIER_SERVER_URL_LOCAL: baseUrl, HAPPIER_PUBLIC_SERVER_URL: baseUrl } }, async () => {
      const committed = new Map<string, unknown>();
      const socket = createApiSessionSocketStub({ connected: true, emitWithAck: (event, payload) => {
        if (event !== 'message') return resolveApiSessionSocketDefaultAck(event, payload);
        const body = payload as Record<string, unknown>;
        const localId = String(body.localId);
        // The released relay deduplicates committed messages by Session/localId.
        if (!committed.has(localId)) committed.set(localId, body.message);
        return { ok: true, id: localId, seq: committed.size, localId };
      } });
      bindApiSessionSocketMock(mockIo, socket);
      const session = new ApiSessionClient('synthetic-token', createPlainSessionFixture({ id: 'import-identity-session' }));
      try {
        for (const [remoteSessionId, messageId] of [['sid:a', 'mid'], ['sid', 'a:mid']]) {
          await importOpenCodeTextHistoryCommitted({ session, provider: 'opencode', remoteSessionId,
            importedFrom: kind === 'history' ? 'acp-history' : 'acp-sidechain',
            ...(kind === 'sidechain' ? { sidechainId: 'branch' } : {}),
            items: [{ messageId, role: 'assistant', createdAtMs: 1, text: `${remoteSessionId}/${messageId}` }] });
        }
        expect(committed.size).toBe(2);
        if (kind === 'sidechain') {
          for (const [sidechainId, messageId] of [['branch:a', 'mid'], ['branch', 'a:mid']]) {
            await importOpenCodeTextHistoryCommitted({ session, provider: 'opencode', remoteSessionId: 'another',
              importedFrom: 'acp-sidechain', sidechainId,
              items: [{ messageId, role: 'assistant', createdAtMs: 1, text: `${sidechainId}/${messageId}` }] });
          }
          expect(committed.size).toBe(4);
        }
      } finally { await session.close(); }
    });
  });

  it('preserves a released ambiguous sidechain import when its exact identities are witnessed', async () => {
    const legacyId = 'opencode:import:sidechain:sid:branch:a:mid';
    const writes: string[] = [];
    const server = createServer((_request, response) => sendJson(response, { messages: [{ seq: 1, localId: legacyId,
      sidechainId: 'branch:a', content: { t: 'plain', v: { role: 'agent',
        content: { type: 'acp', provider: 'opencode', data: { type: 'message', message: 'saved answer', sidechainId: 'branch:a' } },
        meta: { importedFrom: 'acp-sidechain', remoteSessionId: 'sid', sidechainId: 'branch:a' } } } },
      { seq: 2, localId: 'opencode:import:sidechain:sid:branch:a:user-mid',
        content: { t: 'plain', v: { role: 'user', content: { type: 'text', text: 'saved prompt' },
          meta: { importedFrom: 'acp-sidechain', remoteSessionId: 'sid', sidechainId: 'branch:a' } } } }], hasMore: false }));
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await withConfiguredDaemonTestHome({ prefix: 'opencode-sidechain-identities-',
      env: { HAPPIER_SERVER_URL: baseUrl, HAPPIER_SERVER_URL_LOCAL: baseUrl, HAPPIER_PUBLIC_SERVER_URL: baseUrl } }, async () => {
      const socket = createApiSessionSocketStub({ connected: true, emitWithAck: (event, payload) => {
        if (event !== 'message') return resolveApiSessionSocketDefaultAck(event, payload);
        const body = payload as Record<string, unknown>;
        writes.push(String(body.localId));
        return { ok: true, id: String(body.localId), seq: writes.length + 1, localId: body.localId };
      } });
      bindApiSessionSocketMock(mockIo, socket);
      const session = new ApiSessionClient('synthetic-token', createPlainSessionFixture({ id: 'retained-sidechain' }));
      try {
        await importOpenCodeTextHistoryCommitted({ session, provider: 'opencode', remoteSessionId: 'sid',
          importedFrom: 'acp-sidechain', sidechainId: 'branch:a',
          items: [{ messageId: 'mid', role: 'assistant', createdAtMs: 1, text: 'saved answer' },
            { messageId: 'user-mid', role: 'user', createdAtMs: 1, text: 'saved prompt' }] });
        expect(writes).toEqual([]);
        // This tuple had the same legacy string, but is a different branch/message.
        await importOpenCodeTextHistoryCommitted({ session, provider: 'opencode', remoteSessionId: 'sid',
          importedFrom: 'acp-sidechain', sidechainId: 'branch',
          items: [{ messageId: 'a:mid', role: 'assistant', createdAtMs: 1, text: 'different answer' }] });
        expect(writes).toHaveLength(1);
      } finally { await session.close(); }
    });
  });

  it.each([
    { storage: 'plain' as const, legacyGap: false, baselineFailure: false },
    { storage: 'e2ee' as const, legacyGap: false, baselineFailure: false },
    { storage: 'plain' as const, legacyGap: true, baselineFailure: false },
    { storage: 'plain' as const, legacyGap: false, baselineFailure: true },
    { storage: 'plain' as const, legacyGap: false, baselineFailure: 'malformed-page' as const },
    { storage: 'plain' as const, legacyGap: false, baselineFailure: false, malformedNative: true },
  ])('reconciles exact committed identities on cold resume ($storage, legacyGap=$legacyGap, baselineFailure=$baselineFailure, malformedNative=$malformedNative)', async ({ storage, legacyGap, baselineFailure, malformedNative }) => {
    const directory = '/tmp/opencode-cold-resume';
    const nativeSessionId = 'ses_cold:opaque';
    const happySessionId = 'happy_cold_resume';
    const key = new Uint8Array(32).fill(7);
    let events: ServerResponse | null = null;
    let reads = 0;
    let connections = 0;
    let baselineUnavailable = baselineFailure;
    let nativeUnavailable = malformedNative === true;
    const committed: Array<Record<string, unknown>> = [];
    const durable: Array<{ seq: number; localId: string; createdAt: number; content: unknown }> = [];
    const encode = (value: unknown): unknown => storage === 'plain'
      ? { t: 'plain', v: value }
      : { t: 'encrypted', c: encodeBase64(encrypt(key, 'dataKey', value)) };
    const addDurable = (localId: string, value: unknown): void => {
      durable.push({ seq: durable.length + 1, localId, createdAt: durable.length + 1, content: encode(value) });
    };
    addDurable('ui-local', { role: 'user', content: { type: 'text', text: 'already committed UI prompt' } });
    addDurable('stream-local', { role: 'agent', content: { type: 'acp', provider: 'opencode', data: { type: 'message', message: 'already committed UI answer' } },
      meta: { opencodeMessageId: 'msg_ui_answer', opencodeRemoteSessionId: nativeSessionId } });
    addDurable(`opencode:import:history:${nativeSessionId}:msg_imported:user`, { role: 'user', content: { type: 'text', text: 'already imported prompt' },
      meta: { importedFrom: 'acp-history', remoteSessionId: nativeSessionId, source: 'cli' } });
    addDurable(`opencode:import:history:${nativeSessionId}:msg_imported:answer`, { role: 'agent', content: { type: 'acp', provider: 'opencode', data: { type: 'message', message: 'already imported answer' } },
      meta: { importedFrom: 'acp-history', remoteSessionId: nativeSessionId } });
    // These real transcript rows are not conversation messages and cannot make coverage ambiguous.
    addDurable('tool-local', { role: 'agent', content: { type: 'acp', provider: 'opencode', data: { type: 'tool-call', name: 'read', callId: 'tool-1' } } });
    if (legacyGap) addDurable('legacy-ui', { role: 'user', content: { type: 'text', text: 'unmapped legacy prompt' } });
    const pair = (userId: string, assistantId: string, at: number): unknown[] => [
      { id: userId, type: 'user', sessionID: nativeSessionId, text: userId, time: { created: at } },
      { id: assistantId, type: 'assistant', sessionID: nativeSessionId, parentID: userId,
        content: [{ id: `part_${assistantId}`, type: 'text', text: assistantId }], time: { created: at + 1, completed: at + 2 }, finish: 'stop' },
    ];
    const nativeMessages = [
      ...pair('msg_ui_user', 'msg_ui_answer', 100),
      ...pair('msg_imported:user', 'msg_imported:answer', 200),
      ...pair('msg_missing:user', 'msg_missing:answer', 300),
    ];
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      url.pathname = decodeURIComponent(url.pathname);
      if (url.pathname === '/api/info') sendJson(response, { version: '2.0.20', pid: process.pid, urls: [], paths: {} });
      else if (url.pathname === `/api/session/${nativeSessionId}`) sendJson(response, { data: { id: nativeSessionId, location: { directory } } });
      else if (url.pathname === '/api/event') {
        events = response;
        connections += 1;
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(`data: ${JSON.stringify({ type: 'server.connected', data: {} })}\n\n`);
      } else if (url.pathname === `/api/session/${nativeSessionId}/message`) {
        reads += 1;
        if (nativeUnavailable) { sendJson(response, { messages: [] }); return; }
        sendJson(response, { data: nativeMessages, cursor: {} });
      } else if (url.pathname === `/v1/sessions/${happySessionId}/messages`) {
        if (baselineUnavailable) {
          sendJson(response, { error: 'private baseline response' }, baselineFailure === 'malformed-page' ? 200 : 503);
          return;
        }
        const before = Number(url.searchParams.get('beforeSeq') ?? Number.MAX_SAFE_INTEGER);
        const candidates = durable.filter((row) => row.seq < before).reverse();
        // Genuine HTTP pagination boundary: force two-row pages, not a mocked identity reader.
        const page = candidates.slice(0, 2);
        sendJson(response, { messages: page, hasMore: candidates.length > page.length,
          nextBeforeSeq: candidates.length > page.length ? page[page.length - 1]?.seq : null });
      } else sendJson(response, { data: [] });
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await withConfiguredDaemonTestHome({ prefix: 'opencode-cold-resume-',
      env: { HAPPIER_SERVER_URL: baseUrl, HAPPIER_SERVER_URL_LOCAL: baseUrl, HAPPIER_PUBLIC_SERVER_URL: baseUrl } }, async () => {
      let metadata = createTestMetadata({ flavor: 'opencode', opencodeSessionId: nativeSessionId });
      const metadataWithProviderCorrelation = {
        ...metadata,
        opencodeUserMessageIdMapV1: { v: 1, byLocalId: { 'ui-local': 'msg_ui_user' } },
      };
      metadata = metadataWithProviderCorrelation;
      const socket = createApiSessionSocketStub({ connected: true, emitWithAck: (event, payload) => {
        const body = payload as Record<string, unknown>;
        if (event === 'update-metadata' || event === 'update-state') return { result: 'success', metadata: body.metadata,
          agentState: body.agentState, version: Number(body.expectedVersion) + 1 };
        if (event === 'message') {
          committed.push(body);
          const stored = storage === 'plain' ? body.message : { t: 'encrypted', c: body.message };
          durable.push({ seq: durable.length + 1, localId: String(body.localId), createdAt: durable.length + 1, content: stored });
          return { ok: true, id: `m${durable.length}`, seq: durable.length, localId: body.localId };
        }
        return resolveApiSessionSocketDefaultAck(event, payload);
      } });
      bindApiSessionSocketMock(mockIo, socket);
      const diagnostic = vi.spyOn(logger, 'infoFile').mockImplementation(() => {});
      const fixture: Session = storage === 'plain' ? createPlainSessionFixture({ id: happySessionId, metadata })
        : { ...createPlainSessionFixture({ id: happySessionId, metadata }), encryptionMode: 'e2ee', encryptionKey: key, encryptionVariant: 'dataKey' };
      const session = new ApiSessionClient('synthetic-token', fixture);
      const env = { ...process.env, HAPPIER_OPENCODE_SERVER_STATUS_POLL_ENABLED: '0' };
      let client = await createOpenCodeServerRuntimeClient({ directory, baseUrlOverride: baseUrl, env, messageBuffer: new MessageBuffer() });
      const makeRuntime = () => createOpenCodeServerRuntime({ directory, env, session, messageBuffer: new MessageBuffer(), mcpServers: {},
        happierMcpAdmission: { kind: 'not_available_for_execution_run' }, permissionHandler: new ProviderEnforcedPermissionHandler(session, { logPrefix: '[test]' }),
        onThinkingChange: () => {}, getPermissionMode: () => 'default' }, { createClient: async () => client });
      let runtime = makeRuntime();
      const imported = () => committed.filter((body) => String(body.localId).startsWith('opencode:import:'));
      try {
        await runtime.startOrLoad({ resumeId: nativeSessionId });
        await expect.poll(() => connections).toBe(1);
        if (malformedNative) {
          await expect.poll(() => reads).toBeGreaterThan(0);
          expect(imported()).toHaveLength(0);
          nativeUnavailable = false;
          events?.write(`data: ${JSON.stringify({ type: 'session.execution.succeeded', location: { directory }, data: { sessionID: nativeSessionId } })}\n\n`);
        }
        if (baselineFailure) {
          expect(imported()).toHaveLength(0);
          expect(diagnostic.mock.calls).toEqual(expect.arrayContaining([
            [expect.stringContaining('opencode_history_reconciliation_incomplete'), { reason: 'baseline_read_failed' }],
          ]));
          expect(diagnostic.mock.calls.flat().join(' ')).not.toContain('private baseline response');
          baselineUnavailable = false;
          events?.write(`data: ${JSON.stringify({ type: 'session.execution.succeeded', location: { directory }, data: { sessionID: nativeSessionId } })}\n\n`);
        }
        if (legacyGap) {
          await expect.poll(() => diagnostic.mock.calls.some(([message]) => String(message).includes('opencode_history_reconciliation_incomplete'))).toBe(true);
          expect(imported()).toHaveLength(0);
        } else {
          await expect.poll(() => imported()).toHaveLength(2);
          expect(imported().map((body) => body.localId)).toEqual([
            `opencode:import:v2:${JSON.stringify(['history', nativeSessionId, null, 'msg_missing:user'])}`,
            `opencode:import:v2:${JSON.stringify(['history', nativeSessionId, null, 'msg_missing:answer'])}`,
          ]);
        }
        const readsBeforeIdle = reads;
        events?.write(`data: ${JSON.stringify({ type: 'session.execution.succeeded', location: { directory }, data: { sessionID: nativeSessionId } })}\n\n`);
        await expect.poll(() => reads).toBeGreaterThan(readsBeforeIdle);
        expect(imported()).toHaveLength(legacyGap ? 0 : 2);
        nativeMessages.push(...pair('msg_future:user', 'msg_future:answer', 400));
        events?.write(`data: ${JSON.stringify({ type: 'session.execution.succeeded', location: { directory }, data: { sessionID: nativeSessionId } })}\n\n`);
        await expect.poll(() => imported()).toHaveLength(legacyGap ? 2 : 4);
        expect(imported().slice(-2).map((body) => body.localId)).toEqual([
          `opencode:import:v2:${JSON.stringify(['history', nativeSessionId, null, 'msg_future:user'])}`,
          `opencode:import:v2:${JSON.stringify(['history', nativeSessionId, null, 'msg_future:answer'])}`,
        ]);
        if (!legacyGap) {
          // A second controller lifetime reads committed imports, rather than duplicating the pair.
          await runtime.reset();
          metadata = session.getMetadataSnapshot() ?? metadata;
          client = await createOpenCodeServerRuntimeClient({ directory, baseUrlOverride: baseUrl, env, messageBuffer: new MessageBuffer() });
          runtime = makeRuntime();
          await runtime.startOrLoad({ resumeId: nativeSessionId });
          events?.write(`data: ${JSON.stringify({ type: 'session.execution.succeeded', location: { directory }, data: { sessionID: nativeSessionId } })}\n\n`);
          await expect.poll(() => reads).toBeGreaterThan(readsBeforeIdle + 1);
          expect(imported()).toHaveLength(4);
        }
      } finally {
        diagnostic.mockRestore();
        await runtime.reset();
        await client.dispose();
        await session.close();
        server.closeAllConnections();
      }
    });
  });

  it('commits settled native V2 terminal turns on execution completion without replaying them as prompts', async () => {
    const directory = '/tmp/opencode-native-transcript';
    const nativeSessionId = 'ses_native_transcript';
    let eventResponse: ServerResponse | null = null;
    let messages: unknown[] = [];
    let messageReads = 0;
    let historyUnavailable = false;
    let holdNextHistory = false;
    let releaseHistory: (() => void) | null = null;
    let uiPromptAccepted = false;
    let promptCount = 0;
    let connections = 0;
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/info') {
        sendJson(response, { version: '2.0.20', pid: process.pid, urls: [], paths: {} });
      } else if (url.pathname === '/api/session' && request.method === 'POST') {
        sendJson(response, { data: { id: nativeSessionId, location: { directory } } });
      } else if (url.pathname === '/api/event') {
        eventResponse = response;
        connections += 1;
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(`data: ${JSON.stringify({ type: 'server.connected', data: {} })}\n\n`);
      } else if (url.pathname === `/api/session/${nativeSessionId}/message`) {
        messageReads += 1;
        if (holdNextHistory) {
          holdNextHistory = false;
          const snapshot = [...messages];
          releaseHistory = () => sendJson(response, { data: snapshot, cursor: {} });
        } else if (historyUnavailable) sendJson(response, { error: 'private upstream response must not reach the diagnostic' }, 503);
        else sendJson(response, { data: messages, cursor: {} });
      } else if (url.pathname === '/api/session/ses_child/message') {
        sendJson(response, { data: [{ id: 'msg_child', type: 'assistant', sessionID: 'ses_child', parentID: 'msg_child_user',
          content: [{ id: 'part_child', type: 'text', text: 'child answer must not be duplicated' }],
          time: { created: 1, completed: 2 }, finish: 'stop' }], cursor: {} });
      } else if (url.pathname === '/v1/sessions/happy_native_transcript/messages') {
        sendJson(response, { error: 'private sidechain baseline response' }, 503);
      } else if (url.pathname.endsWith('/prompt')) {
        promptCount += 1;
        void readJsonBody(request).then((body) => {
          messages.push(
            { id: body.id, type: 'user', sessionID: nativeSessionId, text: 'Happier prompt', time: { created: 1790950000010 } },
            { id: 'msg_happier_assistant', type: 'assistant', sessionID: nativeSessionId, parentID: body.id,
              content: [{ id: 'part_happier', type: 'text', text: 'Happier answer' }],
              time: { created: 1790950000011, completed: 1790950000012 }, finish: 'stop' },
          );
          uiPromptAccepted = true;
          sendJson(response, {});
        });
      } else {
        sendJson(response, { data: [] });
      }
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    await withConfiguredDaemonTestHome({
      prefix: 'opencode-native-transcript-',
      env: { HAPPIER_SERVER_URL: baseUrl, HAPPIER_SERVER_URL_LOCAL: baseUrl, HAPPIER_PUBLIC_SERVER_URL: baseUrl },
    }, async () => {
      const committed: Array<Record<string, unknown>> = [];
      // Relay socket/ACK boundary only; production session commit, plain envelope and importer stay real.
      const socket = createApiSessionSocketStub({
        connected: true,
        emitWithAck: (event, payload) => {
          const body = payload as Record<string, unknown>;
          if (event === 'update-metadata' || event === 'update-state') {
            return { result: 'success', metadata: body.metadata, agentState: body.agentState,
              version: Number(body.expectedVersion) + 1 };
          }
          if (event === 'message') {
            committed.push(body);
            return { ok: true, id: `m${committed.length}`, seq: committed.length, localId: body.localId };
          }
          return resolveApiSessionSocketDefaultAck(event, payload);
        },
      });
      bindApiSessionSocketMock(mockIo, socket);
      const session = new ApiSessionClient('synthetic-token', createPlainSessionFixture({ id: 'happy_native_transcript' }));
      const env = { ...process.env, HAPPIER_OPENCODE_SERVER_STATUS_POLL_ENABLED: '0' };
      const client = await createOpenCodeServerRuntimeClient({
        directory, baseUrlOverride: baseUrl, env, messageBuffer: new MessageBuffer(),
      });
      const runtime = createOpenCodeServerRuntime({
        directory, env, session, messageBuffer: new MessageBuffer(), mcpServers: {},
        happierMcpAdmission: { kind: 'not_available_for_execution_run' },
        permissionHandler: new ProviderEnforcedPermissionHandler(session, { logPrefix: '[test]' }),
        onThinkingChange: () => {}, getPermissionMode: () => 'default',
      }, { createClient: async () => client });
      const emit = (type: string, data: Record<string, unknown>): void => {
        eventResponse?.write(`data: ${JSON.stringify({ type, location: { directory }, data })}\n\n`);
      };
      const disconnectEvents = (): void => { eventResponse?.end(); };
      const imported = () => committed.filter((body) => String(body.localId).startsWith('opencode:import:'));
      // Default file logger is the external diagnostic sink; opt-in debug cannot own this fallback.
      const defaultDiagnostic = vi.spyOn(logger, 'infoFile').mockImplementation(() => {});
      try {
        await runtime.startOrLoad({});
        await expect.poll(() => connections).toBe(1);
        messages = [
          { id: 'msg_native_user', type: 'user', sessionID: nativeSessionId,
            text: 'native terminal prompt', time: { created: 1790950000000 } },
          { id: 'msg_native_assistant', type: 'assistant', sessionID: nativeSessionId,
            parentID: 'msg_native_user', content: [{ id: 'part_native', type: 'text', text: 'native terminal answer' }],
            time: { created: 1790950000001, completed: 1790950000002 }, finish: 'stop' },
        ];
        emit('session.execution.started', { sessionID: nativeSessionId });
        emit('session.text.started', { sessionID: nativeSessionId, assistantMessageID: 'msg_native_assistant', ordinal: 0 });
        emit('session.text.delta', { sessionID: nativeSessionId, assistantMessageID: 'msg_native_assistant', ordinal: 0, delta: 'native terminal answer' });
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        // Native assistant activity commits through the live stream owner. Only its user row
        // is backfilled from settled history; both durable messages must survive exactly once.
        await expect.poll(() => committed).toHaveLength(2);
        expect(imported()).toHaveLength(1);
        expect(imported().map((body) => body.localId)).toEqual([
          `opencode:import:history:${nativeSessionId}:msg_native_user`,
        ]);
        expect(committed.map((body) => body.message)).toEqual(expect.arrayContaining([
          { t: 'plain', v: expect.objectContaining({ role: 'user', content: { type: 'text', text: 'native terminal prompt' },
            meta: expect.objectContaining({ source: 'cli', importedFrom: 'acp-history' }) }) },
          { t: 'plain', v: expect.objectContaining({ role: 'agent',
            content: expect.objectContaining({ data: { type: 'message', message: 'native terminal answer' } }),
            meta: expect.objectContaining({ opencodeMessageId: 'msg_native_assistant', opencodeRemoteSessionId: nativeSessionId }) }) },
        ]));
        const readsAfterCompletion = messageReads;
        emit('session.execution.succeeded', { sessionID: 'ses_other' });
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await expect.poll(() => messageReads).toBeGreaterThan(readsAfterCompletion);
        disconnectEvents();
        await expect.poll(() => connections).toBe(2);
        await expect.poll(() => messageReads).toBeGreaterThan(readsAfterCompletion + 1);
        expect(committed).toHaveLength(2);
        expect(imported()).toHaveLength(1);

        historyUnavailable = true;
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await expect.poll(() => defaultDiagnostic.mock.calls.some(([message]) =>
          String(message).includes('opencode_passive_transcript_projection_failed'))).toBe(true);
        expect(defaultDiagnostic.mock.calls.flat().join(' ')).not.toContain('private upstream response');
        historyUnavailable = false;
        expect(committed).toHaveLength(2);

        // A control-plane idle is only a wake: authoritative completion still excludes partial text.
        messages.push(
          { id: 'msg_native_user_2', type: 'user', sessionID: nativeSessionId,
            text: 'second native prompt', time: { created: 1790950000003 } },
          { id: 'msg_native_partial', type: 'assistant', sessionID: nativeSessionId,
            parentID: 'msg_native_user_2', content: [{ id: 'part_partial', type: 'text', text: 'partial answer' }],
            time: { created: 1790950000004 } },
        );
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await expect.poll(() => imported()).toHaveLength(2);
        expect(imported().some((body) => String(body.localId).endsWith(':msg_native_partial'))).toBe(false);
        messages[messages.length - 1] = { id: 'msg_native_partial', type: 'assistant', sessionID: nativeSessionId,
          parentID: 'msg_native_user_2', content: [{ id: 'part_partial', type: 'text', text: 'settled answer' }],
          time: { created: 1790950000004, completed: 1790950000005 }, finish: 'stop' };
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await expect.poll(() => imported()).toHaveLength(3);
        expect(promptCount).toBe(0);

        // A passive inventory can be in flight when the app starts its next turn. It must not
        // become a competing transcript writer after the live owner acquires that turn.
        messages.push({ id: 'msg_native_late', type: 'user', sessionID: nativeSessionId,
          text: 'native text returned during a Happier turn', time: { created: 1790950000006 } });
        holdNextHistory = true;
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await expect.poll(() => releaseHistory !== null).toBe(true);
        runtime.beginTurn();
        const prompt = runtime.sendPromptWithMeta!({ text: 'Happier prompt', localId: 'ui_live_input' });
        void prompt.catch(() => {});
        await expect.poll(() => uiPromptAccepted).toBe(true);
        const releaseHeldHistory = (): void => { releaseHistory?.(); };
        releaseHeldHistory();
        emit('session.text.started', { sessionID: nativeSessionId, assistantMessageID: 'msg_happier_assistant', ordinal: 0 });
        emit('session.text.delta', { sessionID: nativeSessionId, assistantMessageID: 'msg_happier_assistant', ordinal: 0, delta: 'Happier answer' });
        emit('session.text.ended', { sessionID: nativeSessionId, assistantMessageID: 'msg_happier_assistant', ordinal: 0 });
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await prompt;
        expect(imported()).toHaveLength(3);
        expect(JSON.stringify(committed.map((body) => body.message))).toContain('Happier answer');
        // A later native wake can catch up, but the completed Happier pair is never passively copied.
        emit('session.execution.succeeded', { sessionID: nativeSessionId });
        await expect.poll(() => imported()).toHaveLength(4);
        expect(imported().some((body) => String(body.localId).includes('msg_happier_assistant'))).toBe(false);
        expect(promptCount).toBe(1);
        emit('message.part.updated', { part: { id: 'part_task', type: 'tool', sessionID: nativeSessionId,
          messageID: 'msg_task', callID: 'call:diagnostic', tool: 'task', state: { status: 'completed',
            output: 'fallback answer must not bypass an unproven history baseline', metadata: { sessionId: 'ses_child' } } } });
        await expect.poll(() => defaultDiagnostic.mock.calls.some(([message]) =>
          String(message).includes('opencode_task_sidechain_import_failed'))).toBe(true);
        expect(defaultDiagnostic.mock.calls.flat().join(' ')).not.toContain('private sidechain baseline response');
        expect(imported()).toHaveLength(4);
      } finally {
        defaultDiagnostic.mockRestore();
        await runtime.reset();
        await client.dispose();
        await session.close();
        server.closeAllConnections();
      }
    });
  });

  it('refreshes published catalogs after V2 plugin settlement, withdrawal and reconnect without a prompt', async () => {
    // OpenCode 2.0.20 returns an immediate model snapshot before plugins settle, then emits
    // location-scoped model.updated/provider.updated/agent.updated invalidations (schema/core owners).
    let populated = false;
    let agentsAvailable = false;
    let inventoryUnavailable = false;
    let agentInventoryUnavailable = false;
    let eventResponse: ServerResponse | null = null;
    let connections = 0;
    let promptCount = 0;
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/api/info') {
        sendJson(response, { version: '2.0.20', pid: process.pid, urls: [], paths: {} });
      } else if (url.pathname === '/api/session' && request.method === 'POST') {
        sendJson(response, { data: { id: 'ses_catalog', location: { directory: '/tmp' } } });
      } else if (url.pathname === '/api/event') {
        eventResponse = response;
        connections += 1;
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.write(`data: ${JSON.stringify({ type: 'server.connected', data: {} })}\n\n`);
      } else if (['/api/provider', '/api/model', '/api/agent', '/api/model/default'].includes(url.pathname)) {
        expect(url.searchParams.get('location[directory]')).toBe('/tmp');
        if ((url.pathname === '/api/model' && inventoryUnavailable)
          || (url.pathname === '/api/agent' && agentInventoryUnavailable)) {
          sendJson(response, {}, 503);
        } else {
          const data = url.pathname === '/api/provider'
            ? (populated ? [{ id: 'openai', name: 'OpenAI', activation: 'enabled', package: 'aisdk:openai' }] : [])
            : url.pathname === '/api/model'
              ? (populated ? [{ id: 'gpt-5.6-luna', modelID: 'gpt-5.6-luna', providerID: 'openai',
                name: 'Luna', status: 'active', enabled: true,
                capabilities: { tools: true, input: ['text'], output: ['text'] }, variants: [{ id: 'low' }],
                time: { released: 0 }, cost: [], limit: { context: 200000, output: 32000 } }] : [])
              : url.pathname === '/api/agent'
                ? (agentsAvailable ? [{ id: 'build', name: 'Build', mode: 'primary', hidden: false, request: {}, permissions: [] }] : [])
                : undefined;
          sendJson(response, { location: { directory: '/tmp' }, data });
        }
      } else if (url.pathname.endsWith('/prompt')) {
        promptCount += 1;
        sendJson(response, {}, 500);
      } else {
        sendJson(response, { data: [] });
      }
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const env = { ...process.env, HAPPIER_OPENCODE_SERVER_STATUS_POLL_ENABLED: '0' };
    const client = await createOpenCodeServerRuntimeClient({
      directory: '/tmp', baseUrlOverride: baseUrl, env, messageBuffer: new MessageBuffer(),
    });
    const session = createMutableApiSessionClientFixture();
    session.__setMetadata(createTestMetadata());
    session.ensureMetadataSnapshot = async () => session.getMetadataSnapshot();
    const runtime = createOpenCodeServerRuntime({
      directory: '/tmp', env, session, messageBuffer: new MessageBuffer(), mcpServers: {},
      happierMcpAdmission: { kind: 'not_available_for_execution_run' },
      permissionHandler: new ProviderEnforcedPermissionHandler(session, { logPrefix: '[test]' }),
      onThinkingChange: () => {}, getPermissionMode: () => 'default',
    }, { createClient: async () => client });
    const emit = (type: string): void => {
      eventResponse?.write(`data: ${JSON.stringify({ type, location: { directory: '/tmp' }, data: {} })}\n\n`);
    };
    const disconnectEvents = (): void => { eventResponse?.end(); };
    try {
      await runtime.startOrLoad({});
      await expect.poll(() => session.getMetadataSnapshot()).toMatchObject({
        sessionModelsV1: { availableModels: [] }, sessionModesV1: { availableModes: [] },
      });
      await expect.poll(() => connections).toBe(1);

      populated = true;
      agentsAvailable = true;
      emit('model.updated');
      await expect.poll(() => session.getMetadataSnapshot()).toMatchObject({
        sessionModelsV1: { availableModels: [{ id: 'openai/gpt-5.6-luna' }] },
        sessionModesV1: { availableModes: [{ id: 'build', name: 'Build' }] },
      });

      populated = false;
      agentsAvailable = false;
      emit('agent.updated');
      await expect.poll(() => session.getMetadataSnapshot()).toMatchObject({
        sessionModelsV1: { availableModels: [] }, sessionModesV1: { availableModes: [] },
      });

      populated = true;
      emit('provider.updated');
      await expect.poll(() => session.getMetadataSnapshot()?.sessionModelsV1?.availableModels)
        .toMatchObject([{ id: 'openai/gpt-5.6-luna' }]);

      inventoryUnavailable = true;
      agentsAvailable = true;
      emit('agent.updated');
      await expect.poll(() => session.getMetadataSnapshot()).toMatchObject({
        sessionModelsV1: { availableModels: [{ id: 'openai/gpt-5.6-luna' }] },
        sessionModesV1: { availableModes: [{ id: 'build', name: 'Build' }] },
      });

      inventoryUnavailable = false;
      populated = false;
      agentInventoryUnavailable = true;
      emit('provider.updated');
      await expect.poll(() => session.getMetadataSnapshot()?.sessionModelsV1?.availableModels).toEqual([]);
      expect(session.getMetadataSnapshot()?.sessionModesV1?.availableModes).toMatchObject([{ id: 'build' }]);

      agentInventoryUnavailable = false;
      agentsAvailable = false;
      disconnectEvents();
      await expect.poll(() => connections).toBe(2);
      await expect.poll(() => session.getMetadataSnapshot()).toMatchObject({
        sessionModelsV1: { availableModels: [] }, sessionModesV1: { availableModes: [] },
      });
      expect(promptCount).toBe(0);
    } finally {
      await runtime.reset();
      await client.dispose();
      server.closeAllConnections();
    }
  });

  it.each(['accepted', 'agent-rejected', 'model-rejected', 'config-rejected', 'transport-recovered', 'rpc-preparation', 'rpc-agent-rejected', 'rpc-headless'] as const)(
    'publishes V2 model and reasoning controls to the native session before any prompt: %s', async (startupCase) => {
    // Released @opencode/cli 2.0.20 (84c9be93): the attached TUI reads session.model,
    // including its variant, rather than accepting model/variant attach flags.
    let nativeModel: { id: string; providerID: string; variant?: string } = {
      id: 'expensive-default', providerID: 'openai',
    };
    let promptCount = 0;
    let nativeAgent = 'build';
    let rejectModelUpdate = false;
    let startupPhase = true;
    let modelWrites = 0;
    logger.flushSync();
    const previousLogLength = existsSync(logger.getLogPath()) ? readFileSync(logger.getLogPath(), 'utf8').length : 0;
    let observeNativeAttachment!: (model: unknown) => void;
    const nativeAttachment = new Promise<unknown>((resolve) => {
      observeNativeAttachment = resolve;
    });
    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (url.pathname === '/tui-observed') {
        observeNativeAttachment({ model: { ...nativeModel }, agent: nativeAgent });
        sendJson(response, {});
      } else if (url.pathname === '/tui-life') {
        response.writeHead(200);
        response.flushHeaders();
      } else if (url.pathname === '/api/info') {
        sendJson(response, { version: '2.0.20', pid: process.pid, urls: [], paths: {} });
      } else if (url.pathname === '/api/session' && request.method === 'POST') {
        sendJson(response, { data: { id: 'ses_native_controls', location: { directory: '/tmp' } } });
      } else if (url.pathname === '/api/session/ses_native_controls/agent' && request.method === 'POST') {
        if (startupPhase && (startupCase === 'agent-rejected' || startupCase === 'rpc-agent-rejected')) {
          sendJson(response, { error: 'fixture-private-credential-path' }, 400);
          return;
        }
        const body = await readJsonBody(request);
        if (typeof body.agent !== 'string') {
          sendJson(response, {}, 400);
          return;
        }
        nativeAgent = body.agent;
        response.writeHead(204);
        response.end();
      } else if (url.pathname === '/api/session/ses_native_controls/model' && request.method === 'POST') {
        if (rejectModelUpdate) {
          sendJson(response, { error: 'native selection unavailable' }, 503);
          return;
        }
        const body = await readJsonBody(request);
        const model = body.model;
        if (!model || typeof model !== 'object' || Array.isArray(model)) {
          sendJson(response, {}, 400);
          return;
        }
        const record = model as Record<string, unknown>;
        if (typeof record.id !== 'string' || typeof record.providerID !== 'string') {
          sendJson(response, {}, 400);
          return;
        }
        modelWrites += 1;
        if (startupPhase && (
          (startupCase === 'model-rejected' && record.id === 'cheap-model')
          || (startupCase === 'config-rejected' && record.variant === 'low')
          || (startupCase === 'transport-recovered' && modelWrites === 1)
        )) {
          sendJson(response, { error: 'native selection unavailable' },
            startupCase === 'transport-recovered' ? 503 : 400);
          return;
        }
        nativeModel = {
          id: record.id,
          providerID: record.providerID,
          ...(typeof record.variant === 'string' ? { variant: record.variant } : {}),
        };
        response.writeHead(204);
        response.end();
      } else if (url.pathname === '/api/session/ses_native_controls' && request.method === 'GET') {
        sendJson(response, { data: { id: 'ses_native_controls', model: nativeModel, agent: nativeAgent } });
      } else if (url.pathname === '/api/provider') {
        sendJson(response, { data: [{ id: 'openai' }] });
      } else if (url.pathname === '/api/model') {
        sendJson(response, { data: [
          { id: 'cheap-model', providerID: 'openai', variants: [{ id: 'low' }, { id: 'high' }] },
          { id: 'other-model', providerID: 'openai', variants: [{ id: 'low' }, { id: 'high' }] },
        ] });
      } else if (url.pathname === '/api/model/default') {
        sendJson(response, { data: { id: 'expensive-default', modelID: 'expensive-default', providerID: 'openai' } });
      } else if (url.pathname.endsWith('/prompt')) {
        promptCount += 1;
        sendJson(response, {}, 500);
      } else if (url.pathname === '/api/event') {
        response.writeHead(200, { 'content-type': 'text/event-stream' });
        response.flushHeaders();
      } else {
        sendJson(response, { data: [] });
      }
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const env = { ...process.env, HAPPIER_OPENCODE_SERVER_STATUS_POLL_ENABLED: '0' };
    const client = await createOpenCodeServerRuntimeClient({
      directory: '/tmp', baseUrlOverride: baseUrl, env, messageBuffer: new MessageBuffer(),
    });
    const session = createMutableApiSessionClientFixture({ overrides: {
      updateAgentState: async () => {}, sendSessionEvent: () => {},
    } });
    session.ensureMetadataSnapshot = async () => session.getMetadataSnapshot();
    session.__setMetadata(createTestMetadata({
      sessionModeOverrideV1: { v: 1, updatedAt: 5, modeId: 'plan' },
      modelOverrideV1: { v: 1, updatedAt: 11, modelId: 'openai/cheap-model' },
      sessionConfigOptionOverridesV1: { v: 1, updatedAt: 22, overrides: {
        reasoning_effort: { updatedAt: 22, value: 'low' },
      } },
    }));
    const permissionHandler = new ProviderEnforcedPermissionHandler(session, { logPrefix: '[test]' });
    const runtime = createOpenCodeServerRuntime({
      directory: '/tmp', env, session,
      messageBuffer: new MessageBuffer(), mcpServers: {},
      happierMcpAdmission: { kind: 'not_available_for_execution_run' },
      permissionHandler,
      onThinkingChange: () => {}, getPermissionMode: () => 'default',
    }, { createClient: async () => client });
    const readNativeSelection = async (): Promise<unknown> => {
      const response = await fetch(`${baseUrl}/api/session/ses_native_controls`);
      return await response.json();
    };
    let prepareLocalAttachment = async (): Promise<boolean> => false;
    const supervisor = createOpenCodeTuiSupervisor({
      command: process.execPath,
      // Real harmless native-terminal process: observes the server selection, then holds its HTTP connection.
      commandArgs: ['-e', 'const a=process.argv;const u=a[a.indexOf("--server")+1];fetch(u+"/tui-observed").then(()=>fetch(u+"/tui-life"));', '--'],
      env, readManagedServerStateFn: async () => null,
    });
    const localControl = createOpenCodeSharedLocalControl({
      support: startupCase === 'rpc-headless' ? { ok: false, reason: 'tty_unavailable' } : { ok: true },
      startingMode: 'local', getSession: () => session,
      getSessionId: runtime.getSessionId, getDirectory: () => '/tmp',
      getServerTarget: () => ({ baseUrl }), supervisor,
      prepareAttachment: () => prepareLocalAttachment(),
    });
    try {
      const startupAccepted = startupCase === 'accepted' || startupCase === 'rpc-preparation' || startupCase === 'rpc-headless';
      let shouldExit = false;
      const queue = new MessageQueue2<{ permissionMode: PermissionMode }, PermissionModeQueuedPrompt>(
        (mode) => mode.permissionMode, { batcher: combinePermissionModeQueuedPrompts },
      );
      await runPermissionModePromptLoop({
        providerName: 'OpenCode', providerId: 'opencode', agentMessageType: 'opencode',
        explicitPermissionMode: undefined, session, messageQueue: queue,
        permissionHandler,
        runtime, messageBuffer: new MessageBuffer(),
        createOverrideSynchronizer: (isStarted) => createRuntimeOverrideSynchronizers({ session, runtime, isStarted }),
        shouldExit: () => shouldExit, getAbortSignal: () => new AbortController().signal,
        keepAlive: () => {}, setThinking: () => {}, sendReady: () => {},
        currentPermissionModeUpdatedAt: 0, setCurrentPermissionMode: () => {},
        setCurrentPermissionModeUpdatedAt: () => {}, startRuntimeBeforeFirstPrompt: true,
        formatPromptErrorMessage: String,
        onAfterStart: async (startup?: { initialControlsApplied: boolean; prepareLocalAttachment: () => Promise<boolean> }) => {
          shouldExit = true;
          if (startupCase === 'accepted' || startupCase === 'transport-recovered') {
            expect(await readNativeSelection()).toMatchObject({ data: {
              agent: 'plan', model: { providerID: 'openai', id: 'cheap-model', variant: 'low' },
            } });
          }
          expect(startup?.initialControlsApplied).toBe(startupAccepted);
          prepareLocalAttachment = startup!.prepareLocalAttachment;
          // The callback returns before entering the loop; allow current-owner attachment admission to run.
          shouldExit = false;
          if (startupCase.startsWith('rpc-')) {
            // Real registered handler + encrypted RPC manager, delegating to this runtime's actual admission owner.
            const runtimeControls = {
              prepareProviderCliAttach: localControl.prepareProviderCliAttach,
            };
            registerSessionControlHandlers(session.rpcHandlerManager, { sessionRuntimeControls: cloneCallableSessionRuntimeControls(runtimeControls) });
            const key = new Uint8Array(32);
            const socket = createApiSessionSocketStub({
              // Match asynchronous network connection while keeping registered RPC admission real.
              onConnect: (connectedSocket) => queueMicrotask(() => connectedSocket.trigger('connect')),
              emit: async (event, args) => {
                const [payload, ack] = args;
                if (event !== 'rpc-call' || typeof ack !== 'function') return;
                // The network harness receives the real typed session-RPC call payload.
                const result: unknown = await session.rpcHandlerManager.handleRequest(payload as RpcRequest);
                ack({ ok: true, result });
              },
            });
            bindApiSessionSocketMock(mockIo, socket);
            const rawSession = createSessionRecordFixture({
              id: session.sessionId, active: true,
              metadata: encodeBase64(encrypt(key, 'legacy', {
                flavor: 'opencode', path: '/tmp', host: 'fixture', machineId: 'machine-fixture',
                opencodeSessionId: 'ses_native_controls', opencodeBackendMode: 'server',
                opencodeServerBaseUrl: baseUrl, opencodeServerBaseUrlExplicit: true,
              })),
            });
            const attach = handleAttachCommand([session.sessionId], {
              readCredentialsFn: async () => ({ token: 'fixture-token', encryption: { type: 'legacy', secret: key } }),
              readSettingsFn: async () => ({ schemaVersion: 1, onboardingCompleted: true, machineId: 'machine-fixture' }),
              fetchSessionByIdFn: async () => rawSession,
              readTerminalAttachmentInfoFn: async () => null,
              runProviderAttachFn: async (params) => await runOpenCodeProviderAttach({
                ...params, command: process.execPath,
                commandArgs: ['-e', 'const a=process.argv;fetch(new URL("/tui-observed",a[a.indexOf("--server")+1]));', '--'],
                env, readManagedServerStateFn: async () => null,
              }),
            });
            if (startupCase === 'rpc-agent-rejected') {
              await expect(attach).rejects.toThrow('provider_cli_attach_not_ready');
            } else {
              await attach;
              // Observe the caller's native child before any local-controller child can satisfy it.
              expect(await nativeAttachment).toEqual({ agent: 'plan', model: { providerID: 'openai', id: 'cheap-model', variant: 'low' } });
            }
          }
          await localControl.onAfterStart({ canAttach: startup!.initialControlsApplied });
          shouldExit = true;
          expect(supervisor.isAttached()).toBe(startupAccepted && startupCase !== 'rpc-headless');
          if (startupCase === 'rpc-headless') expect(localControl.resolveKeepAliveMode()).toBe('remote');
          if (startupAccepted) {
            expect(await nativeAttachment).toEqual({ agent: 'plan', model: { providerID: 'openai', id: 'cheap-model', variant: 'low' } });
          } else {
            expect(localControl.resolveKeepAliveMode()).toBe('remote');
          }
          expect(promptCount).toBe(0);
        },
      });
      if (startupCase === 'agent-rejected') {
        logger.flushSync();
        const diagnostic = existsSync(logger.getLogPath())
          ? readFileSync(logger.getLogPath(), 'utf8').slice(previousLogLength)
          : '';
        expect(diagnostic).toContain('[SessionModeOverrideSync] Failed to apply session mode override; will retry on next sync');
        expect(diagnostic).not.toContain('fixture-private-credential-path');
      }
      startupPhase = false;
      if (!startupAccepted) {
        // An explicit retry uses the synchronizer's current pending commands, not the initial rejection.
        shouldExit = false;
        await expect(localControl.switchToLocal()).resolves.toBe(true);
        shouldExit = true;
        expect(await nativeAttachment).toEqual({ agent: 'plan', model: { providerID: 'openai', id: 'cheap-model', variant: 'low' } });
        expect(runtime.getSessionId()).toBe('ses_native_controls');
        expect(promptCount).toBe(0);
        return;
      }
      await runtime.setSessionModel('openai/expensive-default');
      await runtime.setSessionConfigOption('reasoning_effort', 'low');
      expect(await readNativeSelection()).toMatchObject({ data: { model: {
        providerID: 'openai', id: 'expensive-default', variant: 'low',
      } } });
      await runtime.setSessionModel('openai/cheap-model');
      await runtime.setSessionConfigOption('reasoning_effort', 'low');
      expect(await readNativeSelection()).toMatchObject({ data: { model: {
        providerID: 'openai', id: 'cheap-model', variant: 'low',
      } } });

      await runtime.setSessionModel('openai/other-model');
      await runtime.setSessionConfigOption('reasoning_effort', 'high');
      expect(await readNativeSelection()).toMatchObject({ data: { model: {
        providerID: 'openai', id: 'other-model', variant: 'high',
      } } });
      await runtime.setSessionConfigOption('reasoning_effort', null);
      expect(await readNativeSelection()).toEqual({ data: {
        id: 'ses_native_controls', agent: 'plan', model: { providerID: 'openai', id: 'other-model' },
      } });
      rejectModelUpdate = true;
      await expect(runtime.setSessionModel('openai/cheap-model')).rejects.toThrow();
      await expect(runtime.setSessionConfigOption('reasoning_effort', 'low')).rejects.toThrow();
      rejectModelUpdate = false;
      await runtime.setSessionConfigOption('reasoning_effort', 'high');
      expect(await readNativeSelection()).toMatchObject({ data: { model: {
        providerID: 'openai', id: 'other-model', variant: 'high',
      } } });
      expect(promptCount).toBe(0);
    } finally {
      await localControl.dispose();
      await runtime.reset();
      await client.dispose();
      server.closeAllConnections();
    }
  });

  it('waits for exact-parent terminal inventory after live provider error and idle', async () => {
    let eventResponse: ServerResponse | null = null;
    let eventStreamKind: 'instance' | 'global' | null = null;
    let promptMessageId = '';
    let promptAccepted = false;
    let terminalInventoryReady = false;

    const server = createServer(async (request, response) => {
      const url = new URL(request.url ?? '/', 'http://127.0.0.1');
      if (request.method === 'GET' && url.pathname === '/global/health') {
        sendJson(response, { healthy: true, version: '1.14.41' });
        return;
      }
      if (request.method === 'GET' && (url.pathname === '/event' || url.pathname === '/global/event')) {
        eventStreamKind = url.pathname === '/event' ? 'instance' : 'global';
        if (eventStreamKind === 'instance') {
          expect(url.searchParams.get('directory')).toBe('/tmp');
        }
        response.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        eventResponse = response;
        const connected = { type: 'server.connected', properties: {} };
        response.write(`data: ${JSON.stringify(eventStreamKind === 'instance'
          ? connected
          : { directory: '/tmp', payload: connected })}\n\n`);
        return;
      }
      if (request.method === 'POST' && url.pathname === '/session') {
        sendJson(response, { id: 'ses_1', directory: '/tmp' });
        return;
      }
      if (request.method === 'POST' && url.pathname === '/session/ses_1/prompt_async') {
        const body = await readJsonBody(request);
        promptMessageId = typeof body.messageID === 'string' ? body.messageID : '';
        promptAccepted = true;
        response.writeHead(204);
        response.end();
        return;
      }
      if (request.method === 'GET' && url.pathname === '/session/ses_1/message') {
        if (!promptAccepted) {
          sendJson(response, []);
          return;
        }
        sendJson(response, [
          {
            info: { id: promptMessageId, role: 'user', sessionID: 'ses_1', time: { created: 10 } },
            parts: [{ id: 'part_user', type: 'text', text: 'hello' }],
          },
          {
            info: {
              id: 'msg_provider_error',
              role: 'assistant',
              sessionID: 'ses_1',
              parentID: promptMessageId,
              time: { created: 11, ...(terminalInventoryReady ? { completed: 12 } : {}) },
              error: {
                name: 'ProviderModelNotFoundError',
                data: { message: 'Model not found: openai-codex/gpt-5.6-luna' },
              },
            },
            parts: [],
          },
        ]);
        return;
      }
      if (request.method === 'GET' && url.pathname === '/global/config') {
        sendJson(response, { model: 'openai/gpt-test' });
        return;
      }
      if (request.method === 'GET' && url.pathname === '/provider') {
        sendJson(response, { all: [{ id: 'openai', models: { 'gpt-test': { id: 'gpt-test' } } }], connected: ['openai'] });
        return;
      }
      if (request.method === 'GET' && (url.pathname === '/agent' || url.pathname === '/skill' || url.pathname === '/permission' || url.pathname === '/question' || url.pathname.endsWith('/todo') || url.pathname.endsWith('/diff'))) {
        sendJson(response, []);
        return;
      }
      sendJson(response, {}, 404);
    });
    openServers.push(server);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const address = server.address() as AddressInfo;
    const baseUrl = `http://127.0.0.1:${address.port}`;
    const env = {
      ...process.env,
      HAPPIER_OPENCODE_SERVER_STATUS_POLL_ENABLED: '0',
      HAPPIER_OPENCODE_SERVER_TURN_INACTIVITY_TIMEOUT_MS: '10000',
    };
    const client = await createOpenCodeServerRuntimeClient({
      directory: '/tmp',
      baseUrlOverride: baseUrl,
      env,
      messageBuffer: new MessageBuffer(),
    });
    const session = createSessionHarness();
    const runtime = createOpenCodeServerRuntime({
      directory: '/tmp',
      env,
      session: session as never,
      messageBuffer: new MessageBuffer(),
      mcpServers: {},
      happierMcpAdmission: { kind: 'not_available_for_execution_run' },
      permissionHandler: { handleToolCall: async () => ({ decision: 'approved' as const }) } as never,
      onThinkingChange: vi.fn(),
      getPermissionMode: () => 'default',
    }, {
      createClient: async () => client,
    });

    let promptPromise: Promise<void> | null = null;
    try {
      await runtime.startOrLoad({});
      runtime.beginTurn();
      promptPromise = runtime.sendPromptWithMeta?.({ text: 'hello', localId: 'local-composed-error' }) ?? Promise.resolve();
      void promptPromise.catch(() => undefined);
      await expect.poll(() => promptAccepted).toBe(true);
      await expect.poll(() => eventResponse !== null).toBe(true);

      const emit = (event: unknown): void => {
        const payload = eventStreamKind === 'instance'
          ? event
          : { directory: '/tmp', payload: event };
        eventResponse?.write(`data: ${JSON.stringify(payload)}\n\n`);
      };
      emit({
        type: 'session.error',
        properties: {
          sessionID: 'ses_1',
          error: {
            name: 'ProviderModelNotFoundError',
            data: { message: 'Model not found: openai-codex/gpt-5.6-luna' },
          },
        },
      });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(session.sessionTurnLifecycle.failTurn).not.toHaveBeenCalled();

      emit({ type: 'session.status', properties: { sessionID: 'ses_1', status: { type: 'idle' } } });
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(session.sessionTurnLifecycle.failTurn).not.toHaveBeenCalled();

      terminalInventoryReady = true;
      emit({
        type: 'message.updated',
        properties: {
          info: {
            id: 'msg_provider_error',
            role: 'assistant',
            sessionID: 'ses_1',
            parentID: promptMessageId,
            time: { created: 11, completed: 12 },
            error: {
              name: 'ProviderModelNotFoundError',
              data: { message: 'Model not found: openai-codex/gpt-5.6-luna' },
            },
          },
        },
      });

      const promptOutcome = Promise.race([
        promptPromise,
        new Promise<void>((_resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('timed out waiting for prompt failure')), 500);
          timer.unref?.();
        }),
      ]);
      await expect(promptOutcome).rejects.toThrow('Model not found: openai-codex/gpt-5.6-luna');
      await expect.poll(() => session.sessionTurnLifecycle.failTurn.mock.calls.length).toBe(1);
    } finally {
      await runtime.reset().catch(() => {});
      await client.dispose().catch(() => {});
      await promptPromise?.catch(() => undefined);
    }
  });
});
