# Änderungen

Alle nennenswerten Änderungen an Movue. Die App zeigt diese Datei unter **Hilfe → Was ist neu**.

## Unveröffentlicht

### Neu

- **Countdown** bis zum Start kommender Live-Übertragungen – unter „Live & demnächst“, in Kacheln und auf der Detailseite, in der letzten Stunde sekundengenau
- **Erinnern** auch auf der Detailseite einer kommenden Live-Übertragung
- Die **Senderliste** in der Seitenleiste lässt sich mit einem Klick auf die Überschrift ein- und ausklappen

## 0.16.0 – 2026-11-09

### Neu

- **Falsch einsortiert?** auf Detail- und Serienseiten: öffnet einen vorausgefüllten Fehlerbericht im Browser – Movue schickt nichts selbst
- Die **Art** (Serie, Film, Doku …) steht jetzt als erstes Schild vor den Genres
- **Trailer für ZDF-Serien**: Wie bei der ARD holt Movue den Trailer von der Seite der Reihe, wenn er in der Filmliste fehlt – etwa bei „Under Salt Marsh“
- **Vorab-Sendungen in der Suche**: Was schon vor dem Fernsehtermin online steht, findest du jetzt auch über die Suche – gekennzeichnet mit **Vorab · im TV** und dem Termin

### Verbessert

- Die Hilfe zur Suche nennt alle Formate

## 0.15.0 – 2026-11-09

### Neu

- **Trailer für mehr ARD-Serien**: Steht kein Trailer in der Filmliste, holt Movue den Trailer von der Seite der Reihe in der ARD-Mediathek – einmal am Tag je Serie, nur bei eingeschalteten Vorschauen

## 0.14.0 – 2026-11-08

### Neu

- **Live & demnächst**: das laufende Programm von Das Erste, ZDF, 3sat, Arte, den Spartensendern und allen Dritten (Auswahl in der Karte „Die Dritten“) mit einem Klick
- **Live-Übertragungen** wie Sport oder Sondersendungen mit Tag und Uhrzeit. Mit **Erinnern** meldet sich Movue fünf Minuten vor Beginn
- **Vorab in der Mediathek**: Sendungen, die schon vor dem Fernsehtermin online stehen, mit ihrem TV-Termin
- **Trailer im Kopf**: Hat eine Serie oder Sendung einen Trailer, läuft er oben auf ihrer Seite einmal ohne Ton – anhalten und Ton per Knopf, nicht während der Mini-Player läuft und nicht, wenn dein System weniger Bewegung wünscht
- Knopf **Trailer** auf Serien- und Detailseiten, dazu **Trailer & Extras** auf der Detailseite einzelner Sendungen
- **Einstellungen** unten in der Seitenleiste – dort schaltest du die Vorschauen ab
- **Staffelbilder**: Bei Serien mit bis zu zwölf Staffeln zeigen die Reiter das Bild der Staffel und die Zahl der Folgen

### Verbessert

- Livestreams zeigen im Player **LIVE** statt einer Zeitleiste
- Das Sendungsverzeichnis baut sich schneller auf
- Der Knopf **Jetzt neu starten** im Update-Hinweis ist wieder gut lesbar
- Die Knöpfe oben auf Serien- und Detailseiten brechen in eine neue Zeile um, statt sich zu quetschen

## 0.13.0 – 2026-11-07

### Neu

- **Seitenleiste nach Art**: **Serien**, **Filme**, **Dokus**, **Shows & Talk**, **Nachrichten**, **Sport** und **Kinder** haben jetzt je eine eigene Seite – oben unterteilt nach Genre oder Thema, mit einer Reihe je Genre und Filter nach Sender
- **Alle Kategorien** ersetzt die Seite „Genres“: Arten, Genres, Themen, Kinder, Sender und **Läuft bald ab** auf einen Blick. Magazine sowie Konzert & Bühne findest du hier
- **Genre-Seiten** mit Reitern je Art: Krimi & Thriller zum Beispiel getrennt nach Serien und Filmen, jeweils mit Anzahl
- **Neue Genres** aus Wikidata: Drama, Liebe & Familie, Fantasy & Science-Fiction, Historienfilme & -serien. Sie kommen aus dem Metadaten-Paket – Movue fragt dafür niemanden einzeln
- Die Startseite zeigt je Art das Neueste: **Neu bei Serien**, **Neu bei Filmen**, **Neu bei Dokus** und so weiter
- Auf den Sender-Seiten gibt es eine Reihe **Kurzbeiträge**

### Geändert

