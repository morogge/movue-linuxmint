import { useEffect, useMemo, useState } from 'react';
import type { Film } from '@shared/film';
import { formatDatum, formatDauer } from '@shared/format';
import { genreName } from '@shared/genres';
import { formatZeit } from '@shared/player';
import {
  artName,
  folgenKennung,
  gruppenName,
  gruppeVon,
  serienUmfang,
  sortiereGruppen,
  startFolge,
  waehleTrailer,
  type FolgenStand,
  type SerieDetail,
  type SerieRef
} from '@shared/serie';
import { GESEHEN_ANTEIL } from '@shared/nutzer';
import { FilmBild, SenderMarke } from '../components/Kachel';
import { Icon } from '../components/Icon';
import { Besetzung } from '../components/Besetzung';
import type { TitelInfo } from '@shared/titelinfo';
import { useSerienBild } from '../hooks/useBild';
import { KopfTrailer } from '../components/KopfTrailer';

interface Props {
  serie: SerieRef;
  onZurueck: () => void;
  onAbspielen: (f: Film) => void;
  onOeffne: (f: Film) => void;
  /** Der Mini-Player läuft – dann kein Trailer im Kopf */
  miniLaeuft?: boolean;
}

export function SerieScreen({ serie: ref, onZurueck, onAbspielen, onOeffne, miniLaeuft = false }: Props) {
  const [detail, setDetail] = useState<SerieDetail | null | undefined>(undefined);
  const [staende, setStaende] = useState<Map<string, FolgenStand>>(new Map());
  const [reiter, setReiter] = useState<string | null>(null);
  const [abonniert, setAbonniert] = useState(false);
  const [bannerFehler, setBannerFehler] = useState(false);
  const [info, setInfo] = useState<TitelInfo | null>(null);
  const [seite, setSeite] = useState<'bereit' | 'pruefe' | 'suche'>('bereit');
  const bannerFilm = detail ? (detail.serie.bild ?? detail.folgen[0] ?? null) : null;
  const banner = useSerienBild(bannerFilm, 'banner');

  useEffect(() => {
    let aktiv = true;
    void window.movue.index.serie(ref).then(async (d) => {
      if (!aktiv) return;
      setDetail(d);
      if (!d) return;
      const liste = await window.movue.player.fortschritte(d.folgen.map((f) => f.url));
      if (!aktiv) return;
      setStaende(new Map(liste.map((s) => [s.url, s])));
    });
    void window.movue.index.serieInfo(ref).then((i) => aktiv && setInfo(i));
    void window.movue.abo.ist(ref).then((a) => {
      if (!aktiv) return;
      setAbonniert(a);
      if (a) void window.movue.abo.gesehen(ref);
    });
    return () => {
      aktiv = false;
    };
  }, [ref]);

  const gruppen = useMemo(() => (detail ? sortiereGruppen(detail.folgen.map((f) => gruppeVon(f, detail.serie.art))) : []), [detail]);
  const start = useMemo(() => (detail ? startFolge(detail, staende) : null), [detail, staende]);
  // Anfangs den Reiter der Folge zeigen, mit der es weitergeht
  const aktiverReiter = reiter ?? (start && detail ? gruppeVon(start.film, detail.serie.art) : (gruppen[0] ?? null));
  const trailer = useMemo(() => (detail ? waehleTrailer(detail.folgen.filter((f) => f.extra)) : null), [detail]);
  const sichtbar = detail && aktiverReiter ? detail.folgen.filter((f) => gruppeVon(f, detail.serie.art) === aktiverReiter) : [];

  if (detail === undefined || detail === null) {
    return (
      <section className="detail" aria-busy={detail === undefined}>
        <button type="button" className="zurueck" onClick={onZurueck}>
          ← Zurück
        </button>
        {detail === null && <p className="leer-hinweis">Diese Serie ist gerade nicht im Sendungsverzeichnis.</p>}
      </section>
    );
  }

  const { serie } = detail;
  const kopfFilm = serie.bild ?? detail.folgen[0];
  const startText = (() => {
    if (!start) return null;
    const k = folgenKennung(start.film);
    if (start.art === 'weiter') return `Weiterschauen${k ? ` ${k}` : ''}`;
    if (start.art === 'naechste') return `Nächste Folge${k ? ` ${k}` : ''}`;
    if (serie.art === 'serie') return `Abspielen${k ? ` ${k}` : ''}`;
    return 'Neueste Folge';
  })();
  const aboUmschalten = async () => setAbonniert(await window.movue.abo.setzen(ref, !abonniert));
  // Seite der Serie beim Sender (ZDF, 3sat), sonst die Suche der Mediathek nach dem Namen der Serie
  const seiteOeffnen = async () => {
    if (!kopfFilm) return;
    setSeite('pruefe');
    const art = await window.movue.film.seiteOeffnen({ website: kopfFilm.website, gruppe: serie.gruppe, titel: serie.thema, serie: true });
    setSeite(art === 'suche' ? 'suche' : 'bereit');
  };

  return (
    <section className="detail serie" aria-labelledby="serie-titel">
      <button type="button" className="zurueck" onClick={onZurueck}>
        ← Zurück
      </button>

      {banner && !bannerFehler && (
        <KopfTrailer trailer={trailer} aus={miniLaeuft}>
          <div className="serie-banner">
            <img src={banner} alt="" referrerPolicy="no-referrer" onError={() => setBannerFehler(true)} />
          </div>
        </KopfTrailer>
      )}

      <div className={banner && !bannerFehler ? 'detail-kopf ohne-bild' : 'detail-kopf'}>
        <div className="detail-text">
          <div className="hero-meta">
            {kopfFilm && <SenderMarke film={kopfFilm} />}
            <span>{artName(serie.art)}</span>
          </div>
          <h1 id="serie-titel">{serie.thema}</h1>
          <div className="detail-tags">
            {serie.genres
              .filter((g) => g !== 'sonstiges')
              .map((g) => (
                <span key={g} className="genre-tag">
                  {genreName(g)}
                </span>
              ))}
          </div>
          {kopfFilm?.beschreibung && <p className="detail-beschreibung">{kopfFilm.beschreibung}</p>}
          <p className="detail-info">
            {serienUmfang(serie)}
            {serie.extras > 0 && ` · ${serie.extras === 1 ? '1 Extra' : `${serie.extras} Extras`}`} · neueste Folge vom {formatDatum(serie.neueste)}
          </p>
          <div className="hero-actions">
            {start && startText && (
              <button type="button" className="primary" onClick={() => onAbspielen(start.film)}>
                <Icon name="play" size={16} /> {startText}
              </button>
            )}
            {trailer && (
              <button type="button" className="secondary" onClick={() => onAbspielen(trailer)}>
                <Icon name="film" size={16} /> Trailer
              </button>
            )}
            <button
              type="button"
              className={abonniert ? 'secondary an' : 'secondary'}
              aria-pressed={abonniert}
              title={abonniert ? 'Abo beenden' : `Neue Folgen von „${serie.thema}“ melden`}
              onClick={() => void aboUmschalten()}
            >
              <Icon name="glocke" size={16} /> {abonniert ? 'Abonniert' : 'Abonnieren'}
            </button>
            {kopfFilm && (
              <button type="button" className="secondary" onClick={() => void seiteOeffnen()} disabled={seite === 'pruefe'}>
                {seite === 'pruefe' ? 'Prüfe Seite …' : 'Beim Sender ansehen'} <Icon name="external" size={14} />
              </button>
            )}
          </div>
          {seite === 'suche' && (
            <p className="treffer-hinweis" role="status">
              Movue hat die Suche der Mediathek nach „{serie.thema}“ geöffnet.
            </p>
          )}
        </div>
        {kopfFilm && !(banner && !bannerFehler) && (
          <KopfTrailer trailer={trailer} aus={miniLaeuft}>
            <FilmBild film={kopfFilm} gross titelbild="serie" />
          </KopfTrailer>
        )}
      </div>

      <Besetzung info={info} />

      <section className="folgen" aria-labelledby="serie-folgen-titel">
        <div className="reihe-kopf">
          <h2 id="serie-folgen-titel">{aktiverReiter ? gruppenName(aktiverReiter) : 'Folgen'}</h2>
          {gruppen.length > 1 && (
            <div className="chips" role="tablist" aria-label={serie.art === 'serie' ? 'Staffeln' : 'Jahrgänge'}>
              {gruppen.map((g) => (
                <button
                  key={g}
                  type="button"
                  role="tab"
                  className={aktiverReiter === g ? 'chip an' : 'chip'}
                  aria-selected={aktiverReiter === g}
                  onClick={() => setReiter(g)}
                >
                  {gruppenName(g)}
                </button>
              ))}
            </div>
          )}
        </div>
        <ul className="folgen-liste">
          {sichtbar.map((f) => {
            const s = staende.get(f.url);
            const anteil = s && s.dauer > 0 ? s.position / s.dauer : 0;
            const gesehen = anteil >= GESEHEN_ANTEIL;
            const k = folgenKennung(f);
            return (
              <li key={f.id} className={gesehen ? 'gesehen' : undefined}>
                <button type="button" className="folge" onClick={() => onAbspielen(f)} aria-label={`${f.titel} abspielen`}>
                  <span className="folge-bild">
                    <FilmBild film={f} />
                    {anteil > 0 && (
                      <span className="kachel-fortschritt" aria-hidden="true">
                        <span style={{ width: `${Math.round(Math.min(1, anteil) * 100)}%` }} />
                      </span>
                    )}
                  </span>
                  <span className="folge-text">
                    <span className="folge-titel">
                      {k && <span className="folge-nummer">{k}</span>}
                      {f.titel}
                    </span>
                    <span className="folge-meta">
                      {formatDatum(f.datum)}
                      {f.dauer > 0 && ` · ${formatDauer(f.dauer)}`}
                      {gesehen ? ' · gesehen' : s && anteil > 0 ? ` · noch ${formatZeit(s.dauer - s.position)}` : ''}
                    </span>
                    {f.beschreibung && <span className="folge-beschreibung">{f.beschreibung}</span>}
                  </span>
                </button>
                <button type="button" className="text-button klein folge-details" onClick={() => onOeffne(f)} aria-label={`Details zu „${f.titel}“`}>
                  Details
                </button>
              </li>
            );
          })}
        </ul>
      </section>
    </section>
  );
}
