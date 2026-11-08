import { useEffect, useState } from 'react';

/** Einstellungen dieses Rechners (im Browser-Speicher der App) */
const VORSCHAUEN = 'movue.vorschauen';
const EREIGNIS = 'movue:einstellungen';

function lies(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function schreib(key: string, wert: string): void {
  try {
    window.localStorage.setItem(key, wert);
  } catch {
    // Ohne Speicher gilt die Wahl nur bis zum Neustart
  }
  window.dispatchEvent(new Event(EREIGNIS));
}

/** „Vorschauen automatisch abspielen“: Trailer im Kopf von Serien- und Detailseiten (Standard: an) */
export function useVorschauen(): [boolean, (an: boolean) => void] {
  const [an, setAn] = useState(() => lies(VORSCHAUEN) !== 'aus');
  useEffect(() => {
    const neu = () => setAn(lies(VORSCHAUEN) !== 'aus');
    window.addEventListener(EREIGNIS, neu);
    return () => window.removeEventListener(EREIGNIS, neu);
  }, []);
  return [an, (wert: boolean) => schreib(VORSCHAUEN, wert ? 'an' : 'aus')];
}

/** Wünscht das System weniger Bewegung? */
export function useWenigBewegung(): boolean {
  const abfrage = '(prefers-reduced-motion: reduce)';
  const [wenig, setWenig] = useState(() => window.matchMedia?.(abfrage).matches ?? false);
  useEffect(() => {
    const m = window.matchMedia?.(abfrage);
    if (!m) return;
    const neu = () => setWenig(m.matches);
    m.addEventListener('change', neu);
    return () => m.removeEventListener('change', neu);
  }, []);
  return wenig;
}
