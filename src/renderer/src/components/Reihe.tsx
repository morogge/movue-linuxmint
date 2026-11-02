import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film } from '@shared/film';
import { genreName, type GenreId } from '@shared/genres';
import type { SenderGruppe } from '@shared/sender';
import type { SerieRef } from '@shared/serie';
import { Icon } from './Icon';
import { Kachel } from './Kachel';

interface Props {
  genre: GenreId;
  gruppe?: SenderGruppe | null;
  /** Ändert sich, wenn das Verzeichnis neu geladen wurde */
  stand: number | null;
  onOeffne: (f: Film) => void;
  onAlle: (g: GenreId) => void;
  onSerie?: (s: SerieRef) => void;
  onGeladen?: (genre: GenreId, filme: Film[]) => void;
}

/** Waagerechte Reihe mit den neuesten Sendungen eines Genres; Pfeile links und rechts statt Scrollbalken */
export function Reihe({ genre, gruppe, stand, onOeffne, onAlle, onGeladen, onSerie }: Props) {
  const [filme, setFilme] = useState<Film[] | null>(null);
  const liste = useRef<HTMLUListElement>(null);
  const [kannLinks, setKannLinks] = useState(false);
  const [kannRechts, setKannRechts] = useState(false);

  useEffect(() => {
    let aktiv = true;
    void window.movue?.index.reihe({ genre, gruppe, limit: 18 }).then((f) => {
      if (!aktiv) return;
      setFilme(f);
      onGeladen?.(genre, f);
    });
    return () => {
      aktiv = false;
    };
    // onGeladen bewusst nicht als Abhängigkeit: sonst lädt jede neue Funktion die Reihe neu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [genre, gruppe, stand]);

  /** Pfeile nur zeigen, wo es noch etwas zu sehen gibt */
  const pruefe = useCallback(() => {
    const el = liste.current;
    if (!el) return;
    setKannLinks(el.scrollLeft > 4);
    setKannRechts(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = liste.current;
    if (!el) return;
    pruefe();
    const beobachter = new ResizeObserver(pruefe);
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [filme, pruefe]);

  const blaettern = (richtung: 1 | -1) => {
    const el = liste.current;
    if (!el) return;
    // Um fast eine sichtbare Breite weiter, damit die letzte Kachel als Orientierung stehen bleibt
    el.scrollBy({ left: richtung * Math.max(el.clientWidth - 272, 272), behavior: 'smooth' });
  };

  if (filme !== null && filme.length === 0) return null;
  const titelId = `reihe-${genre}`;

  return (
    <section className="reihe" aria-labelledby={titelId}>
      <div className="reihe-kopf">
        <h2 id={titelId}>{genreName(genre)}</h2>
        <button type="button" className="text-button" onClick={() => onAlle(genre)}>
          Alle anzeigen
        </button>
      </div>
      <div className="reihe-rahmen">
        <ul className="reihe-liste" ref={liste} onScroll={pruefe}>
          {(filme ?? []).map((f) => (
            <li key={f.id}>
              <Kachel film={f} onOeffne={onOeffne} onSerie={onSerie} />
            </li>
          ))}
          {filme === null &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} aria-hidden="true">
                <span className="kachel platzhalter" />
              </li>
            ))}
        </ul>
        {kannLinks && (
          <button type="button" className="reihe-pfeil links" aria-label={`${genreName(genre)}: zurückblättern`} onClick={() => blaettern(-1)}>
            <Icon name="links" size={28} />
          </button>
        )}
        {kannRechts && (
          <button type="button" className="reihe-pfeil rechts" aria-label={`${genreName(genre)}: weiterblättern`} onClick={() => blaettern(1)}>
            <Icon name="rechts" size={28} />
          </button>
        )}
      </div>
    </section>
  );
}
