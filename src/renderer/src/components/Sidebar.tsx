import { useEffect, useState } from 'react';
import type { IndexZustand } from '@shared/film';
import { formatStand, formatZahl } from '@shared/format';
import type { ScreenId } from '@shared/screens';
import { Icon, type IconName } from './Icon';

interface NavItem {
  id: ScreenId | null;
  label: string;
  icon: IconName;
}

// Einträge ohne id folgen in späteren Versionen und sind noch deaktiviert
const NAV: NavItem[] = [
  { id: 'start', label: 'Start', icon: 'home' },
  { id: 'suche', label: 'Suche', icon: 'search' },
  { id: null, label: 'Genres', icon: 'grid' },
  { id: null, label: 'Merkliste', icon: 'bookmark' },
  { id: null, label: 'Läuft bald ab', icon: 'clock' },
  { id: null, label: 'Live-TV', icon: 'tv' }
];

function IndexStatus({ zustand }: { zustand: IndexZustand }) {
  const laedt = zustand.fortschritt !== undefined;
  let zeile1: string;
  let zeile2 = '';

  if (zustand.phase === 'fehler') {
    zeile1 = 'Sendungsverzeichnis nicht geladen';
    zeile2 = zustand.meldung ?? '';
  } else if (zustand.phase === 'leer' || (zustand.phase === 'laedt' && zustand.anzahl === 0)) {
    zeile1 = 'Lade Sendungsverzeichnis …';
    zeile2 = laedt && zustand.fortschritt ? `${formatZahl(zustand.fortschritt)} Einträge gelesen` : '';
  } else {
    zeile1 = laedt ? 'Aktualisiere …' : `${formatZahl(zustand.anzahl)} Sendungen`;
    zeile2 = zustand.stand ? `Stand ${formatStand(zustand.stand)}` : '';
  }

  return (
    <div className="index-status" role="status" aria-live="polite">
      <span className={zustand.phase === 'fehler' ? 'status-dot fehler' : laedt ? 'status-dot laedt' : 'status-dot'} />
      <span>
        <span className="status-zeile">{zeile1}</span>
        {zeile2 && <span className="status-zeile klein">{zeile2}</span>}
      </span>
    </div>
  );
}

export function Sidebar({
  current,
  onNavigate,
  zustand
}: {
  current: ScreenId;
  onNavigate: (id: ScreenId) => void;
  zustand: IndexZustand;
}) {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.movue
      ?.getInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion(''));
  }, []);

  return (
    <nav className="sidebar" aria-label="Hauptnavigation">
      <div className="brand">
        <span className="brand-icon">
          <Icon name="logo" size={28} />
        </span>
        <span className="brand-name">Movue</span>
      </div>
      <ul className="nav">
        {NAV.map((item) => (
          <li key={item.label}>
            <button
              type="button"
              className={item.id === current ? 'nav-item active' : 'nav-item'}
              disabled={item.id === null}
              aria-current={item.id === current ? 'page' : undefined}
              title={item.id === null ? 'Folgt in einer späteren Version' : undefined}
              onClick={() => item.id && onNavigate(item.id)}
            >
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
      <div className="sidebar-foot">
        <IndexStatus zustand={zustand} />
        {version && <span className="version">Version {version}</span>}
      </div>
    </nav>
  );
}
