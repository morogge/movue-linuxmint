# Audit: Klassifizierung der Mediatheken-Inhalte

Stand: 3. November 2026 · Filmliste vom 03.11.2026, 20:19 UTC · Code-Stand `main` = v0.11.0 (8d9a64b)

Reines Lese-Audit: Am Klassifizierungscode wurde nichts geändert. Dieses Dokument beschreibt, was die Regeln
heute mit der echten Liste machen, wo sie danebenliegen und warum.

## 1. Methode

1. **Dump aus der echten Liste.** `tests/echt/audit.test.ts` (Zweig `audit/klassifizierung`) importiert die volle
   MediathekView-Liste genauso wie `struktur.test.ts` (`importiere` → `baueFassungen` → `baueSerien`) und schreibt nach
   `test-results/audit/`:
   - `filme.jsonl.gz` / `filme.csv.gz`: je Sendung Gruppe, Sender, Thema, Titel, Datum, Dauer, **endgültige Genres**
     (nach Angleichung ans Bündel), **Rohgenres** (`bestimmeGenres` direkt), Bündel + Art, `extra`, `variante`,
     `fassung`, Staffel/Folge, Website, Video-URL, Beschreibung (200 Zeichen).
   - `buendel.json` / `buendel.csv`: je Bündel Gruppe, Name, Art, Folgen, Extras, Staffeln, Genres, Quellthemen, Beispieltitel.
   - `meta.json`: Stand der Liste.
2. **Lauf in GitHub Actions** (Workflow „Echtdaten“, `workflow_dispatch` mit `nur=tests/echt/audit.test.ts`),
   Läufe 41716906534 und 41717437251. Das Artefakt (`actions/upload-artifact@v4`, `if: always()`) liegt dort; weil der
   Blob-Speicher der Artefakte aus der Arbeitsumgebung nicht erreichbar ist, schiebt der Workflow die Dumps zusätzlich
   in den Zweig `audit/daten` (Datei in 40-MB-Teilen, mit `cat filme.jsonl.gz.teil-* > filme.jsonl.gz` zusammensetzen).
   Lokale Kopie: `test-results/audit/` (nicht eingecheckt; ohne `filme.csv.gz`, Inhalt identisch zu `filme.jsonl.gz`).
3. **Auswertung lokal** in SQLite/Python. Für jede Sendung wurde nachgebaut, **welcher Begriff aus `BEGRIFFE`**
   (`src/main/genre/regeln.ts`) welches Genre ausgelöst hat (gleiche Wortanfang-/„!“-Logik, `reise` nur im Thema).
   So lässt sich jede Fehlzuordnung auf eine Regel zurückführen.
4. Zählbasis „sichtbar“ = `variante = 0` (wie in allen Listen der App). „Stöbern-Einträge“ zählt wie `stoebern()`:
   ein Bündel = ein Eintrag, plus Einzelsendungen ohne Bündel. Anteile beziehen sich, wo nicht anders genannt, auf
   die Größe des betroffenen Genres.
5. Grenzen: Die Kategorien sind mit Regex-Heuristiken gezählt und stichprobenartig geprüft (je 15–40 Beispiele).
   Zahlen sind deshalb als Größenordnung zu lesen, nicht als exakte Fehlerquote.

## 2. Gesamtzahlen

| Gruppe | Sendungen | sichtbar | in Bündeln | Einzelsendungen (sichtbar) | Extras |
| --- | ---: | ---: | ---: | ---: | ---: |
| ARD | 378.002 | 365.447 | 363.281 | 13.517 | 2.157 |
| ZDF | 107.369 | 97.642 | 96.932 | 9.468 | 625 |
| 3sat | 19.896 | 18.795 | 14.827 | 4.395 | 27 |
| Arte | 15.183 | 11.959 | 6.343 | 6.374 | 13 |
| **Summe** | **520.450** | **493.843** | 481.383 | 33.754 | 2.822 |

4.636 Bündel: 1.843 Serien (43.004 Folgen), 2.451 Sendereihen, 153 Filmreihen, 189 Nachrichten-Bündel.
83 % der sichtbaren Sendungen haben genau ein Genre, 16 % zwei, 1,5 % drei oder mehr.

