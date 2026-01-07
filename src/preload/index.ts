import { contextBridge, ipcRenderer } from 'electron';
import type { ADBDevice, Settings, ApiResponse } from '@shared/types/models';
import type { ExecuteAdbCommandPayload, ExecuteAdbResult } from '@main/services/adbService';

export interface SaveLogsPayload {
  content?: string;
  fileName?: string;
}

export interface SaveLogsResult {
  filePath: string | null;
}

export interface LogcatStartOptions {
  deviceId?: string;
  format?: string;
}

const logMessageListeners = new Map<(line: string) => void, (...args: unknown[]) => void>();
const logStatusListeners = new Map<
  (status: 'started' | 'stopped') => void,
  (...args: unknown[]) => void
>();

const api = {
  getDevices(): Promise<ApiResponse<ADBDevice[]>> {
    return ipcRenderer.invoke('GET /api/devices');
  },
  executeAdbCommand(payload: ExecuteAdbCommandPayload): Promise<ApiResponse<ExecuteAdbResult>> {
    return ipcRenderer.invoke('POST /api/adb/execute', payload);
  },
  getSettings(): Promise<ApiResponse<Settings>> {
    return ipcRenderer.invoke('GET /api/settings');
  },
  updateSettings(partial: Partial<Settings>): Promise<ApiResponse<Settings>> {
    return ipcRenderer.invoke('PUT /api/settings', partial);
  },
  saveLogs(payload: SaveLogsPayload): Promise<ApiResponse<SaveLogsResult>> {
    return ipcRenderer.invoke('POST /api/logs/save', payload);
  },
  clearLogs(): Promise<ApiResponse<{ success: boolean }>> {
    return ipcRenderer.invoke('DELETE /api/logs');
  },
  startLogcat(options: LogcatStartOptions): Promise<ApiResponse<void>> {
    return ipcRenderer.invoke('POST /api/logs/start', options);
  },
  stopLogcat(): Promise<ApiResponse<void>> {
    return ipcRenderer.invoke('POST /api/logs/stop');
  },
  onLogMessage(listener: (line: string) => void): void {
    if (logMessageListeners.has(listener)) {
      return;
    }
    const wrapped = (_event: Electron.IpcRendererEvent, line: string) => {
      listener(line);
    };
    logMessageListeners.set(listener, wrapped);
    ipcRenderer.on('logs:message', wrapped);
  },
  offLogMessage(listener: (line: string) => void): void {
    const wrapped = logMessageListeners.get(listener);
    if (!wrapped) return;
    ipcRenderer.removeListener('logs:message', wrapped);
    logMessageListeners.delete(listener);
  },
  onLogStatus(listener: (status: 'started' | 'stopped') => void): void {
    if (logStatusListeners.has(listener)) {
      return;
    }
    const wrapped = (_event: Electron.IpcRendererEvent, status: 'started' | 'stopped') => {
      listener(status);
    };
    logStatusListeners.set(listener, wrapped);
    ipcRenderer.on('logs:status', wrapped);
  },
  offLogStatus(listener: (status: 'started' | 'stopped') => void): void {
    const wrapped = logStatusListeners.get(listener);
    if (!wrapped) return;
    ipcRenderer.removeListener('logs:status', wrapped);
    logStatusListeners.delete(listener);
  },
};

export type PreloadApi = typeof api;

contextBridge.exposeInMainWorld('api', api);
