const DATUM = new Intl.DateTimeFormat('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
const DATUM_ZEIT = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});
const ZAHL = new Intl.NumberFormat('de-DE');

/** Sekunden seit 1970 → „01.11.2026“ */
export function formatDatum(sekunden: number): string {
  return sekunden > 0 ? DATUM.format(new Date(sekunden * 1000)) : '';
}

/** Millisekunden → „01.11., 18:19“ */
export function formatStand(ms: number): string {
  return DATUM_ZEIT.format(new Date(ms));
}

/** Sekunden → „43 Min.“ bzw. „1 Std. 30 Min.“ */
export function formatDauer(sekunden: number): string {
  if (sekunden <= 0) return '';
  const minuten = Math.round(sekunden / 60);
  if (minuten < 60) return `${Math.max(minuten, 1)} Min.`;
  const std = Math.floor(minuten / 60);
  const rest = minuten % 60;
  return rest ? `${std} Std. ${rest} Min.` : `${std} Std.`;
}

export function formatZahl(n: number): string {
  return ZAHL.format(n);
}
