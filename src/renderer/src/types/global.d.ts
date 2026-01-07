import type { ADBDevice, Settings, ApiResponse } from '@shared/types/models';
import type { ExecuteAdbCommandPayload, ExecuteAdbResult } from '@main/services/adbService';

interface SaveLogsPayload {
  content?: string;
  fileName?: string;
}

interface SaveLogsResult {
  filePath: string | null;
}

interface LogcatStartOptions {
  deviceId?: string;
  format?: string;
}

declare global {
  interface Window {
    api?: {
      getDevices: () => Promise<ApiResponse<ADBDevice[]>>;
      executeAdbCommand: (
        payload: ExecuteAdbCommandPayload,
      ) => Promise<ApiResponse<ExecuteAdbResult>>;
      getSettings: () => Promise<ApiResponse<Settings>>;
      updateSettings: (partial: Partial<Settings>) => Promise<ApiResponse<Settings>>;
      saveLogs: (payload: SaveLogsPayload) => Promise<ApiResponse<SaveLogsResult>>;
      clearLogs: () => Promise<ApiResponse<{ success: boolean }>>;
      startLogcat: (options: LogcatStartOptions) => Promise<ApiResponse<void>>;
      stopLogcat: () => Promise<ApiResponse<void>>;
      onLogMessage: (listener: (line: string) => void) => void;
      offLogMessage: (listener: (line: string) => void) => void;
      onLogStatus: (listener: (status: 'started' | 'stopped') => void) => void;
      offLogStatus: (listener: (status: 'started' | 'stopped') => void) => void;
    };
  }
}

export {};