- „Weitere Sendungen“ gibt es nicht mehr – jede Sendung hat jetzt eine Art
- Kurzbeiträge unter fünf Minuten stehen nur noch in der Suche und auf der Seite ihres Senders
- Serien und Sendereihen erkennst du an einer angedeuteten zweiten Karte über dem Bild
- **Läuft bald ab** ist von der Seitenleiste nach **Alle Kategorien** umgezogen
- Satire- und Talkshows wie heute-show, Markus Lanz oder Maischberger stehen unter **Shows & Talk**, nicht mehr unter Nachrichten
- Krimireihen ohne Staffeln wie Tatort oder Wilsberg stehen unter **Filme**

## 0.12.0 – 2026-11-04

### Verbessert

- **Genauere Genres**: Wörter wie „Krimi“, „Mord“, „Garten“ oder „Krieg“ zählen nur noch im Namen einer Sendung, nicht im Titel einer Folge. Ein „Elfmeter-Krimi“ ist damit ein Spielbericht, das Merz-Zitat zum „Ende dieses Krieges“ steht nicht mehr unter Geschichte, „Ridley“ nicht mehr unter Ratgeber
- Eine Reihe bekommt ein Genre erst, wenn die Mehrheit ihrer Folgen es trägt – eine Folge mit „ermittelt“ macht „History or Mystery“ nicht mehr zum Krimi
- Dokus über echte Verbrechen stehen unter Dokus statt unter Krimi & Thriller; Spielberichte und Nachrichten nie unter Krimi
- Krimis vom Bodensee oder aus dem Schwarzwald stehen nicht mehr unter Reisen & Länder; „Die Toten vom Bodensee“ ist eine Filmreihe
- Doku-Serien wie „Mittendrin – Flughafen Frankfurt“ sind Dokus mit Staffel-Reitern statt „Serie“
- Viele Krimiserien werden jetzt erkannt, etwa „Death in Paradise“, „The Rookie“ oder „Der letzte Zeuge“
- Sport und Nachrichten erkennt Movue auch an der Adresse beim Sender (Sportschau, tagesschau, zdfheute)
- **„Weitere Sendungen“ halb so groß**: Regionale Kurzmeldungen, Musik-, Sport-, Comedy- und Ratgeberformate haben jetzt ihr Genre
- Mittagsmagazin und Brisant stehen nicht mehr unter Ratgeber & Service

### Behoben

- **Trailer, Clips und Vorschauen** erscheinen nicht mehr als eigene Sendung in Listen, Suche und Genres – nur noch auf der Seite ihrer Reihe unter **Extras**
- **Livestreams** und angekündigte Übertragungen (z. B. „Basketball live: Gladiators Trier“) stehen nicht mehr zwischen den Videos; Sendungen mit Datum in der Zukunft erscheinen erst, wenn sie zu sehen sind
- Lange Sendungen wie „Hinter den Kulissen der Macht“ oder Podcast-Aufzeichnungen zählen nicht mehr als Extra

### Geändert

- Auf der Seite einer Sendung gibt es nur noch **Beim Sender ansehen**; „Extern öffnen“ entfällt, Movue hat seinen eigenen Player
- Auf der Serienseite führt **Beim Sender ansehen** zur Seite der Serie beim Sender

### Hinweis

- Beim ersten Start nach dem Update baut Movue das Sendungsverzeichnis einmal neu auf (ein bis zwei Minuten). Merkliste, Abos und Fortschritt bleiben erhalten.

## 0.11.0 – 2026-11-03

### Verbessert

- **Ordnung in Serien und Rubriken**: Arte-Serien heißen jetzt wie die Serie („Mord im Mittsommer“, „Haus aus Glas“) statt „Fernsehfilme und Serien“; Reihen wie „360° Reportage“ oder „Re:“ stehen gebündelt, Filme einzeln
- Rubriken mit ganz verschiedenen Filmen und Trailern (z. B. „Das kleine Fernsehspiel“) erscheinen nicht mehr als Serie
- Magazine wie „Volle Kanne“, „Kaffee oder Tee“ oder „Hier und heute“ stehen wieder als eine Kachel statt vieler einzelner Ausgaben
- Folgen tragen die Genres ihrer Reihe: Kulturzeit steht nicht mehr unter Krimi, die Sportschau nicht unter Kultur
- „Tatort“, „Polizeiruf 110“ und ähnliche heißen jetzt **Filmreihe**; die Reihe „Spielfilme“ zeigt nur noch Filme, keine Magazin- oder Märchenfolgen
- Sportsendungen mit Spieltag-Nummern sind keine „Serie“ mehr
- Trailer, Kinotrailer und Podcast-Folgen zählen als Extras
- Arte-Porträts von Schauspielern und Filmemachern stehen unter Kultur statt unter Spielfilme

### Hinweis

- Beim ersten Start nach dem Update baut Movue das Sendungsverzeichnis einmal neu auf (ein bis zwei Minuten).

## 0.10.0 – 2026-11-02

### Neu

