import { useCallback, useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import { formatAblauf, laeuftBaldAb, type Abo, type MerkEintrag } from '@shared/nutzer';
import { GRUPPEN } from '@shared/sender';
import { Kachel } from '../components/Kachel';

interface Props {
  stand: number | null;
  onOeffne: (f: Film) => void;
}

function aboHinweis(a: Abo): string {
  if (a.neu === 1) return '1 neue Folge';
  if (a.neu > 1) return `${a.neu} neue Folgen`;
  return a.anzahl === 1 ? '1 Folge' : `${a.anzahl} Folgen`;
}

/** Merkliste: gemerkte Sendungen und abonnierte Reihen */
export function MerklisteScreen({ stand, onOeffne }: Props) {
  const [eintraege, setEintraege] = useState<MerkEintrag[] | null>(null);
  const [abos, setAbos] = useState<Abo[]>([]);

  const laden = useCallback(() => {
    void Promise.all([window.movue.merkliste.liste(), window.movue.abo.liste()]).then(([m, a]) => {
      setEintraege(m);
      setAbos(a);
    });
  }, []);

  useEffect(() => {
    laden();
    return window.movue.abo.beiNeuen(laden);
  }, [laden, stand]);

  const entfernen = async (e: MerkEintrag) => {
    await window.movue.merkliste.setzen(e.film, false);
    laden();
  };

  const abbestellen = async (a: Abo) => {
    await window.movue.abo.setzen({ gruppe: a.gruppe, thema: a.thema }, false);
    laden();
  };

  const aboOeffnen = (a: Abo) => {
    if (!a.neueste) return;
    void window.movue.abo.gesehen({ gruppe: a.gruppe, thema: a.thema });
    onOeffne(a.neueste);
  };

  const weg = (e: MerkEintrag) => !e.verfuegbar || e.ablauf?.weg === true;

  return (
    <section className="liste-seite" aria-labelledby="merkliste-titel">
      <h1 id="merkliste-titel">Merkliste</h1>

      {abos.length > 0 && (
        <section aria-labelledby="abos-titel">
          <div className="reihe-kopf">
            <h2 id="abos-titel">Abos</h2>
            <span className="klein">Neue Folgen meldet Movue, sobald das Verzeichnis sie enthält.</span>
          </div>
          <ul className="kachel-raster">
            {abos.map((a) => (
              <li key={`${a.gruppe}|${a.thema}`} className={a.neueste ? undefined : 'weg'}>
                {a.neueste ? (
                  <Kachel film={{ ...a.neueste, titel: a.thema }} onOeffne={() => aboOeffnen(a)} hinweis={aboHinweis(a)} />
                ) : (
                  <p className="kachel-ersatz">
                    <strong>{a.thema}</strong>
                    <span className="klein">
                      {GRUPPEN.find((g) => g.id === a.gruppe)?.name} · gerade keine Folgen im Verzeichnis
                    </span>
                  </p>
                )}
                {a.neu > 0 && <span className="neu-marke">Neu</span>}
                <button type="button" className="text-button klein" onClick={() => void abbestellen(a)} aria-label={`Abo „${a.thema}“ beenden`}>
                  Abo beenden
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section aria-labelledby="gemerkt-titel">
        <div className="reihe-kopf">
          <h2 id="gemerkt-titel">Gemerkt</h2>
        </div>
        {eintraege !== null && eintraege.length === 0 && (
          <p className="leer-hinweis">
            Noch nichts gemerkt. Auf der Seite einer Sendung legst du sie mit „Merken“ hier ab, mit „Reihe abonnieren“ bekommst du neue
            Folgen gemeldet.
          </p>
        )}
        {eintraege && eintraege.length > 0 && (
          <ul className="kachel-raster">
            {eintraege.map((e) => {
              const text = weg(e) ? 'nicht mehr verfügbar' : formatAblauf(e.ablauf);
              return (
                <li key={e.film.url} className={weg(e) ? 'weg' : laeuftBaldAb(e.ablauf) ? 'bald' : undefined}>
                  <Kachel
                    film={e.film}
                    onOeffne={(f) =>
                      e.verfuegbar ? onOeffne(f) : void window.movue.film.seiteOeffnen({ website: f.website, gruppe: f.gruppe, titel: f.titel })
                    }
                    hinweis={laeuftBaldAb(e.ablauf) || weg(e) ? (text ?? undefined) : undefined}
                  />
                  <button type="button" className="text-button klein" onClick={() => void entfernen(e)} aria-label={`„${e.film.titel}“ aus der Merkliste entfernen`}>
                    Entfernen
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </section>
  );
}