### Genres je Sender (sichtbare Sendungen, endgültige Genres)

| Genre | ARD | ZDF | 3sat | Arte | gesamt | Stöbern-Einträge |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Nachrichten & Politik | 202.441 | 42.710 | 1.195 | 4.641 | 250.987 | 7.839 |
| Gesellschaft & Talk | 26.975 | 7.760 | 3.422 | 4.721 | 42.878 | 5.507 |
| Kultur & Musik | 15.075 | 3.230 | 6.848 | 5.636 | 30.789 | 5.449 |
| Serien (Format) | 16.307 | 12.990 | 160 | 1.084 | 30.541 | 1.422 |
| Geschichte | 25.824 | 2.921 | 428 | 717 | 29.890 | 2.471 |
| **Weitere Sendungen** | **28.505** | 575 | 607 | 2 | **29.689** | **8.627** |
| Dokus & Reportagen | 9.600 | 13.897 | 3.985 | 1.253 | 28.735 | 9.996 |
| Ratgeber & Service | 21.804 | 5.384 | 933 | 567 | 28.688 | 1.009 |
| Wissen & Natur | 14.041 | 7.287 | 4.102 | 961 | 26.391 | 3.357 |
| Sport | 16.404 | 8.270 | 21 | 70 | 24.765 | 1.872 |
| Kinder & Familie | 5.852 | 15.608 | 54 | 129 | 21.643 | 790 |
| Comedy & Satire | 8.705 | 1.128 | 755 | 11 | 10.599 | 529 |
| Reisen & Länder | 7.121 | 730 | 1.747 | 988 | 10.586 | 1.711 |
| Shows & Unterhaltung | 5.206 | 2.771 | 173 | 36 | 8.186 | 559 |
| Krimi & Thriller | 3.483 | 3.353 | 124 | 76 | 7.036 | 705 |
| Spielfilme (Format) | 1.643 | 583 | 1.683 | 423 | 4.332 | 3.460 |

Auffällig: „Weitere Sendungen“ ist auf der Genre-Seite der **zweitgrößte Eintrag nach Dokus** (8.627 Einträge) und fast
nur ein ARD-Problem (96 %). Sport hat bei 3sat/Arte fast nichts, weil dort kein Sport-Pfad/Begriff greift.
80.684 von 460.089 gebündelten Sendungen (17,5 %) ändern ihre Genres durch die Angleichung ans Bündel (`baueSerien` Schritt 5).

## 3. Fehlerkategorien

