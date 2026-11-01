import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { IndexZustand, SuchAnfrage, SuchErgebnis } from '../shared/film';
import type { UpdateZustand } from '../shared/update';

export interface AppInfo {
  version: string;
  electron: string;
  platform: string;
}

const api = {
  getInfo: (): Promise<AppInfo> => ipcRenderer.invoke('app:info'),
  toggleFullscreen: (): Promise<boolean> => ipcRenderer.invoke('window:toggle-fullscreen'),
  index: {
    zustand: (): Promise<IndexZustand> => ipcRenderer.invoke('index:zustand'),
    suche: (anfrage: SuchAnfrage): Promise<SuchErgebnis> => ipcRenderer.invoke('index:suche', anfrage),
    /** Meldet jede Zustandsänderung; gibt eine Funktion zum Abmelden zurück. */
    beiAenderung: (callback: (z: IndexZustand) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, z: IndexZustand) => callback(z);
      ipcRenderer.on('index:zustand', listener);
      return () => ipcRenderer.removeListener('index:zustand', listener);
    }
  },
  update: {
    zustand: (): Promise<UpdateZustand> => ipcRenderer.invoke('update:zustand'),
    installieren: (): Promise<void> => ipcRenderer.invoke('update:installieren'),
    beiAenderung: (callback: (z: UpdateZustand) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, z: UpdateZustand) => callback(z);
      ipcRenderer.on('update:zustand', listener);
      return () => ipcRenderer.removeListener('update:zustand', listener);
    }
  }
};

export type MovueApi = typeof api;

contextBridge.exposeInMainWorld('movue', api);
