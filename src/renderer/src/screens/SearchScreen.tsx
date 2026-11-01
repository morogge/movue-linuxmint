import { useEffect, useState } from 'react';
import type { Film, IndexZustand, Sortierung, SuchErgebnis } from '@shared/film';
import { formatDatum, formatDauer, formatZahl } from '@shared/format';
import { GENRES, genreName, istGenre, type GenreId } from '@shared/genres';
import { GRUPPEN, type SenderGruppe } from '@shared/sender';
import { Icon } from '../components/Icon';
import { FilmBild, Kachel } from '../components/Kachel';
import { SENDER_FARBE } from '../senderFarben';

const SEITE = 50;


/** Direkt abspielbare Videodatei (MP4); HLS-Streams spielt erst der eigene Player */
function videoDatei(film: Film): string | null {
  const url = film.urlHd || film.url;
  return /^https?:\/\/.+\.mp4(\?|$)/i.test(url) ? url : null;
}

function Treffer({ film, onOeffne }: { film: Film; onOeffne: (f: Film) => void }) {
  const [seite, setSeite] = useState<'bereit' | 'pruefe' | 'suche'>('bereit');
  const unterSender = film.sender !== film.gruppe && film.sender !== '3Sat' && film.sender !== 'ARTE.DE';
  const video = videoDatei(film);

  const seiteOeffnen = async () => {
    setSeite('pruefe');
    const art = await window.movue.film.seiteOeffnen({ website: film.website, gruppe: film.gruppe, titel: film.titel });
    setSeite(art === 'suche' ? 'suche' : 'bereit');
  };

  return (
    <li className="treffer">
      <button type="button" className="treffer-bild" onClick={() => onOeffne(film)} tabIndex={-1} aria-hidden="true">
        <FilmBild film={film} />
      </button>
      <div className="treffer-inhalt">
      <div className="treffer-kopf">
        <span className="sender-badge">
          <span className="dot" style={{ background: SENDER_FARBE[film.gruppe] }} />
          {film.gruppe}
          {unterSender && <span className="unter-sender"> · {film.sender}</span>}
        </span>
        {film.thema && film.thema !== film.titel && <span className="treffer-thema">{film.thema}</span>}
        {film.genres
          .filter((g) => g !== 'sonstiges')
          .slice(0, 3)
          .map((g) => (
            <span key={g} className="genre-tag">
              {genreName(g)}
            </span>
          ))}
      </div>
      <h3 className="treffer-titel">
        <button type="button" className="treffer-link" onClick={() => onOeffne(film)}>
          {film.titel}
        </button>
      </h3>
      {film.beschreibung && <p className="treffer-text">{film.beschreibung}</p>}
      <div className="treffer-fuss">
        <span>{formatDatum(film.datum)}</span>
        {film.dauer > 0 && <span>{formatDauer(film.dauer)}</span>}
        {film.urlUntertitel && <span className="tag">UT</span>}
        {film.urlHd && <span className="tag">HD</span>}
        {film.geo && <span className="tag" title={`Nur abrufbar in: ${film.geo}`}>{film.geo.replace(/-/g, ' · ')}</span>}
        <span className="treffer-aktionen">
          {video && (
            <a className="extern" href={video} target="_blank" rel="noreferrer">
              Video öffnen <Icon name="external" size={14} />
            </a>
          )}
          <button type="button" className="extern" onClick={() => void seiteOeffnen()} disabled={seite === 'pruefe'}>
            {seite === 'pruefe' ? 'Prüfe Seite …' : 'Beim Sender ansehen'} <Icon name="external" size={14} />
          </button>
        </span>
      </div>
      {seite === 'suche' && (
        <p className="treffer-hinweis" role="status">
          Die Seite dieser Sendung gibt es beim Sender nicht mehr. Movue hat stattdessen die Suche der Mediathek geöffnet.
        </p>
      )}
      </div>
    </li>
  );
}

interface Props {
  suchtext: string;
  zustand: IndexZustand;
  genre: GenreId | null;
  onGenre: (g: GenreId | null) => void;
  onOeffne: (f: Film) => void;
}

type Darstellung = 'kacheln' | 'liste';
const DARSTELLUNG = 'movue.darstellung';

function leseDarstellung(): Darstellung {
  try {
    return window.localStorage.getItem(DARSTELLUNG) === 'liste' ? 'liste' : 'kacheln';
  } catch {
    return 'kacheln';
  }
}

