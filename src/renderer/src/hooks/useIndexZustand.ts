import { useEffect, useState } from 'react';
import type { IndexZustand } from '@shared/film';

const START: IndexZustand = { phase: 'leer', anzahl: 0, stand: null };

/** Aktueller Zustand des Sendungs-Index, wird vom Hauptprozess laufend gemeldet. */
export function useIndexZustand(): IndexZustand {
  const [zustand, setZustand] = useState<IndexZustand>(START);

  useEffect(() => {
    const api = window.movue?.index;
    if (!api) return;
    let aktiv = true;
    void api.zustand().then((z) => aktiv && setZustand(z));
    const abmelden = api.beiAenderung(setZustand);
    return () => {
      aktiv = false;
      abmelden();
    };
  }, []);

  return zustand;
}
