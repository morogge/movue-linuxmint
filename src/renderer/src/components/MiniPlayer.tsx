import type { Film } from '@shared/film';
import { Icon } from './Icon';
import { VideoPlayer } from './VideoPlayer';

interface Props {
  film: Film;
  start: number;
  onOeffnen: () => void;
  onSchliessen: () => void;
  onPosition: (position: number) => void;
}

/** Läuft unten rechts weiter, während du in Movue stöberst */
export function MiniPlayer({ film, start, onOeffnen, onSchliessen, onPosition }: Props) {
  return (
    <section className="mini-player" aria-label="Mini-Player">
      <VideoPlayer
        film={film}
        start={start}
        kompakt
        onFortschritt={(position, dauer) => {
          onPosition(position);
          void window.movue.player.fortschrittSetzen(film.url, position, dauer);
        }}
      />
      <div className="mini-kopf">
        <span className="mini-titel" title={film.titel}>
          {film.titel}
        </span>
        <button type="button" className="player-knopf" aria-label="Im großen Player öffnen" title="Im großen Player öffnen" onClick={onOeffnen}>
          <Icon name="fullscreen" size={18} />
        </button>
        <button type="button" className="player-knopf" aria-label="Mini-Player schließen" title="Schließen" onClick={onSchliessen}>
          <Icon name="close" size={18} />
        </button>
      </div>
    </section>
  );
}
