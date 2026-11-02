import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import type { Abo } from '@shared/nutzer';
import { Kachel } from './Kachel';

/** Reihe „Neue Folgen deiner Abos“ auf der Startseite; erscheint nur, wenn es neue Folgen gibt */
export function NeueFolgen({ stand, onOeffne }: { stand: number | null; onOeffne: (f: Film) => void }) {
  const [abos, setAbos] = useState<Abo[]>([]);

  useEffect(() => {
    let aktiv = true;
    const laden = () => void window.movue?.abo.liste().then((l) => aktiv && setAbos(l.filter((a) => a.neu > 0 && a.neueste)));
    laden();
    const ab = window.movue?.abo.beiNeuen(laden);
    return () => {
      aktiv = false;
      ab?.();
    };
  }, [stand]);

  if (abos.length === 0) return null;
  return (
    <section className="reihe" aria-labelledby="reihe-abos">
      <div className="reihe-kopf">
        <h2 id="reihe-abos">Neue Folgen deiner Abos</h2>
      </div>
      <div className="reihe-rahmen">
        <ul className="reihe-liste">
          {abos.map((a) => (
            <li key={`${a.gruppe}|${a.thema}`}>
              <Kachel
                film={a.neueste!}
                hinweis={a.neu === 1 ? '1 neue Folge' : `${a.neu} neue Folgen`}
                onOeffne={(f) => {
                  void window.movue.abo.gesehen({ gruppe: a.gruppe, thema: a.thema });
                  onOeffne(f);
                }}
              />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
