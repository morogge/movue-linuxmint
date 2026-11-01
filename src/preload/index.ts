import { contextBridge, ipcRenderer } from 'electron';

export interface AppInfo {
  version: string;
  electron: string;
  platform: string;
}

const api = {
  getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-fullscreen')
};

export type MovueApi = typeof api;

contextBridge.exposeInMainWorld('movue', api);
