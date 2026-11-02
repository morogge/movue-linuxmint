/**
 * Einheitliche Genres über alle Sender. Die Filmliste hat kein Genre-Feld –
 * Movue leitet die Genres aus Thema, Titel, Sender und Website-Adresse ab (src/main/genre/regeln.ts).
 */

export const GENRES = [
  { id: 'krimi', name: 'Krimi & Thriller' },
  { id: 'film', name: 'Spielfilme' },
  { id: 'serie', name: 'Serien' },
  { id: 'doku', name: 'Dokus & Reportagen' },
  { id: 'wissen', name: 'Wissen & Natur' },
  { id: 'geschichte', name: 'Geschichte' },
  { id: 'reise', name: 'Reisen & Länder' },
  { id: 'kultur', name: 'Kultur & Musik' },
  { id: 'comedy', name: 'Comedy & Satire' },
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
 * Formate sind keine Genres: „Serien“ und „Spielfilme“ beschreiben die Form, nicht den Inhalt.
 * Sie stehen als eigener Filter neben dem Genre (ein Krimi kann Serie oder Film sein).
 */
export type Format = 'serie' | 'film';

export const FORMATE: { id: Format; name: string }[] = [
  { id: 'serie', name: 'Serien' },
  { id: 'film', name: 'Filme' }
];

export function istFormat(wert: unknown): wert is Format {
  return wert === 'serie' || wert === 'film';
}

/** Genres, die eigentlich Formate sind – im Genre-Filter ausgeblendet */
export const FORMAT_GENRES: GenreId[] = ['film', 'serie'];

export function istInhaltsGenre(id: GenreId): boolean {
  return !FORMAT_GENRES.includes(id);
}
