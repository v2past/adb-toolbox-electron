import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { ensureExecutablePermissions } from '../platform/permissions';

export interface ScrcpyStartOptions {
  deviceId: string;
  windowTitle?: string;
  windowWidth?: number;
  windowHeight?: number;
  alwaysOnTop?: boolean;
  noBorder?: boolean;
  stayAwake?: boolean;
}

export interface ScrcpyStatus {
  running: boolean;
  deviceId?: string;
  windowId?: number;
  pid?: number;
}

let scrcpyProcess: ChildProcessWithoutNullStreams | null = null;
let currentWindowId: number | null = null;

export async function resolveScrcpyExecutable(): Promise<string> {
  const isWindows = process.platform === 'win32';
  const binaryName = isWindows ? 'scrcpy.exe' : 'scrcpy';
  const platformSegment = process.platform;

  const candidates: string[] = [];

  const resourcesDir = process.resourcesPath;
  candidates.push(
    join(resourcesDir, 'scrcpy', platformSegment, binaryName),
    join(resourcesDir, 'scrcpy', binaryName),
  );

  const appPath = app.getAppPath();
  candidates.push(
    join(appPath, 'vendor', 'scrcpy', platformSegment, binaryName),
    join(appPath, '..', 'vendor', 'scrcpy', platformSegment, binaryName),
  );

  if (!isWindows) {
    candidates.push('/usr/local/bin/scrcpy', '/usr/bin/scrcpy');
  }

  for (const p of candidates) {
    try {
      await access(p, fsConstants.X_OK);
      await ensureExecutablePermissions(p);
      return p;
    } catch {
      continue;
    }
  }

  return binaryName;
}

export async function startScrcpy(options: ScrcpyStartOptions): Promise<void> {
  if (scrcpyProcess) {
    throw new Error('Scrcpy is already running');
  }

  const scrcpyPath = await resolveScrcpyExecutable();
  const args: string[] = [];

  args.push('-s', options.deviceId);

  if (options.windowTitle) {
    args.push('--window-title', options.windowTitle);
  }

  if (options.windowWidth && options.windowHeight) {
    args.push('--window-width', options.windowWidth.toString());
    args.push('--window-height', options.windowHeight.toString());
  }

  if (options.alwaysOnTop) {
    args.push('--always-on-top');
  }

  if (options.noBorder) {
    args.push('--window-borderless');
  }

  if (options.stayAwake) {
    args.push('--stay-awake');
  }

  const scrcpyDir = join(scrcpyPath, '..');

  scrcpyProcess = spawn(scrcpyPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
    cwd: scrcpyDir,
  });

  scrcpyProcess.on('error', (error) => {
    console.error('Scrcpy process error:', error);
    scrcpyProcess = null;
    currentWindowId = null;
  });

  scrcpyProcess.on('exit', (code, signal) => {
    console.log(`Scrcpy process exited with code ${code}, signal ${signal}`);
    scrcpyProcess = null;
    currentWindowId = null;
  });

  scrcpyProcess.stderr?.on('data', (data) => {
    console.error('Scrcpy stderr:', data.toString());
  });

  scrcpyProcess.unref();
}

export async function stopScrcpy(): Promise<void> {
  if (!scrcpyProcess) {
    return;
  }

  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (scrcpyProcess) {
        scrcpyProcess.kill('SIGKILL');
      }
      resolve();
    }, 5000);

    scrcpyProcess.once('exit', () => {
      clearTimeout(timeout);
      resolve();
    });

    scrcpyProcess.kill('SIGTERM');
    scrcpyProcess = null;
    currentWindowId = null;
  });
}

export function getScrcpyStatus(): ScrcpyStatus {
  return {
    running: scrcpyProcess !== null,
    deviceId: undefined,
    windowId: currentWindowId ?? undefined,
    pid: scrcpyProcess?.pid,
  };
}
