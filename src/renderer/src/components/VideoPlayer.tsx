import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Film } from '@shared/film';
import { adresseFuer, bevorzugteSpur, formatZeit, QUALITAET_NAME, qualitaeten, spurName, type Qualitaet } from '@shared/player';
import { matchShortcut } from '@shared/shortcuts';
import { Icon } from './Icon';

/** Einstellungen, die Movue sich merkt (nur Komfort – ohne Speicher gelten die Vorgaben) */
export const EINSTELLUNG = {
  qualitaet: 'movue.qualitaet',
  untertitel: 'movue.untertitel',
  tonsprache: 'movue.tonsprache',
  utsprache: 'movue.utsprache',
  autoplay: 'movue.autoplay',
  lautstaerke: 'movue.lautstaerke'
} as const;

export function lies(key: string, vorgabe: string): string {
  try {
    return window.localStorage.getItem(key) ?? vorgabe;
  } catch {
    return vorgabe;
  }
}

export function merke(key: string, wert: string): void {
  try {
    window.localStorage.setItem(key, wert);
  } catch {
    // ohne Speicher eben nicht
  }
}

interface Props {
  film: Film;
  /** Startposition in Sekunden */
  start?: number;
  /** Kleine Ansicht (Mini-Player): weniger Bedienelemente, keine Tastenkürzel */
  kompakt?: boolean;
  naechste?: Film | null;
  onNaechste?: () => void;
  onFortschritt?: (position: number, dauer: number) => void;
  /** Meldet, ob gerade abgespielt wird (für den Mini-Player) */
  onLaeuft?: (laeuft: boolean) => void;
}

const COUNTDOWN = 10;

function istEingabe(ziel: EventTarget | null): boolean {
  return ziel instanceof HTMLElement && (ziel.isContentEditable || ['INPUT', 'SELECT', 'TEXTAREA'].includes(ziel.tagName));
}

