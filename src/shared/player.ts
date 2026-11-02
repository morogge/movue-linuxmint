import type { Film } from './film';

export type Qualitaet = 'sd' | 'standard' | 'hd';

export const QUALITAET_NAME: Record<Qualitaet, string> = { sd: 'Niedrig', standard: 'Standard', hd: 'HD' };

/** Verfügbare Qualitäten einer Sendung mit ihrer Adresse, beste zuerst */
export function qualitaeten(film: Pick<Film, 'url' | 'urlKlein' | 'urlHd'>): { id: Qualitaet; url: string }[] {
  const liste: { id: Qualitaet; url: string }[] = [];
  if (film.urlHd && film.urlHd !== film.url) liste.push({ id: 'hd', url: film.urlHd });
  if (film.url) liste.push({ id: 'standard', url: film.url });
  if (film.urlKlein && film.urlKlein !== film.url) liste.push({ id: 'sd', url: film.urlKlein });
  return liste;
}

/** Adresse für die gewünschte Qualität – oder die nächstbessere verfügbare */
export function adresseFuer(film: Pick<Film, 'url' | 'urlKlein' | 'urlHd'>, wunsch: Qualitaet): { id: Qualitaet; url: string } | null {
  const liste = qualitaeten(film);
  return liste.find((q) => q.id === wunsch) ?? liste.find((q) => q.id === 'standard') ?? liste[0] ?? null;
}

/** „(S02/E05)“ → [2, 5] */
export function folgenNummer(titel: string): [number, number] | null {
  const m = /\(S(\d{1,2})\/E(\d+)\)/.exec(titel);
  return m ? [Number(m[1]), Number(m[2])] : null;
}

/**
 * Die Folge, die nach `aktuell` kommt: bei Serien mit Staffel/Folge die nächste Nummer,
 * sonst die nächst-neuere Sendung der Reihe. Varianten (andere Fassungen derselben Folge) zählen nicht.
 */
export function naechsteFolge(aktuell: Film, folgen: Film[]): Film | null {
  const andere = folgen.filter((f) => f.id !== aktuell.id && f.titel !== aktuell.titel);
  const nr = folgenNummer(aktuell.titel);
  if (nr) {
    const kandidaten = andere
      .map((f) => ({ f, n: folgenNummer(f.titel) }))
      .filter((x): x is { f: Film; n: [number, number] } => x.n !== null && (x.n[0] > nr[0] || (x.n[0] === nr[0] && x.n[1] > nr[1])))
      .sort((a, b) => a.n[0] - b.n[0] || a.n[1] - b.n[1]);
    if (kandidaten.length) return kandidaten[0].f;
  }
  const neuere = andere.filter((f) => f.datum > aktuell.datum).sort((a, b) => a.datum - b.datum);
  return neuere[0] ?? null;
}

/** Sekunden → „1:02:05“ bzw. „12:05“ */
export function formatZeit(sekunden: number): string {
  if (!Number.isFinite(sekunden) || sekunden < 0) return '0:00';
  const s = Math.floor(sekunden);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const rest = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${rest}` : `${m}:${rest}`;
}
