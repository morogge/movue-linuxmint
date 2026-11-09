import { contextBridge, ipcRenderer, type IpcRendererEvent } from 'electron';
import type { Film, IndexZustand, SuchAnfrage, SuchErgebnis } from '../shared/film';
import type { UpdateZustand } from '../shared/update';
import type { Format, GenreAnzahl, GenreId } from '../shared/genres';
import type { SenderGruppe } from '../shared/sender';
import type { Abo, Ablauf, MerkEintrag } from '../shared/nutzer';
import type { ReihenTrailer, Serie, SerieDetail } from '../shared/serie';
import type { LiveAngebot } from '../shared/live';
import type { TitelInfo } from '../shared/titelinfo';

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
    /** Serie bzw. Sendereihe mit allen Folgen */
    serie: (r: { gruppe: SenderGruppe; thema: string }): Promise<SerieDetail | null> => ipcRenderer.invoke('index:serie', r),
    /** Genre-Seite: Serien als je ein Eintrag, Einzelsendungen dazwischen */
    stoebern: (a: {
      genre?: GenreId | null;
      format?: Format | null;
      gruppe?: SenderGruppe | null;
      limit?: number;
      offset?: number;
    }): Promise<{ eintraege: ({ typ: 'serie'; serie: Serie; datum: number } | { typ: 'film'; film: Film; datum: number })[]; gesamt: number }> =>
      ipcRenderer.invoke('index:stoebern', a),
    /** Trailer und Extras zu einer Sendung (aus ihrem Bündel oder mit gleichem Thema) */
    extras: (id: number): Promise<Film[]> => ipcRenderer.invoke('index:extras', id),
    /** Anzahl der Einträge je Art (Serien, Filme, Dokus …), wahlweise nur eines Genres oder Senders */
    arten: (a?: { genre?: GenreId | null; gruppe?: SenderGruppe | null }): Promise<Partial<Record<Format, number>>> =>
      ipcRenderer.invoke('index:arten', a ?? {}),
    serienSuche: (a: { text: string; gruppe?: SenderGruppe | null }): Promise<Serie[]> => ipcRenderer.invoke('index:serien-suche', a),
    folgen: (id: number): Promise<Film[]> => ipcRenderer.invoke('index:folgen', id),
    /** Fassungen derselben Sendung; name = null für die Standardfassung */
    fassungen: (id: number): Promise<{ film: Film; name: string | null }[]> => ipcRenderer.invoke('index:fassungen', id),
    /** Dieselbe Sendung bei anderen Sendern */
    auchBei: (id: number): Promise<Film[]> => ipcRenderer.invoke('index:auch-bei', id),
    /** Besetzung und Stab (ZDF, 3sat) – null, wenn der Sender nicht erreichbar war */
    titelInfo: (id: number): Promise<TitelInfo | null> => ipcRenderer.invoke('titel:info', id),
    /** Besetzung einer Serie (Wikidata) */
    serieInfo: (r: { gruppe: SenderGruppe; thema: string }): Promise<TitelInfo | null> => ipcRenderer.invoke('serie:info', r),
    /** Meldet jede Zustandsänderung; gibt eine Funktion zum Abmelden zurück. */
    beiAenderung: (callback: (z: IndexZustand) => void): (() => void) => {
      const listener = (_e: IpcRendererEvent, z: IndexZustand) => callback(z);
      ipcRenderer.on('index:zustand', listener);
      return () => ipcRenderer.removeListener('index:zustand', listener);
    }
  },
  film: {
    /** Öffnet die Sendungsseite im Browser – oder die Suche beim Sender, wenn die Seite nicht mehr existiert. */
    seiteOeffnen: (film: { website: string; gruppe: string; titel: string; serie?: boolean }): Promise<'seite' | 'suche' | null> =>
      ipcRenderer.invoke('film:seite-oeffnen', film)
  },
  player: {
    /** Untertitel als WebVTT-Text (null = keine) */
    untertitel: (url: string): Promise<string | null> => ipcRenderer.invoke('untertitel:laden', url),
    fortschrittSetzen: (url: string, position: number, dauer: number): Promise<void> =>
      ipcRenderer.invoke('fortschritt:setzen', url, position, dauer),
    fortschritt: (url: string): Promise<{ position: number; dauer: number } | null> => ipcRenderer.invoke('fortschritt:holen', url),
    vergessen: (url: string): Promise<void> => ipcRenderer.invoke('fortschritt:vergessen', url),
    fortschritte: (urls: string[]): Promise<{ url: string; position: number; dauer: number; zeit: number }[]> =>
      ipcRenderer.invoke('fortschritt:viele', urls),
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
  melden: {
    /** „Falsch einsortiert?“ – öffnet einen vorausgefüllten Fehlerbericht im Browser; Movue schickt nichts selbst */
    einsortierung: (ziel: { filmId: number } | { gruppe: string; thema: string }): Promise<boolean> =>
      ipcRenderer.invoke('melden:einsortierung', ziel)
  },
  live: {
    /** Livestreams der Sender, Live-Übertragungen und Sendungen, die schon vor dem TV-Termin abrufbar sind */
    angebot: (): Promise<LiveAngebot> => ipcRenderer.invoke('live:angebot'),
    /** Videoadressen der Übertragungen, an die Movue erinnern soll */
    erinnerungen: (): Promise<string[]> => ipcRenderer.invoke('live:erinnerungen'),
    /** Erinnerung an- oder abschalten; gibt den neuen Zustand zurück */
    erinnern: (id: number, an: boolean): Promise<boolean> => ipcRenderer.invoke('live:erinnern', id, an),
    /** Eine Übertragung, an die erinnert werden soll, beginnt gleich */
    beiErinnerung: (cb: (filme: Film[]) => void): (() => void) => {
      const listener = (_e: unknown, filme: Film[]) => cb(filme);
      ipcRenderer.on('live:erinnerung', listener);
      return () => ipcRenderer.removeListener('live:erinnerung', listener);
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
    url: (website: string): Promise<string | null> => ipcRenderer.invoke('bild:url', website, 'folge'),
    /** Bild zu einer Sendung aus dem Verzeichnis – mit Ersatz aus anderen Folgen oder dem Titelbild der Serie */
    film: (film: { id: number; url: string; website: string }): Promise<string | null> =>
      ipcRenderer.invoke('bild:film', film.id, film.url, film.website),
    /** Titelbild der Serie (16:9) bzw. breites Banner (16:7) – bisher nur ARD, sonst null */
    serie: (website: string, art: 'serie' | 'banner'): Promise<string | null> => ipcRenderer.invoke('bild:url', website, art),
    /** Trailer der Reihe bei der ARD zu einer Folgenseite; andere Sender und ohne Trailer: null */
    reihenTrailer: (website: string): Promise<ReihenTrailer | null> => ipcRenderer.invoke('bild:reihen-trailer', website)
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
