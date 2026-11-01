import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import { formatZeit } from '@shared/player';
import { Kachel } from './Kachel';

interface Eintrag {
  film: Film;
  position: number;
  dauer: number;
}

/** Reihe „Weiterschauen“ mit angefangenen Videos; ohne angefangene Videos erscheint sie nicht */
export function Weiterschauen({ stand, onAbspielen }: { stand: number | null; onAbspielen: (f: Film) => void }) {
  const [liste, setListe] = useState<Eintrag[]>([]);

  useEffect(() => {
    let aktiv = true;
    void window.movue?.player.weiterschauen().then((l) => aktiv && setListe(l));
    return () => {
      aktiv = false;
    };
  }, [stand]);

  if (liste.length === 0) return null;
  return (
    <section className="reihe" aria-labelledby="reihe-weiterschauen">
      <div className="reihe-kopf">
        <h2 id="reihe-weiterschauen">Weiterschauen</h2>
      </div>
      <div className="reihe-rahmen">
        <ul className="reihe-liste">
          {liste.map((e) => (
            <li key={e.film.id}>
              <Kachel film={e.film} onOeffne={onAbspielen} fortschritt={e.position / e.dauer} hinweis={`noch ${formatZeit(e.dauer - e.position)}`} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
