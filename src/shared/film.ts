import type { GenreId } from './genres';
import type { SenderGruppe } from './sender';

/** Eine Sendung aus dem Index. Zeiten in Sekunden seit 1970 (UTC), Dauer in Sekunden. */
export interface Film {
  id: number;
  sender: string;
  gruppe: SenderGruppe;
  thema: string;
  titel: string;
  datum: number;
  dauer: number;
  beschreibung: string;
  website: string;
  url: string;
  urlKlein: string;
  urlHd: string;
  urlUntertitel: string;
  geo: string;
  genres: GenreId[];
}

export type Sortierung = 'relevanz' | 'datum';

export interface SuchAnfrage {
  text: string;
  gruppe?: SenderGruppe | null;
  genre?: GenreId | null;
  sortierung?: Sortierung;
  limit?: number;
  offset?: number;
}

export interface SuchErgebnis {
  treffer: Film[];
  gesamt: number;
}

export type IndexPhase = 'leer' | 'laedt' | 'bereit' | 'fehler';

export interface IndexZustand {
  phase: IndexPhase;
  /** Anzahl Sendungen im aktuell durchsuchbaren Index */
  anzahl: number;
  /** Erstellungszeit der Filmliste in ms (UTC), null wenn noch kein Index */
  stand: number | null;
  /** Während des Ladens: bisher verarbeitete Einträge */
  fortschritt?: number;
  /** Fehlermeldung für Nutzer */
  meldung?: string;
}
