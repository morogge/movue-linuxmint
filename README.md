# Movue

Die Mediatheken von **ARD, ZDF, 3sat und Arte** in einer Desktop-App für Linux Mint: nach Genre stöbern, über alle Sender suchen und Sendungen im eigenen Player anschauen.

> **Status:** Vorabversion 0.1 – Grundgerüst. Sendungen, Suche und Player folgen in den nächsten Versionen. Was sich ändert, steht im [Changelog](CHANGELOG.md).

## Installieren

Unter [Releases](https://github.com/morogge/movue-linuxmint/releases) gibt es für jede Version:

- **.deb** – per Doppelklick unter Linux Mint installieren
- **AppImage** – ohne Installation: ausführbar machen (`chmod +x Movue-*.AppImage`) und starten

## Hilfe

Die Hilfe ist in die App eingebaut: **F1** öffnet sie für den aktuellen Bildschirm. Die Inhalte liegen im Ordner [`help/`](help/).

## Entwickeln

Voraussetzung: Node.js 22.

```bash
npm install
npm run dev        # App mit Live-Neuladen starten
npm test           # Unit-Tests
npm run build && npm run test:e2e   # Oberflächentests
npm run dist       # .deb und AppImage bauen
```

Aufbau und Regeln für Beiträge stehen in [`CLAUDE.md`](CLAUDE.md) und [`docs/architektur.md`](docs/architektur.md).

## Datenquellen

Das Verzeichnis der Sendungen stammt aus der Filmliste des Projekts [MediathekView](https://mediathekview.de). Videos werden direkt von den Servern der Sender abgespielt und nicht gespeichert.

## Lizenz

[MIT](LICENSE) – frei nutzbar, veränderbar und weitergebbar, auch in eigenen Projekten.
