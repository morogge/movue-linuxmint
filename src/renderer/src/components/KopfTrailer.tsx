import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { Film } from '@shared/film';
import { useVorschauen, useWenigBewegung } from '../einstellungen';
import { Icon } from './Icon';

interface Props {
  trailer: Film | null;
  /** Gerade nicht abspielen (z. B. weil der Mini-Player läuft) */
  aus: boolean;
  /** Standbild, über dem der Trailer läuft und das nach dem Ende wieder erscheint */
  children: ReactNode;
}

/** MP4 direkt, HLS über hls.js; gibt eine Aufräumfunktion zurück */
function ladeQuelle(v: HTMLVideoElement, url: string, onFehler: () => void): () => void {
  let hls: { destroy: () => void } | null = null;
  let aktiv = true;
  if (/\.m3u8(\?|$)/i.test(url) && !v.canPlayType('application/vnd.apple.mpegurl')) {
    void import('hls.js').then(({ default: Hls }) => {
      if (!aktiv) return;
      if (!Hls.isSupported()) return onFehler();
      const h = new Hls();
      h.loadSource(url);
      h.attachMedia(v);
      h.on(Hls.Events.ERROR, (_e, d) => d.fatal && onFehler());
      hls = h;
    });
  } else {
    v.src = url;
  }
  return () => {
    aktiv = false;
    hls?.destroy();
    v.removeAttribute('src');
    v.load();
  };
}

/**
 * Trailer im Kopf einer Seite: startet nach kurzer Pause stumm, läuft einmal und zeigt danach wieder das Standbild.
 * Nicht bei abgeschalteter Einstellung, bei „weniger Bewegung“ im System oder während der Mini-Player läuft.
 */
export function KopfTrailer({ trailer, aus, children }: Props) {
  const [vorschauen] = useVorschauen();
  const wenigBewegung = useWenigBewegung();
  const erlaubt = !!trailer && vorschauen && !wenigBewegung && !aus;
  const [phase, setPhase] = useState<'warte' | 'laeuft' | 'pause' | 'fertig'>('warte');
  const [ton, setTon] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const url = trailer?.url ?? '';

  // Neuer Trailer: wieder von vorn, nach 1,5 s Ruhe
  useEffect(() => {
    setPhase('warte');
    setTon(false);
  }, [url]);

  useEffect(() => {
    if (!erlaubt || phase !== 'warte') return;
    const t = setTimeout(() => setPhase('laeuft'), 1500);
    return () => clearTimeout(t);
  }, [erlaubt, phase]);

  // Einstellung aus oder Mini-Player an: sofort aufhören
  useEffect(() => {
    if (!erlaubt && (phase === 'laeuft' || phase === 'pause')) setPhase('fertig');
  }, [erlaubt, phase]);

  const sichtbar = phase === 'laeuft' || phase === 'pause';
  useEffect(() => {
    const v = video.current;
    if (!sichtbar || !v || !url) return;
    return ladeQuelle(v, url, () => setPhase('fertig'));
    // Quelle nur beim Erscheinen laden, nicht bei Pause
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sichtbar && url]);

  const umschalten = () => {
    const v = video.current;
    if (!v) return;
    if (v.paused) {
      void v.play();
      setPhase('laeuft');
    } else {
      v.pause();
      setPhase('pause');
    }
  };

  return (
    <div className={sichtbar ? 'kopf-trailer spielt' : 'kopf-trailer'}>
      {children}
      {sichtbar && (
        <>
          <video
            ref={video}
            className="kopf-trailer-video"
            autoPlay
            playsInline
            muted={!ton}
            aria-hidden="true"
            onEnded={() => setPhase('fertig')}
            onError={() => setPhase('fertig')}
          />
          <div className="kopf-trailer-knoepfe">
            <button type="button" className="player-knopf" onClick={umschalten} aria-label={phase === 'pause' ? 'Trailer fortsetzen' : 'Trailer anhalten'}>
              <Icon name={phase === 'pause' ? 'play' : 'pause'} size={18} />
            </button>
            <button type="button" className="player-knopf" onClick={() => setTon(!ton)} aria-label={ton ? 'Trailer stumm schalten' : 'Ton des Trailers einschalten'} aria-pressed={ton}>
              <Icon name={ton ? 'laut' : 'stumm'} size={18} />
            </button>
          </div>
        </>
      )}
      <span className="sr-only" role="status">
        {phase === 'laeuft' ? (ton ? 'Trailer läuft mit Ton' : 'Trailer läuft ohne Ton') : phase === 'pause' ? 'Trailer angehalten' : ''}
      </span>
    </div>
  );
}
