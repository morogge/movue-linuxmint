# Movue – Arbeitsregeln für Claude

Movue ist eine Desktop-App für Linux Mint, die die Mediatheken von ARD, ZDF, 3sat und Arte unter einer Oberfläche bündelt: Stöbern nach Genre, Suche über alle oder einzelne Sender, eigener Player (Fenster, Vollbild, Mini-Player). Downloads gehören bewusst nicht dazu.

Umsetzungsplan und Mockup liegen außerhalb des Repos (Claude Docs / Design-Canvas); `docs/architektur.md` fasst die Entscheidungen zusammen.

## Stack

- Electron + React 19 + TypeScript, gebaut mit electron-vite (Vite 7)
- `src/main/` Hauptprozess (Node): Filmliste, Datenbank, Sender-Schnittstellen, Fenster
- `src/preload/` schmale Brücke `window.movue` (contextIsolation, sandbox)
- `src/renderer/` React-Oberfläche
- `src/shared/` Code für beide Seiten: Bildschirme, Tastenkürzel, Hilfe-Logik
- Player: HTML5-Video + hls.js (ab Phase 4); Daten: SQLite mit FTS5 (ab Phase 1)
- Tests: Vitest (`tests/unit/`), Playwright mit Electron (`tests/e2e/`)
- Pakete: electron-builder → .deb und AppImage

## Befehle

| Zweck | Befehl |
| --- | --- |
| Entwickeln | `npm run dev` |
| Typen | `npm run typecheck` |
| Lint | `npm run lint` |
| Unit-Tests | `npm test` |
| Oberflächentests | `npm run build && npm run test:e2e` (unter Linux ohne Bildschirm: `xvfb-run -a`) |
| Pakete | `npm run dist` |

Wenn in der Arbeitsumgebung kein npm-Register erreichbar ist: Code schreiben, pushen und die Ergebnisse der GitHub-Action „CI“ auswerten (`gh run list`, `gh run view --log-failed`).

## Regeln

1. **Hilfe ist Pflicht.** Jede Änderung an Verhalten oder Oberfläche ändert im selben Pull Request die passende Seite in `help/`. Neue Bildschirme bekommen einen Eintrag in `src/shared/screens.ts` mit Hilfeseite; neue Hilfeseiten einen Eintrag in `HELP_ORDER` (`src/shared/help.ts`). Die Unit-Tests prüfen das.
2. **Tastenkürzel nur in `src/shared/shortcuts.ts`.** Die Hilfe erzeugt ihre Tabelle daraus; nur Kürzel eintragen, die wirklich funktionieren.
3. **Changelog.** Jede Code-Änderung ergänzt `CHANGELOG.md` unter „Unveröffentlicht“, in Worten für Nutzer. Die App zeigt die Datei als „Was ist neu“.
4. **Der CI-Hilfe-Check** (`scripts/check-help.mjs`) erzwingt 1 und 3; das Label `keine-hilfe-noetig` nur setzen, wenn sich für Nutzer nichts ändert.
5. **Arbeitsweise:** `main` bleibt lauffähig. Je Aufgabe ein Zweig `feat/…` oder `fix/…`, ein Pull Request mit Screenshots aus `test-results/screens/`, Zusammenführen erst bei grüner CI.
6. **Sprache:** Oberfläche, Hilfe und Changelog auf Deutsch, du-Form. Code, Bezeichner und Commit-Betreff auf Englisch oder Deutsch, aber einheitlich je Datei.
7. **Sicherheit:** Kein `nodeIntegration`, keine Remote-Inhalte im Hauptfenster außer Videos und Bildern der Sender; externe Links öffnen im Standardbrowser.
8. **Daten der Sender:** Filmliste höchstens stündlich abrufen, Diff statt Komplettliste; Sender-Schnittstellen sind optional, ein Ausfall darf nie die App blockieren.
9. **Releases:** Version in `package.json` erhöhen, Changelog-Abschnitt datieren, Tag `vX.Y.Z` pushen – die Action „Release“ baut die Pakete.