- **Fassungen zusammengefasst**: Audiodeskription, Gebärdensprache und Originalfassungen stehen als Auswahl auf der Seite der Sendung; Listen zeigen nur noch die Standardfassung
- **Format-Filter**: Serien oder Filme – kombinierbar mit Sender und Genre; „Filter zurücksetzen“ hebt alles auf einmal auf
- **Genres und Formate getrennt**: Serien und Filme stehen auf der Genre-Seite als eigene Formate
- **Seitenleiste einklappbar** auf Symbole (Pfeil oben oder Strg+B); sie bleibt beim Scrollen stehen
- **Titelbilder auch bei ZDF und 3sat** für Serien (z. B. „Under Salt Marsh“)
- **Besetzung und Stab bei Arte**, dazu Land und Jahr auf der Seite der Sendung
- **Zusatzangaben aus Wikidata** für alle Sender: Besetzung mit Rollen, Regie, Jahr, Land und Originaltitel, wo der Sender sie nicht nennt – auch für Serien. Movue lädt dafür einmal am Tag ein fertiges Paket; niemand erfährt, was du ansiehst

### Verbessert

- Ruhigere Filterleiste: Filter oben, Anzahl, Darstellung und Sortierung in einer Ergebnisleiste darunter; die Sortierung erscheint nur bei einer Suche
- Stand des Verzeichnisses und Version stehen direkt unter der Navigation statt ganz unten

### Behoben

- Im Vollbild ragte das Video über den Bildschirm hinaus; jetzt ist immer das ganze Bild zu sehen
- Beim ZDF landeten Links aus dem Seitenfuß unter „Stab“

## 0.9.0 – 2026-11-02

### Hinweis

- Beim ersten Start nach dem Update baut Movue das Sendungsverzeichnis einmal neu auf (ein bis zwei Minuten).

### Neu

- **Titelbilder der ARD**: Serien der ARD zeigen ihr Original-Titelbild auf der Kachel und als breites Banner auf der Serienseite
- **Auch bei …**: Läuft eine Sendung auch bei einem anderen Sender, steht das auf ihrer Seite – ein Klick führt zur anderen Fassung
- **Besetzung**: Darsteller mit Rollen und der Stab auf der Seite einer Sendung (bei ZDF und 3sat)
- Alle Angaben stammen von den Sendern selbst; Movue fragt keine fremden Dienste

## 0.8.0 – 2026-11-02

### Neu

- **Serien und Sendereihen gebündelt**: Statt vieler einzelner Folgen steht eine Kachel je Serie – auf der Startseite, den Sender-Seiten, in den Genres und in der Suche
- **Serienseite** mit Reitern für Staffeln bzw. Jahrgänge, Fortschritt je Folge und einem Knopf, der dort weitermacht, wo du aufgehört hast
- Vorschauen, Making-of und Trailer stehen unter **Extras** und zählen nicht als Folge
- Genre-Seiten zeigen Serien gebündelt; **Einzelne Folgen** schaltet zurück
- Nachrichtensendungen erscheinen nicht mehr auf der Startseite, sondern unter „Nachrichten & Politik“ und in der Suche
- Neue Hilfeseite „Serien und Sendereihen“

### Hinweis

- Beim ersten Start nach dem Update baut Movue das Sendungsverzeichnis einmal neu auf (ein bis zwei Minuten). Merkliste, Abos und Fortschritt bleiben erhalten.

## 0.7.0 – 2026-11-02

### Neu

- **Merkliste**: Sendungen mit „Merken“ für später ablegen; die Merkliste steht links in der Seitenleiste
- **Reihen abonnieren**: Movue meldet neue Folgen mit einer Benachrichtigung; auf der Startseite erscheint „Neue Folgen deiner Abos“
- **Läuft bald ab**: gemerkte und angefangene Sendungen, die in den nächsten 14 Tagen aus der Mediathek verschwinden
- Auf der Seite einer Sendung steht jetzt, wie lange sie noch verfügbar ist (sofern der Sender es nennt)
- Neue Hilfeseite „Merkliste und Abos“

## 0.6.0 – 2026-11-01

### Neu

- **Eigener Player**: Sendungen laufen jetzt direkt in Movue – mit Zeitleiste, Lautstärke, 10 Sekunden vor/zurück, Vollbild und Bild-in-Bild
- **Untertitel** der Sender (ZDF, 3sat, ARD), ein- und ausschaltbar
- **Qualität** wählbar (Niedrig, Standard, HD), Movue merkt sich die Wahl
- **Als Nächstes**: die folgenden Folgen neben dem Video; am Ende startet die nächste Folge nach zehn Sekunden (abschaltbar)
- **Mini-Player**: Verlässt du den Player während der Wiedergabe, läuft das Video unten rechts weiter
- **Weiterschauen**: Movue merkt sich, wo du aufgehört hast – auf der Startseite und mit „Weiterschauen ab …“ auf der Detailseite
- Tastenkürzel im Player: Leertaste, ← →, ↑ ↓, M, F, C, N
- Neue Hilfeseite „Player“

