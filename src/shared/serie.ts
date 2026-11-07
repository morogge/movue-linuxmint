import type { Film } from './film';
import type { Format, GenreId } from './genres';
import type { SenderGruppe } from './sender';
import { GESEHEN_ANTEIL } from './nutzer';

/**
 * Serien und Sendereihen: alle Folgen eines Themas bei einem Sender, gebündelt.
 * Die Regeln hier nutzen Import (Hauptprozess) und Oberfläche gemeinsam.
 */

/**
 * serie = Staffeln/Folgennummern; reihe = fortlaufend (Magazine, Dokureihen);
 * filmreihe = eigenständige Filme unter einer Marke (Tatort, Polizeiruf); nachrichten = viele kurze Ausgaben
 */
export type SerienArt = 'serie' | 'reihe' | 'filmreihe' | 'nachrichten';

export function artName(art: SerienArt): string {
  return { serie: 'Serie', reihe: 'Sendereihe', filmreihe: 'Filmreihe', nachrichten: 'Nachrichten' }[art];
}

/** Ab so vielen Folgen wird ein Thema gebündelt */
export const MIN_FOLGEN = 3;

export interface Serie {
  id: number;
  gruppe: SenderGruppe;
  thema: string;
  art: SerienArt;
  /** Art der Sendung (Serie, Doku, Magazin …) */
  format: Format;
  /** Folgen ohne Extras und Varianten */
  folgen: number;
  extras: number;
  /** Anzahl Staffeln bzw. Jahrgänge */
  staffeln: number;
  /** Datum der neuesten Folge (s) */
  neueste: number;
  genres: GenreId[];
  /** Neueste Folge – liefert Bild und Beschreibung */
  bild: Film | null;
}

/** Was eine Serie über Neuaufbauten hinweg kennzeichnet (die id ändert sich) */
export type SerieRef = Pick<Serie, 'gruppe' | 'thema'>;

export interface SerieDetail {
  serie: Serie;
  /** Alle Folgen und Extras, sortiert nach Staffel und Folge bzw. Datum */
  folgen: Film[];
}

export interface FolgenInfo {
  /** Staffel – oder Jahr, wenn der Sender Jahrgänge als Staffel führt (S2025) */
  staffel: number | null;
  folge: number | null;
  /** Vorschau, Making-of, Trailer … – zählt nicht als Folge */
  extra: boolean;
}

/** Staffelnummern ab hier sind Jahrgänge (ZDF: „(S2025/E343)“) */
export const JAHRGANG_AB = 1900;

// „Kinotrailer“, „Serientrailer“: Trailer auch am Wortende; Podcast-Folgen, Clips und Vorschauen sind Beiwerk
const EXTRA = /(\bvorschau\b|\bmaking[- ]of\b|\bouttakes?\b|trailer\b|\bteaser\b|\bbonusmaterial\b|\bpodcast\b|\bhinter den kulissen\b|\bsneak peek\b|\bpreview\b|(?:\bweb-|\bonline-|\b)clip\b)/i;

/** Ab dieser Länge ist es eine eigene Sendung, auch wenn der Titel nach Beiwerk klingt („Hinter den Kulissen der Macht“) */
export const EXTRA_BIS = 20 * 60;

/** Liest Staffel, Folge und „Extra“ aus einem Titel; dauer in Sekunden (0 = unbekannt) */
export function folgenInfo(titel: string, dauer = 0): FolgenInfo {
  const extra = EXTRA.test(titel) && (dauer <= 0 || dauer < EXTRA_BIS);
  const se = /\(S(\d{1,4})\/E(\d{1,4})\)/.exec(titel);
  if (se) return { staffel: Number(se[1]), folge: Number(se[2]), extra };
  // „Folge 1237: …“, „3. Folge“ oder eine Nummer am Ende wie „Erinnerungen (958)“
  const folge = /\bFolge\s+(\d{1,5})\b/i.exec(titel) ?? /^(\d{1,4})\.\s*Folge\b/i.exec(titel) ?? /\((\d{1,4})\)\s*$/.exec(titel);
  const staffel = /\bStaffel\s+(\d{1,2})\b/i.exec(titel);
  return { staffel: staffel ? Number(staffel[1]) : null, folge: folge ? Number(folge[1]) : null, extra };
}

