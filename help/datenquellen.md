# Datenquellen und Datenschutz

## Woher die Inhalte kommen

Movue zeigt Sendungen aus den öffentlich zugänglichen Mediatheken von ARD, ZDF, 3sat und Arte. Das Verzeichnis aller Sendungen stammt aus der Filmliste des Open-Source-Projekts [MediathekView](https://mediathekview.de), die stündlich neu erstellt wird.

Die Videos selbst kommen immer direkt von den Servern der Sender. Movue speichert sie nicht.

## Wie Movue das Verzeichnis aktuell hält

- Beim ersten Start lädt Movue die komplette Liste (rund 80 MB).
- Danach holt Movue höchstens einmal pro Stunde nur die neuen Einträge – das sind meist weniger als 1 MB.
- Einmal am Tag lädt Movue die komplette Liste neu. Dabei verschwinden Sendungen, die die Sender inzwischen entfernt haben.
- Während einer Aktualisierung kannst du normal weitersuchen.

Unten in der Seitenleiste siehst du, wie viele Sendungen das Verzeichnis enthält und von wann es stammt.

## Was auf deinem Rechner bleibt

- Movue braucht kein Konto und sendet keine Nutzungsdaten.
- Das Sendungsverzeichnis liegt im Ordner `~/.config/Movue` und belegt einige hundert MB.
- Merkliste, Abspielfortschritt und Einstellungen liegen später ebenfalls nur dort.

## Nur in bestimmten Ländern verfügbar

Manche Sendungen dürfen die Sender nur in bestimmten Ländern zeigen, etwa nur in Deutschland. Movue zeigt das an den Treffern mit Länderkürzeln wie **DE** oder **DE · AT · CH**.