| # | Kategorie | Anzahl | Anteil | Ursache im Code | Beispiele |
| --- | --- | ---: | ---: | --- | --- |
| 1 | **Krimi durch Allerweltswörter** (Sport, Nachrichten, Kultur, Wissen, Ratgeber mit Krimi-Etikett) | 117 Stöbern-Einträge (17 Bündel, 100 Einzel); 390 Einträge mit irgendeinem Sachgenre | 16,6 % bzw. 55 % der 705 Krimi-Einträge | `regeln.ts` `BEGRIFFE.krimi`: `mord`, `krimi`, `ermittl`, `täter`, `verbrechen`, `crime`, `thriller`, `tatort`, `detektiv` als Wortanfang in Thema **und Titel**; kein Ausschluss bei Doku/Nachrichten/Sport. „-Krimi“ nach Bindestrich zählt als Wortanfang. | ZDF Sport „Kiel schockt Hoffenheim: Sieg nach Elfmeter-Krimi“ (`krimi`); 3sat „Last Man Standing – der Mord an Tupac Shakur – Dokumentarfilm“ (`mord`); ZDF Politik „IS-Ableger und Hamas beschäftigen Ermittler“ (`ermittl`); ZDF Sport „Zverev liefert nächsten Fünf-Satz-Krimi“; Arte „Kunstzerstörer – Auf den Spuren der Täter“ (`täter`); ARD „Lokalzeit MordOrte“ (Bündel, krimi+nachrichten) |
| 2 | **Minderheitsgenre wird Bündel-Genre** (1/3-Regel) | 1.661 Bündel mit ≤ 5 Folgen anfällig; 88 Folgen bekommen Krimi nur über ihr Bündel | – | `serien.ts` `baueSerien` Schritt 3: `HAVING COUNT(*) * 3 >= s.folgen` – bei 3 Folgen reicht **eine**; Schritt 5 kopiert das Genre auf alle Folgen | ARD „History or Mystery – Die Burgenchallenge mit Alexander Prinz“: Folge 2 „… ermittelt auf der Hardenburg“ → ganzes Bündel Krimi (+ Wissen über `rätsel`); ARD „Ridley“ → Ratgeber (siehe 6); ZDF „Der Überfall“, „Berühmt und Berüchtigt“ |
| 3 | **Trailer/Extras in Listen** | 2.798 sichtbare Extras, davon 551 als eigene Einträge im Stöbern; 1.544 echte Trailer/Teaser/Vorschauen < 10 Min. | 0,6 % aller; 1,6 % der Einzelsendungen | `EXTRA` (`shared/serie.ts`) erkennt sie (auch „Trailer Tatort …“), aber **keine Liste filtert `extra`**: `stoebern()`, `suche()`, `reihe()` (dort nur `minDauer 600` auf der Startseite) | ZDF „Trailer Tatort Mittelalter“ (38 s, `extra=1`, Rubrik ZDFinfo Doku → Einzelsendung, Genres doku+geschichte+krimi über `tatort`/`mittelalter`); ARD „Trailer: Volk in Angst · Wie mit Verbrechen Politik gemacht wird“ (Krimi); ZDF „Dunkelstadt – Online-Clip“ |
| 3a | Extras-Fehlalarm (ganze Sendungen als Extra) | 384 Extras ≥ 20 Min. (296 Podcasts, 52 „hinter den Kulissen“) | 14 % der Extras | `EXTRA` matcht `podcast`, `hinter den kulissen`, `vorschau` ohne Dauerprüfung; Extras zählen nicht als Folge und fallen aus Bündeln | Arte „Macron – Merz: Hinter den Kulissen der Macht (1/2)“ (45 Min., nicht gebündelt!); ARD „Alles Eurovision – Die Vorschau auf das zweite Halbfinale“ (130 Min.); ZDF Theater „Trailer Park“ (55 Min.) |
| 3b | Clips nicht als Extra erkannt | 381 | – | `EXTRA` kennt kein `clip`, `preview`, `web-clip`, `online-clip` | ARD DRUCK „… – Clip 34“; ARD „Der Schneeberg – Web-Clip“; ARD buten un binnen „Tatort Preview ‚Echolot‘“ |
| 4 | **Livestreams/Ankündigungen wie VOD** | 28 Sender-Streams (Datum 0, Dauer 0), 39 Event-Streams (`/hls/live/`), davon 4 in der Zukunft | – | Kein Live-Merkmal im Import (`eintrag.ts`, `regeln.ts`); `reihe()` lässt `datum ≤ jetzt + 1 Tag` zu, `stoebern()`/`suche()` gar keine Datumsgrenze | ARD SWR Sport „Basketball live: Die Gladiators Trier empfangen Trepca“ (04.11.2026 18:55, `event14cloudhls…/hls/live/…m3u8`); ARD Sportschau „Die Auslosung für die Qualifikation zur EM 2028“ (06.12.); „ARD Livestream“, „NDR Hamburg“ … (Thema „Livestream“, in Weitere Sendungen) |
| 4a | Vorab-/Zukunftsdatum | 790 Sendungen mit Datum nach Listenstand, 533 davon > 7 Tage, Extremfall Jahr 2204 | 0,16 % | Datum = geplante Ausstrahlung; Sortierung „neueste zuerst“ stellt sie nach oben | ZDF Doku Natur „Am Fuß des Glockners“ (13.12.2204); ZDF-tivi „Arrietty …“ (2030); NDR „Cave Painter“ (2027) |
| 5 | **Nachrichten in Ratgeber** | 2.775 (ZDF-/ARD-Mittagsmagazin, Brisant) | 9,7 % von Ratgeber | `BEGRIFFE.ratgeber` enthält `mittagsmagazin` und `brisant` | ZDF-Mittagsmagazin „Live: Neue Wasserwelt im Leipziger Zoo“ (nachrichten+ratgeber); ARD Mittagsmagazin „Hohe Preise trüben New Yorks Hoffnungen …“ |
| 6 | **Ratgeber durch Allerweltswörter** | 1.409 Treffer nur über `garten`, dazu `küche`, `geld!`, `auto!`, `steuer` … | – | `BEGRIFFE.ratgeber` im Titel; plus 1/3-Regel (Kat. 2) | ARD „Ridley“: „Folge 1: Der stille Garten“ → Ratgeber für die ganze Krimiserie; Ridley selbst bekommt **kein** Krimi (kein Begriff); 3sat/ARD „Praxis mit Meerblick“ (`praxis!`) |
| 7 | **Aktuelle Nachrichten in Geschichte** | 294 aktuelle Clips (geschichte+nachrichten, kein Retro-Thema, letzte 3 Jahre), 175 davon Einzel­einträge | 1 % von Geschichte; 7 % der Geschichte-Einzeleinträge | `BEGRIFFE.geschichte`: `krieg!`, `kriege` (Wortanfang – trifft auch „Krieges“), `kaiser`, `könig` im Titel; Sammelthemen („Politik“) werden nicht gebündelt, also auch nicht angeglichen | ZDF Politik „Merz: ‚Es ist Zeit für ein Ende dieses Krieges‘“ (`kriege`); ZDF „Ukraine-Krieg: Trump kündigt … Treffen an“; Arte „Droht ein Krieg im All?“ |
| 7a | Geschichte besteht zu 79 % aus Archiv-Nachrichtenclips | 23.702 von 29.890 | 79 % | `retro` in `BEGRIFFE.geschichte` (hr Retro, SWR/WDR/RB Retro) | „hr Retro – hessenschau: 75. Geburtstag von Heinrich Zinnkann“ (171 s) |
| 8 | **Reisen durch Ortsnamen im Thema von Fiktion** | 406 Sendungen in 29 Bündeln | 3,8 % von Reisen | `NUR_THEMA = {reise}` prüft das Thema auf `bodensee`, `schwarzwald`, `irland`, `alpen`, `elbe!` … – ohne Ausschluss bei Krimi/Film/Serie | ZDF „Die Toten vom Bodensee“ (krimi+reise+serie), 3sat dito (film+krimi+reise); ARD „WaPo Bodensee“ (163); ZDF „Die Schwarzwaldklinik“; ARD „Der Irland-Krimi“ |
| 9 | **Doku-/Sachserien als „Serie“** | 843 von 1.843 Serien-Bündeln haben ein Sachgenre und weder Krimi noch Film; 587 Bündel (8.002 Folgen) sind reine Doku/Wissen/Geschichte | 46 % bzw. 32 % der Serien-Bündel | `serienArt()` (`shared/serie.ts`): `nummeriert * 2 >= folgen → 'serie'` vor jeder Genreprüfung; `bestimmeGenres`: `(S01/E05)` → Genre `serie`, wenn kein Sachgenre gefunden wurde | ARD „Mittendrin – Flughafen Frankfurt“ (102 Folgen, nur Genre `serie`, Art Serie); ARD „Elefant, Tiger & Co.“ (1.247 Folgen, Art Serie); ZDF „Terra Xplore“, „Wunderbauten der Geschichte“; ARD „Hitlers Volk – Ein deutsches Tagebuch“ |
| 9a | Staffelbilder fehlen | alle ARD-Serien mit Staffeln | – | `bilder.ts` `ardSerienBild()` liest nur `show.images` (ein Bild je Sendung), keine Staffel-/Compilation-Bilder; `serie.film_id` = neueste Folge | „Mittendrin – Flughafen Frankfurt“ Staffeln 8–17 zeigen dasselbe Bild |
| 10 | **Sport außerhalb von Sport** | 323 Sportschau-Clips ohne Sport; 784 Vereins-/Fußballformate in Weitere Sendungen | – | ARD-Website-IDs sind base64 (`crid://sportschau.de/…`), werden nicht ausgewertet; `PFADE` nur für zdf.de/3sat.de, nicht zdfheute.de; Vereinsformate ohne Begriff | ARD Morgenmagazin „Pacers gewinnen in letzter Sekunde gegen Oklahoma“ (nur nachrichten); „DEIN VfB“, „DEIN SCF“, „DEIN FCK“, „DEIN FSV“, „Heimspiel“, „FUSSBALL 2000“ |
| 11 | **Weitere Sendungen als Sammelbecken** | 29.689 Sendungen / 8.627 Stöbern-Einträge (831 Bündel, 7.796 Einzel) | 6,0 % aller; 7,8 % bei ARD | `bestimmeGenres`: `sonstiges`, wenn nichts trifft (24.040); zusätzlich 5.649 Sendungen, die ihr Genre verlieren, weil das Bündel `sonstiges` geerbt hat (Schritt 5); 480 Sendungen, deren Film-Genre die 50-Min.-Regel gelöscht hat | siehe Abschnitt 4 |
| 12 | Spielfilm-Etikett für Dokumentarfilme | 3sat-Pfad `/film/` | – | `PFADE` `/film/` → film, Dauer > 50 Min. bleibt film | 3sat Dokumentarfilmzeit „Last Man Standing …“ = doku+**film**+krimi |

