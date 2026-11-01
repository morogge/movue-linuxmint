import { Icon } from './Icon';

export function TopBar({ onHelp }: { onHelp: () => void }) {
  return (
    <header className="topbar">
      <div className="search-placeholder" aria-hidden="true">
        Suche in allen Mediatheken – folgt mit Version 0.2
      </div>
      <button type="button" className="icon-button" aria-label="Hilfe (F1)" title="Hilfe (F1)" onClick={onHelp}>
        <Icon name="help" />
      </button>
      <button
        type="button"
        className="icon-button"
        aria-label="Vollbild (F11)"
        title="Vollbild (F11)"
        onClick={() => void window.movue?.toggleFullscreen()}
      >
        <Icon name="fullscreen" />
      </button>
    </header>
  );
}