/** Hat die Folge eine echte Folgennummer (keinen Jahrgang)? */
export function hatNummer(info: Pick<FolgenInfo, 'staffel' | 'folge'>): boolean {
  return info.folge !== null && (info.staffel === null || info.staffel < JAHRGANG_AB);
}

/** Genres, die für erzählte Fiktion sprechen – nur dann machen Folgennummern ein Bündel zur Serie */
const FIKTION: GenreId[] = ['serie', 'krimi', 'film', 'comedy', 'kinder'];

/**
 * Art eines Bündels: Nachrichten bei kurzen Ausgaben im Genre Nachrichten; Filmreihe, wenn überwiegend Filme
 * (auch mit ZDF-Nummern wie „Die Toten vom Bodensee (S04/E03)“); Serie, wenn mindestens die Hälfte der Folgen
 * nummeriert ist und es Fiktion ist; sonst Sendereihe – auch Doku-Serien mit Staffeln („Mittendrin“).
 */
export function serienArt(z: { folgen: number; nummeriert: number; dauer: number; genres: GenreId[]; filme?: number }): SerienArt {
  if (z.genres.includes('nachrichten') && z.dauer < 15 * 60) return 'nachrichten';
  // Sport und Nachrichten zählen ihre Ausgaben oft durch (Spieltage, „S2026/E40“) – das macht sie nicht zur Serie
  if (z.genres.includes('sport') || z.genres.includes('nachrichten')) return 'reihe';
  if ((z.filme ?? 0) * 10 >= z.folgen * 7) return 'filmreihe';
  // Sachsendungen (Doku, Wissen …) ohne Hinweis auf Fiktion bleiben Sendereihen, auch nummeriert
  const fiktion = z.genres.length === 0 || z.genres.some((g) => FIKTION.includes(g));
  if (!fiktion) return 'reihe';
  // Mindestens die Hälfte nummeriert – oder als Serie eingeordnet und kein Film-Format (Episoden unter 75 Min.)
  if (z.nummeriert * 2 >= z.folgen) return 'serie';
  if (z.genres.includes('serie') && z.dauer < 75 * 60) return 'serie';
  return 'reihe';
}

export interface AusTitel {
  name: string;
  staffel: number | null;
  folge: number | null;
}

/**
 * Serienname aus dem Titel – für Sendungen, deren Thema nur eine Rubrik ist (Arte „Fernsehfilme und Serien“,
 * ZDF „Der Fernsehfilm der Woche“): „Twin Peaks - Staffel 1 (3/8) - Zen …“, „The Hack (4/7)“,
 * „Wilder: Sau, Staffel 4, Folge 1“. null, wenn der Titel nach einem einzelnen Film aussieht.
 */
export function serieAusTitel(titel: string): AusTitel | null {
  const t = titel.replace(/\s*\((?:audiodeskription|originalversion[^)]*|gebärdensprache|mit untertitel[^)]*)\)\s*/gi, ' ').trim();
  const staffelTeil = /^(.+?)\s[-–:]\s(?:Staffel|Saison)\s(\d{1,2})\s\((\d{1,3})\/\d{1,3}\)/i.exec(t);
  if (staffelTeil) return { name: staffelTeil[1].trim(), staffel: Number(staffelTeil[2]), folge: Number(staffelTeil[3]) };
  const staffelFolge = /^(.+?)(?::\s[^,]+)?,\sStaffel\s(\d{1,2}),\s(?:Folge|Episode)\s(\d{1,3})\s*$/i.exec(t);
  if (staffelFolge) return { name: staffelFolge[1].trim(), staffel: Number(staffelFolge[2]), folge: Number(staffelFolge[3]) };
  const teil = /^(.+?)\s\((\d{1,3})\/(\d{1,3})\)(?:\s*[-–:].*)?$/.exec(t);
  if (teil && Number(teil[3]) >= 2 && Number(teil[2]) <= Number(teil[3])) return { name: teil[1].replace(/\s[-–:]\s*$/, '').trim(), staffel: null, folge: Number(teil[2]) };
  return null;
}

