import { useEffect, useMemo, useState } from 'react';
import type { Film } from '@shared/film';
import { formatDatum, formatDauer } from '@shared/format';
import { genreName } from '@shared/genres';
import { FilmBild, SenderMarke } from '../components/Kachel';
import { Icon } from '../components/Icon';

/** „(S02/E05)“ im Titel → Staffel 2, sonst null */
export function staffelVon(titel: string): number | null {
  const m = /\(S(\d{1,2})\/E\d+\)/.exec(titel);
  return m ? Number(m[1]) : null;
}

function videoDatei(film: Film): string | null {
  const url = film.urlHd || film.url;
  return /^https?:\/\/.+\.mp4(\?|$)/i.test(url) ? url : null;
}

interface Props {
  filmId: number;
  onOeffne: (f: Film) => void;
  onZurueck: () => void;
}

export function DetailScreen({ filmId, onOeffne, onZurueck }: Props) {
  const [film, setFilm] = useState<Film | null>(null);
  const [folgen, setFolgen] = useState<Film[]>([]);
  const [staffel, setStaffel] = useState<number | null>(null);
  const [seite, setSeite] = useState<'bereit' | 'pruefe' | 'suche'>('bereit');

  useEffect(() => {
    let aktiv = true;
    void Promise.all([window.movue.index.film(filmId), window.movue.index.folgen(filmId)]).then(([f, fo]) => {
      if (!aktiv) return;
      setFilm(f);
      setFolgen(fo);
      setStaffel(f ? staffelVon(f.titel) : null);
      setSeite('bereit');
    });
    return () => {
      aktiv = false;
    };
  }, [filmId]);

  const staffeln = useMemo(() => {
    const s = new Set<number>();
    for (const f of folgen) {
      const n = staffelVon(f.titel);
      if (n !== null) s.add(n);
    }
    return [...s].sort((a, b) => a - b);
  }, [folgen]);

  const sichtbareFolgen = useMemo(() => {
    const liste = staffeln.length > 1 && staffel !== null ? folgen.filter((f) => staffelVon(f.titel) === staffel) : folgen;
    return liste.filter((f) => f.id !== filmId).slice(0, 60);
  }, [folgen, staffeln, staffel, filmId]);

  if (!film) {
    return (
      <section className="detail" aria-busy="true">
        <button type="button" className="zurueck" onClick={onZurueck}>
          ← Zurück
        </button>
      </section>
    );
  }

  const video = videoDatei(film);
  const seiteOeffnen = async () => {
    setSeite('pruefe');
    const art = await window.movue.film.seiteOeffnen({ website: film.website, gruppe: film.gruppe, titel: film.titel });
    setSeite(art === 'suche' ? 'suche' : 'bereit');
  };

  return (
    <section className="detail" aria-labelledby="detail-titel">
      <button type="button" className="zurueck" onClick={onZurueck}>
        ← Zurück
      </button>

      <div className="detail-kopf">
        <div className="detail-text">
          <div className="hero-meta">
            <SenderMarke film={film} />
            {film.sender !== film.gruppe && film.sender !== '3Sat' && film.sender !== 'ARTE.DE' && <span>{film.sender}</span>}
            {film.thema && film.thema !== film.titel && <span>{film.thema}</span>}
          </div>
          <h1 id="detail-titel">{film.titel}</h1>
          <div className="detail-tags">
            {film.genres
              .filter((g) => g !== 'sonstiges')
              .map((g) => (
                <span key={g} className="genre-tag">
                  {genreName(g)}
                </span>
              ))}
            {film.urlUntertitel && <span className="tag">UT</span>}
            {film.urlHd && <span className="tag">HD</span>}
            {film.geo && <span className="tag">{film.geo.replace(/-/g, ' · ')}</span>}
          </div>
          {film.beschreibung && <p className="detail-beschreibung">{film.beschreibung}</p>}
          <p className="detail-info">
            {formatDatum(film.datum)}
            {film.dauer > 0 && ` · ${formatDauer(film.dauer)}`}
          </p>
          <div className="hero-actions">
            {video && (
              <a className="primary" href={video} target="_blank" rel="noreferrer">
                Video öffnen
              </a>
            )}
            <button type="button" className="secondary" onClick={() => void seiteOeffnen()} disabled={seite === 'pruefe'}>
              {seite === 'pruefe' ? 'Prüfe Seite …' : 'Beim Sender ansehen'} <Icon name="external" size={14} />
            </button>
          </div>
          {seite === 'suche' && (
            <p className="treffer-hinweis" role="status">
              Die Seite dieser Sendung gibt es beim Sender nicht mehr. Movue hat stattdessen die Suche der Mediathek geöffnet.
            </p>
          )}
        </div>
        <FilmBild film={film} gross />
      </div>

      {sichtbareFolgen.length > 0 && (
        <section className="folgen" aria-labelledby="folgen-titel">
          <div className="reihe-kopf">
            <h2 id="folgen-titel">Weitere Folgen von „{film.thema}“</h2>
            {staffeln.length > 1 && (
              <div className="chips" role="group" aria-label="Staffel">
                {staffeln.map((n) => (
                  <button key={n} type="button" className={staffel === n ? 'chip an' : 'chip'} aria-pressed={staffel === n} onClick={() => setStaffel(n)}>
                    Staffel {n}
                  </button>
                ))}
              </div>
            )}
          </div>
          <ul className="folgen-liste">
            {sichtbareFolgen.map((f) => (
              <li key={f.id}>
                <button type="button" className="folge" onClick={() => onOeffne(f)}>
                  <FilmBild film={f} />
                  <span className="folge-text">
                    <span className="folge-titel">{f.titel}</span>
                    <span className="folge-meta">
                      {formatDatum(f.datum)}
                      {f.dauer > 0 && ` · ${formatDauer(f.dauer)}`}
                    </span>
                    {f.beschreibung && <span className="folge-beschreibung">{f.beschreibung}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