### Seed-Beispiele aus den Rückmeldungen

| Beispiel | Befund im Dump | Ursache |
| --- | --- | --- |
| ZDF „Die Toten vom Bodensee“ in Reisen | Bündel ZDF: `krimi|reise|serie`, Art **serie** (Filme à 89 Min.); 3sat: `film|krimi|reise`, Filmreihe | `reise` über `bodensee` im Thema (`NUR_THEMA`); Art Serie, weil ZDF die Filme „(S04/E03)“ nummeriert → `serienArt` prüft Nummerierung vor Filmlänge |
| 3sat „Last Man Standing – der Mord an Tupac Shakur – Dokumentarfilm“ in Krimi | `doku|film|krimi`, Einzelsendung in Rubrik „Dokumentarfilmzeit“ (ARD-Fassung: `doku|krimi|kultur`) | `mord` im Titel; `film` über 3sat-Pfad `/film/` |
| ARD „Mittendrin – Flughafen Frankfurt“ als Serie | 102 Folgen, Genre nur `serie`, Art serie | Kein Begriff trifft; „(S08/E05)“ → `serie`; `serienArt` → serie. Staffelbilder: siehe 9a |
| ZDF „Kiel schockt Hoffenheim: Sieg nach Elfmeter-Krimi“ | `krimi|sport`, Einzel (Thema „Sport“ ist Sammelthema) | `krimi` nach Bindestrich; Website `zdfheute.de/sport/…` wird von `PFADE` nicht gelesen |
| ZDF „Trailer Tatort Mittelalter“ | `doku|geschichte|krimi`, `extra=1`, 38 s, Einzel | `EXTRA` erkennt den Trailer, aber Listen filtern `extra` nicht; Krimi über `tatort` |
| ARD „History or Mystery – Die Burgenchallenge mit Alexander Prinz“ | Bündel `geschichte|krimi|wissen`, Art serie, 3 Folgen | Eine Folge mit „ermittelt“ → 1/3-Regel macht das Bündel zum Krimi; „History“ → Geschichte |
| „Weitere Sendungen“ unsortiert | siehe Abschnitt 4 | Rückfall `sonstiges` + Bündel-Angleichung |
| ARD/SWR „Basketball live: Die Gladiators Trier empfangen Trepca“ | `sport`, Datum 04.11.2026 18:55 (Liste: 03.11. 20:19), URL `…/hls/live/…`, Dauer 185 Min. | Kein Live-Merkmal; `reihe()` nimmt Sendungen bis jetzt + 24 h → steht als „neueste“ auf der Startseite |
| „Ratgeber & Service“ enthält „Ridley“ | Bündel `ratgeber|serie` | `garten` in „Der stille Garten“ (2 von 6 Folgen) + 1/3-Regel; Krimi fehlt ganz |
| „Geschichte“ enthält „Merz: Es ist Zeit für ein Ende des Krieges“ | ZDF Thema „Politik“, `geschichte|nachrichten`, 139 s, Einzel | `kriege` als Wortanfang trifft „Krieges“; Sammelthema „Politik“ → keine Angleichung |

