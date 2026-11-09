import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';

/** Bilder einmal je Sendungsseite anfragen – auch wenn dieselbe Sendung mehrfach auf dem Schirm ist */
const cache = new Map<string, Promise<string | null>>();

function lade(film: Pick<Film, 'id' | 'url' | 'website'>): Promise<string | null> {
  // Sendungen aus dem Verzeichnis (id > 0) mit Ersatzwegen, sonst nur über die Seite
  const schluessel = film.id > 0 ? `id|${film.id}|${film.url}` : film.website;
  let p = cache.get(schluessel);
  if (!p) {
    p = !window.movue?.bild
      ? Promise.resolve(null)
      : film.id > 0 && window.movue.bild.film
        ? window.movue.bild.film(film)
        : window.movue.bild.url(film.website);
    cache.set(schluessel, p);
  }
  return p;
}

/** Vorschaubild einer Sendung (Seite des Senders, sonst Ersatz aus der Serie), null solange unbekannt oder ohne Bild */
export function useBild(film: Pick<Film, 'id' | 'url' | 'website'> | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  const id = film?.id ?? 0;
  const website = film?.website ?? '';
  const videoUrl = film?.url ?? '';
  useEffect(() => {
    setUrl(null);
    if (!website && id <= 0) return;
    let aktiv = true;
    void lade({ id, url: videoUrl, website }).then((u) => aktiv && setUrl(u));
    return () => {
      aktiv = false;
    };
  }, [id, videoUrl, website]);
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
