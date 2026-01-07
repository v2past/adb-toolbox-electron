export type ADBDeviceStatus = 'device' | 'offline' | 'unauthorized' | 'unknown';

export interface ADBDevice {
  id: string;
  status: ADBDeviceStatus;
  model?: string;
  product?: string;
  transportId?: string;
}

export type OperationType =
  | 'adb-command'
  | 'device-refresh'
  | 'logcat-start'
  | 'logcat-stop'
  | 'settings-update'
  | 'custom-shell';

export type OperationStatus = 'pending' | 'success' | 'failed';

export interface Operation {
  id: string;
  type: OperationType;
  deviceId?: string;
  command?: string;
  args?: string[];
  status: OperationStatus;
  output?: string;
  error?: string;
  createdAt: string;
  finishedAt?: string;
}

export interface Settings {
  adbPath?: string;
  logSaveDirectory?: string;
  devicePollIntervalMs: number;
}

export interface AppState {
  devices: ADBDevice[];
  selectedDeviceId?: string;
  isDevicePolling: boolean;
  isLogStreaming: boolean;
  operations: Operation[];
  settings: Settings;
}

export interface ApiError {
  code: string;
  message: string;
  /**
   * 附加调试信息，仅用于开发排查，不建议直接展示给终端用户。
   */
  details?: unknown;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  error?: ApiError;
}
