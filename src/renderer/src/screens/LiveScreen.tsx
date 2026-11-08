import { useEffect, useState } from 'react';
import type { Film, IndexZustand } from '@shared/film';
import { formatDauer } from '@shared/format';
import { laeuftJetzt, terminText, type LiveAngebot, type LiveSender } from '@shared/live';
import { Icon } from '../components/Icon';
import { Kachel } from '../components/Kachel';
import { SENDER_FARBE } from '../senderFarben';

interface Props {
  zustand: IndexZustand;
  onAbspielen: (f: Film) => void;
  onOeffne: (f: Film) => void;
}

function SenderKarte({ s, onAbspielen }: { s: LiveSender; onAbspielen: (f: Film) => void }) {
  return (
    <li>
      <button type="button" className="live-karte" onClick={() => onAbspielen(s.film)} aria-label={`${s.name} live ansehen`}>
        <span className="live-marke">LIVE</span>
        <span className="live-name">
          <span className="dot" style={{ background: SENDER_FARBE[s.film.gruppe] }} />
          {s.name}
        </span>
        <span className="live-start">
          <Icon name="play" size={16} /> Ansehen
        </span>
      </button>
    </li>
  );
}

/** Livestreams der Sender, Live-Übertragungen mit Erinnerung und Sendungen, die schon vor dem TV-Termin abrufbar sind */
export function LiveScreen({ zustand, onAbspielen, onOeffne }: Props) {
  const [angebot, setAngebot] = useState<LiveAngebot | null>(null);
  const [erinnert, setErinnert] = useState<Set<string>>(new Set());
  const [dritter, setDritter] = useState('');
  const [jetzt, setJetzt] = useState(Date.now());

  useEffect(() => {
    let aktiv = true;
    void window.movue.live.angebot().then((a) => aktiv && setAngebot(a));
    void window.movue.live.erinnerungen().then((e) => aktiv && setErinnert(new Set(e)));
    return () => {
      aktiv = false;
    };
  }, [zustand.stand]);

  // „Läuft jetzt“ aktuell halten
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  const erinnern = async (f: Film) => {
    const an = await window.movue.live.erinnern(f.id, !erinnert.has(f.url));
    setErinnert((alt) => {
      const neu = new Set(alt);
      if (an) neu.add(f.url);
      else neu.delete(f.url);
      return neu;
    });
  };

  const oben = angebot?.sender.filter((s) => s.gruppe !== 'dritte') ?? [];
  const dritte = angebot?.sender.filter((s) => s.gruppe === 'dritte') ?? [];
  const gewaehlt = dritte.find((s) => s.name === dritter) ?? dritte[0];

  return (
    <section className="live-seite" aria-labelledby="live-titel">
      <header className="seiten-kopf">
        <h1 id="live-titel">Live & demnächst</h1>
        <p className="seiten-text">Das laufende Programm der Sender, Live-Übertragungen und Sendungen, die du schon vor dem Fernsehtermin sehen kannst.</p>
      </header>
      {angebot === null && <p className="anzahl" aria-busy="true">Lade …</p>}

      {angebot && angebot.sender.length > 0 && (
        <section aria-labelledby="live-sender" className="kategorie-gruppe">
          <h2 id="live-sender">Jetzt im Programm</h2>
          <ul className="live-raster">
            {oben.map((s) => (
              <SenderKarte key={s.name} s={s} onAbspielen={onAbspielen} />
            ))}
            {gewaehlt && (
              <li>
                <div className="live-karte dritte">
                  <span className="live-marke">LIVE</span>
                  <label className="live-name" htmlFor="dritte-wahl">
                    Die Dritten
                  </label>
                  <select id="dritte-wahl" value={gewaehlt.name} onChange={(e) => setDritter(e.target.value)}>
                    {dritte.map((s) => (
                      <option key={s.name} value={s.name}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button type="button" className="secondary" onClick={() => onAbspielen(gewaehlt.film)} aria-label={`${gewaehlt.name} live ansehen`}>
                    <Icon name="play" size={16} /> Ansehen
                  </button>
                </div>
              </li>
            )}
          </ul>
        </section>
      )}

      {angebot && (
        <section aria-labelledby="live-uebertragungen" className="kategorie-gruppe">
          <h2 id="live-uebertragungen">Live-Übertragungen</h2>
          {angebot.uebertragungen.length === 0 ? (
            <p className="hinweis">Gerade ist keine Übertragung angekündigt.</p>
          ) : (
            <ul className="termin-liste">
              {angebot.uebertragungen.map((f) => {
                const laeuft = laeuftJetzt(f, jetzt);
                const an = erinnert.has(f.url);
                return (
                  <li key={f.id} className="termin">
                    <span className={laeuft ? 'termin-zeit jetzt' : 'termin-zeit'}>{laeuft ? <span className="live-marke">LIVE</span> : terminText(f.datum, jetzt)}</span>
                    <button type="button" className="termin-text" onClick={() => onOeffne(f)}>
                      <span className="termin-titel">{f.titel}</span>
                      <span className="termin-meta">
                        <span className="dot" style={{ background: SENDER_FARBE[f.gruppe] }} /> {f.sender} · {f.thema} · {formatDauer(f.dauer)}
                      </span>
                    </button>
                    {laeuft ? (
                      <button type="button" className="primary" onClick={() => onAbspielen(f)}>
                        <Icon name="play" size={16} /> Ansehen
                      </button>
                    ) : (
                      <button type="button" className={an ? 'secondary an' : 'secondary'} aria-pressed={an} onClick={() => void erinnern(f)}>
                        <Icon name="glocke" size={16} /> {an ? 'Erinnert' : 'Erinnern'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
          <p className="anzahl">Mit „Erinnern“ meldet sich Movue fünf Minuten vor Beginn – solange Movue läuft.</p>
        </section>
      )}

      {angebot && angebot.vorab.length > 0 && (
        <section aria-labelledby="live-vorab" className="kategorie-gruppe">
          <h2 id="live-vorab">Vorab in der Mediathek</h2>
          <p className="anzahl">Schon abrufbar, im Fernsehen erst zum angegebenen Termin.</p>
          <ul className="kachel-raster" aria-label="Vorab in der Mediathek">
            {angebot.vorab.map((f) => (
              <li key={f.id}>
                <Kachel film={f} onOeffne={onOeffne} />
                <span className="vorab-termin">Im TV: {terminText(f.datum, jetzt)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
