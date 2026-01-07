import { app, type WebContents } from 'electron';
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process';
import { join, resolve as resolvePath } from 'path';
import { mkdir, writeFile } from 'fs/promises';
import { getSettings } from './settingsService';
import { resolveAdbExecutable } from '../platform/paths';
import { ensureExecutablePermissions } from '../platform/permissions';

export interface SaveLogFilePayload {
  content?: string;
  fileName?: string;
}

export interface SaveLogFileResult {
  filePath: string | null;
}

export interface LogcatStartOptions {
  deviceId?: string;
  format?: string;
}

let logcatProcess: ChildProcessWithoutNullStreams | null = null;
let logTarget: WebContents | null = null;
let logBuffer = '';

function appendLogLine(line: string): void {
  if (!line) return;
  if (logBuffer) {
    logBuffer += '\n' + line;
  } else {
    logBuffer = line;
  }
}

export async function startLogcat(
  webContents: WebContents,
  options: LogcatStartOptions = {},
): Promise<void> {
  await stopLogcat();

  const settings = await getSettings();
  const customPath = settings.adbPath && settings.adbPath.trim() ? settings.adbPath.trim() : undefined;
  const adbPath = await resolveAdbExecutable(customPath);
  await ensureExecutablePermissions(adbPath);

  const { deviceId, format = 'time' } = options;

  const args: string[] = [];
  if (deviceId) {
    args.push('-s', deviceId);
  }
  args.push('logcat', '-v', format);

  const child: ChildProcessWithoutNullStreams = spawn(adbPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  logcatProcess = child;
  logTarget = webContents;

  if (!webContents.isDestroyed()) {
    webContents.send('logs:status', 'started');
  }

  let stdoutBuffer = '';

  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (chunk: string) => {
    stdoutBuffer += chunk;
    const lines = stdoutBuffer.split(/\r?\n/);
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line) continue;
      appendLogLine(line);
      if (logTarget && !logTarget.isDestroyed()) {
        logTarget.send('logs:message', line);
      }
    }
  });

  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (chunk: string) => {
    const text = chunk.toString();
    const lines = text.split(/\r?\n/).filter(Boolean);
    for (const line of lines) {
      const message = `[stderr] ${line}`;
      appendLogLine(message);
      if (logTarget && !logTarget.isDestroyed()) {
        logTarget.send('logs:message', message);
      }
    }
  });

  child.on('error', (err: NodeJS.ErrnoException) => {
    const message =
      err.code === 'ENOENT'
        ? '未找到 ADB 可执行文件，请检查环境变量或设置中的 adbPath。'
        : `启动 logcat 失败：${err.message}`;
    const prefixed = `[error] ${message}`;
    appendLogLine(prefixed);
    if (logTarget && !logTarget.isDestroyed()) {
      logTarget.send('logs:message', prefixed);
      logTarget.send('logs:status', 'stopped');
    }
    logcatProcess = null;
  });

  child.on('close', () => {
    if (logTarget && !logTarget.isDestroyed()) {
      logTarget.send('logs:status', 'stopped');
    }
    logcatProcess = null;
  });
}

export async function stopLogcat(): Promise<void> {
  if (logcatProcess) {
    try {
      logcatProcess.removeAllListeners();
      logcatProcess.kill();
    } catch {
      // ignore
    } finally {
      logcatProcess = null;
    }
  }

  if (logTarget && !logTarget.isDestroyed()) {
    logTarget.send('logs:status', 'stopped');
  }
  logTarget = null;
}

/**
 * 日志保存：将内容写入用户指定目录或系统文档目录。
 */
export async function saveLogFile(payload: SaveLogFilePayload): Promise<SaveLogFileResult> {
  const contentToSave = payload.content ?? logBuffer;

  if (!contentToSave) {
    return { filePath: null };
  }

  const settings = await getSettings();
  const baseDir =
    (settings.logSaveDirectory && settings.logSaveDirectory.trim()) || app.getPath('documents');
  const dir = resolvePath(baseDir);

  await mkdir(dir, { recursive: true });

  const fileName =
    payload.fileName || `adb-log-${new Date().toISOString().replace(/[:.]/g, '-')}.log`;
  const filePath = join(dir, fileName);

  await writeFile(filePath, contentToSave, 'utf8');

  return { filePath };
}

/**
 * 清理当前日志缓存（不删除磁盘文件）。
 */
export async function clearLogFiles(): Promise<void> {
  logBuffer = '';
}
