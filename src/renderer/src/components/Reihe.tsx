import { useCallback, useEffect, useRef, useState } from 'react';
import type { Film } from '@shared/film';
import type { Format, GenreId } from '@shared/genres';
import type { SenderGruppe } from '@shared/sender';
import type { Serie, SerieRef } from '@shared/serie';
import { Icon } from './Icon';
import { Kachel, SerieKachel } from './Kachel';

export type StoebernEintrag = { typ: 'serie'; serie: Serie; datum: number } | { typ: 'film'; film: Film; datum: number };

/** Was eine Reihe zeigt – dieselben Filter wie beim Stöbern */
export interface ReihenAnfrage {
  format?: Format | null;
  genre?: GenreId | null;
  gruppe?: SenderGruppe | null;
}

interface Props {
  titel: string;
  anfrage: ReihenAnfrage;
  /** Ändert sich, wenn das Verzeichnis neu geladen wurde */
  stand: number | null;
  onOeffne: (f: Film) => void;
  onSerie: (s: SerieRef) => void;
  /** „Alle anzeigen“ – ohne: kein Link */
  onAlle?: () => void;
  onGeladen?: (eintraege: StoebernEintrag[]) => void;
}

/** Eintrag als Kachel: Serien und Sendereihen als eine Kachel, sonst die Sendung */
export function EintragKachel({ eintrag, onOeffne, onSerie }: { eintrag: StoebernEintrag; onOeffne: (f: Film) => void; onSerie: (s: SerieRef) => void }) {
  return eintrag.typ === 'serie' ? <SerieKachel serie={eintrag.serie} onOeffne={onSerie} /> : <Kachel film={eintrag.film} onOeffne={onOeffne} />;
}

export function eintragSchluessel(e: StoebernEintrag): string {
  return e.typ === 'serie' ? `s${e.serie.id}` : `f${e.film.id}`;
}

/** Waagerechte Reihe mit den neuesten Einträgen; Pfeile links und rechts statt Scrollbalken */
export function Reihe({ titel, anfrage, stand, onOeffne, onSerie, onAlle, onGeladen }: Props) {
  const [eintraege, setEintraege] = useState<StoebernEintrag[] | null>(null);
  const liste = useRef<HTMLUListElement>(null);
  const [kannLinks, setKannLinks] = useState(false);
  const [kannRechts, setKannRechts] = useState(false);
  const { format = null, genre = null, gruppe = null } = anfrage;

  useEffect(() => {
    let aktiv = true;
    void window.movue?.index.stoebern({ format, genre, gruppe, limit: 18 }).then((e) => {
      if (!aktiv) return;
      setEintraege(e.eintraege);
      onGeladen?.(e.eintraege);
    });
    return () => {
      aktiv = false;
    };
    // onGeladen bewusst nicht als Abhängigkeit: sonst lädt jede neue Funktion die Reihe neu
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [format, genre, gruppe, stand]);

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
  }, [eintraege, pruefe]);

  const blaettern = (richtung: 1 | -1) => {
    const el = liste.current;
    if (!el) return;
    // Um fast eine sichtbare Breite weiter, damit die letzte Kachel als Orientierung stehen bleibt
    el.scrollBy({ left: richtung * Math.max(el.clientWidth - 272, 272), behavior: 'smooth' });
  };

  if (eintraege !== null && eintraege.length === 0) return null;
  const titelId = `reihe-${[format, genre, gruppe].filter(Boolean).join('-') || 'alle'}`;

  return (
    <section className="reihe" aria-labelledby={titelId}>
      <div className="reihe-kopf">
        <h2 id={titelId}>{titel}</h2>
        {onAlle && (
          <button type="button" className="text-button" onClick={onAlle} aria-label={`${titel}: alle anzeigen`}>
            Alle anzeigen
          </button>
        )}
      </div>
      <div className="reihe-rahmen">
        <ul className="reihe-liste" ref={liste} onScroll={pruefe}>
          {(eintraege ?? []).map((e) => (
            <li key={eintragSchluessel(e)}>
              <EintragKachel eintrag={e} onOeffne={onOeffne} onSerie={onSerie} />
            </li>
          ))}
          {eintraege === null &&
            Array.from({ length: 6 }, (_, i) => (
              <li key={i} aria-hidden="true">
                <span className="kachel platzhalter" />
              </li>
            ))}
        </ul>
        {kannLinks && (
          <button type="button" className="reihe-pfeil links" aria-label={`${titel}: zurückblättern`} onClick={() => blaettern(-1)}>
            <Icon name="links" size={28} />
          </button>
        )}
        {kannRechts && (
          <button type="button" className="reihe-pfeil rechts" aria-label={`${titel}: weiterblättern`} onClick={() => blaettern(1)}>
            <Icon name="rechts" size={28} />
          </button>
        )}
      </div>
    </section>
  );
}
