# Architektur

## Überblick

```
liste.mediathekview.de ──► Hauptprozess (Node.js) ◄──IPC──► Oberfläche (React)
Sender-Schnittstellen  ──►   Filmlisten-Dienst                Seiten
                             Datenbank (SQLite + FTS5)        Player (hls.js)
                             Genre-Zuordnung                  Mini-Player-Fenster
                             Bild-Cache                       Hilfe (help/)
Video-Server der Sender ─────────────────────────────────────► Player
```

- Die Oberfläche fragt Daten nur über IPC beim Hauptprozess an (`window.movue`, definiert in `src/preload/`).
- Videos lädt der Player direkt von den Servern der Sender.

## Entscheidungen

| Thema | Entscheidung | Grund |
| --- | --- | --- |
| App-Gerüst | Electron + React + TypeScript | Mockup-Look direkt umsetzbar, ohne Bildschirm testbar (Playwright) |
| Player | HTML5-Video + hls.js | Eigene Bedienelemente, Untertitel als WebVTT, Bild-in-Bild |
| Index | MediathekView-Filmliste, Diff-Updates | Ein Format für alle Sender, enthält Stream- und Untertitel-Adressen |
| Suche | SQLite mit FTS5 | Lokal und schnell |
| Bilder | Sender-Schnittstellen, zwischengespeichert, optional | Filmliste hat keine Bilder; Ausfall darf die App nicht blockieren |
| Hilfe | Markdown in `help/`, in der App gerendert | Hilfe ändert sich im selben Pull Request wie der Code |
| Pakete | electron-builder: .deb, AppImage | Installation unter Mint per Doppelklick |

## Phasen

| Phase | Inhalt |
| --- | --- |
| 0 | Grundgerüst, CI, Hilfe-Gerüst |
| 1 | Datenbasis: Filmliste → SQLite/FTS5 |
| 2 | Genres |
| 3 | Oberfläche: Start, Genres, Sender, Suche, Detail |
| 4 | Player: Fenster, Vollbild, Mini-Player, Untertitel |
| 5 | Bilder und Serien |
| 6 | Merkliste, Weiterschauen, Läuft bald ab, Abos |
| 7 | Live-TV |
| 8 | Release 1.0 |
