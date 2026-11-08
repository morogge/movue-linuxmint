import { useEffect, useState } from 'react';
import type { IndexZustand } from '@shared/film';
import { formatStand, formatZahl } from '@shared/format';
import { ART_SEITEN } from '@shared/arten';
import { GRUPPEN } from '@shared/sender';
import type { Ansicht } from '../App';
import { SENDER_FARBE } from '../senderFarben';
import type { UpdateZustand } from '@shared/update';
import { Icon, type IconName } from './Icon';

interface NavItem {
  /** Bildschirm oder Art-Seite */
  ziel: Ansicht | null;
  label: string;
  icon: IconName;
  leise?: boolean;
}

const ART_ICON: Record<string, IconName> = {
  serien: 'tv',
  filme: 'film',
  dokus: 'doku',
  shows: 'show',
  nachrichten: 'nachrichten',
  sport: 'sport',
  kinder: 'kinder'
};

const art = (seite: string): Ansicht => ({ screen: 'art', seite });

// Gruppen, durch Linien getrennt: Start | Arten | Live, Merkliste, Suche
const NAV: NavItem[][] = [
  [{ ziel: { screen: 'start' }, label: 'Start', icon: 'home' }],
  [
    ...ART_SEITEN.filter((s) => s.seitenleiste).map((s): NavItem => ({ ziel: art(s.id), label: s.titel, icon: ART_ICON[s.id] ?? 'grid' })),
    { ziel: { screen: 'kategorien' }, label: 'Alle Kategorien', icon: 'grid', leise: true }
  ],
  [
    { ziel: { screen: 'live' }, label: 'Live & demnächst', icon: 'live' },
    { ziel: { screen: 'merkliste' }, label: 'Merkliste', icon: 'bookmark' },
    { ziel: { screen: 'suche' }, label: 'Suche', icon: 'search' }
  ]
];

/** Ist dieser Eintrag die aktuelle Seite? Genre-Seiten und Seiten ohne eigenen Eintrag gehören zu „Alle Kategorien“ */
function aktivBei(ziel: Ansicht | null, ansicht: Ansicht): boolean {
  if (!ziel) return false;
  if (ziel.screen === 'art') return ansicht.screen === 'art' && ansicht.seite === ziel.seite;
  if (ziel.screen === 'kategorien') {
    if (ansicht.screen === 'genre' || ansicht.screen === 'ablauf') return true;
    if (ansicht.screen === 'art') return !ART_SEITEN.find((s) => s.id === ansicht.seite)?.seitenleiste;
  }
  return ziel.screen === ansicht.screen;
}

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
      <span className="status-text">
        <span className="status-zeile">{zeile1}</span>
        {zeile2 && <span className="status-zeile klein">{zeile2}</span>}
      </span>
    </div>
  );
}

export function Sidebar({
  ansicht,
  onNavigate,
  zustand,
  update,
  eingeklappt,
  onEinklappen
}: {
  ansicht: Ansicht;
  eingeklappt: boolean;
  onEinklappen: () => void;
  onNavigate: (a: Ansicht) => void;
  zustand: IndexZustand;
  update: UpdateZustand;
}) {
  const [version, setVersion] = useState<string>('');

  useEffect(() => {
    window.movue
      ?.getInfo()
      .then((info) => setVersion(info.version))
      .catch(() => setVersion(''));
  }, []);

  return (
    <nav className={eingeklappt ? 'sidebar eingeklappt' : 'sidebar'} aria-label="Hauptnavigation">
      <div className="brand">
        <span className="brand-icon">
          <Icon name="logo" size={28} />
        </span>
        <span className="brand-name">Movue</span>
        <button
          type="button"
          className="einklappen"
          aria-expanded={!eingeklappt}
          aria-label={eingeklappt ? 'Seitenleiste ausklappen (Strg+B)' : 'Seitenleiste einklappen (Strg+B)'}
          title={eingeklappt ? 'Seitenleiste ausklappen (Strg+B)' : 'Seitenleiste einklappen (Strg+B)'}
          onClick={onEinklappen}
        >
          <Icon name={eingeklappt ? 'rechts' : 'links'} size={18} />
        </button>
      </div>
      {NAV.map((gruppe, i) => (
        <ul className={i === 0 ? 'nav' : 'nav getrennt'} key={i}>
          {gruppe.map((item) => {
            const aktiv = aktivBei(item.ziel, ansicht);
            return (
              <li key={item.label}>
                <button
                  type="button"
                  className={['nav-item', aktiv && 'active', item.leise && 'leise'].filter(Boolean).join(' ')}
                  disabled={item.ziel === null}
                  aria-current={aktiv ? 'page' : undefined}
                  aria-label={item.label}
                  title={eingeklappt ? item.label : undefined}
                  onClick={() => item.ziel && onNavigate(item.ziel)}
                >
                  <Icon name={item.icon} size={item.leise ? 18 : 20} />
                  <span className="nav-text">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      ))}
      <div className="nav-gruppe">
        <span className="nav-ueberschrift">Sender</span>
        <ul className="nav">
          {GRUPPEN.map((g) => {
            const aktiv = ansicht.screen === 'sender' && ansicht.gruppe === g.id;
            return (
              <li key={g.id}>
                <button
                  type="button"
                  className={aktiv ? 'nav-item active' : 'nav-item'}
                  aria-current={aktiv ? 'page' : undefined}
                  aria-label={g.name}
                  title={eingeklappt ? g.name : undefined}
                  onClick={() => onNavigate({ screen: 'sender', gruppe: g.id })}
                >
                  <span className="dot" style={{ background: SENDER_FARBE[g.id] }} />
                  <span className="nav-text">{g.name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="sidebar-foot">
        <IndexStatus zustand={zustand} />
        {version && (
          <span className="version">
            Version {version}
            {update.phase === 'laedt' && ` · Update ${update.version} wird geladen (${update.prozent} %)`}
          </span>
        )}
      </div>
    </nav>
  );
}
