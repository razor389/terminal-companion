import type { PermissionHookData, PermissionHookResponse, SessionHookData } from '../utils/startHookServer';
import { DEFAULT_LOCAL_PERMISSION_HOOK_RESPONSE, type ClaudeLocalPermissionBridge } from './localPermissionBridge';

export async function handlePermissionHookWithLifecycle(params: Readonly<{
  data: PermissionHookData;
  bridge: ClaudeLocalPermissionBridge | null;
  onSessionHook: (data: SessionHookData) => void;
}>): Promise<PermissionHookResponse> {
  const publish = (hookEventName: 'PermissionRequest' | 'PermissionRequestCompleted') => {
    params.onSessionHook({ ...params.data, hook_event_name: hookEventName, hookEventName });
  };
  publish('PermissionRequest');
  try {
    if (!params.bridge) return DEFAULT_LOCAL_PERMISSION_HOOK_RESPONSE;
    // Keep the terminal permission block until this hook's waiter settles.
    return await params.bridge.handlePermissionHook(params.data);
  } finally {
    publish('PermissionRequestCompleted');
  }
}
