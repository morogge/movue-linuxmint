/**
 * Trailer einer Reihe bei der ARD: Die Seite der Reihe nennt oft einen eigenen Trailer, der in der
 * Filmliste fehlt. Weg: Seite der Folge → Kennung der Reihe → Seite der Reihe → Seite des Trailers → Video.
 * Gefragt wird nur die ARD selbst, die auch die Videos liefert.
 */

import type { ReihenTrailer } from '@shared/serie';

export type { ReihenTrailer };

const UA = 'Movue (+https://github.com/morogge/movue-linuxmint)';
const API = 'https://api.ardmediathek.de/page-gateway/pages/ard';

type Obj = Record<string, unknown>;
const obj = (x: unknown): Obj | null => (x && typeof x === 'object' && !Array.isArray(x) ? (x as Obj) : null);

/** Kennung der Reihe aus der Seite einer Folge (`widgets[0].show.id`) */
export function reihenId(item: unknown): string | null {
  const widgets = obj(item)?.['widgets'];
  if (!Array.isArray(widgets)) return null;
  for (const w of widgets) {
    const id = obj(obj(w)?.['show'])?.['id'];
    if (typeof id === 'string' && /^[A-Za-z0-9_-]+$/.test(id)) return id;
  }
  return null;
}

/** Trailer der Reihe aus ihrer Seite (`trailer.links.target`) */
export function trailerVerweis(grouping: unknown): { id: string; titel: string; dauer: number } | null {
  const t = obj(obj(grouping)?.['trailer']);
  const ziel = obj(obj(t?.['links'])?.['target']);
  const id = ziel?.['id'];
  if (typeof id !== 'string' || !/^[A-Za-z0-9_-]+$/.test(id)) return null;
  const titel = typeof ziel?.['title'] === 'string' ? (ziel['title'] as string) : 'Trailer';
  const dauer = typeof t?.['duration'] === 'number' ? (t['duration'] as number) : 0;
  return { id, titel, dauer };
}

/** Video aus der Seite eines Trailers: MP4 bis 1280 Pixel Breite (der Kopf braucht kein Full HD), sonst HLS */
export function videoAdresse(item: unknown): string | null {
  const widgets = obj(item)?.['widgets'];
  if (!Array.isArray(widgets)) return null;
  for (const w of widgets) {
    const streams = obj(obj(obj(w)?.['mediaCollection'])?.['embedded'])?.['streams'];
    if (!Array.isArray(streams)) continue;
    const medien = streams
      .map(obj)
      .filter((s) => s && (s['kind'] === 'main' || s['kind'] === undefined))
      .flatMap((s) => (Array.isArray(s?.['media']) ? (s['media'] as unknown[]) : []))
      .map(obj)
      .filter((m): m is Obj => !!m && typeof m['url'] === 'string' && /^https:\/\//.test(m['url'] as string));
    const breite = (m: Obj) => (typeof m['maxHResolutionPx'] === 'number' ? (m['maxHResolutionPx'] as number) : 0);
    const mp4 = medien.filter((m) => m['mimeType'] === 'video/mp4').sort((a, b) => breite(b) - breite(a));
    const passend = mp4.find((m) => breite(m) <= 1280) ?? mp4[mp4.length - 1];
    if (passend) return passend['url'] as string;
    const hls = medien.find((m) => m['mimeType'] === 'application/vnd.apple.mpegurl');
    if (hls) return hls['url'] as string;
  }
  return null;
}

async function seite(pfad: string): Promise<unknown> {
  const antwort = await fetch(`${API}/${pfad}?devicetype=pc&embedded=true`, {
    headers: { 'User-Agent': UA },
    signal: AbortSignal.timeout(10_000)
  });
  if (!antwort.ok) return null;
  return antwort.json();
}

/** Trailer der Reihe zu einer Folge (ARD-Kennung der Folge); null, wenn es keinen gibt */
export async function findeReihenTrailer(folgenId: string): Promise<ReihenTrailer | null> {
  const reihe = reihenId(await seite(`item/${folgenId}`));
  if (!reihe) return null;
  const verweis = trailerVerweis(await seite(`grouping/${reihe}`));
  if (!verweis) return null;
  const url = videoAdresse(await seite(`item/${verweis.id}`));
  return url ? { titel: verweis.titel, url, dauer: verweis.dauer } : null;
}
