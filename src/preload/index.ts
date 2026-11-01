import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Film, IndexZustand, SuchAnfrage, SuchErgebnis } from '../shared/film';
import type { UpdateZustand } from '../shared/update';
import type { GenreAnzahl, GenreId } from '../shared/genres';
import type { SenderGruppe } from '../shared/sender';

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
    genres: (): Promise<GenreAnzahl[]> => ipcRenderer.invoke('index:genres'),
    /** Neueste Sendungen eines Genres, je Reihe eine – für die Reihen auf Start- und Sender-Seiten */
    reihe: (a: { genre: GenreId; gruppe?: SenderGruppe | null; limit?: number }): Promise<Film[]> =>
      ipcRenderer.invoke('index:reihe', a),
    film: (id: number): Promise<Film | null> => ipcRenderer.invoke('index:film', id),
    folgen: (id: number): Promise<Film[]> => ipcRenderer.invoke('index:folgen', id),
    /** Meldet jede Zustandsänderung; gibt eine Funktion zum Abmelden zurück. */
    beiAenderung: (callback: (z: IndexZustand) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, z: IndexZustand) => callback(z);
      ipcRenderer.on('index:zustand', listener);
      return () => ipcRenderer.removeListener('index:zustand', listener);
    }
  },
  film: {
    /** Öffnet die Sendungsseite im Browser – oder die Suche beim Sender, wenn die Seite nicht mehr existiert. */
    seiteOeffnen: (film: { website: string; gruppe: string; titel: string }): Promise<'seite' | 'suche' | null> =>
      ipcRenderer.invoke('film:seite-oeffnen', film)
  },
  player: {
    /** Untertitel als WebVTT-Text (null = keine) */
    untertitel: (url: string): Promise<string | null> => ipcRenderer.invoke('untertitel:laden', url),
    fortschrittSetzen: (url: string, position: number, dauer: number): Promise<void> =>
      ipcRenderer.invoke('fortschritt:setzen', url, position, dauer),
    fortschritt: (url: string): Promise<{ position: number; dauer: number } | null> => ipcRenderer.invoke('fortschritt:holen', url),
    vergessen: (url: string): Promise<void> => ipcRenderer.invoke('fortschritt:vergessen', url),
    weiterschauen: (): Promise<{ film: Film; position: number; dauer: number }[]> => ipcRenderer.invoke('index:weiterschauen')
  },
  bild: {
    /** Vorschaubild zur Sendungsseite (null = keins gefunden) */
    url: (website: string): Promise<string | null> => ipcRenderer.invoke('bild:url', website)
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
