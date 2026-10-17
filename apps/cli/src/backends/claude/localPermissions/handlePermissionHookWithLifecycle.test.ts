import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageQueue2 } from '@/agent/runtime/modeMessageQueue';
import type { SessionClientPort } from '@/api/session/sessionClientPort';
import type { AgentState } from '@/api/types';
import { createMutableApiSessionClientFixture } from '@/testkit/backends/sessionFixtures';
import type { EnhancedMode } from '../loop';
import { Session } from '../session';
import { createClaudeUnifiedHookLifecycleBridge } from '../unifiedTerminal/createClaudeUnifiedHookLifecycleBridge';
import { createClaudeUnifiedInputArbiter } from '../unifiedTerminal/createClaudeUnifiedInputArbiter';
import { createClaudeUnifiedPromptInjector } from '../unifiedTerminal/createClaudeUnifiedPromptInjector';
import { handlePermissionHookWithLifecycle } from './handlePermissionHookWithLifecycle';
import { ClaudeLocalPermissionBridge } from './localPermissionBridge';

describe('handlePermissionHookWithLifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(['remote denial', 'bridge disposal', 'provider timeout'] as const)(
    'keeps queued input blocked until the real permission waiter settles through %s',
    async (settlement) => {
      let agentState: AgentState = { requests: {}, completedRequests: {} };
      // The session API is the relay boundary; keep Session, RPC routing, request
      // coordination, hook lifecycle and terminal input decisions real.
      const client = createMutableApiSessionClientFixture({
        overrides: {
          async updateAgentState(updater: Parameters<SessionClientPort['updateAgentState']>[0]) {
            agentState = updater(agentState);
          },
          getAgentStateSnapshot: () => agentState,
          flush: async () => {},
        },
      });
      const session = new Session({
        client,
        path: process.cwd(),
        logPath: 'permission-lifecycle-fixture.log',
        hookSettingsPath: 'permission-lifecycle-fixture.json',
        sessionId: 'native-permission-fixture',
        messageQueue: new MessageQueue2<EnhancedMode>(() => 'default'),
        onModeChange: () => {},
      });
      const bridge = new ClaudeLocalPermissionBridge(session, { responseTimeoutMs: 1_000 });
      const writes: string[] = [];
      const injector = createClaudeUnifiedPromptInjector({
        inputInjection: {
          // Only the actual terminal write is replaced at the OS boundary.
          hostKind: 'windows_console',
          injectUserPrompt: async (input) => {
            writes.push(input.text);
            return { status: 'injected', at: Date.now(), bytesWritten: input.text.length };
          },
        },
      });
      const arbiter = createClaudeUnifiedInputArbiter({
        injectPrompt: injector.injectPrompt,
        quietPeriodMs: 0,
      });
      const lifecycle = createClaudeUnifiedHookLifecycleBridge({
        subscribeClaudeSessionHooks: (callback) => {
          session.addClaudeSessionHookCallback(callback);
          return () => session.removeClaudeSessionHookCallback(callback);
        },
        arbiter,
        completionQuiescenceMs: 0,
      });
      const lifetime = new AbortController();
      try {
        bridge.activate();
        lifecycle.start({ abortSignal: lifetime.signal });
        arbiter.observeLifecycle({ type: 'turn_state', state: 'idle' });
        arbiter.observeLifecycle({ type: 'output' });

        let settled = false;
        const pending = handlePermissionHookWithLifecycle({
          data: {
            hook_event_name: 'PermissionRequest',
            session_id: 'native-permission-fixture',
            tool_use_id: 'permission-1',
            tool_name: 'Write',
            tool_input: { file_path: 'fixture.txt', content: 'fixture' },
          },
          bridge,
          onSessionHook: session.onClaudeSessionHook,
        }).then(
          response => { settled = true; return { response }; },
          error => { settled = true; return { error }; },
        );
        await vi.advanceTimersByTimeAsync(0);
        expect(agentState.requests?.['permission-1']).toBeDefined();
        expect(settled).toBe(false);
        expect(arbiter.snapshot().permissionBlocked).toBe(true);

        await arbiter.enqueueUiMessage({ message: 'queued remote message', origin: { kind: 'ui_pending' } });
        await arbiter.drainWhenSafe();
        expect(writes).toEqual([]);
        expect(arbiter.snapshot().queuedCount).toBe(1);

        if (settlement === 'remote denial') {
          await expect(client.rpcHandlerManager.invokeLocal('permission', {
            id: 'permission-1', approved: false,
          })).resolves.toEqual({ ok: true });
        } else if (settlement === 'bridge disposal') {
          bridge.dispose();
        } else {
          await vi.advanceTimersByTimeAsync(1_000);
        }

        const outcome = await pending;
        if (settlement === 'remote denial') {
          expect(outcome).toMatchObject({
            response: { hookSpecificOutput: { decision: { behavior: 'deny' } } },
          });
        }
        await vi.advanceTimersByTimeAsync(0);
        expect(settled).toBe(true);
        expect(arbiter.snapshot().permissionBlocked).toBe(false);
        expect(writes).toEqual(['queued remote message']);
      } finally {
        bridge.dispose();
        lifetime.abort();
        lifecycle.dispose();
        await arbiter.dispose();
        session.cleanup();
      }
    },
  );
});