export function SearchScreen({ suchtext, zustand, genre, onGenre, onOeffne }: Props) {
  const [darstellung, setDarstellungState] = useState<Darstellung>(leseDarstellung);
  const setDarstellung = (d: Darstellung) => {
    setDarstellungState(d);
    try {
      window.localStorage.setItem(DARSTELLUNG, d);
    } catch {
      // nur Komfort
    }
  };
  const [gruppe, setGruppe] = useState<SenderGruppe | null>(null);
  const [sortierung, setSortierung] = useState<Sortierung>('relevanz');
  const [ergebnis, setErgebnis] = useState<SuchErgebnis>({ treffer: [], gesamt: 0 });
  const [laedtMehr, setLaedtMehr] = useState(false);

  // Bei jeder Änderung von Text, Filter oder Index neu suchen (kurz verzögert, während getippt wird)
  useEffect(() => {
    const api = window.movue?.index;
    if (!api) return;
    let aktiv = true;
    const t = setTimeout(() => {
      void api.suche({ text: suchtext, gruppe, genre, sortierung, limit: SEITE, offset: 0 }).then((e) => aktiv && setErgebnis(e));
    }, 200);
    return () => {
      aktiv = false;
      clearTimeout(t);
    };
  }, [suchtext, gruppe, genre, sortierung, zustand.anzahl, zustand.stand]);

  const mehrLaden = async () => {
    setLaedtMehr(true);
    const e = await window.movue.index.suche({
      text: suchtext,
      gruppe,
      genre,
      sortierung,
      limit: SEITE,
      offset: ergebnis.treffer.length
    });
    setErgebnis((alt) => ({ gesamt: e.gesamt, treffer: [...alt.treffer, ...e.treffer] }));
    setLaedtMehr(false);
  };

  const indexFehlt = zustand.anzahl === 0;
  const ohneText = !suchtext.trim();

  return (
    <section className="suche" aria-labelledby="suche-titel">
      <div className="suche-kopf">
        <h1 id="suche-titel">
          {!ohneText ? `Suche: „${suchtext.trim()}“` : genre ? genreName(genre) : 'Neueste Sendungen'}
        </h1>
        <div className="suche-filter">
          <div className="chips" role="group" aria-label="Sender">
            <button type="button" className={gruppe === null ? 'chip an' : 'chip'} aria-pressed={gruppe === null} onClick={() => setGruppe(null)}>
              Alle Sender
            </button>
            {GRUPPEN.map((g) => (
              <button
                key={g.id}
                type="button"
                className={gruppe === g.id ? 'chip an' : 'chip'}
                aria-pressed={gruppe === g.id}
                onClick={() => setGruppe(g.id)}
              >
                <span className="dot" style={{ background: SENDER_FARBE[g.id] }} />
                {g.id}
              </button>
            ))}
          </div>
          <div className="chips" role="group" aria-label="Darstellung">
            <button type="button" className={darstellung === 'kacheln' ? 'chip an' : 'chip'} aria-pressed={darstellung === 'kacheln'} onClick={() => setDarstellung('kacheln')}>
              <Icon name="grid" size={16} /> Kacheln
            </button>
            <button type="button" className={darstellung === 'liste' ? 'chip an' : 'chip'} aria-pressed={darstellung === 'liste'} onClick={() => setDarstellung('liste')}>
              <Icon name="liste" size={16} /> Liste
            </button>
          </div>
          <label className="sortierung">
            <span>Genre</span>
            <select value={genre ?? ''} onChange={(e) => onGenre(istGenre(e.target.value) ? e.target.value : null)}>
              <option value="">Alle Genres</option>
              {GENRES.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.name}
                </option>
              ))}
            </select>
          </label>
          <label className="sortierung">
            <span>Sortieren</span>
            <select value={sortierung} onChange={(e) => setSortierung(e.target.value as Sortierung)} disabled={ohneText}>
              <option value="relevanz">Beste Treffer</option>
              <option value="datum">Neueste zuerst</option>
            </select>
          </label>
        </div>
      </div>

      {indexFehlt ? (
        <p className="hinweis">
          {zustand.phase === 'fehler'
            ? `Das Sendungsverzeichnis konnte nicht geladen werden: ${zustand.meldung ?? 'unbekannter Fehler'}`
            : 'Das Sendungsverzeichnis wird gerade zum ersten Mal geladen. Das dauert ein bis zwei Minuten.'}
        </p>
      ) : (
        <>
          <p className="anzahl" aria-live="polite">
            {ergebnis.gesamt === 0 ? 'Keine Treffer.' : `${formatZahl(ergebnis.gesamt)} Treffer`}
          </p>
          {darstellung === 'kacheln' ? (
            <ul className="kachel-raster">
              {ergebnis.treffer.map((f) => (
                <li key={f.id}>
                  <Kachel film={f} onOeffne={onOeffne} />
                </li>
              ))}
            </ul>
          ) : (
            <ul className="trefferliste">
              {ergebnis.treffer.map((f) => (
                <Treffer key={f.id} film={f} onOeffne={onOeffne} />
              ))}
            </ul>
          )}
          {ergebnis.treffer.length < ergebnis.gesamt && (
            <button type="button" className="mehr" onClick={() => void mehrLaden()} disabled={laedtMehr}>
              {laedtMehr ? 'Lade …' : 'Mehr anzeigen'}
            </button>
          )}
        </>
      )}
    </section>
  );
}
