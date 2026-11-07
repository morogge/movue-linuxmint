import { useState } from 'react';
import { neuTitel, type ArtSeite } from '@shared/arten';
import type { Film, IndexZustand } from '@shared/film';
import { GRUPPEN, type SenderGruppe } from '@shared/sender';
import type { SerieRef } from '@shared/serie';
import { Raster } from '../components/Raster';
import { Reihe } from '../components/Reihe';
import { SENDER_FARBE } from '../senderFarben';

interface Props {
  seite: ArtSeite;
  zustand: IndexZustand;
  /** Sender, mit dem die Seite startet (von einer Sender-Seite aus) */
  gruppe?: SenderGruppe | null;
  onOeffne: (f: Film) => void;
  onSerie: (s: SerieRef) => void;
  onKategorien: () => void;
}

/** Seite einer Art (Serien, Filme, Dokus …): Reihen je Genre bzw. Thema, mit Filter alles als Raster */
export function ArtScreen({ seite, zustand, gruppe: startGruppe = null, onOeffne, onSerie, onKategorien }: Props) {
  const [teil, setTeil] = useState<number | null>(null);
  const [gruppe, setGruppe] = useState<SenderGruppe | null>(startGruppe);
  const basis = { format: seite.format ?? null, genre: seite.genre ?? null, gruppe };
  const gewaehlt = teil !== null ? seite.teile[teil] : null;
  const filterName = seite.genre ? 'Art' : seite.format === 'serie' || seite.format === 'film' ? 'Genre' : 'Thema';

  return (
    <section className="art-seite" aria-labelledby="art-titel">
      <header className="seiten-kopf">
        <nav aria-label="Brotkrumen" className="brotkrumen">
          <button type="button" className="text-button" onClick={onKategorien}>
            Alle Kategorien
          </button>
          <span aria-hidden="true"> › </span>
          {seite.titel}
        </nav>
        <h1 id="art-titel">{gewaehlt ? `${seite.titel} · ${gewaehlt.name}` : seite.titel}</h1>
        <p className="seiten-text">{seite.beschreibung}</p>
      </header>

      {seite.teile.length > 0 && (
        <div className="chips" role="group" aria-label={filterName}>
          <button type="button" className={teil === null ? 'chip an' : 'chip'} aria-pressed={teil === null} onClick={() => setTeil(null)}>
            Alle
          </button>
          {seite.teile.map((t, i) => (
            <button key={t.name} type="button" className={teil === i ? 'chip an' : 'chip'} aria-pressed={teil === i} onClick={() => setTeil(i)}>
              {t.name}
            </button>
          ))}
        </div>
      )}
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

      {gewaehlt || seite.teile.length === 0 ? (
        <Raster
          anfrage={{ ...basis, format: gewaehlt?.format ?? basis.format, genre: gewaehlt?.genre ?? basis.genre }}
          stand={zustand.stand}
          onOeffne={onOeffne}
          onSerie={onSerie}
          name={gewaehlt ? `${seite.titel} · ${gewaehlt.name}` : seite.titel}
        />
      ) : (
        <>
          <Reihe key={`neu-${gruppe}`} titel={neuTitel(seite)} anfrage={basis} stand={zustand.stand} onOeffne={onOeffne} onSerie={onSerie} />
          {seite.teile.map((t, i) => (
            <Reihe
              key={`${t.name}-${gruppe}`}
              titel={t.name}
              anfrage={{ ...basis, format: t.format ?? basis.format, genre: t.genre ?? basis.genre }}
              stand={zustand.stand}
              onOeffne={onOeffne}
              onSerie={onSerie}
              onAlle={() => {
                setTeil(i);
                window.scrollTo({ top: 0 });
              }}
            />
          ))}
        </>
      )}
    </section>
  );
}
