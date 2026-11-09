import { useState } from 'react';
import type { Film } from '@shared/film';
import { formatDatum, formatDauer } from '@shared/format';
import { artName, serienUmfang, type Serie, type SerieRef } from '@shared/serie';
import { useBild, useSerienBild } from '../hooks/useBild';
import { istKommendLive, terminText } from '@shared/live';
import { Countdown } from './Countdown';
import { SENDER_FARBE } from '../senderFarben';

/**
 * Bildfläche einer Sendung: Vorschaubild, sonst eine ruhige Farbfläche mit dem Titel.
 * Mit `titelbild` zuerst das Titelbild der Serie (ARD), sonst das Bild der Folge.
 */
export function FilmBild({ film, gross = false, titelbild }: { film: Film; gross?: boolean; titelbild?: 'serie' | 'banner' }) {
  const folge = useBild(film);
  const serie = useSerienBild(film, titelbild);
  const url = serie ?? folge;
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

/** Kachel für eine ganze Serie bzw. Sendereihe: Bild der neuesten Folge, Name, Umfang */
export function SerieKachel({ serie, onOeffne, hinweis }: { serie: Serie; onOeffne: (s: Serie) => void; hinweis?: string }) {
  const bild: Film = serie.bild ?? {
    id: -serie.id,
    sender: serie.gruppe,
    gruppe: serie.gruppe,
    thema: serie.thema,
    titel: serie.thema,
    datum: serie.neueste,
    dauer: 0,
    beschreibung: '',
    website: '',
    url: '',
    urlKlein: '',
    urlHd: '',
    urlUntertitel: '',
    geo: '',
    genres: serie.genres,
    staffel: null,
    folge: null,
    extra: false,
    serieId: serie.id,
    buendel: serie.thema
  };
  return (
    <button type="button" className="kachel serie-kachel" onClick={() => onOeffne(serie)}>
      <span className="kachel-bild">
        <FilmBild film={bild} titelbild="serie" />
        <SenderMarke film={bild} />
        <span className="kachel-dauer">{hinweis ?? serienUmfang(serie)}</span>
      </span>
      <span className="kachel-titel">{serie.thema}</span>
      <span className="kachel-meta">
        {artName(serie.art)} · neu: {formatDatum(serie.neueste)}
      </span>
    </button>
  );
}

/** Kachel in einer Reihe: Bild, Sender, Titel, Reihe und Datum */
export function Kachel({
  film,
  onOeffne,
  fortschritt,
  hinweis,
  onSerie
}: {
  film: Film;
  onOeffne: (f: Film) => void;
  /** Gesetzt: Folgen einer Serie erscheinen als Serienkachel */
  onSerie?: (s: SerieRef) => void;
  /** 0–1: wie weit schon gesehen (Weiterschauen) */
  fortschritt?: number;
  hinweis?: string;
}) {
  if (onSerie && film.serie) return <SerieKachel serie={film.serie} onOeffne={onSerie} />;
  return (
    <button type="button" className="kachel" onClick={() => onOeffne(film)}>
      <span className="kachel-bild">
        <FilmBild film={film} />
        <SenderMarke film={film} />
        {(hinweis || film.dauer > 0) && <span className="kachel-dauer">{hinweis ?? formatDauer(film.dauer)}</span>}
        {fortschritt !== undefined && (
          <span className="kachel-fortschritt" aria-hidden="true">
            <span style={{ width: `${Math.round(Math.min(1, Math.max(0, fortschritt)) * 100)}%` }} />
          </span>
        )}
      </span>
      <span className="kachel-titel">{film.titel}</span>
      <span className="kachel-meta">
        {film.thema && film.thema !== film.titel ? `${film.thema} · ` : ''}
        {istKommendLive(film) ? (
          <Countdown datum={film.datum} />
        ) : istVorab(film) ? (
          <span className="vorab-termin">Vorab · im TV {terminText(film.datum)}</span>
        ) : (
          formatDatum(film.datum)
        )}
      </span>
    </button>
  );
}

/** Schon online, im Fernsehen erst später */
export function istVorab(film: Pick<Film, 'datum'>, jetzt = Date.now()): boolean {
  return film.datum * 1000 > jetzt;
}
