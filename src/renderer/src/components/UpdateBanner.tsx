import { useEffect, useState } from 'react';
import type { Film } from '@shared/film';
import { terminText } from '@shared/live';
import type { UpdateZustand } from '@shared/update';
import { Icon } from './Icon';

/** Hält den Update-Zustand aus dem Hauptprozess aktuell. */
export function useUpdateZustand(): UpdateZustand {
  const [zustand, setZustand] = useState<UpdateZustand>({ phase: 'aus' });
  useEffect(() => {
    const api = window.movue?.update;
    if (!api) return;
    let aktiv = true;
    void api.zustand().then((z) => aktiv && setZustand(z));
    const abmelden = api.beiAenderung(setZustand);
    return () => {
      aktiv = false;
      abmelden();
    };
  }, []);
  return zustand;
}

/** Hinweis oben im Hauptbereich, sobald eine neue Version bereitliegt. */
export function UpdateBanner({ zustand }: { zustand: UpdateZustand }) {
  const [ausgeblendet, setAusgeblendet] = useState<string | null>(null);

  if (zustand.phase !== 'bereit' && zustand.phase !== 'manuell') return null;
  if (ausgeblendet === zustand.version) return null;

  return (
    <section className="update-banner" aria-label="Neue Version">
      <Icon name="download" />
      <div className="update-text">
        <strong>Movue {zustand.version} ist da.</strong>{' '}
        {zustand.phase === 'bereit'
          ? 'Sie ist heruntergeladen und wird beim nächsten Beenden installiert.'
          : 'Die neue Version konnte nicht automatisch installiert werden.'}
      </div>
      {zustand.phase === 'bereit' ? (
        <button type="button" className="primary klein" onClick={() => void window.movue.update.installieren()}>
          Jetzt neu starten
        </button>
      ) : (
        <a className="primary klein" href={zustand.url} target="_blank" rel="noreferrer">
          Herunterladen
        </a>
      )}
      <button type="button" className="text-button" onClick={() => setAusgeblendet(zustand.version)}>
        Später
      </button>
    </section>
  );
}

/** Hinweis, wenn eine Live-Übertragung gleich beginnt, an die du erinnert werden wolltest */
export function ErinnerungBanner({ onAnsehen }: { onAnsehen: (f: Film) => void }) {
  const [filme, setFilme] = useState<Film[]>([]);
  useEffect(() => window.movue?.live.beiErinnerung((neu) => setFilme((alt) => [...alt, ...neu])), []);
  const film = filme[0];
  if (!film) return null;
  const weg = () => setFilme((alt) => alt.slice(1));
  return (
    <section className="update-banner erinnerung" aria-label="Erinnerung" role="status">
      <Icon name="glocke" />
      <div className="update-text">
        <strong>Gleich live: {film.titel}</strong> {terminText(film.datum)} · {film.sender}
      </div>
      <button
        type="button"
        className="primary klein"
        onClick={() => {
          onAnsehen(film);
          weg();
        }}
      >
        Ansehen
      </button>
      <button type="button" className="text-button" onClick={weg}>
        Schließen
      </button>
    </section>
  );
}