## 0.5.1 – 2026-11-01

### Verbessert

- Reihen blättern jetzt mit **Pfeilen** am linken und rechten Rand statt mit Scrollbalken. Ein Pfeil erscheint nur, wenn es in diese Richtung weitergeht.
- Jede **Sender-Seite** hat ihre eigene Empfehlung aus dem Programm dieses Senders.
- Genre-Seiten und Suchergebnisse zeigen die Sendungen als **Kacheln mit Bild**. Die bisherige Liste gibt es weiter, jetzt ebenfalls mit Bild – umschaltbar über **Kacheln / Liste**.

## 0.5.0 – 2026-11-01

### Neu

- **Neue Startseite**: oben eine Empfehlung, darunter Reihen mit den neuesten Sendungen je Genre – über alle Mediatheken hinweg, je Sendereihe nur die neueste Folge
- **Vorschaubilder** für Sendungen, geholt von den Seiten der Sender und zwischengespeichert
- **Detailseite** für jede Sendung mit Beschreibung, Genres und allen weiteren Folgen der Reihe, bei Serien nach Staffel sortiert
- **Sender-Seiten** für ARD, ZDF, 3sat und Arte in der Seitenleiste
- **Zurück**-Knopf und **Alt + ←**
- In der Suche öffnet ein Klick auf den Titel die Detailseite
- Neue Hilfeseite „Stöbern“

### Hinweis

- Nach dem Update baut Movue das Sendungsverzeichnis einmal neu auf.

## 0.4.0 – 2026-11-01

### Neu

- **Genres**: Alle Sendungen von ARD, ZDF, 3sat und Arte sind jetzt nach 15 Genres geordnet – von Krimi über Dokus bis Kinder. Die neue Seite „Genres“ zeigt sie als Kacheln mit der Anzahl der Sendungen.
- In der Suche gibt es einen Genre-Filter; Suchbegriff, Sender und Genre lassen sich kombinieren.
- Jeder Treffer zeigt seine Genres.
- Neue Hilfeseite „Genres“

### Hinweis

- Nach dem Update baut Movue das Sendungsverzeichnis einmal neu auf (ein bis zwei Minuten). Die Suche funktioniert währenddessen weiter.

## 0.3.1 – 2026-11-01

### Verbessert

- „Beim Sender ansehen“ prüft vorher, ob es die Seite der Sendung noch gibt. Viele Sender haben ihre Seiten umgebaut oder entfernt. Fehlt die Seite, öffnet Movue stattdessen die Suche der Mediathek mit dem Titel der Sendung.
- Adressen alter Portale (z. B. die klassische ARD-Mediathek oder die SR-Mediathek) führen direkt zur Suche beim Sender.
- Neuer Knopf „Video öffnen“: spielt die Videodatei direkt ab – auch dann, wenn die Seite beim Sender fehlt.

## 0.3.0 – 2026-11-01

### Neu

- Movue aktualisiert sich selbst: Neue Versionen werden im Hintergrund geladen, ein Hinweis bietet „Jetzt neu starten“ an
- Beim .deb-Paket fragt Linux Mint zum Installieren einmal nach dem Passwort, das AppImage aktualisiert sich ohne Rückfrage
- Nach einem Update zeigt Movue einmal „Was ist neu“
- Neue Hilfeseite „Aktualisierungen“

### Hinweis

- Wer Version 0.2.0 oder älter nutzt, installiert 0.3.0 noch einmal von Hand. Ab dann kommen Updates automatisch.

## 0.2.0 – 2026-11-01

### Neu

- Movue lädt das Verzeichnis aller Sendungen von ARD, ZDF, 3sat und Arte und hält es im Hintergrund aktuell
- Suche über alle vier Mediatheken – schon während des Tippens, nach Titel, Thema und Beschreibung
- Filter nach Sender und Sortierung nach besten Treffern oder Datum
- **Strg + K** springt ins Suchfeld, **Esc** leert es
- Die Seitenleiste zeigt, wie viele Sendungen verfügbar sind und von wann das Verzeichnis stammt
- Neue Hilfeseite „Suchen“

## 0.1.0 – 2026-11-01

### Neu

- Grundgerüst der App mit Seitenleiste, Startseite und dunklem Design
- Eingebaute Hilfe: **F1** öffnet die Seite zum aktuellen Bildschirm, **Esc** schließt sie
- Übersicht der Tastenkürzel, die automatisch aus der App erzeugt wird
- Vollbild mit **F11**
- Installationspakete für Linux Mint (.deb) und AppImage
