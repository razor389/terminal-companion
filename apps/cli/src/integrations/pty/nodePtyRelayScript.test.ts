import { EventEmitter } from 'node:events';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import vm from 'node:vm';
import { Writable } from 'node:stream';

import { describe, expect, it, vi } from 'vitest';

type RelayCallbacks = {
  onData?: (data: string) => void;
  onExit?: (event: { exitCode?: number }) => void;
};

// Real Writable ordering/backpressure, with only the OS write completion held.
function createHeldOutput() {
  const pending: Array<{ text: string; complete: (error?: Error | null) => void }> = [];
  let delivered = '';
  const stream = new Writable({
    write(chunk: Buffer, _encoding, complete) {
      pending.push({ text: chunk.toString(), complete });
    },
  });
  return {
    stream,
    get delivered() { return delivered; },
    async drain() {
      while (pending.length) {
        const write = pending.shift()!;
        delivered += write.text;
        write.complete();
      }
      await new Promise<void>((resolve) => setImmediate(resolve));
    },
  };
}

function createRelayScriptHarness(
  argv: string[] = ['--', 'fake-shell'],
  params?: Readonly<{
    platform?: NodeJS.Platform;
    modules?: (defaultModule: { spawn: ReturnType<typeof vi.fn> }, fakePty: {
      write: ReturnType<typeof vi.fn>;
      kill: ReturnType<typeof vi.fn>;
      onData: ReturnType<typeof vi.fn>;
      onExit: ReturnType<typeof vi.fn>;
    }) => Record<string, unknown>;
  }>,
) {
  const scriptPath = resolve(__dirname, '../../../scripts/node_pty_relay.cjs');
  const source = readFileSync(scriptPath, 'utf8').replace(/^#!.*\n/, '');
  const callbacks: RelayCallbacks = {};
  const fakePty = {
    write: vi.fn(),
    kill: vi.fn(),
    onData: vi.fn((listener: (data: string) => void) => {
      callbacks.onData = listener;
      return { dispose: vi.fn() };
    }),
    onExit: vi.fn((listener: (event: { exitCode?: number }) => void) => {
      callbacks.onExit = listener;
      return { dispose: vi.fn() };
    }),
  };
  const spawn = vi.fn(() => fakePty);
  const modules = params?.modules?.({ spawn }, fakePty) ?? { 'node-pty': { spawn } };
  const fakeStdin = Object.assign(new EventEmitter(), {
    pause: vi.fn(),
    destroy: vi.fn(),
  });
  const stdout = createHeldOutput();
  const stderr = createHeldOutput();
  const fakeProcess = Object.assign(new EventEmitter(), {
    platform: params?.platform ?? 'win32',
    argv: ['node', scriptPath, ...argv],
    env: { TERM: 'xterm-256color' },
    exit: vi.fn(),
    exitCode: undefined as number | undefined,
    cwd: vi.fn(() => '/tmp/workspace'),
    stdin: fakeStdin,
    stdout: stdout.stream,
    stderr: stderr.stream,
  });

  vm.runInNewContext(source, {
    Buffer,
    process: fakeProcess,
    require: (id: string) => {
      if (Object.prototype.hasOwnProperty.call(modules, id)) {
        const value = modules[id];
        if (value instanceof Error) throw value;
        return value;
      }
      throw new Error(`unexpected require: ${id}`);
    },
  });

  return { callbacks, fakeProcess, fakePty, spawn, stdout, stderr };
}

describe('node_pty_relay.cjs', () => {
  it('completes despite retained backend handles, only after final output callbacks', async () => {
    const { callbacks, fakeProcess, fakePty, stdout } = createRelayScriptHarness();
    const finalOutput = 'x'.repeat(128 * 1024) + '\nfinal output\n';

    callbacks.onData?.(finalOutput);
    callbacks.onData?.('last bytes');
    callbacks.onExit?.({ exitCode: 7 });

    expect(fakeProcess.exit).not.toHaveBeenCalled();
    expect(fakeProcess.stdin.pause).toHaveBeenCalled();
    await stdout.drain();
    expect(stdout.delivered).toBe(finalOutput + 'last bytes');
    expect(fakePty.kill).toHaveBeenCalled();
    expect(fakeProcess.exit).toHaveBeenCalledExactlyOnceWith(7);
  });

  it('requests cleanup on error but waits for native exit and both output streams', async () => {
    const { callbacks, fakeProcess, fakePty, stdout, stderr } = createRelayScriptHarness();
    fakePty.write.mockImplementation(() => { throw new Error('owned input failed'); });
    fakeProcess.stdin.emit('data', 'input');
    expect(fakePty.kill).toHaveBeenCalledOnce();
    await stderr.drain();
    expect(stderr.delivered).toContain('owned input failed');
    expect(fakeProcess.exit).not.toHaveBeenCalled();

    callbacks.onData?.('child final bytes');
    callbacks.onExit?.({ exitCode: 0 });
    expect(fakeProcess.exit).not.toHaveBeenCalled();
    await stdout.drain();
    expect(stdout.delivered).toBe('child final bytes');
    expect(fakeProcess.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('holds completion for queued diagnostics even when stdout has drained', async () => {
    const { callbacks, fakeProcess, fakePty, stdout, stderr } = createRelayScriptHarness();
    fakePty.write.mockImplementation(() => { throw new Error('diagnostic tail'); });
    fakeProcess.stdin.emit('data', 'input');
    callbacks.onData?.('output tail');
    callbacks.onExit?.({ exitCode: 9 });
    await stdout.drain();
    expect(fakeProcess.exit).not.toHaveBeenCalled();
    await stderr.drain();
    expect(stderr.delivered).toContain('diagnostic tail');
    expect(fakeProcess.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('waits for cleanup to return when it synchronously reports native exit', async () => {
    const { callbacks, fakeProcess, fakePty } = createRelayScriptHarness();
    fakePty.kill.mockImplementation(() => {
      callbacks.onExit?.({ exitCode: 0 });
      expect(fakeProcess.exit).not.toHaveBeenCalled();
    });
    fakeProcess.stdin.emit('end');
    await new Promise<void>((resolve) => setImmediate(resolve));
    expect(fakeProcess.exit).toHaveBeenCalledExactlyOnceWith(0);
  });

  it('does not abandon the native child when cleanup fails before an exit event', async () => {
    const { fakeProcess, fakePty, stderr } = createRelayScriptHarness();
    fakePty.kill.mockImplementation(() => { throw new Error('cleanup failed'); });
    fakeProcess.stdin.emit('end');
    await stderr.drain();
    expect(stderr.delivered).toContain('cleanup failed');
    expect(fakeProcess.exit).not.toHaveBeenCalled();
  });

  it('terminates the Windows child on a signal and keeps repeated cancellation idempotent', async () => {
    const { callbacks, fakeProcess, fakePty, stdout, stderr } = createRelayScriptHarness();
    let nativeAlive = true;
    fakePty.kill.mockImplementation((signal?: string) => {
      // Both installed WindowsTerminal backends reject every nonempty signal.
      if (signal) throw new Error('Signals not supported on windows.');
      nativeAlive = false;
      callbacks.onData?.('native final bytes');
      callbacks.onExit?.({ exitCode: 1 });
    });

    fakeProcess.emit('SIGINT');
    fakeProcess.stdin.emit('end');
    fakeProcess.emit('SIGTERM');

    expect(nativeAlive).toBe(false);
    expect(fakePty.kill).toHaveBeenCalledOnce();
    expect(fakeProcess.exit).not.toHaveBeenCalled();
    await stdout.drain();
    await stderr.drain();
    expect(stdout.delivered).toBe('native final bytes');
    expect(stderr.delivered).toBe('');
    expect(fakeProcess.exit).toHaveBeenCalledExactlyOnceWith(1);
  });

  it('preserves the requested cleanup signal on non-Windows backends', () => {
    const { callbacks, fakeProcess, fakePty } = createRelayScriptHarness(['--', 'fake-shell'], { platform: 'linux' });
    fakePty.kill.mockImplementation((signal?: string) => {
      if (signal === 'SIGTERM') callbacks.onExit?.({ exitCode: 143 });
    });

    fakeProcess.emit('SIGTERM');

    expect(fakePty.kill).toHaveBeenCalledExactlyOnceWith('SIGTERM');
    expect(fakeProcess.exit).toHaveBeenCalledExactlyOnceWith(143);
  });

  it('preserves string child args when requested by the relay protocol', () => {
    const { spawn } = createRelayScriptHarness(['--args-kind', 'string', '--', 'cmd.exe', '/c echo ok']);

    expect(spawn).toHaveBeenCalledWith(
      'cmd.exe',
      '/c echo ok',
      expect.objectContaining({ encoding: null, useConpty: true }),
    );
  });

  it('falls back to the packaged prebuilt PTY backend when node-pty cannot load', () => {
    const homebridgeSpawn = vi.fn();
    createRelayScriptHarness(['--', 'cmd.exe'], {
      modules: (_defaultModule, fakePty) => ({
        'node-pty': new Error('node-pty native binding unavailable'),
        '@homebridge/node-pty-prebuilt-multiarch': {
          spawn: homebridgeSpawn.mockReturnValue(fakePty),
        },
      }),
    });

    expect(homebridgeSpawn).toHaveBeenCalledWith(
      'cmd.exe',
      [],
      expect.objectContaining({ encoding: null, useConpty: true }),
    );
  });
});