## 4. Was „Weitere Sendungen“ enthält

29.689 sichtbare Sendungen. 96 % ARD (ARD-Hauptsender 9.566, SR 5.985, BR 4.505, SWR 2.322), 81 % ohne jeden
Regeltreffer, 19 % durch Bündel-Angleichung. Dauer: 33 % unter 5 Min., 24 % 5–15 Min., 24 % 15–40 Min., 13 % 40–75 Min., 6 % über 75 Min.
Website: 69 % ardmediathek.de (keine Pfad-Info), 18 % sr-mediathek.de.

Grobe Clusterung (Regex auf Thema/Titel/Beschreibung, erste passende Regel):

| Cluster | Anzahl | Anteil | davon Einzel | Beispiele | Vorgeschlagenes Ziel |
| --- | ---: | ---: | ---: | --- | --- |
| Regionale Kurzmeldungen (SR „Beiträge“/„SR“, BR „BR“-Archiv, < 10 Min.) | 5.078 | 17 % | 4.945 | „Villeroy & Boch meldet höhere Umsätze“, „Lehrerproteste in Saarbrücken“ | Nachrichten (Regional); als Nachrichten-Art ausblenden |
| Gesellschaft, Talk, Jugend/funk | 3.487 | 12 % | 315 | RESPEKT, Treffpunkt, Ich mach's!, DRUCK, UNSERDING, Sehen statt Hören | Gesellschaft & Talk (funk-Formate ggf. eigener Filter „Jung“) |
| Musik & Konzert | 2.558 | 9 % | 304 | hr-Bigband, NDR Bigband, Wirtshausmusikanten, Startrampe, Bardentreffen | Kultur & Musik |
| Essen, Gesundheit, Ratgeber | 2.506 | 8 % | 129 | aktiv und gesund, Horst sein Schrebergarten, Hessen à la carte, Genuss mit Zukunft | Ratgeber & Service |
| Reise & Region | 2.017 | 7 % | 424 | Wunderschön!, #hinREISEND, Berlin/Brandenburg erleben, Landpartie | Reisen & Länder |
| Comedy & Kabarett | 1.245 | 4 % | 58 | ALFONS und Gäste, Datteltäter, Phil Laude, Mainz bleibt Mainz | Comedy & Satire |
| Wissen & Bildung | 1.186 | 4 % | 12 | MrWissen2go, alpha-demokratie, ARD alpha Uni, Space Night science | Wissen & Natur |
| Nachrichten & Politik | 1.107 | 4 % | 44 | SAARTALK, SAARTHEMA, SWR Extra, DIE DA OBEN!, Umschau | Nachrichten & Politik |
| Kurzclips < 2 Min. ohne Zuordnung | 1.009 | 3 % | 236 | Abstimmungs-Spots, Programmhinweise | ausblenden (Extra) |
| Sport (Vereine, Fußball-Podcasts) | 784 | 3 % | 1 | DEIN VfB/SCF/FCK/FSV, Heimspiel, FUSSBALL 2000 | Sport |
| Film & Fiktion | 352 | 1 % | 200 | Debüt im Dritten, ARD Debüt, Steirerkrimi, Kluftingerkrimis, „Die Himmelsleiter“ | Spielfilme / Krimi |
| Livestreams (Sender, Events) | 30 | 0,1 % | 28 | ARD/ZDF/3sat/Arte-Livestream, „Jetzt live: …“ | eigenes Format „Live“ (Phase 7), nicht im VOD |
| Rest (nicht zuordenbar) | 8.330 | 28 % | 1.100 | 3sat-Archiv (Thema „3sat“, 2013–2018), Ab 18!, Alles finster, Berlinale | Einzelfall; viele sind 3sat-Dokus mit altem `3sat.de/mediathek/?obj=`-Link → Doku |

