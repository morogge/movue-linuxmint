import { useEffect, useState } from 'react';
import type { Film, IndexZustand, Sortierung, SuchErgebnis } from '@shared/film';
import { formatDatum, formatDauer, formatZahl } from '@shared/format';
import { GRUPPEN, type SenderGruppe } from '@shared/sender';
import { Icon } from '../components/Icon';
import { SENDER_FARBE } from '../senderFarben';

const SEITE = 50;


function Treffer({ film }: { film: Film }) {
  const unterSender = film.sender !== film.gruppe && film.sender !== '3Sat' && film.sender !== 'ARTE.DE';
  return (
    <li className="treffer">
      <div className="treffer-kopf">
        <span className="sender-badge">
          <span className="dot" style={{ background: SENDER_FARBE[film.gruppe] }} />
          {film.gruppe}
          {unterSender && <span className="unter-sender"> · {film.sender}</span>}
        </span>
        {film.thema && film.thema !== film.titel && <span className="treffer-thema">{film.thema}</span>}
      </div>
      <h3 className="treffer-titel">{film.titel}</h3>
      {film.beschreibung && <p className="treffer-text">{film.beschreibung}</p>}
      <div className="treffer-fuss">
        <span>{formatDatum(film.datum)}</span>
        {film.dauer > 0 && <span>{formatDauer(film.dauer)}</span>}
        {film.urlUntertitel && <span className="tag">UT</span>}
        {film.urlHd && <span className="tag">HD</span>}
        {film.geo && <span className="tag" title={`Nur abrufbar in: ${film.geo}`}>{film.geo.replace(/-/g, ' · ')}</span>}
        {film.website && (
          <a className="extern" href={film.website} target="_blank" rel="noreferrer">
            Beim Sender ansehen <Icon name="external" size={14} />
          </a>
        )}
      </div>
    </li>
  );
}

export function SearchScreen({ suchtext, zustand }: { suchtext: string; zustand: IndexZustand }) {
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
      void api.suche({ text: suchtext, gruppe, sortierung, limit: SEITE, offset: 0 }).then((e) => aktiv && setErgebnis(e));
    }, 200);
    return () => {
      aktiv = false;
      clearTimeout(t);
    };
  }, [suchtext, gruppe, sortierung, zustand.anzahl, zustand.stand]);

  const mehrLaden = async () => {
    setLaedtMehr(true);
    const e = await window.movue.index.suche({
      text: suchtext,
      gruppe,
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
        <h1 id="suche-titel">{ohneText ? 'Neueste Sendungen' : `Suche: „${suchtext.trim()}“`}</h1>
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
          <ul className="trefferliste">
            {ergebnis.treffer.map((f) => (
              <Treffer key={f.id} film={f} />
            ))}
          </ul>
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
