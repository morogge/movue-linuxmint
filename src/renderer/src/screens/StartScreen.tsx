import { useCallback, useState } from 'react';
import type { Film, IndexZustand } from '@shared/film';
import { formatDatum, formatDauer, formatZahl } from '@shared/format';
import { genreName } from '@shared/genres';
import { artSeite, neuTitel, type ArtSeite } from '@shared/arten';
import { GRUPPEN, type SenderGruppe } from '@shared/sender';
import { FilmBild, SenderMarke } from '../components/Kachel';
import { Reihe, type StoebernEintrag } from '../components/Reihe';
import { Weiterschauen } from '../components/Weiterschauen';
import { NeueFolgen } from '../components/NeueFolgen';
import type { SerieRef } from '@shared/serie';

/** Reihen auf der Startseite und den Sender-Seiten: je Art die neuesten, Serien als eine Kachel */
export const START_REIHEN = ['serien', 'filme', 'dokus', 'shows', 'kinder', 'magazine', 'sport', 'konzert', 'nachrichten'] as const;

interface Props {
  zustand: IndexZustand;
  /** Gesetzt auf einer Sender-Seite: nur Sendungen dieser Mediathek */
  gruppe?: SenderGruppe | null;
  onOeffne: (f: Film) => void;
  onArt: (s: ArtSeite, gruppe: SenderGruppe | null) => void;
  onAbspielen: (f: Film) => void;
  onSerie: (s: SerieRef) => void;
}

function Hero({ film, onOeffne, onAbspielen }: { film: Film; onOeffne: (f: Film) => void; onAbspielen: (f: Film) => void }) {
  return (
    <section className="hero-film" aria-label="Empfehlung">
      <FilmBild film={film} gross />
      <div className="hero-text">
        <div className="hero-meta">
          <SenderMarke film={film} />
          {film.genres
            .filter((g) => g !== 'sonstiges')
            .slice(0, 2)
            .map((g) => genreName(g))
            .join(' · ')}
        </div>
        <h1>{film.titel}</h1>
        {film.beschreibung && <p>{film.beschreibung}</p>}
        <div className="hero-actions">
          <button type="button" className="primary" onClick={() => onAbspielen(film)}>
            Abspielen
          </button>
          <button type="button" className="secondary" onClick={() => onOeffne(film)}>
            Details
          </button>
          <span className="hero-info">
            {formatDatum(film.datum)}
            {film.dauer > 0 && ` · ${formatDauer(film.dauer)}`}
          </span>
        </div>
      </div>
    </section>
  );
}

export function StartScreen({ zustand, gruppe = null, onOeffne, onArt, onAbspielen, onSerie }: Props) {
  const [hero, setHero] = useState<Film | null>(null);

  // Die Empfehlung oben: der neueste Spielfilm (oder sonst die neueste Doku) mit Beschreibung
  const reiheGeladen = useCallback((seite: string, eintraege: StoebernEintrag[]) => {
    if (seite !== 'filme' && seite !== 'dokus') return;
    const kandidat = eintraege.flatMap((e) => (e.typ === 'film' ? [e.film] : [])).find((f) => f.beschreibung.length > 40 && f.dauer >= 40 * 60);
    if (!kandidat) return;
    setHero((alt) => (alt && (seite === 'dokus' || alt.format === 'film') ? alt : kandidat));
  }, []);

  const name = gruppe ? GRUPPEN.find((g) => g.id === gruppe)?.name : null;

  if (zustand.anzahl === 0) {
    return (
      <section className="start" aria-labelledby="start-title">
        <div className="hero">
          <h1 id="start-title">Willkommen bei Movue</h1>
          <p>
            Movue bündelt die Mediatheken von ARD, ZDF, 3sat und Arte in einer Oberfläche. Das Verzeichnis aller Sendungen wird
            gerade geladen – das dauert beim ersten Start ein bis zwei Minuten.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="start" aria-label={name ?? 'Startseite'}>
      {name && (
        <div className="sender-kopf">
          <h1>{name}</h1>
          <span className="anzahl">{formatZahl(zustand.anzahl)} Sendungen in allen Mediatheken</span>
        </div>
      )}
      {hero && <Hero film={hero} onOeffne={onOeffne} onAbspielen={onAbspielen} />}
      {!gruppe && <Weiterschauen stand={zustand.stand} onAbspielen={onAbspielen} />}
      {!gruppe && <NeueFolgen stand={zustand.stand} onOeffne={onOeffne} onSerie={onSerie} />}
      {START_REIHEN.map((id) => {
        const seite = artSeite(id);
        if (!seite) return null;
        return (
          <Reihe
            key={`${gruppe ?? 'alle'}-${id}`}
            titel={neuTitel(seite)}
            anfrage={{ format: seite.format ?? null, genre: seite.genre ?? null, gruppe }}
            stand={zustand.stand}
            onOeffne={onOeffne}
            onSerie={onSerie}
            onAlle={() => onArt(seite, gruppe)}
            onGeladen={(e) => reiheGeladen(id, e)}
          />
        );
      })}
      {/* Kurzbeiträge nur auf der Seite eines Senders */}
      {gruppe && <Reihe key={`${gruppe}-kurz`} titel="Kurzbeiträge" anfrage={{ format: 'kurz', gruppe }} stand={zustand.stand} onOeffne={onOeffne} onSerie={onSerie} />}
    </section>
  );
}
