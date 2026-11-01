import { forwardRef } from 'react';
import { Icon } from './Icon';

interface Props {
  suchtext: string;
  onSuche: (text: string) => void;
  onHelp: () => void;
}

export const TopBar = forwardRef<HTMLInputElement, Props>(function TopBar({ suchtext, onSuche, onHelp }, ref) {
  return (
    <header className="topbar">
      <div className="search-field">
        <Icon name="search" size={18} />
        <label htmlFor="suche" className="sr-only">
          Suche in allen Mediatheken
        </label>
        <input
          ref={ref}
          id="suche"
          type="search"
          placeholder="Suche in allen Mediatheken …"
          autoComplete="off"
          spellCheck={false}
          value={suchtext}
          onChange={(e) => onSuche(e.target.value)}
        />
        <kbd aria-hidden="true">Strg K</kbd>
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
});
