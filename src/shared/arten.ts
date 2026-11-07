import type { Format, GenreId } from './genres';

/**
 * Seiten je Art (Serien, Filme, Dokus …) – die ersten Einträge der Seitenleiste.
 * Eine Seite zeigt alles einer Art (oder bei „Kinder“: einer Zielgruppe) und teilt es in Reihen nach Genre bzw. Thema.
 */

export interface Teil {
  genre?: GenreId;
  format?: Format;
  /** Name der Reihe bzw. des Filters auf dieser Seite */
  name: string;
}

export interface ArtSeite {
  id: string;
  titel: string;
  beschreibung: string;
  /** Grundfilter der Seite */
  format?: Format;
  genre?: GenreId;
  /** Reihen und Filter; leer = alles in einem Raster */
  teile: Teil[];
  /** In der Seitenleiste (sonst nur über „Alle Kategorien“) */
  seitenleiste: boolean;
}

const FIKTION: Teil[] = [
  { genre: 'krimi', name: 'Krimi & Thriller' },
  { genre: 'drama', name: 'Drama' },
  { genre: 'comedy', name: 'Komödie' },
  { genre: 'liebe', name: 'Liebe & Familie' },
  { genre: 'fantasy', name: 'Fantasy & Science-Fiction' },
  { genre: 'historisch', name: 'Historisch' },
  { genre: 'kinder', name: 'Für Kinder' }
];

export const ART_SEITEN: ArtSeite[] = [
  {
    id: 'serien',
    titel: 'Serien',
    beschreibung: 'Serien mit Staffeln und Folgen – jede Serie als eine Kachel.',
    format: 'serie',
    teile: FIKTION,
    seitenleiste: true
  },
  {
    id: 'filme',
    titel: 'Filme',
    beschreibung: 'Spielfilme und Fernsehfilme, auch aus Filmreihen wie „Tatort“.',
    format: 'film',
    teile: FIKTION,
    seitenleiste: true
  },
  {
    id: 'dokus',
    titel: 'Dokus',
    beschreibung: 'Dokumentationen, Reportagen und Doku-Reihen – geordnet nach Thema.',
    format: 'doku',
    teile: [
      { genre: 'geschichte', name: 'Geschichte' },
      { genre: 'wissen', name: 'Wissen & Natur' },
      { genre: 'gesellschaft', name: 'Gesellschaft & Menschen' },
      { genre: 'reise', name: 'Reisen & Länder' },
      { genre: 'nachrichten', name: 'Politik & Zeitgeschehen' },
      { genre: 'kultur', name: 'Kultur & Musik' },
      { genre: 'sport', name: 'Sport' },
      { genre: 'kinder', name: 'Für Kinder' }
    ],
    seitenleiste: true
  },
  {
    id: 'shows',
    titel: 'Shows & Talk',
    beschreibung: 'Satire, Comedy, Quiz, Talkshows und große Abendshows.',
    format: 'show',
    teile: [
      { genre: 'comedy', name: 'Comedy & Satire' },
      { genre: 'unterhaltung', name: 'Shows & Quiz' },
      { genre: 'gesellschaft', name: 'Talk' },
      { genre: 'kultur', name: 'Kultur' }
    ],
    seitenleiste: true
  },
  {
    id: 'nachrichten',
    titel: 'Nachrichten',
    beschreibung: 'Nachrichtensendungen und politische Magazine, die neuesten zuerst.',
    format: 'nachrichten',
    teile: [],
    seitenleiste: true
  },
  {
    id: 'sport',
    titel: 'Sport',
    beschreibung: 'Spielberichte, Sportmagazine und Übertragungen.',
    format: 'sport',
    teile: [],
    seitenleiste: true
  },
  {
    id: 'kinder',
    titel: 'Kinder',
    beschreibung: 'Serien, Filme und Wissen für Kinder.',
    genre: 'kinder',
    teile: [
      { format: 'serie', name: 'Serien' },
      { format: 'film', name: 'Filme' },
      { format: 'doku', name: 'Wissen & Dokus' },
      { format: 'magazin', name: 'Magazine' },
      { format: 'show', name: 'Shows' }
    ],
    seitenleiste: true
  },
  {
    id: 'magazine',
    titel: 'Magazine',
    beschreibung: 'Regelmäßige Sendungen mit mehreren Beiträgen: Kultur, Verbraucher, Wissen, Regionales.',
    format: 'magazin',
    teile: [
      { genre: 'kultur', name: 'Kultur' },
      { genre: 'ratgeber', name: 'Ratgeber & Verbraucher' },
      { genre: 'wissen', name: 'Wissen' },
      { genre: 'gesellschaft', name: 'Gesellschaft' },
      { genre: 'nachrichten', name: 'Politik' },
      { genre: 'reise', name: 'Reisen' }
    ],
    seitenleiste: false
  },
  {
    id: 'konzert',
    titel: 'Konzert & Bühne',
    beschreibung: 'Konzerte, Oper, Theater und Tanz.',
    format: 'konzert',
    teile: [],
    seitenleiste: false
  }
];

export function artSeite(id: string | undefined): ArtSeite | undefined {
  return ART_SEITEN.find((s) => s.id === id);
}

/** Überschrift der Reihe mit den neuesten Einträgen */
export function neuTitel(seite: ArtSeite): string {
  return seite.genre ? `Neu für ${seite.titel}` : `Neu bei ${seite.titel}`;
}

/** Die Seite einer Art (für Kacheln unter „Alle Kategorien“) */
export function seiteFuerFormat(format: Format): ArtSeite | undefined {
  return ART_SEITEN.find((s) => s.format === format);
}

/** Genres für Serien und Filme – auf „Alle Kategorien“ getrennt von den Themen */
export const KATEGORIE_GENRES: GenreId[] = ['krimi', 'drama', 'comedy', 'liebe', 'fantasy', 'historisch'];
/** Themen für Dokus, Magazine und Talk */
export const KATEGORIE_THEMEN: GenreId[] = ['nachrichten', 'gesellschaft', 'geschichte', 'wissen', 'reise', 'kultur', 'ratgeber', 'unterhaltung', 'sport'];