Besonderheiten:
- **480 Film-Treffer werden zu „sonstiges“**: `kinokino` (152), `unicato` (121), `debüt im dritten` (53), `fernsehfilm`, `herzkino` …
  Die Regel „kein Spielfilm unter 50 Min.“ löscht `film`, und dann bleibt nichts übrig.
- **131 Bündel tragen `sonstiges` neben echten Genres** (z. B. NDR „Cave Painter“ = `serie|sonstiges`), 706 Bündel nur `sonstiges`.
  `sonstiges` wird in Schritt 3 wie ein Genre gezählt und in Schritt 5 an alle Folgen weitergegeben.
- Die Themen „Beiträge“, „SR“, „BR“ stehen in `SAMMELTHEMEN` → nie gebündelt → 4.945 Einzelkacheln: 63 % aller Einzel­einträge in Weitere Sendungen.

## 5. Weitere Messungen

| Messgröße | Wert |
| --- | --- |
| Trailer/Teaser/Vorschauen (Extra, < 10 Min.) | 1.544 (393 als Einzeleintrag) |
| Alle Extras sichtbar / davon als Einzeleintrag im Stöbern | 2.798 / 551 |
| Kurze Beiträge < 3 Min. außerhalb von Nachrichten-Bündeln | 44.966 (9.643 Einzel) |
| Sender-Livestreams in der VOD-Liste | 28 (Datum 1970, Dauer 0) |
| Event-Livestreams (`/hls/live/`) | 39, davon 4 mit Startzeit in der Zukunft |
| Sendungen mit Datum in der Zukunft | 790 (533 > 7 Tage) |
| Nachrichten-URLs (zdfheute, tagesschau, br24, swraktuell …) ohne Nachrichten-Genre | 1.135 (951 ZDF „hallo deutschland“ = Boulevard, als Gesellschaft vertretbar) |
| Sportschau-Clips ohne Sport-Genre | 323 |
| Sport-Bündel/Themen in Weitere Sendungen | 784 |
| Bündel-Angleichung: Folgen mit geänderten Genres | 80.684 (17,5 % der gebündelten); am häufigsten hinzugefügt: sonstiges 5.649, serie 2.777, gesellschaft 2.643 |

