import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import { genreName, type GenreId } from '@shared/genres';
import type { SenderGruppe } from '@shared/sender';
import { Kachel } from './Kachel';

interface Props {
  genre: GenreId;
  gruppe?: SenderGruppe | null;
  /** Ändert sich, wenn das Verzeichnis neu geladen wurde */
  stand: number | null;
  onOeffne: (f: Film) => void;
  onAlle: (g: GenreId) => void;
  onGeladen?: (genre: GenreId, filme: Film[]) => void;
}

/** Waagerechte Reihe mit den neuesten Sendungen eines Genres */
export function Reihe({ genre, gruppe, stand, onOeffne, onAlle, onGeladen }: Props) {
  const [filme, setFilme] = useState<Film[] | null>(null);

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
      <ul className="reihe-liste">
        {(filme ?? []).map((f) => (
          <li key={f.id}>
            <Kachel film={f} onOeffne={onOeffne} />
          </li>
        ))}
        {filme === null &&
          Array.from({ length: 6 }, (_, i) => (
            <li key={i} aria-hidden="true">
              <span className="kachel platzhalter" />
            </li>
          ))}
      </ul>
    </section>
  );
}
