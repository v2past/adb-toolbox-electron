import { app } from 'electron';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, resolve as resolvePath } from 'path';
import type { Settings } from '@shared/types/models';

const DEFAULT_POLL_INTERVAL_MS = 5000;
const MIN_POLL_INTERVAL_MS = 500;
const MAX_POLL_INTERVAL_MS = 60_000;

const DEFAULT_SETTINGS: Settings = {
  adbPath: '',
  logSaveDirectory: '',
  devicePollIntervalMs: DEFAULT_POLL_INTERVAL_MS,
};

let currentSettings: Settings | null = null;

function getSettingsFilePath(): string {
  return join(app.getPath('userData'), 'settings.json');
}

function normalizePollInterval(value: number | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_POLL_INTERVAL_MS;
  }
  const clamped = Math.min(Math.max(value, MIN_POLL_INTERVAL_MS), MAX_POLL_INTERVAL_MS);
  return clamped;
}

function normalizePathInput(raw?: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (!trimmed) return '';
  return resolvePath(trimmed);
}

function normalizeSettings(settings: Partial<Settings>): Settings {
  return {
    adbPath: normalizePathInput(settings.adbPath),
    logSaveDirectory: normalizePathInput(settings.logSaveDirectory),
    devicePollIntervalMs: normalizePollInterval(settings.devicePollIntervalMs),
  };
}

async function loadSettingsFromDisk(): Promise<Settings> {
  try {
    const filePath = getSettingsFilePath();
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return normalizeSettings({ ...DEFAULT_SETTINGS, ...parsed });
  } catch (error: any) {
    if (error?.code !== 'ENOENT') {
      // eslint-disable-next-line no-console
      console.warn('[adb-toolbox] 读取设置文件失败，将使用默认配置:', error);
    }
    return { ...DEFAULT_SETTINGS };
  }
}

/**
 * 获取当前应用设置。
 *
 * 设置会被持久化到 app.getPath('userData')/settings.json 中，并在首次调用时懒加载。
 */
export async function getSettings(): Promise<Settings> {
  if (!currentSettings) {
    currentSettings = await loadSettingsFromDisk();
  }
  return currentSettings;
}

/**
 * 更新并持久化设置。
 *
 * - 对路径类字段进行规范化（去空格、转为绝对路径）；
 * - 对轮询间隔做范围校验；
 * - 写入失败时抛出带 code 的错误，供 IPC 层包装。
 */
export async function updateSettings(partial: Partial<Settings>): Promise<Settings> {
  const existing = await getSettings();

  const next: Settings = {
    adbPath: normalizePathInput(partial.adbPath ?? existing.adbPath),
    logSaveDirectory: normalizePathInput(partial.logSaveDirectory ?? existing.logSaveDirectory),
    devicePollIntervalMs: normalizePollInterval(
      partial.devicePollIntervalMs ?? existing.devicePollIntervalMs,
    ),
  };

  try {
    await mkdir(app.getPath('userData'), { recursive: true });
    await writeFile(getSettingsFilePath(), JSON.stringify(next, null, 2), 'utf8');
  } catch (error) {
    const err = new Error('保存设置失败');
    (err as any).code = 'SETTINGS_SAVE_FAILED';
    (err as any).details = { originalError: error };
    throw err;
  }

  currentSettings = next;
  return next;
}