## 6. Priorisierte Regel-Korrekturen

**P1 – sichtbar falsch, wenig Aufwand**

1. **Extras aus allen Listen nehmen**: `stoebern()` (Einzelteil), `suche()` und `reihe()` mit `f.extra = 0` filtern;
   Extras nur auf der Serienseite (Reiter „Extras“). Behebt „Trailer Tatort Mittelalter“ und 551 Einzeleinträge.
2. **Live erkennen** (Import, `eintrag.ts`/`regeln.ts`): `url ~ /hls/live/|/live/hls/` oder Thema „Livestream“ oder
   `dauer = 0 && datum = 0` → Merkmal `live` (neue Spalte); Sender-Streams in Live-TV (Phase 7), Event-Streams als
   Format „Live-Stream“ mit Startzeit („morgen 18:55“), nicht als VOD. Allgemein: Listen auf `datum <= jetzt` begrenzen,
   Zukünftiges als „Demnächst“ führen.
3. **Krimi-Allerweltswörter entschärfen** (`BEGRIFFE.krimi`): `mord`, `krimi`, `ermittl`, `täter`, `verbrechen`, `crime`,
   `thriller`, `detektiv`, `fahndung` nur im **Thema** werten (wie `reise` über `NUR_THEMA`), im Titel nur als
   Formatangabe („- Krimi“, „- Thriller“ am Ende). „-Krimi“-Komposita („Elfmeter-Krimi“, „Wahlkrimi“)
   ausschließen. `tatort` nur, wenn das Thema mit „Tatort“ beginnt.
4. **Ausschlussmatrix nach der Zuordnung** in `bestimmeGenres`: `krimi` entfällt bei `sport` oder `nachrichten`;
   bei `doku` wird Krimi nur über ein Thema mit „True Crime/Kriminalfälle/Aktenzeichen“ vergeben (eigener
   Unterbegriff „True Crime“ statt Krimi & Thriller).
