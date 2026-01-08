import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { access, writeFile } from 'fs/promises';
import { constants as fsConstants } from 'fs';
import { resolve as resolvePath } from 'path';
import { tmpdir } from 'os';
import type { ADBDevice, ADBDeviceStatus } from '@shared/types/models';
import { resolveAdbExecutable } from '../platform/paths';
import { ensureExecutablePermissions } from '../platform/permissions';
import { validateAdbCommand, applyCommandTimeout } from '../security/commandGuard';
import { getSettings } from './settingsService';

function getCurrentFormattedTime(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${day}.${hours}${minutes}${seconds}`;
}

export interface ExecuteAdbCommandPayload {
  deviceId?: string;
  command: string;
  args?: string[];
  timeoutMs?: number;
  /**
   * 可选参数，用于部分命令（例如 install 的覆盖安装）。
   */
  options?: {
    /**
     * 对 install 操作启用 -r 覆盖安装。
     */
    reinstall?: boolean;
  };
}

export interface ExecuteAdbResult {
  stdout: string;
  stderr: string;
  exitCode: number | null;
  /**
   * 某些命令会返回本地文件路径，例如截图。
   */
  filePath?: string;
}

export async function resolveAdbPathFromSettings(): Promise<string> {
  const settings = await getSettings();
  const customPath = settings.adbPath && settings.adbPath.trim() ? settings.adbPath.trim() : undefined;
  const adbPath = await resolveAdbExecutable(customPath);
  await ensureExecutablePermissions(adbPath);
  return adbPath;
}

async function spawnAdbAndCollect(
  adbPath: string,
  args: string[],
  timeoutMs: number,
): Promise<ExecuteAdbResult> {
  return new Promise((resolve, reject) => {
    const child: ChildProcessWithoutNullStreams = spawn(adbPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    applyCommandTimeout(child, timeoutMs);

    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderrChunks.push(chunk);
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      const error = new Error(
        err.code === 'ENOENT'
          ? '未找到 ADB 可执行文件，请检查环境变量或设置中的 adbPath。'
          : `ADB 命令执行失败：${err.message}`,
      );
      (error as any).code = err.code === 'ENOENT' ? 'ADB_NOT_FOUND' : 'ADB_PROCESS_ERROR';
      (error as any).details = { originalError: err, args };
      reject(error);
    });

    child.on('close', (code: number | null) => {
      const stdout = Buffer.concat(stdoutChunks).toString('utf8');
      const stderr = Buffer.concat(stderrChunks).toString('utf8');
      const timedOut = (child as any).__adbTimeout === true;

      if (timedOut) {
        const error = new Error('ADB 命令执行超时');
        (error as any).code = 'ADB_COMMAND_TIMEOUT';
        (error as any).details = { stdout, stderr, args };
        reject(error);
        return;
      }

      resolve({
        stdout,
        stderr,
        exitCode: code,
      });
    });
  });
}

function buildDeviceArgs(deviceId: string | undefined, subcommandArgs: string[]): string[] {
  const args: string[] = [];
  if (deviceId) {
    args.push('-s', deviceId);
  }
  args.push(...subcommandArgs);
  return args;
}

async function sanitizeApkPath(rawPath: string): Promise<string> {
  const resolved = resolvePath(rawPath);
  try {
    await access(resolved, fsConstants.R_OK);
  } catch (error) {
    const err = new Error(`APK 文件不存在或不可读：${resolved}`);
    (err as any).code = 'APK_NOT_FOUND';
    (err as any).details = { path: resolved };
    throw err;
  }
  return resolved;
}

function mapKeyEvent(arg?: string): string | null {
  if (!arg) return null;
  const value = arg.toLowerCase();
  if (value === 'power') return '26';
  if (value === 'home') return '3';
  if (value === 'back') return '4';
  if (/^\d+$/.test(value)) return value;
  return null;
}

async function captureScreenshot(
  adbPath: string,
  deviceId: string | undefined,
  timeoutMs: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const args = buildDeviceArgs(deviceId, ['exec-out', 'screencap', '-p']);
    const child: ChildProcessWithoutNullStreams = spawn(adbPath, args, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    applyCommandTimeout(child, timeoutMs);

    const stdoutChunks: Buffer[] = [];
    let stderr = '';

    child.stdout.on('data', (chunk: Buffer) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on('data', (chunk: Buffer) => {
      stderr += chunk.toString('utf8');
    });

    child.on('error', (err: NodeJS.ErrnoException) => {
      const error = new Error(
        err.code === 'ENOENT'
          ? '未找到 ADB 可执行文件，请检查环境变量或设置中的 adbPath。'
          : `截图命令执行失败：${err.message}`,
      );
      (error as any).code = err.code === 'ENOENT' ? 'ADB_NOT_FOUND' : 'SCREENSHOT_FAILED';
      (error as any).details = { originalError: err };
      reject(error);
    });

    child.on('close', async (code: number | null) => {
      const timedOut = (child as any).__adbTimeout === true;

      if (timedOut) {
        const error = new Error('截图命令执行超时');
        (error as any).code = 'SCREENSHOT_TIMEOUT';
        (error as any).details = { stderr };
        reject(error);
        return;
      }

      if (code !== 0) {
        const error = new Error(`截图命令返回非零退出码：${code}\n${stderr}`);
        (error as any).code = 'SCREENSHOT_FAILED';
        (error as any).details = { stderr, exitCode: code };
        reject(error);
        return;
      }

      const buffer = Buffer.concat(stdoutChunks);
      try {
        const fileName = `adb-screenshot-${Date.now()}.png`;
        const filePath = resolvePath(tmpdir(), fileName);
        await writeFile(filePath, buffer);
        resolve(filePath);
      } catch (err) {
        const error = new Error('保存截图文件失败');
        (error as any).code = 'SCREENSHOT_SAVE_FAILED';
        (error as any).details = { originalError: err };
        reject(error);
      }
    });
  });
}

/**
 * 获取当前连接的设备列表。
 *
 * 通过执行 `adb devices -l` 并解析输出。
 */
export async function listDevices(): Promise<ADBDevice[]> {
  const adbPath = await resolveAdbPathFromSettings();
  const result = await spawnAdbAndCollect(adbPath, ['devices', '-l'], 10_000);

  if (!result.stdout) {
    return [];
  }

  const lines = result.stdout
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.toLowerCase().startsWith('list of devices'));

  const devices: ADBDevice[] = [];

  for (const line of lines) {
    const parts = line.split(/\s+/);
    if (parts.length === 0) continue;

    const id = parts[0];
    const state = parts[1] ?? 'unknown';
    const propsTokens = parts.slice(2);

    const props: Record<string, string> = {};
    for (const token of propsTokens) {
      const [k, v] = token.split(':');
      if (k && v) {
        props[k] = v;
      }
    }

    const status = mapAdbStatus(state as string);

    devices.push({
      id,
      status,
      model: props.model,
      product: props.product,
      transportId: props.transport_id ?? props.transportId,
    });
  }

  return devices;
}

function mapAdbStatus(raw: string): ADBDeviceStatus {
  const value = raw.toLowerCase();
  if (value === 'device' || value === 'offline' || value === 'unauthorized') {
    return value;
  }
  return 'unknown';
}

/**
 * 执行 ADB 命令的统一入口。
 *
 * 该函数负责：
 *  - 解析/拼装 ADB 可执行路径（含跨平台处理）；
 *  - 调用安全校验逻辑（命令黑名单、参数长度等）；
 *  - 使用 child_process 启动子进程并接收输出；
 *  - 应用超时控制，防止命令长时间卡死；
 *  - 将结果以结构化形式返回给调用方。
 */
export async function executeAdbCommand(payload: ExecuteAdbCommandPayload): Promise<ExecuteAdbResult> {
  const { deviceId, command, args = [], timeoutMs = 30_000, options } = payload;

  // 基础安全校验：黑名单、非法字符等。
  validateAdbCommand(command, args);

  const adbPath = await resolveAdbPathFromSettings();

  switch (command) {
    case 'keyevent': {
      const keyCode = mapKeyEvent(args[0]);
      if (!keyCode) {
        const error = new Error('不支持的按键类型，请使用 power/home/back 或合法的 keycode。');
        (error as any).code = 'INVALID_KEY_EVENT';
        throw error;
      }

      const adbArgs = buildDeviceArgs(deviceId, ['shell', 'input', 'keyevent', keyCode]);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    case 'screencap': {
      const filePath = await captureScreenshot(adbPath, deviceId, timeoutMs);
      return {
        stdout: filePath,
        stderr: '',
        exitCode: 0,
        filePath,
      };
    }
    case 'reboot': {
      const adbArgs = buildDeviceArgs(deviceId, ['reboot']);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    case 'sync-time': {
      const formattedTime = getCurrentFormattedTime();
      const adbArgs = buildDeviceArgs(deviceId, ['shell', 'su', '-c', 'date', '-s', formattedTime]);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    case 'remount': {
      const rootArgs = buildDeviceArgs(deviceId, ['root']);
      await spawnAdbAndCollect(adbPath, rootArgs, timeoutMs);
      const remountArgs = buildDeviceArgs(deviceId, ['remount']);
      return spawnAdbAndCollect(adbPath, remountArgs, timeoutMs);
    }
    case 'install': {
      if (!args[0]) {
        const error = new Error('install 命令缺少 APK 路径参数');
        (error as any).code = 'APK_PATH_REQUIRED';
        throw error;
      }
      const apkPath = await sanitizeApkPath(args[0]);
      const installArgs = ['install'];
      if (options?.reinstall) {
        installArgs.push('-r');
      }
      installArgs.push(apkPath);
      const adbArgs = buildDeviceArgs(deviceId, installArgs);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    case 'uninstall': {
      if (!args[0]) {
        const error = new Error('uninstall 命令缺少包名参数');
        (error as any).code = 'PACKAGE_NAME_REQUIRED';
        throw error;
      }
      const adbArgs = buildDeviceArgs(deviceId, ['uninstall', args[0]]);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    case 'list-packages': {
      const extraArgs = args.length > 0 ? args : [];
      const adbArgs = buildDeviceArgs(deviceId, ['shell', 'pm', 'list', 'packages', ...extraArgs]);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    case 'shell': {
      if (args.length === 0) {
        const error = new Error('自定义 shell 命令不能为空');
        (error as any).code = 'SHELL_ARGS_REQUIRED';
        throw error;
      }
      const adbArgs = buildDeviceArgs(deviceId, ['shell', ...args]);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
    default: {
      // 未显式支持的命令，按原样拼接到 adb 后执行（仍受 validateAdbCommand 保护）。
      const adbArgs = buildDeviceArgs(deviceId, [command, ...args]);
      return spawnAdbAndCollect(adbPath, adbArgs, timeoutMs);
    }
  }
}
