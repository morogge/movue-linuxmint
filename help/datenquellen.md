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
- Merkliste, Abos und Abspielfortschritt liegen ebenfalls nur dort (`nutzer.db`).
- Bilder, Besetzung und Ablaufdaten holt Movue bei den Sendern selbst – von denselben Seiten, die du im Browser sähest. Die Ergebnisse liegen in `bilder.db` und `infos.db`.
- Film-Datenbanken fragt Movue nie direkt. Zusatzangaben aus Wikidata kommen aus einem fertigen Paket (siehe unten); so erfährt niemand außer dem Sender, was du dir ansiehst.
- Für gemerkte und angefangene Sendungen fragt Movue bei den Sendern nach, bis wann sie abrufbar sind. Dabei geht nur die Adresse der Sendungsseite an den Sender, wie beim Öffnen im Browser.

## Nur in bestimmten Ländern verfügbar

Manche Sendungen dürfen die Sender nur in bestimmten Ländern zeigen, etwa nur in Deutschland. Movue zeigt das an den Treffern mit Länderkürzeln wie **DE** oder **DE · AT · CH**.

## Zusatzangaben aus Wikidata

Nicht jeder Sender nennt Besetzung, Regie, Jahr, Land oder Genre. Diese Angaben ergänzt Movue aus [Wikidata](https://www.wikidata.org), der freien Wissensdatenbank der Wikimedia (Daten frei nutzbar, CC0).

- Einmal am Tag gleicht eine automatische Aufgabe im Movue-Projekt alle Filme und Serien des Sendungsverzeichnisses mit Wikidata ab und legt das Ergebnis als eine Datei ab (`metadaten.json`, rund ein bis zwei MB).
- Movue lädt diese Datei als Ganzes von GitHub, höchstens einmal am Tag. Weil alle dieselbe Datei laden, erfährt weder Wikidata noch GitHub, welche Sendungen du dir ansiehst.
- Gefunden werden Titel über ihren deutschen Namen; bei gleichnamigen Filmen entscheidet das Jahr. Findet Movue keinen eindeutigen Eintrag, bleibt der Abschnitt leer – lieber nichts als etwas Falsches.
- Aus den Genres bei Wikidata (etwa „Filmdrama“ oder „Science-Fiction-Serie“) ergeben sich die Genres Drama, Liebe & Familie, Fantasy & Science-Fiction und Historienfilme & -serien (siehe **Kategorien und Genres**).
- Fehler korrigierst du am besten direkt bei Wikidata; die Korrektur erscheint spätestens nach dem nächsten Abgleich in Movue.
