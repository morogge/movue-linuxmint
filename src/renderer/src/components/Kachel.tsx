import { useState } from 'react';
import type { Film } from '@shared/film';
import { formatDatum, formatDauer } from '@shared/format';
import { useBild } from '../hooks/useBild';
import { SENDER_FARBE } from '../senderFarben';

/** Bildfläche einer Sendung: Vorschaubild, sonst eine ruhige Farbfläche mit dem Titel */
export function FilmBild({ film, gross = false }: { film: Film; gross?: boolean }) {
  const url = useBild(film);
  const [fehler, setFehler] = useState(false);
  const zeigeBild = url && !fehler;
  return (
    <div className={gross ? 'film-bild gross' : 'film-bild'} style={{ borderColor: SENDER_FARBE[film.gruppe] }}>
      {zeigeBild ? (
        <img src={url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFehler(true)} />
      ) : (
        <span className="film-bild-platzhalter" aria-hidden="true">
          {film.thema || film.titel}
        </span>
      )}
    </div>
  );
}

export function SenderMarke({ film }: { film: Film }) {
  return (
    <span className="sender-marke">
      <span className="dot" style={{ background: SENDER_FARBE[film.gruppe] }} />
      {film.gruppe}
    </span>
  );
}

/** Kachel in einer Reihe: Bild, Sender, Titel, Reihe und Datum */
export function Kachel({ film, onOeffne }: { film: Film; onOeffne: (f: Film) => void }) {
  return (
    <button type="button" className="kachel" onClick={() => onOeffne(film)}>
      <span className="kachel-bild">
        <FilmBild film={film} />
        <SenderMarke film={film} />
        {film.dauer > 0 && <span className="kachel-dauer">{formatDauer(film.dauer)}</span>}
      </span>
      <span className="kachel-titel">{film.titel}</span>
      <span className="kachel-meta">
        {film.thema && film.thema !== film.titel ? `${film.thema} · ` : ''}
        {formatDatum(film.datum)}
      </span>
    </button>
  );
}
