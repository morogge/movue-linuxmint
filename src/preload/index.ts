import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Film, IndexZustand, SuchAnfrage, SuchErgebnis } from '../shared/film';
import type { UpdateZustand } from '../shared/update';
import type { GenreAnzahl, GenreId } from '../shared/genres';
import type { SenderGruppe } from '../shared/sender';
import type { Abo, Ablauf, MerkEintrag } from '../shared/nutzer';

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
  merkliste: {
    liste: (): Promise<MerkEintrag[]> => ipcRenderer.invoke('merkliste:liste'),
    ist: (url: string): Promise<boolean> => ipcRenderer.invoke('merkliste:ist', url),
    /** Merken (an = true, über die id) oder entfernen (an = false, über die Videoadresse); gibt den neuen Zustand zurück */
    setzen: (film: { id: number; url: string }, an: boolean): Promise<boolean> =>
      ipcRenderer.invoke('merkliste:setzen', { id: film.id, url: film.url }, an)
  },
  abo: {
    liste: (): Promise<Abo[]> => ipcRenderer.invoke('abo:liste'),
    ist: (r: { gruppe: SenderGruppe; thema: string }): Promise<boolean> => ipcRenderer.invoke('abo:ist', r),
    setzen: (r: { gruppe: SenderGruppe; thema: string }, an: boolean): Promise<boolean> => ipcRenderer.invoke('abo:setzen', r, an),
    /** Reihe angesehen: neue Folgen gelten als gesehen */
    gesehen: (r: { gruppe: SenderGruppe; thema: string }): Promise<void> => ipcRenderer.invoke('abo:gesehen', r),
    /** Meldet, wenn nach dem Laden des Verzeichnisses neue Folgen da sind */
    beiNeuen: (callback: () => void): (() => void) => {
      const listener = () => callback();
      ipcRenderer.on('abo:neu', listener);
      return () => ipcRenderer.removeListener('abo:neu', listener);
    }
  },
  ablauf: {
    /** Wie lange die Sendung noch abrufbar ist – fragt beim Sender nach (null = unbekannt) */
    holen: (id: number): Promise<Ablauf | null> => ipcRenderer.invoke('ablauf:holen', id),
    bald: (): Promise<{ film: Film; ablauf: Ablauf; gemerkt: boolean }[]> => ipcRenderer.invoke('ablauf:bald')
  },
  /** Der Hauptprozess bittet um einen Bildschirmwechsel (Klick auf eine Benachrichtigung) */
  beiNavigation: (callback: (screen: string) => void): (() => void) => {
    const listener = (_e: IpcRendererEvent, screen: string) => callback(screen);
    ipcRenderer.on('navigation', listener);
    return () => ipcRenderer.removeListener('navigation', listener);
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
