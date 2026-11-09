import { formatName, genreName, type Format, type GenreId } from './genres';

/** Wohin „Falsch einsortiert?“ führt: ein neuer Fehlerbericht im Repository von Movue */
export const MELDE_REPO = 'https://github.com/morogge/movue-linuxmint/issues/new';
export const MELDE_LABEL = 'einsortierung';

export interface MeldeInfo {
  /** „Sendung“ oder „Serie“ */
  was: 'Sendung' | 'Serie';
  titel: string;
  thema: string;
  sender: string;
  format: Format | null;
  genres: GenreId[];
  website: string;
  datum?: number;
}

/**
 * Adresse für einen vorausgefüllten Fehlerbericht. Movue schickt nichts selbst – der Browser öffnet die Seite,
 * abschicken (oder verwerfen) entscheidest du dort.
 */
export function meldeAdresse(info: MeldeInfo, version: string): string {
  const genres = info.genres.filter((g) => g !== 'sonstiges').map(genreName);
  const zeilen = [
    `**${info.was}:** ${info.titel}`,
    info.thema && info.thema !== info.titel ? `**Thema:** ${info.thema}` : null,
    `**Sender:** ${info.sender}`,
    `**Art in Movue:** ${info.format ? formatName(info.format) : '–'}`,
    `**Genres in Movue:** ${genres.length ? genres.join(', ') : '–'}`,
    info.datum ? `**Datum:** ${new Date(info.datum * 1000).toLocaleDateString('de-DE')}` : null,
    info.website ? `**Beim Sender:** ${info.website}` : null,
    `**Movue:** ${version}`,
    '',
    '### Was wäre richtig?',
    '',
    '<!-- z. B. „Ist eine Doku, kein Krimi“ oder „Gehört zu den Serien“ -->',
    ''
  ].filter((z): z is string => z !== null);
  const titel = `Falsch einsortiert: ${info.titel}`.slice(0, 200);
  const q = new URLSearchParams({ title: titel, labels: MELDE_LABEL, body: zeilen.join('\n').slice(0, 6000) });
  return `${MELDE_REPO}?${q.toString()}`;
}
