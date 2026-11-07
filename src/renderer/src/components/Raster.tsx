import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import { formatZahl } from '@shared/format';
import type { SerieRef } from '@shared/serie';
import { EintragKachel, eintragSchluessel, type ReihenAnfrage, type StoebernEintrag } from './Reihe';

const SEITE = 60;

interface Props {
  anfrage: ReihenAnfrage;
  stand: number | null;
  onOeffne: (f: Film) => void;
  onSerie: (s: SerieRef) => void;
  /** Bezeichnung für Bildschirmleser, z. B. „Dokus · Geschichte“ */
  name: string;
}

/** Alle Einträge einer Auswahl als Kachelraster, neueste zuerst, seitenweise nachladen */
export function Raster({ anfrage, stand, onOeffne, onSerie, name }: Props) {
  const { format = null, genre = null, gruppe = null } = anfrage;
  const [daten, setDaten] = useState<{ eintraege: StoebernEintrag[]; gesamt: number } | null>(null);
  const [laedt, setLaedt] = useState(false);

  useEffect(() => {
    let aktiv = true;
    setDaten(null);
    void window.movue.index.stoebern({ format, genre, gruppe, limit: SEITE, offset: 0 }).then((d) => aktiv && setDaten(d));
    return () => {
      aktiv = false;
    };
  }, [format, genre, gruppe, stand]);

  const mehr = async () => {
    if (!daten) return;
    setLaedt(true);
    const d = await window.movue.index.stoebern({ format, genre, gruppe, limit: SEITE, offset: daten.eintraege.length });
    setDaten({ eintraege: [...daten.eintraege, ...d.eintraege], gesamt: d.gesamt });
    setLaedt(false);
  };

  if (daten === null) return <p className="anzahl" aria-busy="true">Lade …</p>;
  if (daten.gesamt === 0) return <p className="hinweis">Hier gibt es gerade nichts. Probier einen anderen Sender oder ein anderes Thema.</p>;

  return (
    <>
      <p className="anzahl" role="status">
        {daten.gesamt === 1 ? '1 Eintrag' : `${formatZahl(daten.gesamt)} Einträge`} · neueste zuerst · Serien und Reihen als eine Kachel
      </p>
      <ul className="kachel-raster" aria-label={name}>
        {daten.eintraege.map((e) => (
          <li key={eintragSchluessel(e)}>
            <EintragKachel eintrag={e} onOeffne={onOeffne} onSerie={onSerie} />
          </li>
        ))}
      </ul>
      {daten.eintraege.length < daten.gesamt && (
        <div className="mehr-laden">
          <button type="button" className="secondary" onClick={() => void mehr()} disabled={laedt}>
            {laedt ? 'Lade …' : 'Mehr laden'}
          </button>
        </div>
      )}
    </>
  );
}
