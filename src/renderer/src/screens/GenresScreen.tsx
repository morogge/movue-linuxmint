import { useEffect, useState } from 'react';
import type { IndexZustand } from '@shared/film';
import { formatZahl } from '@shared/format';
import type { GenreAnzahl, GenreId } from '@shared/genres';

/** Farbton je Genre für die Kacheln (gedämpft, damit weißer Text gut lesbar bleibt) */
const FARBE: Record<GenreId, string> = {
  krimi: '#3a2a2e',
  film: '#2e2a40',
  serie: '#2a3346',
  doku: '#283a36',
  wissen: '#24383f',
  geschichte: '#3b3326',
  reise: '#233a2c',
  kultur: '#3a2840',
  comedy: '#40361f',
  unterhaltung: '#402a36',
  nachrichten: '#262f3d',
  gesellschaft: '#33302a',
  ratgeber: '#2c3a28',
  kinder: '#3f3122',
  sport: '#1f3a3a',
  sonstiges: '#23262c'
};

interface Props {
  zustand: IndexZustand;
  onWaehle: (g: GenreId) => void;
}

export function GenresScreen({ zustand, onWaehle }: Props) {
  const [genres, setGenres] = useState<GenreAnzahl[]>([]);

  // Nach jedem Laden des Verzeichnisses neu zählen
  useEffect(() => {
    let aktiv = true;
    void window.movue?.index.genres().then((g) => aktiv && setGenres(g));
    return () => {
      aktiv = false;
    };
  }, [zustand.anzahl, zustand.stand]);

  return (
    <section className="genres" aria-labelledby="genres-titel">
      <h1 id="genres-titel">Genres</h1>
      <p className="anzahl">Sendungen aller vier Mediatheken, nach Genre sortiert. Eine Sendung kann in mehreren Genres stehen.</p>
      {genres.length === 0 ? (
        <p className="hinweis">Das Sendungsverzeichnis wird gerade geladen. Danach erscheinen hier die Genres.</p>
      ) : (
        <ul className="genre-raster">
          {genres.map((g) => (
            <li key={g.id}>
              <button
                type="button"
                className={g.id === 'sonstiges' ? 'genre-kachel weitere' : 'genre-kachel'}
                style={{ background: FARBE[g.id] }}
                onClick={() => onWaehle(g.id)}
                disabled={g.anzahl === 0}
              >
                <span className="genre-name">{g.name}</span>
                <span className="genre-zahl">{formatZahl(g.anzahl)} Sendungen</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
