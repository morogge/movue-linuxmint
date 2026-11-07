const PATHS = {
  logo: 'M2 7a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2zM10 9.5v5l4.5-2.5z',
  home: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  bookmark: 'M6 3h12v18l-6-4-6 4z',
  glocke: 'M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0',
  clock: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM12 6v6l4 2',
  tv: 'M2 7h20v13H2zM7 2l5 5 5-5',
  help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01',
  fullscreen: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  close: 'M6 6l12 12M18 6L6 18',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zM20 20l-3.5-3.5',
  external: 'M14 4h6v6M20 4l-9 9M19 14v6H4V5h6',
  download: 'M12 3v12M7 10l5 5 5-5M5 21h14',
  liste: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  links: 'M15 18l-6-6 6-6',
  rechts: 'M9 18l6-6-6-6',
  play: 'M7 4v16l13-8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  zurueck10: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  vor10: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  laut: 'M11 5L6 9H2v6h4l5 4zM15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14',
  stumm: 'M11 5L6 9H2v6h4l5 4zM23 9l-6 6M17 9l6 6',
  untertitel: 'M2 5h20v14H2zM7 13h4M13 13h4M7 16h10',
  autoplay: 'M5 4v16l9-8zM16 5h3v14h-3',
  pip: 'M2 4h20v16H2zM12 12h7v5h-7z',
  film: 'M4 4h16v16H4zM8 4v16M16 4v16M4 8h4M4 12h4M4 16h4M16 8h4M16 12h4M16 16h4',
  doku: 'M3 7h12v10H3zM15 10l6-3v10l-6-3',
  show: 'M12 3a3 3 0 0 1 3 3v5a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
  nachrichten: 'M4 5h13v14H6a2 2 0 0 1-2-2zM17 9h3v8a2 2 0 0 1-2 2M8 9h5M8 13h5',
  sport: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM2 12h20M12 2c3 3 3 17 0 20M12 2c-3 3-3 17 0 20',
  kinder: 'M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20zM8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01',
  live: 'M12 12h.01M8.5 8.5a5 5 0 0 0 0 7M15.5 8.5a5 5 0 0 1 0 7M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14',
  magazin: 'M4 4h16v16H4zM8 8h8M8 12h8M8 16h5',
  konzert: 'M9 18V5l11-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zM20 16a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  vollbildAus: 'M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5'
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