/** Gruppe einer Folge auf der Serienseite (Reiter): Staffeln auch bei Sendereihen (Doku-Serien wie „Mittendrin“) */
export function gruppeVon(f: Pick<Film, 'staffel' | 'extra' | 'datum'>, art: SerienArt): string {
  if (f.extra) return 'extras';
  if (f.staffel !== null && f.staffel < JAHRGANG_AB) return `s${f.staffel}`;
  if (art === 'serie') return 'folgen';
  const jahr = f.staffel !== null && f.staffel >= JAHRGANG_AB ? f.staffel : new Date(f.datum * 1000).getFullYear();
  return `j${jahr}`;
}

export function gruppenName(gruppe: string): string {
  if (gruppe === 'extras') return 'Extras';
  if (gruppe === 'folgen') return 'Folgen';
  if (gruppe.startsWith('s')) return `Staffel ${gruppe.slice(1)}`;
  return gruppe.slice(1);
}

/** Reihenfolge der Reiter: Staffeln aufsteigend, Jahrgänge absteigend, „Folgen“ nach den Staffeln, Extras zuletzt */
export function sortiereGruppen(gruppen: string[]): string[] {
  const rang = (g: string): [number, number] => {
    if (g === 'extras') return [3, 0];
    if (g === 'folgen') return [1, 0];
    if (g.startsWith('s')) return [0, Number(g.slice(1))];
    return [2, -Number(g.slice(1))];
  };
  return [...new Set(gruppen)].sort((a, b) => {
    const [ra, na] = rang(a);
    const [rb, nb] = rang(b);
    return ra - rb || na - nb;
  });
}

/** Folgen in Abspielreihenfolge: nummerierte nach Staffel/Folge, sonst nach Datum (bei Reihen neueste zuerst) */
export function sortiereFolgen(folgen: Film[], art: SerienArt): Film[] {
  return [...folgen].sort((a, b) => {
    if (art === 'serie') {
      const sa = a.staffel ?? 0;
      const sb = b.staffel ?? 0;
      if (sa !== sb) return sa - sb;
      if (a.folge !== null && b.folge !== null && a.folge !== b.folge) return a.folge - b.folge;
      return a.datum - b.datum;
    }
    return b.datum - a.datum;
  });
}

/** „S2 · F4“, „F12“ oder null */
export function folgenKennung(f: Pick<Film, 'staffel' | 'folge'>): string | null {
  if (f.folge === null) return null;
  if (f.staffel !== null && f.staffel < JAHRGANG_AB) return `S${f.staffel} · F${f.folge}`;
  return `F${f.folge}`;
}

/** Untertitel der Serienkachel: „3 Staffeln · 42 Folgen“ bzw. „128 Folgen“ */
export function serienUmfang(s: Pick<Serie, 'art' | 'folgen' | 'staffeln'>): string {
  const folgen = s.folgen === 1 ? '1 Folge' : `${s.folgen} Folgen`;
  if (s.art === 'serie' && s.staffeln > 1) return `${s.staffeln} Staffeln · ${folgen}`;
  return folgen;
}

export interface FolgenStand {
  position: number;
  dauer: number;
  zeit: number;
}

/**
 * Welche Folge der Hauptknopf der Serienseite startet: die zuletzt angefangene, sonst die nach der
 * zuletzt gesehenen; ohne Verlauf bei Serien die erste Folge, bei Sendereihen die neueste.
 */
export function startFolge(detail: SerieDetail, staende: Map<string, FolgenStand>): { film: Film; art: 'weiter' | 'naechste' | 'start' } | null {
  const folgen = detail.folgen.filter((f) => !f.extra);
  if (folgen.length === 0) return null;
  let zuletzt: { film: Film; stand: FolgenStand; index: number } | null = null;
  for (let index = 0; index < folgen.length; index++) {
    const stand = staende.get(folgen[index].url);
    if (stand && (!zuletzt || stand.zeit > zuletzt.stand.zeit)) zuletzt = { film: folgen[index], stand, index };
  }
  if (zuletzt) {
    if (zuletzt.stand.position < zuletzt.stand.dauer * GESEHEN_ANTEIL) return { film: zuletzt.film, art: 'weiter' };
    // Serien laufen vorwärts, Sendereihen sind neueste zuerst sortiert
    const naechste = detail.serie.art === 'serie' ? folgen[zuletzt.index + 1] : folgen[zuletzt.index - 1];
    if (naechste) return { film: naechste, art: 'naechste' };
  }
  return { film: folgen[0], art: 'start' };
}