5. **Ratgeber**: `mittagsmagazin` und `brisant` aus `BEGRIFFE.ratgeber` streichen (Mittagsmagazin = Nachrichten,
   Brisant = Gesellschaft/Boulevard); `garten`, `küche`, `geld!`, `auto!`, `steuer`, `rente` nur im Thema.
6. **Geschichte**: `krieg!`, `kriege`, `kaiser`, `könig` nur im Thema; `kriege` als Ganzwort (`kriege!`).
   Kein `geschichte`, wenn `nachrichten` und Dauer < 10 Min.

**P2 – Struktur**

7. **Bündel-Genres** (`baueSerien` Schritt 3/5): Schwelle für kleine Bündel anheben (Mehrheit statt 1/3, mindestens
   2 Folgen); `sonstiges` nie als Bündel-Genre, wenn es andere gibt, und nie per Angleichung über echte Genres schreiben.
8. **Reise im Thema bei Fiktion unterdrücken**: `reise` entfernen, wenn `krimi`, `film` oder `serie` gesetzt ist
   (Bodensee, Schwarzwald, Irland …).
9. **Art Doku-Serie** (`serienArt`): Nummerierung macht nur dann zur `serie`, wenn kein Sachgenre (`KEINE_SERIE`)
   dominiert; sonst `reihe` bzw. neue Art „dokuserie“. In `bestimmeGenres` „Doku-Serie/Dokuserie/Reportage
   Deutschland 20xx“ am Beschreibungsanfang → `doku` (Beschreibung als Quelle zulassen).
10. **Filmreihen mit ZDF-Nummern**: Bündel mit ≥ 70 % Folgen ≥ 75 Min. → `filmreihe`, auch wenn nummeriert
    (Reihenfolge in `serienArt` tauschen). Behebt „Die Toten vom Bodensee“, „Der Zürich-Krimi“ als Serie.
11. **Quelle der ARD-Website auswerten**: Die ID in `ardmediathek.de/video/<base64>` ist `crid://<haus>/…`
    (`sportschau.de`, `tagesschau.de`, `swr.de/aex`, `br.de`); `sportschau.de` → sport, `tagesschau.de` → nachrichten.
    `PFADE` auf `zdfheute.de` erweitern (`/sport/`, `/nachrichten/`, `/politik/`).
12. **„Weitere Sendungen“ abbauen**: SR/BR-Sammelthemen „Beiträge“, „SR“, „BR“ mit Dauer < 10 Min. → nachrichten;
    THEMA_EXAKT um die großen Waisen ergänzen (Wunderschön! → reise, hr-Bigband/NDR Bigband/Wirtshausmusikanten → kultur,
    DEIN VfB/SCF/FCK/FSV, Heimspiel → sport, ALFONS und Gäste/Mainz bleibt Mainz → comedy/unterhaltung,
    aktiv und gesund → ratgeber, MrWissen2go → wissen); bei gelöschtem `film` (`kinokino`, `unicato`) `kultur` setzen
    statt leer zu lassen.

**P3 – Feinschliff**

13. `EXTRA`: `podcast`, `hinter den kulissen`, `vorschau` nur bei Dauer < 20 Min.; neu `clip`, `web-clip`,
    `online-clip`, `preview`.
14. 3sat-Pfad `/film/` bei „Dokumentarfilm“ im Titel oder Rubrik „Dokumentarfilmzeit“ nicht als `film` werten.
15. Staffelbilder: in `bilder.ts` neben `show.images` die Bilder der Staffel-Compilation der ARD-Schnittstelle lesen
    und je Staffel-Reiter anzeigen.
16. Daten > 1 Jahr in der Zukunft (Jahr 2204) als fehlerhaft behandeln und auf das Listendatum setzen.

Jede Korrektur lässt sich mit dem Audit-Test gegen die echte Liste nachmessen: Workflow „Echtdaten“ auf dem Zweig
mit `nur=tests/echt/audit.test.ts` starten und dieselben Abfragen auf dem neuen Dump wiederholen.