export function VideoPlayer({ film, start = 0, kompakt = false, naechste, onNaechste, onFortschritt, onLaeuft }: Props) {
  const video = useRef<HTMLVideoElement>(null);
  const huelle = useRef<HTMLDivElement>(null);
  const zuletztGemeldet = useRef(0);
  const ausblenden = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fortsetzenBei = useRef<{ zeit: number; spielen: boolean } | null>(null);

  const [qualitaet, setQualitaet] = useState<Qualitaet>(() => lies(EINSTELLUNG.qualitaet, 'hd') as Qualitaet);
  const quelle = adresseFuer(film, qualitaet);
  const [laeuft, setLaeuft] = useState(false);
  const [zeit, setZeit] = useState(0);
  const [dauer, setDauer] = useState(film.dauer || 0);
  // Livestreams melden keine Länge (Infinity)
  const live = dauer === Infinity;
  const [puffer, setPuffer] = useState(0);
  const [stumm, setStumm] = useState(false);
  const [lautstaerke, setLautstaerke] = useState(() => Number(lies(EINSTELLUNG.lautstaerke, '1')) || 1);
  const [utAn, setUtAn] = useState(() => lies(EINSTELLUNG.untertitel, 'aus') === 'an');
  // Ton- und Untertitelspuren im Stream (HLS): nur bei mehr als einer Tonspur bzw. überhaupt Untertiteln eine Auswahl
  const hlsRef = useRef<{ audioTrack: number; subtitleTrack: number; subtitleDisplay: boolean } | null>(null);
  const [tonspuren, setTonspuren] = useState<{ name: string; lang?: string }[]>([]);
  const [tonspur, setTonspur] = useState(0);
  const [utSpuren, setUtSpuren] = useState<{ name: string; lang?: string }[]>([]);
  const [utSpur, setUtSpur] = useState(-1);
  const [utQuelle, setUtQuelle] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [steuerung, setSteuerung] = useState(true);
  const [vollbild, setVollbild] = useState(false);
  const [autoplay, setAutoplay] = useState(() => lies(EINSTELLUNG.autoplay, 'an') === 'an');
  const [countdown, setCountdown] = useState<number | null>(null);

  // Quelle laden: MP4 direkt, HLS über hls.js
  useEffect(() => {
    const v = video.current;
    if (!v || !quelle) return;
    setFehler(null);
    let hls: { destroy: () => void } | null = null;
    let aktiv = true;
    if (/\.m3u8(\?|$)/i.test(quelle.url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
      void import('hls.js').then(({ default: Hls }) => {
        if (!aktiv) return;
        if (!Hls.isSupported()) {
          setFehler('Dieser Stream kann hier nicht abgespielt werden.');
          return;
        }
        const h = new Hls();
        h.loadSource(quelle.url);
        h.attachMedia(v);
        hlsRef.current = h;
        h.on(Hls.Events.AUDIO_TRACKS_UPDATED, (_e, d) => {
          const spuren = d.audioTracks.map((t, i) => ({ name: spurName(t, i), lang: t.lang }));
          setTonspuren(spuren);
          const i = bevorzugteSpur(d.audioTracks, lies(EINSTELLUNG.tonsprache, ''), h.audioTrack);
          if (i !== h.audioTrack && i >= 0) h.audioTrack = i;
          setTonspur(Math.max(i, 0));
        });
        h.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, (_e, d) => {
          setUtSpuren(d.subtitleTracks.map((t, i) => ({ name: spurName(t, i), lang: t.lang })));
          const gemerkt = lies(EINSTELLUNG.utsprache, '');
          const i = gemerkt ? bevorzugteSpur(d.subtitleTracks, gemerkt, -1) : -1;
          h.subtitleDisplay = i >= 0;
          h.subtitleTrack = i;
          setUtSpur(i);
        });
        h.on(Hls.Events.ERROR, (_e, d) => {
          if (d.fatal) setFehler('Der Stream konnte nicht geladen werden.');
        });
        hls = h;
      });
    } else {
      v.src = quelle.url;
    }
    return () => {
      aktiv = false;
      hlsRef.current = null;
      setTonspuren([]);
      setUtSpuren([]);
      hls?.destroy();
      v.removeAttribute('src');
      v.load();
    };
  }, [quelle?.url]); // eslint-disable-line react-hooks/exhaustive-deps

  // Untertitel holen (Hauptprozess wandelt TTML in WebVTT)
  useEffect(() => {
    setUtQuelle(null);
    if (!film.urlUntertitel) return;
    let url: string | null = null;
    let aktiv = true;
    void window.movue?.player.untertitel(film.urlUntertitel).then((vtt) => {
      if (!aktiv || !vtt) return;
      url = URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
      setUtQuelle(url);
    });
    return () => {
      aktiv = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [film.urlUntertitel]);

  // Untertitel ein-/ausblenden
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    for (const t of Array.from(v.textTracks)) t.mode = utAn ? 'showing' : 'hidden';
  }, [utAn, utQuelle]);

  useEffect(() => {
    if (video.current) {
      video.current.volume = lautstaerke;
      video.current.muted = stumm;
    }
  }, [lautstaerke, stumm]);

  useEffect(() => {
    const anders = () => setVollbild(document.fullscreenElement === huelle.current);
    document.addEventListener('fullscreenchange', anders);
    return () => document.removeEventListener('fullscreenchange', anders);
  }, []);

  const umschalten = useCallback(() => {
    const v = video.current;
    if (!v) return;
    if (v.paused) void v.play().catch(() => undefined);
    else v.pause();
  }, []);

  const springe = useCallback((delta: number) => {
    const v = video.current;
    if (v) v.currentTime = Math.max(0, Math.min(v.duration || Infinity, v.currentTime + delta));
  }, []);

  const vollbildUmschalten = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void huelle.current?.requestFullscreen();
  }, []);

  const utUmschalten = useCallback(() => {
    setUtAn((an) => {
      merke(EINSTELLUNG.untertitel, an ? 'aus' : 'an');
      return !an;
    });
  }, []);

  const lautstaerkeAendern = useCallback((wert: number) => {
    const l = Math.max(0, Math.min(1, wert));
    setLautstaerke(l);
    setStumm(l === 0);
    merke(EINSTELLUNG.lautstaerke, String(l));
  }, []);

  const qualitaetWechseln = (q: Qualitaet) => {
    const v = video.current;
    if (v) fortsetzenBei.current = { zeit: v.currentTime, spielen: !v.paused };
    setQualitaet(q);
    merke(EINSTELLUNG.qualitaet, q);
  };

  const zeigeSteuerung = useCallback(() => {
    setSteuerung(true);
    if (ausblenden.current) clearTimeout(ausblenden.current);
    ausblenden.current = setTimeout(() => {
      if (video.current && !video.current.paused) setSteuerung(false);
    }, 3000);
  }, []);

  // Tastenkürzel des Players (nicht im Mini-Player, nicht beim Tippen)
  useEffect(() => {
    if (kompakt) return;
    const onKey = (e: KeyboardEvent) => {
      if (istEingabe(e.target)) return;
      const aktion = matchShortcut(e, 'player');
      if (!aktion) return;
      e.preventDefault();
      zeigeSteuerung();
      if (aktion === 'abspielen') umschalten();
      if (aktion === 'zurueckspulen') springe(-10);
      if (aktion === 'vorspulen') springe(10);
      if (aktion === 'lauter') lautstaerkeAendern(lautstaerke + 0.1);
      if (aktion === 'leiser') lautstaerkeAendern(lautstaerke - 0.1);
      if (aktion === 'stumm') setStumm((s) => !s);
      if (aktion === 'vollbild') vollbildUmschalten();
      if (aktion === 'untertitel' && utQuelle) utUmschalten();
      if (aktion === 'naechste' && naechste) onNaechste?.();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [kompakt, lautstaerke, naechste, onNaechste, springe, umschalten, utQuelle, utUmschalten, vollbildUmschalten, zeigeSteuerung, lautstaerkeAendern]);

  // Countdown zur nächsten Folge
  useEffect(() => {
    if (countdown === null) return;
    if (countdown <= 0) {
      setCountdown(null);
      onNaechste?.();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => (c === null ? null : c - 1)), 1000);
    return () => clearTimeout(t);
  }, [countdown, onNaechste]);

  useEffect(() => setCountdown(null), [film.id]);

  const melde = (v: HTMLVideoElement, sofort = false) => {
    if (!onFortschritt || !Number.isFinite(v.duration)) return;
    if (sofort || Math.abs(v.currentTime - zuletztGemeldet.current) >= 5) {
      zuletztGemeldet.current = v.currentTime;
      onFortschritt(v.currentTime, v.duration);
    }
  };

  const fehlertext = (v: HTMLVideoElement) => {
    const code = v.error?.code;
    if (code === MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED || code === MediaError.MEDIA_ERR_NETWORK) {
      return film.geo
        ? `Dieses Video lässt sich nicht abspielen. Es ist nur in bestimmten Ländern abrufbar (${film.geo.replace(/-/g, ', ')}) – oder der Sender hat es inzwischen entfernt.`
        : 'Dieses Video lässt sich nicht abspielen. Wahrscheinlich hat der Sender es inzwischen entfernt.';
    }
    return 'Beim Abspielen ist ein Fehler aufgetreten.';
  };

  const andereQualitaeten = qualitaeten(film);
  const pipMoeglich = typeof document !== 'undefined' && document.pictureInPictureEnabled;

  return (
    <div
      ref={huelle}
      className={`player${kompakt ? ' kompakt' : ''}${steuerung || !laeuft ? ' steuerung-an' : ''}`}
      onMouseMove={zeigeSteuerung}
      onMouseLeave={() => laeuft && setSteuerung(false)}
    >
      <video
        ref={video}
        className="player-video"
        playsInline
        autoPlay
        onClick={umschalten}
        onDoubleClick={kompakt ? undefined : vollbildUmschalten}
        onPlay={() => {
          setLaeuft(true);
          onLaeuft?.(true);
          zeigeSteuerung();
        }}
        onPause={(e) => {
          setLaeuft(false);
          onLaeuft?.(false);
          setSteuerung(true);
          melde(e.currentTarget, true);
        }}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setDauer(v.duration);
          const weiter = fortsetzenBei.current;
          fortsetzenBei.current = null;
          if (weiter) {
            v.currentTime = weiter.zeit;
            if (!weiter.spielen) v.pause();
          } else if (start > 5 && start < v.duration - 15) {
            v.currentTime = start;
          }
        }}
        onTimeUpdate={(e) => {
          setZeit(e.currentTarget.currentTime);
          melde(e.currentTarget);
        }}
        onProgress={(e) => {
          const b = e.currentTarget.buffered;
          if (b.length) setPuffer(b.end(b.length - 1));
        }}
        onEnded={(e) => {
          melde(e.currentTarget, true);
          if (naechste && autoplay && !kompakt) setCountdown(COUNTDOWN);
        }}
        onError={(e) => setFehler(fehlertext(e.currentTarget))}
      >
        {utQuelle && <track kind="subtitles" srcLang="de" label="Deutsch" src={utQuelle} default={utAn} />}
      </video>

      {fehler && (
        <div className="player-fehler" role="alert">
          <p>{fehler}</p>
          <button
            type="button"
            className="secondary"
            onClick={() => void window.movue.film.seiteOeffnen({ website: film.website, gruppe: film.gruppe, titel: film.titel })}
          >
            Beim Sender ansehen <Icon name="external" size={14} />
          </button>
        </div>
      )}

      {countdown !== null && naechste && (
        <div className="player-naechste" role="status">
          <span className="klein">Nächste Folge in {countdown} s</span>
          <strong>{naechste.titel}</strong>
          <div className="player-naechste-knoepfe">
            <button type="button" className="primary klein" onClick={() => onNaechste?.()}>
              Jetzt abspielen
            </button>
            <button type="button" className="text-button" onClick={() => setCountdown(null)}>
              Abbrechen
            </button>
          </div>
        </div>
      )}

      <div className="player-steuerung" onClick={(e) => e.stopPropagation()}>
        {/* Livestream: keine Länge, keine Zeitleiste */}
        {!live ? (
          <div className="player-zeitleiste">
            <span className="player-zeit">{formatZeit(zeit)}</span>
            <div className="player-balken">
              <div className="player-puffer" style={{ width: dauer ? `${(puffer / dauer) * 100}%` : 0 }} />
              <input
                type="range"
                min={0}
                max={Math.max(1, Math.floor(dauer))}
                step={1}
                value={Math.floor(zeit)}
                aria-label="Wiedergabeposition"
                aria-valuetext={`${formatZeit(zeit)} von ${formatZeit(dauer)}`}
                style={{ '--fortschritt': dauer ? `${(zeit / dauer) * 100}%` : '0%' } as CSSProperties}
                onChange={(e) => {
                  if (video.current) video.current.currentTime = Number(e.target.value);
                }}
              />
            </div>
            <span className="player-zeit">{formatZeit(dauer)}</span>
          </div>
        ) : (
          <div className="player-zeitleiste">
            <span className="live-marke">LIVE</span>
          </div>
        )}
        <div className="player-knoepfe">
          {!kompakt && !live && (
            <button type="button" className="player-knopf" aria-label="10 Sekunden zurück" title="10 Sekunden zurück (←)" onClick={() => springe(-10)}>
              <Icon name="zurueck10" />
            </button>
          )}
          <button type="button" className="player-knopf gross" aria-label={laeuft ? 'Pause' : 'Abspielen'} title="Abspielen / Pause (Leertaste)" onClick={umschalten}>
            <Icon name={laeuft ? 'pause' : 'play'} size={24} />
          </button>
          {!kompakt && !live && (
            <button type="button" className="player-knopf" aria-label="10 Sekunden vor" title="10 Sekunden vor (→)" onClick={() => springe(10)}>
              <Icon name="vor10" />
            </button>
          )}
          {!kompakt && (
            <div className="player-lautstaerke">
              <button type="button" className="player-knopf" aria-label={stumm ? 'Ton an' : 'Ton aus'} title="Ton aus / an (M)" onClick={() => setStumm((s) => !s)}>
                <Icon name={stumm || lautstaerke === 0 ? 'stumm' : 'laut'} />
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={stumm ? 0 : lautstaerke}
                aria-label="Lautstärke"
                onChange={(e) => lautstaerkeAendern(Number(e.target.value))}
              />
            </div>
          )}
          <span className="player-luecke" />
          {!kompakt && tonspuren.length > 1 && (
            <label className="player-qualitaet">
              <span className="sr-only">Sprache</span>
              <select
                aria-label="Sprache"
                value={tonspur}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  if (hlsRef.current) hlsRef.current.audioTrack = i;
                  setTonspur(i);
                  merke(EINSTELLUNG.tonsprache, tonspuren[i]?.lang ?? '');
                }}
              >
                {tonspuren.map((t, i) => (
                  <option key={i} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!kompakt && utSpuren.length > 0 && (
            <label className="player-qualitaet">
              <span className="sr-only">Untertitel im Stream</span>
              <select
                aria-label="Untertitel im Stream"
                value={utSpur}
                onChange={(e) => {
                  const i = Number(e.target.value);
                  if (hlsRef.current) {
                    hlsRef.current.subtitleDisplay = i >= 0;
                    hlsRef.current.subtitleTrack = i;
                  }
                  setUtSpur(i);
                  merke(EINSTELLUNG.utsprache, i >= 0 ? (utSpuren[i]?.lang ?? '') : '');
                }}
              >
                <option value={-1}>Untertitel aus</option>
                {utSpuren.map((t, i) => (
                  <option key={i} value={i}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!kompakt && utQuelle && (
            <button type="button" className={utAn ? 'player-knopf an' : 'player-knopf'} aria-label="Untertitel" aria-pressed={utAn} title="Untertitel (C)" onClick={utUmschalten}>
              <Icon name="untertitel" />
            </button>
          )}
          {!kompakt && andereQualitaeten.length > 1 && (
            <label className="player-qualitaet">
              <span className="sr-only">Qualität</span>
              <select value={quelle?.id ?? qualitaet} onChange={(e) => qualitaetWechseln(e.target.value as Qualitaet)}>
                {andereQualitaeten.map((q) => (
                  <option key={q.id} value={q.id}>
                    {QUALITAET_NAME[q.id]}
                  </option>
                ))}
              </select>
            </label>
          )}
          {!kompakt && naechste && (
            <button
              type="button"
              className={autoplay ? 'player-knopf an' : 'player-knopf'}
              aria-label="Nächste Folge automatisch abspielen"
              aria-pressed={autoplay}
              title="Autoplay der nächsten Folge"
              onClick={() =>
                setAutoplay((a) => {
                  merke(EINSTELLUNG.autoplay, a ? 'aus' : 'an');
                  return !a;
                })
              }
            >
              <Icon name="autoplay" />
            </button>
          )}
          {pipMoeglich && (
            <button
              type="button"
              className="player-knopf"
              aria-label="Bild-in-Bild"
              title="Bild-in-Bild: Video in eigenem Fenster, immer im Vordergrund"
              onClick={() => {
                if (document.pictureInPictureElement) void document.exitPictureInPicture();
                else void video.current?.requestPictureInPicture();
              }}
            >
              <Icon name="pip" />
            </button>
          )}
          {!kompakt && (
            <button type="button" className="player-knopf" aria-label={vollbild ? 'Vollbild beenden' : 'Vollbild'} title="Vollbild (F)" onClick={vollbildUmschalten}>
              <Icon name={vollbild ? 'vollbildAus' : 'fullscreen'} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
