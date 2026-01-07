import create from 'zustand';
import type { ADBDevice, AppState as AppStateModel, Operation, Settings } from '@shared/types/models';

interface AppStore extends AppStateModel {
  setDevices: (devices: ADBDevice[]) => void;
  setSelectedDeviceId: (id?: string) => void;
  setIsDevicePolling: (value: boolean) => void;
  setIsLogStreaming: (value: boolean) => void;
  addOperation: (operation: Operation) => void;
  updateSettingsState: (partial: Partial<Settings>) => void;
  initializeSettings: () => Promise<void>;
}

export const useAppStore = create<AppStore>((set) => ({
  devices: [],
  selectedDeviceId: undefined,
  isDevicePolling: false,
  isLogStreaming: false,
  operations: [],
  settings: {
    adbPath: '',
    logSaveDirectory: '',
    devicePollIntervalMs: 5000,
  },
  setDevices: (devices) => set({ devices }),
  setSelectedDeviceId: (id) => set({ selectedDeviceId: id }),
  setIsDevicePolling: (value) => set({ isDevicePolling: value }),
  setIsLogStreaming: (value) => set({ isLogStreaming: value }),
  addOperation: (operation) =>
    set((state) => ({ operations: [operation, ...state.operations] })),
  updateSettingsState: (partial) =>
    set((state) => ({ settings: { ...state.settings, ...partial } })),
  initializeSettings: async () => {
    try {
      const res = await window.api?.getSettings();
      if (res?.ok && res.data) {
        set({ settings: res.data });
      } else if (res && !res.ok) {
        console.error('初始化设置失败', res.error);
      }
    } catch (error) {
      console.error('初始化设置失败', error);
    }
  },
}));
