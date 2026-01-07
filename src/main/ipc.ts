import { ipcMain } from 'electron';
import type { ADBDevice, ApiResponse, Settings } from '@shared/types/models';
import {
  listDevices,
  executeAdbCommand,
  type ExecuteAdbCommandPayload,
  type ExecuteAdbResult,
} from './services/adbService';
import { getSettings, updateSettings } from './services/settingsService';
import {
  saveLogFile,
  clearLogFiles,
  startLogcat,
  stopLogcat,
  type SaveLogFilePayload,
  type SaveLogFileResult,
  type LogcatStartOptions,
} from './services/logService';

function toApiError(error: unknown, defaultCode: string) {
  const fallbackMessage = '发生未知错误';
  if (error && typeof error === 'object') {
    const e = error as any;
    const code = typeof e.code === 'string' ? e.code : defaultCode;
    const message = typeof e.message === 'string' ? e.message : fallbackMessage;
    const details = e.details ?? undefined;
    return { code, message, details };
  }
  return {
    code: defaultCode,
    message: fallbackMessage,
    details: error,
  };
}

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data };
}

function fail<T = never>(error: { code: string; message: string; details?: unknown }): ApiResponse<T> {
  return { ok: false, error };
}

export function registerIpcHandlers() {
  // 设备列表：GET /api/devices
  ipcMain.handle('GET /api/devices', async (): Promise<ApiResponse<ADBDevice[]>> => {
    try {
      const devices = await listDevices();
      return ok(devices);
    } catch (error) {
      return fail(toApiError(error, 'ADB_LIST_DEVICES_FAILED'));
    }
  });

  // 执行 ADB 命令：POST /api/adb/execute
  ipcMain.handle(
    'POST /api/adb/execute',
    async (
      _event,
      payload: ExecuteAdbCommandPayload,
    ): Promise<ApiResponse<ExecuteAdbResult>> => {
      try {
        const result = await executeAdbCommand(payload);
        return ok(result);
      } catch (error) {
        return fail(toApiError(error, 'ADB_EXECUTE_FAILED'));
      }
    },
  );

  // 获取设置：GET /api/settings
  ipcMain.handle('GET /api/settings', async (): Promise<ApiResponse<Settings>> => {
    try {
      const settings = await getSettings();
      return ok(settings);
    } catch (error) {
      return fail(toApiError(error, 'SETTINGS_LOAD_FAILED'));
    }
  });

  // 更新设置：PUT /api/settings
  ipcMain.handle(
    'PUT /api/settings',
    async (_event, partial: Partial<Settings>): Promise<ApiResponse<Settings>> => {
      try {
        const settings = await updateSettings(partial);
        return ok(settings);
      } catch (error) {
        return fail(toApiError(error, 'SETTINGS_SAVE_FAILED'));
      }
    },
  );

  // 保存日志：POST /api/logs/save
  ipcMain.handle(
    'POST /api/logs/save',
    async (
      _event,
      payload: SaveLogFilePayload,
    ): Promise<ApiResponse<SaveLogFileResult>> => {
      try {
        const result = await saveLogFile(payload);
        return ok(result);
      } catch (error) {
        return fail(toApiError(error, 'LOG_SAVE_FAILED'));
      }
    },
  );

  // 清理日志缓存：DELETE /api/logs
  ipcMain.handle('DELETE /api/logs', async (): Promise<ApiResponse<{ success: boolean }>> => {
    try {
      await clearLogFiles();
      return ok({ success: true });
    } catch (error) {
      return fail(toApiError(error, 'LOG_CLEAR_FAILED'));
    }
  });

  // 启动 logcat：POST /api/logs/start
  ipcMain.handle(
    'POST /api/logs/start',
    async (
      event,
      options: LogcatStartOptions = {},
    ): Promise<ApiResponse<void>> => {
      try {
        await startLogcat(event.sender, options);
        return ok<void>(undefined);
      } catch (error) {
        return fail(toApiError(error, 'LOGCAT_START_FAILED'));
      }
    },
  );

  // 停止 logcat：POST /api/logs/stop
  ipcMain.handle('POST /api/logs/stop', async (): Promise<ApiResponse<void>> => {
    try {
      await stopLogcat();
      return ok<void>(undefined);
    } catch (error) {
      return fail(toApiError(error, 'LOGCAT_STOP_FAILED'));
    }
  });
}
