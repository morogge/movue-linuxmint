import type { SenderGruppe } from '@shared/sender';

/**
 * Die Filmliste führt oft Adressen von Sendungsseiten, die es nicht mehr gibt: Die Sender bauen ihre
 * Portale um, die Videos bleiben aber erreichbar. Vor dem Öffnen prüft Movue deshalb die Seite und
 * öffnet sonst die Suche der jeweiligen Mediathek mit dem Titel.
 */

/** Adressen alter Portale, die nicht mehr auf die Sendung führen – gar nicht erst prüfen. */
const VERALTET = [
  /^https?:\/\/classic\.ardmediathek\.de\//,
  /^https?:\/\/(www\.)?ardmediathek\.de\/(tv|ard\/player|radio)\//,
  /^https?:\/\/(www\.)?sr-mediathek\.de\//,
  /^https?:\/\/(www\.)?br\.de\/mediathek\//,
  /^https?:\/\/(www\.)?arte\.tv\/guide\//
];

export function istVeraltet(url: string): boolean {
  return VERALTET.some((re) => re.test(url));
}

/** Suchseite der Mediathek für einen Titel */
export function suchAdresse(gruppe: SenderGruppe, titel: string): string {
  const q = encodeURIComponent(titel.trim());
  switch (gruppe) {
    case 'ARD':
      return `https://www.ardmediathek.de/suche/${q}`;
    case 'ZDF':
      return `https://www.zdf.de/suche?q=${q}`;
    case '3sat':
      return `https://www.3sat.de/suche?q=${q}`;
    case 'Arte':
      return `https://www.arte.tv/de/search/?q=${q}`;
  }
}

/** Kürzt Titel um Zusätze, die die Suche der Sender verwirren: „(S01/E17)“, „- Spielfilm, USA 1993“ usw. */
export function suchTitel(titel: string): string {
  return titel
    .replace(/\((S\d+\/E\d+|Audiodeskription|mit Gebärdensprache|Originalversion)[^)]*\)/gi, '')
    .replace(/\s+-\s+(Spielfilm|Fernsehfilm|Dokumentarfilm)\b.*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export type Pruefer = (url: string) => Promise<boolean>;

/** Ruft die Seite ab (mit Weiterleitungen) und meldet, ob sie existiert. Netzfehler gelten als „unklar“ = ok. */
export const pruefeSeite: Pruefer = async (url) => {
  try {
    const antwort = await fetch(url, {
      method: 'GET',
      redirect: 'follow',
      headers: { 'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) Movue' },
      signal: AbortSignal.timeout(6000)
    });
    void antwort.body?.cancel();
    return antwort.status !== 404 && antwort.status !== 410;
  } catch {
    // Zeitüberschreitung oder kein Netz: lieber die Originalseite versuchen als falsch umleiten
    return true;
  }
};

export interface SeitenZiel {
  url: string;
  art: 'seite' | 'suche';
}

/** Entscheidet, welche Adresse geöffnet wird: die Sendungsseite oder die Suche beim Sender. */
export async function seitenZiel(
  film: { website: string; gruppe: SenderGruppe; titel: string },
  pruefe: Pruefer = pruefeSeite
): Promise<SeitenZiel> {
  const suche: SeitenZiel = { url: suchAdresse(film.gruppe, suchTitel(film.titel)), art: 'suche' };
  if (!/^https?:\/\//.test(film.website) || istVeraltet(film.website)) return suche;
  const website = film.website.replace(/^http:\/\//, 'https://');
  return (await pruefe(website)) ? { url: website, art: 'seite' } : suche;
}
