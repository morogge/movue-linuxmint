import { useEffect, useState } from 'react';
import { KATEGORIE_GENRES } from '@shared/arten';
import type { Film, IndexZustand } from '@shared/film';
import { formatZahl } from '@shared/format';
import { FORMATE, genreName, type Format, type GenreId } from '@shared/genres';
import { GRUPPEN, type SenderGruppe } from '@shared/sender';
import type { SerieRef } from '@shared/serie';
import { Raster } from '../components/Raster';
import { SENDER_FARBE } from '../senderFarben';

interface Props {
  genre: GenreId;
  zustand: IndexZustand;
  onOeffne: (f: Film) => void;
  onSerie: (s: SerieRef) => void;
  onKategorien: () => void;
}

/** Seite eines Genres oder Themas: Reiter je Art (Serien, Filme, Dokus …), darunter alle Einträge */
export function GenreScreen({ genre, zustand, onOeffne, onSerie, onKategorien }: Props) {
  const [format, setFormat] = useState<Format | null>(null);
  const [gruppe, setGruppe] = useState<SenderGruppe | null>(null);
  const [anzahlen, setAnzahlen] = useState<Partial<Record<Format, number>>>({});
  const istGenre = KATEGORIE_GENRES.includes(genre);

  useEffect(() => {
    let aktiv = true;
    void window.movue.index.arten({ genre, gruppe }).then((a) => aktiv && setAnzahlen(a));
    return () => {
      aktiv = false;
    };
  }, [genre, gruppe, zustand.stand]);

  // Kurzbeiträge gibt es nur in der Suche und auf den Sender-Seiten
  const reiter = FORMATE.filter((f) => f.id !== 'kurz' && (anzahlen[f.id] ?? 0) > 0);
  const name = genreName(genre);

  return (
    <section className="genre-seite" aria-labelledby="genre-titel">
      <header className="seiten-kopf genre-kopf">
        <nav aria-label="Brotkrumen" className="brotkrumen">
          <button type="button" className="text-button" onClick={onKategorien}>
            Alle Kategorien
          </button>
          <span aria-hidden="true"> › </span>
          {istGenre ? 'Genres' : 'Themen'}
        </nav>
        <span className="ueberzeile">{istGenre ? 'Genre' : 'Thema'}</span>
        <h1 id="genre-titel">{name}</h1>
      </header>

      <div className="reiter" role="tablist" aria-label="Nach Art">
        <button type="button" role="tab" aria-selected={format === null} className={format === null ? 'reiter-knopf an' : 'reiter-knopf'} onClick={() => setFormat(null)}>
          Alle
        </button>
        {reiter.map((f) => (
          <button
            key={f.id}
            type="button"
            role="tab"
            aria-selected={format === f.id}
            className={format === f.id ? 'reiter-knopf an' : 'reiter-knopf'}
            onClick={() => setFormat(f.id)}
          >
            {f.name} <span className="reiter-zahl">{formatZahl(anzahlen[f.id] ?? 0)}</span>
          </button>
        ))}
      </div>
      <div className="chips" role="group" aria-label="Sender">
        <button type="button" className={gruppe === null ? 'chip an' : 'chip'} aria-pressed={gruppe === null} onClick={() => setGruppe(null)}>
          Alle Sender
        </button>
        {GRUPPEN.map((g) => (
          <button key={g.id} type="button" className={gruppe === g.id ? 'chip an' : 'chip'} aria-pressed={gruppe === g.id} onClick={() => setGruppe(g.id)}>
            <span className="dot" style={{ background: SENDER_FARBE[g.id] }} />
            {g.id}
          </button>
        ))}
      </div>
      <div role="tabpanel" aria-label={format ? FORMATE.find((f) => f.id === format)?.name : 'Alle'}>
        <Raster anfrage={{ genre, format, gruppe }} stand={zustand.stand} onOeffne={onOeffne} onSerie={onSerie} name={name} />
      </div>
    </section>
  );
}
