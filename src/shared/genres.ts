/**
 * Einheitliche Genres über alle Sender. Die Filmliste hat kein Genre-Feld –
 * Movue leitet die Genres aus Thema, Titel, Sender und Website-Adresse ab (src/main/genre/regeln.ts).
 */

export const GENRES = [
  { id: 'krimi', name: 'Krimi & Thriller' },
  { id: 'drama', name: 'Drama' },
  { id: 'comedy', name: 'Comedy & Satire' },
  { id: 'liebe', name: 'Liebe & Familie' },
  { id: 'fantasy', name: 'Fantasy & Science-Fiction' },
  { id: 'historisch', name: 'Historienfilme & -serien' },
  { id: 'film', name: 'Spielfilme' },
  { id: 'serie', name: 'Serien' },
  { id: 'doku', name: 'Dokus & Reportagen' },
  { id: 'wissen', name: 'Wissen & Natur' },
  { id: 'geschichte', name: 'Geschichte' },
  { id: 'reise', name: 'Reisen & Länder' },
  { id: 'kultur', name: 'Kultur & Musik' },
  { id: 'unterhaltung', name: 'Shows & Unterhaltung' },
  { id: 'nachrichten', name: 'Nachrichten & Politik' },
  { id: 'gesellschaft', name: 'Gesellschaft & Talk' },
  { id: 'ratgeber', name: 'Ratgeber & Service' },
  { id: 'kinder', name: 'Kinder & Familie' },
  { id: 'sport', name: 'Sport' },
  { id: 'sonstiges', name: 'Weitere Sendungen' }
] as const;

export type GenreId = (typeof GENRES)[number]['id'];

export function istGenre(wert: unknown): wert is GenreId {
  return GENRES.some((g) => g.id === wert);
}

export function genreName(id: GenreId): string {
  return GENRES.find((g) => g.id === id)?.name ?? id;
}

export interface GenreAnzahl {
  id: GenreId;
  name: string;
  anzahl: number;
}

/**
 * Die Art einer Sendung (Format) – die erste Achse der Einordnung, immer genau eine je Sendung.
 * Formate sind keine Genres: „Serie“ oder „Doku“ beschreiben die Form, nicht den Inhalt.
 * Sie stehen als eigener Filter neben dem Genre (ein Krimi kann Serie oder Film sein).
 */
export const FORMATE = [
  { id: 'serie', name: 'Serien' },
  { id: 'film', name: 'Filme' },
  { id: 'doku', name: 'Dokus' },
  { id: 'magazin', name: 'Magazine' },
  { id: 'show', name: 'Shows & Talk' },
  { id: 'nachrichten', name: 'Nachrichten' },
  { id: 'sport', name: 'Sport' },
  { id: 'konzert', name: 'Konzert & Bühne' },
  { id: 'kurz', name: 'Kurzbeiträge' }
] as const;

export type Format = (typeof FORMATE)[number]['id'];

export function istFormat(wert: unknown): wert is Format {
  return FORMATE.some((f) => f.id === wert);
}

export function formatName(id: Format): string {
  return FORMATE.find((f) => f.id === id)?.name ?? id;
}

/** Bühne statt Studio: Konzerte, Oper, Theater, Tanz */
export const KONZERT = /konzert|concert|\boper\b|opern|ballett|theater|philharmon|orchester|sinfoni|symphon|festival|bühne|tanz\b/i;
const TALK = /\btalk|maischberger|markus lanz|illner|hart aber fair|caren miosga|3nach9|nachtcafé|kölner treff|riverboat|tietjen|zur person/i;

/** Genres, die nur Erfundenes tragen – Comedy fehlt, weil Satire und Shows sie auch haben */
const FIKTION_GENRES: GenreId[] = ['krimi', 'drama', 'liebe', 'fantasy', 'historisch', 'film'];

/**
 * Art eines Bündels aus seinem Typ (Serie, Filmreihe, Nachrichten …), seinen Genres und seinen Titeln.
 * datiert = Anteil der Folgen mit Datum im Titel („Volle Kanne vom 3. November“) – typisch für Magazine.
 */
export function buendelFormat(z: {
  art: 'serie' | 'reihe' | 'filmreihe' | 'nachrichten';
  genres: readonly GenreId[];
  thema: string;
  dauer: number;
  datiert: number;
}): Format {
  const g = (x: GenreId) => z.genres.includes(x);
  if (z.art === 'nachrichten') return 'nachrichten';
  if (g('sport')) return 'sport';
  if (z.art === 'filmreihe') return 'film';
  if (z.art === 'serie') return 'serie';
  // Fiktion ohne Nummerierung (z. B. „Tatort“ ohne Staffeln): lang = Filme, kurz = Serie
  if (!g('doku') && FIKTION_GENRES.some(g)) return z.dauer >= 60 * 60 ? 'film' : 'serie';
  if (g('nachrichten') && !(g('doku') && z.dauer >= 20 * 60)) return 'nachrichten';
  if (g('kultur') && KONZERT.test(z.thema)) return 'konzert';
  if (g('comedy') || g('unterhaltung') || TALK.test(z.thema)) return 'show';
  if (/magazin/i.test(z.thema) || z.datiert >= 0.5) return 'magazin';
  if (!g('doku') && (g('ratgeber') || g('gesellschaft') || g('kultur'))) return 'magazin';
  return 'doku';
}

/** Genres, die eigentlich Formate sind – im Genre-Filter ausgeblendet */
export const FORMAT_GENRES: GenreId[] = ['film', 'serie'];

export function istInhaltsGenre(id: GenreId): boolean {
  return !FORMAT_GENRES.includes(id);
}
