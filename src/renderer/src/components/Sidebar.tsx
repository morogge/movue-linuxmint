import { useEffect, useState } from 'react';
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
  { id: null, label: 'Genres', icon: 'grid' },
  { id: null, label: 'Merkliste', icon: 'bookmark' },
  { id: null, label: 'Läuft bald ab', icon: 'clock' },
  { id: null, label: 'Live-TV', icon: 'tv' }
];

export function Sidebar({ current, onNavigate }: { current: ScreenId; onNavigate: (id: ScreenId) => void }) {
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
      <div className="sidebar-foot">{version && <span>Version {version}</span>}</div>
    </nav>
  );
}
