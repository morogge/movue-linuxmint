/**
 * Trailer einer Serie beim ZDF: Die Seite der Reihe verlinkt ihn („…/trailer-under-salt-marsh-staffel-1-102“),
 * die Seite des Trailers nennt das Video in ihren Daten für Suchmaschinen (JSON-LD, `contentUrl`).
 * Gefragt wird nur das ZDF selbst.
 */
import type { ReihenTrailer } from '@shared/serie';

const UA = 'Movue (+https://github.com/morogge/movue-linuxmint)';

/** Link auf die Seite des Trailers – nur innerhalb dieser Reihe (gleicher Pfad), nie fremde Seiten */
export function zdfTrailerLink(html: string, reihe: string): string | null {
  const pfad = new URL(reihe).pathname.replace(/\/$/, '');
  for (const m of html.matchAll(/href="([^"]+)"/g)) {
    const href = m[1]!;
    let ziel: URL;
    try {
      ziel = new URL(href, 'https://www.zdf.de');
    } catch {
      continue;
    }
    if (ziel.hostname !== 'www.zdf.de') continue;
    const teil = ziel.pathname.replace(/\/$/, '');
    if (teil.startsWith(`${pfad}/`) && /trailer/i.test(teil.slice(pfad.length))) return `https://www.zdf.de${teil}`;
  }
  return null;
}

/** Video und Titel aus der Seite des Trailers (JSON-LD) */
export function zdfVideo(html: string): { url: string; titel: string; dauer: number } | null {
  for (const m of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
    const block = m[1]!;
    const url = /"contentUrl"\s*:\s*"(https:\/\/[^"]+\.(?:m3u8|mp4)[^"]*)"/.exec(block)?.[1];
    if (!url || !/^https:\/\/[^/]*(zdf|akamaized)\.[^/]+\//.test(url)) continue;
    const titel = /"name"\s*:\s*"([^"]+)"/.exec(block)?.[1] ?? 'Trailer';
    // ISO-Dauer „PT1M38S“
    const d = /"duration"\s*:\s*"PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?"/.exec(block);
    const dauer = d ? Number(d[1] ?? 0) * 3600 + Number(d[2] ?? 0) * 60 + Number(d[3] ?? 0) : 0;
    return { url, titel, dauer };
  }
  return null;
}

async function seite(url: string): Promise<string | null> {
  const antwort = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10_000) });
  return antwort.ok ? antwort.text() : null;
}

/** Trailer einer ZDF-Reihe (Adresse der Reihe, siehe `serienSeite`); null, wenn sie keinen verlinkt */
export async function findeZdfTrailer(reihe: string): Promise<ReihenTrailer | null> {
  if (!/^https:\/\/www\.zdf\.de\//.test(reihe)) return null;
  const html = await seite(reihe);
  const link = html ? zdfTrailerLink(html, reihe) : null;
  if (!link) return null;
  const trailer = await seite(link);
  return trailer ? zdfVideo(trailer) : null;
}
