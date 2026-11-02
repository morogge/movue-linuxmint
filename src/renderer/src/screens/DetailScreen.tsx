import { useEffect, useMemo, useState } from 'react';
import type { Film } from '@shared/film';
import { formatDatum, formatDauer } from '@shared/format';
import { genreName } from '@shared/genres';
import { formatZeit } from '@shared/player';
import { formatAblauf, laeuftBaldAb, type Ablauf } from '@shared/nutzer';
import { folgenKennung, type SerieRef } from '@shared/serie';
import type { TitelInfo } from '@shared/titelinfo';
import { GRUPPEN } from '@shared/sender';
import { SENDER_FARBE } from '../senderFarben';
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
  onAbspielen: (f: Film) => void;
  onSerie: (s: SerieRef) => void;
}

export function DetailScreen({ filmId, onOeffne, onZurueck, onAbspielen, onSerie }: Props) {
  const [position, setPosition] = useState<number | null>(null);
  const [film, setFilm] = useState<Film | null>(null);
  const [folgen, setFolgen] = useState<Film[]>([]);
  const [staffel, setStaffel] = useState<number | null>(null);
  const [seite, setSeite] = useState<'bereit' | 'pruefe' | 'suche'>('bereit');
  const [gemerkt, setGemerkt] = useState(false);
  const [abonniert, setAbonniert] = useState(false);
  const [ablauf, setAblauf] = useState<Ablauf | null>(null);
  const [auchBei, setAuchBei] = useState<Film[]>([]);
  const [info, setInfo] = useState<TitelInfo | null>(null);

  useEffect(() => {
    let aktiv = true;
    void Promise.all([window.movue.index.film(filmId), window.movue.index.folgen(filmId)]).then(([f, fo]) => {
      if (!aktiv) return;
      setFilm(f);
      setFolgen(fo);
      setPosition(null);
      if (f) void window.movue.player.fortschritt(f.url).then((p) => aktiv && setPosition(p && p.position >= 30 && p.position < p.dauer * 0.95 ? p.position : null));
      setStaffel(f ? staffelVon(f.titel) : null);
      setSeite('bereit');
      setAblauf(null);
      setAuchBei([]);
      setInfo(null);
      if (!f) return;
      void window.movue.index.auchBei(f.id).then((a) => aktiv && setAuchBei(a));
      void window.movue.index.titelInfo(f.id).then((i) => aktiv && setInfo(i));
      void window.movue.merkliste.ist(f.url).then((g) => aktiv && setGemerkt(g));
      void window.movue.abo.ist({ gruppe: f.gruppe, thema: f.thema }).then((a) => {
        if (!aktiv) return;
        setAbonniert(a);
        if (a) void window.movue.abo.gesehen({ gruppe: f.gruppe, thema: f.thema });
      });
      // Beim Sender nachfragen, wie lange die Sendung noch abrufbar ist – kommt später oder gar nicht
      void window.movue.ablauf.holen(f.id).then((x) => aktiv && setAblauf(x));
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
  const ablaufText = formatAblauf(ablauf);
  const merkenUmschalten = async () => setGemerkt(await window.movue.merkliste.setzen(film, !gemerkt));
  const aboUmschalten = async () => setAbonniert(await window.movue.abo.setzen({ gruppe: film.gruppe, thema: film.thema }, !abonniert));
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
            {ablaufText && (
              <span className={laeuftBaldAb(ablauf) || ablauf?.weg ? 'ablauf bald' : 'ablauf'}>
                {' · '}
                {ablauf?.weg || ablaufText === 'abgelaufen' ? ablaufText : `verfügbar ${ablaufText}`}
              </span>
            )}
          </p>
          {auchBei.length > 0 && (
            <p className="auch-bei">
              Auch bei
              {auchBei.map((f) => (
                <button key={f.id} type="button" className="chip" onClick={() => onOeffne(f)} title={`${f.titel} bei ${f.gruppe}`}>
                  <span className="dot" style={{ background: SENDER_FARBE[f.gruppe] }} />
                  {GRUPPEN.find((g) => g.id === f.gruppe)?.name ?? f.gruppe}
                </button>
              ))}
            </p>
          )}
          <div className="hero-actions">
            <button type="button" className="primary" onClick={() => onAbspielen(film)}>
              <Icon name="play" size={16} /> {position !== null ? `Weiterschauen ab ${formatZeit(position)}` : 'Abspielen'}
            </button>
            {video && (
              <a className="text-button" href={video} target="_blank" rel="noreferrer" title="Videodatei im Browser oder Videoprogramm öffnen">
                Extern öffnen
              </a>
            )}
            <button type="button" className={gemerkt ? 'secondary an' : 'secondary'} aria-pressed={gemerkt} onClick={() => void merkenUmschalten()}>
              <Icon name="bookmark" size={16} /> {gemerkt ? 'Gemerkt' : 'Merken'}
            </button>
            {folgen.length > 0 && (
              <button
                type="button"
                className={abonniert ? 'secondary an' : 'secondary'}
                aria-pressed={abonniert}
                title={abonniert ? 'Abo beenden' : `Neue Folgen von „${film.thema}“ melden`}
                onClick={() => void aboUmschalten()}
              >
                <Icon name="glocke" size={16} /> {abonniert ? 'Abonniert' : 'Reihe abonnieren'}
              </button>
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

      {info && (info.darsteller.length > 0 || info.stab.length > 0) && (
        <section className="besetzung" aria-labelledby="besetzung-titel">
          <h2 id="besetzung-titel">Besetzung</h2>
          {info.darsteller.length > 0 && (
            <ul className="besetzung-liste" aria-label="Darsteller">
              {info.darsteller.map((d, i) => (
                <li key={`${d.name}-${i}`}>
                  <span className="besetzung-name">{d.name}</span>
                  {d.rolle && <span className="besetzung-rolle">{d.rolle}</span>}
                </li>
              ))}
            </ul>
          )}
          {info.stab.length > 0 && (
            <>
              <h2>Stab</h2>
              <ul className="besetzung-liste" aria-label="Stab">
                {info.stab.map((d, i) => (
                  <li key={`${d.name}-${i}`}>
                    <span className="besetzung-name">{d.name}</span>
                    {d.rolle && <span className="besetzung-rolle">{d.rolle}</span>}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {film.serieId !== null && (
        <section className="folgen zur-serie" aria-label="Serie">
          <button type="button" className="secondary" onClick={() => onSerie({ gruppe: film.gruppe, thema: film.thema })}>
            <Icon name="liste" size={16} /> Alle Folgen von „{film.thema}“
          </button>
          {folgenKennung(film) && <span className="klein">Diese Sendung: {folgenKennung(film)}</span>}
        </section>
      )}

      {film.serieId === null && sichtbareFolgen.length > 0 && (
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
