import { useEffect, useState } from 'react';
import { ART_SEITEN, KATEGORIE_GENRES, KATEGORIE_THEMEN, artSeite, type ArtSeite } from '@shared/arten';
import type { IndexZustand } from '@shared/film';
import { formatZahl } from '@shared/format';
import { genreName, type Format, type GenreAnzahl, type GenreId } from '@shared/genres';
import { GRUPPEN, type SenderGruppe } from '@shared/sender';
import { Icon, type IconName } from '../components/Icon';
import { SENDER_FARBE } from '../senderFarben';

const ART_ICON: Record<string, IconName> = {
  serien: 'tv',
  filme: 'film',
  dokus: 'doku',
  shows: 'show',
  nachrichten: 'nachrichten',
  sport: 'sport',
  kinder: 'kinder',
  magazine: 'magazin',
  konzert: 'konzert'
};

interface Props {
  zustand: IndexZustand;
  onArt: (s: ArtSeite) => void;
  onGenre: (g: GenreId) => void;
  onSender: (g: SenderGruppe) => void;
  onAblauf: () => void;
}

function titelZahl(n: number): string {
  return n === 1 ? '1 Titel' : `${formatZahl(n)} Titel`;
}

/** Alles, was es gibt: nach Art, nach Genre oder Thema, für wen, von welchem Sender */
export function KategorienScreen({ zustand, onArt, onGenre, onSender, onAblauf }: Props) {
  const [arten, setArten] = useState<Partial<Record<Format, number>>>({});
  const [genres, setGenres] = useState<GenreAnzahl[]>([]);

  // Nach jedem Laden des Verzeichnisses neu zählen
  useEffect(() => {
    let aktiv = true;
    void window.movue?.index.arten().then((a) => aktiv && setArten(a));
    void window.movue?.index.genres().then((g) => aktiv && setGenres(g));
    return () => {
      aktiv = false;
    };
  }, [zustand.anzahl, zustand.stand]);

  const anzahl = (g: GenreId) => genres.find((x) => x.id === g)?.anzahl ?? 0;
  const genreKachel = (g: GenreId) => (
    <li key={g}>
      <button type="button" className="kategorie-kachel" onClick={() => onGenre(g)}>
        <span className="kategorie-name">{genreName(g)}</span>
        <span className="kategorie-zahl">{formatZahl(anzahl(g))} Sendungen</span>
      </button>
    </li>
  );
  const kinder = artSeite('kinder');

  return (
    <section className="kategorien" aria-labelledby="kategorien-titel">
      <header className="seiten-kopf">
        <h1 id="kategorien-titel">Alle Kategorien</h1>
        <p className="seiten-text">Alles aus den vier Mediatheken – nach Art, nach Genre oder Thema, für wen und von welchem Sender.</p>
      </header>
      {zustand.anzahl === 0 && <p className="hinweis">Das Sendungsverzeichnis wird gerade geladen. Danach erscheinen hier die Zahlen.</p>}

      <section aria-labelledby="k-arten" className="kategorie-gruppe">
        <h2 id="k-arten">Arten</h2>
        <p className="anzahl">Was ist es? Jede Sendung gehört zu genau einer Art.</p>
        <ul className="kategorie-raster gross">
          {ART_SEITEN.filter((s) => s.format).map((s) => (
            <li key={s.id}>
              <button type="button" className="art-kachel" onClick={() => onArt(s)}>
                <span className="art-icon">
                  <Icon name={ART_ICON[s.id] ?? 'grid'} size={28} />
                </span>
                <span className="kategorie-name">{s.titel}</span>
                <span className="kategorie-zahl">{titelZahl(s.format ? (arten[s.format] ?? 0) : 0)}</span>
                {!s.seitenleiste && <span className="nur-hier">nur hier</span>}
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="k-genres" className="kategorie-gruppe">
        <h2 id="k-genres">Genres und Themen</h2>
        <p className="anzahl">Worum geht es? Eine Sendung kann mehrere Genres oder Themen haben.</p>
        <h3 className="kategorie-unter">Genres · für Serien und Filme</h3>
        <ul className="kategorie-raster">{KATEGORIE_GENRES.filter((g) => anzahl(g) > 0).map(genreKachel)}</ul>
        <h3 className="kategorie-unter">Themen · für Dokus, Magazine und Shows</h3>
        <ul className="kategorie-raster">{KATEGORIE_THEMEN.filter((g) => anzahl(g) > 0).map(genreKachel)}</ul>
      </section>

      <section aria-labelledby="k-ziel" className="kategorie-gruppe">
        <h2 id="k-ziel">Für wen</h2>
        <ul className="kategorie-raster">
          {kinder && (
            <li>
              <button type="button" className="kategorie-kachel mit-icon" onClick={() => onArt(kinder)}>
                <Icon name="kinder" size={24} />
                <span>
                  <span className="kategorie-name">Kinder</span>
                  <span className="kategorie-zahl">{formatZahl(anzahl('kinder'))} Sendungen</span>
                </span>
              </button>
            </li>
          )}
        </ul>
      </section>

      <section aria-labelledby="k-sender" className="kategorie-gruppe">
        <h2 id="k-sender">Sender</h2>
        <ul className="kategorie-raster">
          {GRUPPEN.map((g) => (
            <li key={g.id}>
              <button type="button" className="kategorie-kachel mit-icon" onClick={() => onSender(g.id)}>
                <span className="dot gross" style={{ background: SENDER_FARBE[g.id] }} />
                <span>
                  <span className="kategorie-name">{g.name}</span>
                  <span className="kategorie-zahl">Alles von diesem Sender, auch Kurzbeiträge</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="k-merkmale" className="kategorie-gruppe">
        <h2 id="k-merkmale">Merkmale</h2>
        <ul className="kategorie-raster">
          <li>
            <button type="button" className="kategorie-kachel mit-icon" onClick={onAblauf}>
              <Icon name="clock" size={24} />
              <span>
                <span className="kategorie-name">Läuft bald ab</span>
                <span className="kategorie-zahl">Nur noch wenige Tage in der Mediathek</span>
              </span>
            </button>
          </li>
        </ul>
      </section>
    </section>
  );
}
