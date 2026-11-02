import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Film } from '@shared/film';
import { formatDatum, formatDauer } from '@shared/format';
import { folgenNummer, naechsteFolge } from '@shared/player';
import { FilmBild, SenderMarke } from '../components/Kachel';
import { Icon } from '../components/Icon';
import { VideoPlayer } from '../components/VideoPlayer';

/** Reihenfolge „Als Nächstes“: Serien nach Staffel/Folge, sonst neuere Sendungen der Reihe; gibt es keine, ältere */
export function alsNaechstes(aktuell: Film, folgen: Film[], anzahl = 8): { titel: string; filme: Film[] } {
  const liste: Film[] = [];
  let f: Film | null = aktuell;
  const gesehen = new Set<number>([aktuell.id]);
  while (liste.length < anzahl && f) {
    f = naechsteFolge(f, folgen.filter((x) => !gesehen.has(x.id)));
    if (f) {
      gesehen.add(f.id);
      liste.push(f);
    }
  }
  if (liste.length) return { titel: 'Als Nächstes', filme: liste };
  const aeltere = folgen
    .filter((x) => x.id !== aktuell.id && x.titel !== aktuell.titel && (folgenNummer(x.titel) !== null || x.datum < aktuell.datum))
    .sort((a, b) => b.datum - a.datum)
    .slice(0, anzahl);
  return { titel: 'Weitere Folgen', filme: aeltere };
}

interface Props {
  filmId: number;
  /** Position, an der der Mini-Player gerade war (hat Vorrang vor der gespeicherten) */
  startHinweis?: number;
  onAbspielen: (f: Film) => void;
  onDetails: (f: Film) => void;
  onZurueck: () => void;
  onFilm: (f: Film) => void;
  onPosition: (position: number) => void;
  onLaeuft: (laeuft: boolean) => void;
}

export function PlayerScreen({ filmId, startHinweis, onAbspielen, onDetails, onZurueck, onFilm, onPosition, onLaeuft }: Props) {
  const [film, setFilm] = useState<Film | null>(null);
  const [folgen, setFolgen] = useState<Film[]>([]);
  const [start, setStart] = useState<number | null>(null);

  useEffect(() => {
    let aktiv = true;
    setFilm(null);
    setStart(null);
    void Promise.all([window.movue.index.film(filmId), window.movue.index.folgen(filmId)]).then(async ([f, fo]) => {
      if (!aktiv || !f) return;
      const gespeichert = await window.movue.player.fortschritt(f.url);
      if (!aktiv) return;
      setFolgen(fo);
      setStart(startHinweis ?? gespeichert?.position ?? 0);
      setFilm(f);
      onFilm(f);
    });
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filmId]);

  const naechste = useMemo(() => (film ? alsNaechstes(film, folgen) : { titel: '', filme: [] }), [film, folgen]);
  const naechsteFilm = naechste.titel === 'Als Nächstes' ? (naechste.filme[0] ?? null) : null;

  const fortschritt = useCallback(
    (position: number, dauer: number) => {
      if (!film) return;
      onPosition(position);
      void window.movue.player.fortschrittSetzen(film.url, position, dauer);
    },
    [film, onPosition]
  );

  if (!film || start === null) {
    return (
      <section className="player-seite" aria-busy="true">
        <button type="button" className="zurueck" onClick={onZurueck}>
          ← Zurück
        </button>
        <div className="player platzhalter" />
      </section>
    );
  }

  return (
    <section className="player-seite" aria-labelledby="player-titel">
      <button type="button" className="zurueck" onClick={onZurueck}>
        ← Zurück
      </button>
      <div className="player-raster">
        <div className="player-haupt">
          <VideoPlayer
            key={film.id}
            film={film}
            start={start}
            naechste={naechsteFilm}
            onNaechste={naechsteFilm ? () => onAbspielen(naechsteFilm) : undefined}
            onFortschritt={fortschritt}
            onLaeuft={onLaeuft}
          />
          <div className="player-info">
            <div className="hero-meta">
              <SenderMarke film={film} />
              {film.thema && film.thema !== film.titel && <span>{film.thema}</span>}
              <span>
                {formatDatum(film.datum)}
                {film.dauer > 0 && ` · ${formatDauer(film.dauer)}`}
              </span>
            </div>
            <h1 id="player-titel">{film.titel}</h1>
            {film.beschreibung && <p className="detail-beschreibung">{film.beschreibung}</p>}
            <div className="hero-actions">
              <button type="button" className="secondary" onClick={() => onDetails(film)}>
                Details und alle Folgen
              </button>
              <button
                type="button"
                className="secondary"
                onClick={() => void window.movue.film.seiteOeffnen({ website: film.website, gruppe: film.gruppe, titel: film.titel })}
              >
                Beim Sender ansehen <Icon name="external" size={14} />
              </button>
            </div>
          </div>
        </div>
        {naechste.filme.length > 0 && (
          <aside className="player-liste" aria-labelledby="naechstes-titel">
            <h2 id="naechstes-titel">{naechste.titel}</h2>
            <ul>
              {naechste.filme.map((f, i) => (
                <li key={f.id}>
                  <button type="button" className="naechstes" onClick={() => onAbspielen(f)}>
                    <FilmBild film={f} />
                    <span className="naechstes-text">
                      {i === 0 && naechste.titel === 'Als Nächstes' && <span className="klein akzent">Nächste Folge</span>}
                      <span className="naechstes-titel">{f.titel}</span>
                      <span className="klein">
                        {formatDatum(f.datum)}
                        {f.dauer > 0 && ` · ${formatDauer(f.dauer)}`}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </aside>
        )}
      </div>
    </section>
  );
}
