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

const serienCache = new Map<string, Promise<string | null>>();

/** Titelbild der Serie (16:9) oder Banner (16:7); null, wenn der Sender keins liefert */
export function useSerienBild(film: Pick<Film, 'website' | 'gruppe'> | null, art: 'serie' | 'banner' | undefined): string | null {
  const [url, setUrl] = useState<string | null>(null);
  // Titelbilder: ARD (16:9 und Banner), ZDF und 3sat (nur 16:9)
  const moeglich = film && art && (film.gruppe === 'ARD' || (art === 'serie' && (film.gruppe === 'ZDF' || film.gruppe === '3sat')));
  const website = moeglich ? film.website : null;
  useEffect(() => {
    if (!website || !art) return;
    let aktiv = true;
    const schluessel = `${art}|${website}`;
    let p = serienCache.get(schluessel);
    if (!p) {
      p = window.movue?.bild?.serie ? window.movue.bild.serie(website, art) : Promise.resolve(null);
      serienCache.set(schluessel, p);
    }
    void p.then((u) => aktiv && setUrl(u));
    return () => {
      aktiv = false;
    };
  }, [website, art]);
  return url;
}
