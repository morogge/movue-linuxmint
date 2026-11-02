import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import { BALD_TAGE, formatAblauf, type Ablauf } from '@shared/nutzer';
import { Kachel } from '../components/Kachel';

interface Eintrag {
  film: Film;
  ablauf: Ablauf;
  gemerkt: boolean;
}

/** Gemerkte und angefangene Sendungen, die in den nächsten Tagen aus der Mediathek verschwinden */
export function AblaufScreen({ stand, onOeffne }: { stand: number | null; onOeffne: (f: Film) => void }) {
  const [liste, setListe] = useState<Eintrag[] | null>(null);

  useEffect(() => {
    let aktiv = true;
    const laden = () => void window.movue.ablauf.bald().then((l) => aktiv && setListe(l));
    laden();
    // Ablaufdaten kommen im Hintergrund an – nach kurzer Zeit noch einmal schauen
    const t = window.setTimeout(laden, 4000);
    return () => {
      aktiv = false;
      window.clearTimeout(t);
    };
  }, [stand]);

  return (
    <section className="liste-seite" aria-labelledby="ablauf-titel">
      <h1 id="ablauf-titel">Läuft bald ab</h1>
      <p className="klein">
        Sendungen aus deiner Merkliste und angefangene Videos, die in den nächsten {BALD_TAGE} Tagen aus der Mediathek verschwinden.
      </p>
      {liste !== null && liste.length === 0 && (
        <p className="leer-hinweis">Gerade läuft nichts davon ab. Movue fragt bei den Sendern nach, wie lange gemerkte und angefangene Sendungen verfügbar sind.</p>
      )}
      {liste && liste.length > 0 && (
        <ul className="kachel-raster">
          {liste.map((e) => (
            <li key={e.film.url} className="bald">
              <Kachel film={e.film} onOeffne={onOeffne} hinweis={formatAblauf(e.ablauf) ?? undefined} />
              <span className="klein">{e.gemerkt ? 'Gemerkt' : 'Angefangen'}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
