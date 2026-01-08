import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { access } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { ensureExecutablePermissions } from '../platform/permissions';
import { listDevices, resolveAdbPathFromSettings } from './adbService';

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
    candidates.push(
      '/usr/local/bin/scrcpy',
      '/usr/bin/scrcpy',
      '/opt/homebrew/bin/scrcpy',
    );
  }

  for (const p of candidates) {
    try {
      await access(p, fsConstants.X_OK);
      await ensureExecutablePermissions(p);
      console.log(`[scrcpy] Found scrcpy at: ${p}`);
      return p;
    } catch {
      continue;
    }
  }

  console.warn(`[scrcpy] Scrcpy executable not found, using system PATH: ${binaryName}`);
  return binaryName;
}

export async function startScrcpy(options: ScrcpyStartOptions): Promise<void> {
  if (scrcpyProcess) {
    throw new Error('Scrcpy is already running');
  }

  const scrcpyPath = await resolveScrcpyExecutable();
  console.log(`[scrcpy] Starting scrcpy with path: ${scrcpyPath}`);

  const devices = await listDevices();
  const device = devices.find(d => d.id === options.deviceId);
  
  if (!device) {
    throw new Error(`Device ${options.deviceId} not found. Please check device connection.`);
  }

  if (device.status !== 'device') {
    throw new Error(`Device ${options.deviceId} is not ready. Status: ${device.status}`);
  }

  console.log(`[scrcpy] Device found: ${device.id} (${device.model})`);
  
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

  console.log(`[scrcpy] Command: ${scrcpyPath} ${args.join(' ')}`);

  const scrcpyDir = join(scrcpyPath, '..');

  const adbPath = await resolveAdbPathFromSettings();
  const adbDir = join(adbPath, '..');

  const env = { ...process.env };
  
  if (process.platform === 'darwin') {
    env.DYLD_LIBRARY_PATH = scrcpyDir;
  }
  
  env.PATH = `${adbDir}${process.platform === 'win32' ? ';' : ':'}${env.PATH || ''}`;
  env.ADB = adbPath;

  console.log(`[scrcpy] ADB path: ${adbPath}`);
  console.log(`[scrcpy] PATH: ${env.PATH}`);

  scrcpyProcess = spawn(scrcpyPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
    cwd: scrcpyDir,
    env,
  });

  let stderrOutput = '';
  let stdoutOutput = '';

  scrcpyProcess.on('error', (error) => {
    console.error('[scrcpy] Process error:', error);
    scrcpyProcess = null;
    currentWindowId = null;
  });

  scrcpyProcess.on('exit', (code, signal) => {
    console.log(`[scrcpy] Process exited with code ${code}, signal ${signal}`);
    if (stderrOutput) {
      console.error('[scrcpy] stderr output:', stderrOutput);
    }
    if (stdoutOutput) {
      console.log('[scrcpy] stdout output:', stdoutOutput);
    }
    scrcpyProcess = null;
    currentWindowId = null;
  });

  scrcpyProcess.stdout?.on('data', (data) => {
    const text = data.toString();
    stdoutOutput += text;
    console.log('[scrcpy] stdout:', text);
  });

  scrcpyProcess.stderr?.on('data', (data) => {
    const text = data.toString();
    stderrOutput += text;
    console.error('[scrcpy] stderr:', text);
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      if (scrcpyProcess?.killed) {
        reject(new Error('Scrcpy process failed to start'));
        return;
      }
      console.log('[scrcpy] Process started successfully');
      resolve();
    }, 2000);

    scrcpyProcess?.once('exit', (code) => {
      clearTimeout(timeout);
      if (code !== null && code !== 0) {
        let errorMsg = `Scrcpy process exited with code ${code}`;
        if (stderrOutput) {
          errorMsg += `\nError output: ${stderrOutput}`;
        }
        reject(new Error(errorMsg));
      }
    });

    scrcpyProcess?.once('error', (error) => {
      clearTimeout(timeout);
      let errorMsg = `Scrcpy process error: ${error.message}`;
      if (stderrOutput) {
        errorMsg += `\nError output: ${stderrOutput}`;
      }
      reject(new Error(errorMsg));
    });
  });
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
