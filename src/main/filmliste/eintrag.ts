import { gruppeFuer, type SenderGruppe } from '@shared/sender';

/** Ein Eintrag der Filmliste, wie er in die Datenbank geht. */
export interface FilmEintrag {
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
  neu: boolean;
}

/** Spalten der Filmliste (Kopfzeile "Filmliste" Nr. 2) */
const F = {
  sender: 0,
  thema: 1,
  titel: 2,
  datum: 3,
  zeit: 4,
  dauer: 5,
  beschreibung: 7,
  url: 8,
  website: 9,
  untertitel: 10,
  klein: 12,
  hd: 14,
  datumL: 16,
  geo: 18,
  neu: 19
} as const;

/**
 * Kleine und HD-Adressen sind relativ zur Haupt-Adresse kodiert: "8|rest" heißt
 * „die ersten 8 Zeichen der Haupt-Adresse, dann rest“.
 */
export function erweitereUrl(url: string, relativ: string): string {
  if (!relativ) return '';
  const trenner = relativ.indexOf('|');
  if (trenner < 0) return relativ;
  const laenge = Number.parseInt(relativ.slice(0, trenner), 10);
  if (!Number.isFinite(laenge)) return '';
  return url.slice(0, laenge) + relativ.slice(trenner + 1);
}

/** "00:43:20" oder "43:20" → Sekunden */
export function parseDauer(text: string): number {
  if (!text) return 0;
  const teile = text.split(':').map((t) => Number.parseInt(t, 10));
  if (teile.some((t) => !Number.isFinite(t))) return 0;
  return teile.reduce((summe, t) => summe * 60 + t, 0);
}

/** "01.11.2026" + "20:15:00" → Sekunden (als UTC gelesen, nur Rückfall wenn DatumL fehlt) */
function parseDatum(datum: string, zeit: string): number {
  const d = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(datum);
  if (!d) return 0;
  const z = /^(\d{2}):(\d{2})/.exec(zeit);
  const ms = Date.UTC(Number(d[3]), Number(d[2]) - 1, Number(d[1]), z ? Number(z[1]) : 0, z ? Number(z[2]) : 0);
  return Math.floor(ms / 1000);
}

/** Kopf der Filmliste: "01.11.2026, 17:19" (UTC) → Millisekunden */
export function parseListenStand(text: string): number | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4}), (\d{2}):(\d{2})$/.exec(text.trim());
  if (!m) return null;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4]), Number(m[5]));
}

/**
 * Wandelt Zeilen der Filmliste in Einträge um. Leere Sender- und Themenfelder bedeuten
 * „wie in der vorigen Zeile“, deshalb hält der Leser Zustand.
 */
export class EintragsLeser {
  private sender = '';
  private thema = '';

  lies(felder: string[]): FilmEintrag | null {
    if (felder[F.sender]) {
      this.sender = felder[F.sender];
      this.thema = '';
    }
    if (felder[F.thema]) this.thema = felder[F.thema];

    const gruppe = gruppeFuer(this.sender);
    const url = felder[F.url] ?? '';
    if (!gruppe || !url) return null;

    const datumL = Number.parseInt(felder[F.datumL] ?? '', 10);
    return {
      sender: this.sender,
      gruppe,
      thema: this.thema,
      titel: felder[F.titel] ?? '',
      datum: Number.isFinite(datumL) && datumL > 0 ? datumL : parseDatum(felder[F.datum] ?? '', felder[F.zeit] ?? ''),
      dauer: parseDauer(felder[F.dauer] ?? ''),
      beschreibung: felder[F.beschreibung] ?? '',
      website: felder[F.website] ?? '',
      url,
      urlKlein: erweitereUrl(url, felder[F.klein] ?? ''),
      urlHd: erweitereUrl(url, felder[F.hd] ?? ''),
      urlUntertitel: felder[F.untertitel] ?? '',
      geo: felder[F.geo] ?? '',
      neu: felder[F.neu] === 'true'
    };
  }
}
