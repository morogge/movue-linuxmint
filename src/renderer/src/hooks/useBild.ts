import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';

/** Bilder einmal je Sendungsseite anfragen – auch wenn dieselbe Sendung mehrfach auf dem Schirm ist */
const cache = new Map<string, Promise<string | null>>();

function lade(website: string): Promise<string | null> {
  let p = cache.get(website);
  if (!p) {
    p = window.movue?.bild ? window.movue.bild.url(website) : Promise.resolve(null);
    cache.set(website, p);
  }
  return p;
}

/** Vorschaubild einer Sendung (aus der Sendungsseite des Senders), null solange unbekannt oder ohne Bild */
export function useBild(film: Pick<Film, 'website'> | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!film?.website) return;
    let aktiv = true;
    void lade(film.website).then((u) => aktiv && setUrl(u));
    return () => {
      aktiv = false;
    };
  }, [film?.website]);
  return url;
}
