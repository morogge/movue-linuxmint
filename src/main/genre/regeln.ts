import type { GenreId } from '@shared/genres';
import { serieAusTitel } from '@shared/serie';

/**
 * Leitet Genres aus den Feldern der Filmliste ab. Reihenfolge der Quellen:
 *  1. Sender (z. B. ZDFtivi → Kinder) und Themen, die genau so heißen
 *  2. Website: Pfade bei ZDF, 3sat und zdfheute, bei der ARD die Quelle in der Adresse (sportschau.de …)
 *  3. Begriffe: allgemeine Wörter („Krimi“, „Garten“, „Krieg“) nur im Namen der Sendung (Thema oder Serienname
 *     aus dem Titel), nicht im Titel einer Folge – dort sind es Zufallstreffer („Elfmeter-Krimi“)
 *  4. Formatangaben in Titel und Beschreibung („– Spielfilm, USA 1993“, „Fernsehfilm Deutschland 2021“)
 *  5. Ausschlüsse: kein Krimi bei Sport, Nachrichten und Dokus, keine Reise bei Fiktion …
 * Was nichts trifft, landet vorerst in „Weitere Sendungen“.
 *
 * Neue Reihen oder Korrekturen: in BEGRIFFE ergänzen und mit `npx vitest run --config vitest.echt.config.ts`
 * gegen die echte Liste prüfen (zeigt Abdeckung und die häufigsten nicht zugeordneten Themen).
 */

/**
 * Begriffe je Genre. Treffer am Wortanfang („doku“ trifft „Dokumentation“).
 * Ein „!“ am Ende verlangt das ganze Wort („heute!“ trifft nicht „heutige“).
 */
const BEGRIFFE: Record<Exclude<GenreId, 'sonstiges'>, string[]> = {
  krimi: [],
<<<<<<< HEAD
=======
  // kommen aus Wikidata (Paket „Metadaten“), nicht aus Begriffen
  drama: [],
  liebe: [],
  fantasy: [],
  historisch: [],
>>>>>>> origin/feat/navigation-nach-art
  film: [
    'spielfilm', 'fernsehfilm', 'kinofilm', 'filme im ersten', 'filmmittwoch', 'herzkino', 'montagskino',
    'der fernsehfilm der woche', 'sommerkino', 'kino im ersten', 'das kleine fernsehspiel', 'debüt im ersten',
    'kinokino', 'filmdebüt', 'arthouse', 'freitagskino', 'sonntagskino', 'spätfilm', 'kurzfilm',
    'animationsfilm', 'liebesfilm', 'heimatfilm', 'familienfilm', 'western', 'komödie', 'tragikomödie',
    'melodram', 'märchenfilm', 'märchen', 'mittwochsfilm', 'filmfestival', 'ard degeto', 'degeto',
    'kino -', 'kino –',
    'filme in der ard', 'debüt im dritten', 'unicato'
  ],
  serie: [
    'serie', 'serien', 'rote rosen', 'sturm der liebe', 'in aller freundschaft', 'um himmels willen',
    'die bergretter', 'der bergdoktor', 'lindenstraße', 'marienhof', 'watzmann ermittelt', 'die kanzlei',
    'der landarzt', 'babylon berlin', 'charité', 'familie dr. kleist', 'dahoam is dahoam', 'unter uns',
    'die fallers', 'hubert und/ohne staller', 'doctor’s diary', 'das boot', 'der lehrer', 'die bergwacht',
    'die küstenwache', 'notruf hafenkante', 'heiter bis tödlich', 'tierärztin dr. mertens', 'praxis mit meerblick',
    'die eifelpraxis', 'der hafenpastor', 'frühling', 'rentnercops', 'die drei von der müllabfuhr', 'kitz',
    'miniserie', 'webserie', 'staffel', 'telenovela', 'soap', 'sitcom'
  ],
  doku: [
    'doku', 'dokumentation', 'dokumentarfilm', 'reportage', 'reporter', 'exclusiv im ersten', 'die story',
    'die spur', 'hautnah', 'story!', 'feature', 'zdfinfo', 'zdf.reportage', 'zdf.dokukanal', 'die reportage',
    '37 grad', '37°', 're:', 'arte re:', 'y-kollektiv', 'strg_f', 'panorama 3', 'exakt – die story',
    'die nordreportage', 'die nordstory', 'unser leben', 'menschen hautnah', 'inside!', 'investigativ',
    'die rbb reporter', 'betrifft', 'der osten – entdecke', 'echt!', 'lebensläufe', 'porträt', 'portrait',
    'biografie', 'biographie', 'dokumentarisch', 'zeitreise', 'stationen', 'die dokumentation', 'dok 5',
    'zdfzeit', 'zdfzoom', 'handwerkskunst', 'dokumentationen und reportagen',
    'lebenslinien', 'einzeldok'
  ],
  wissen: [
    'terra x', 'terra xpress', 'nano!', 'quarks', 'planet wissen', 'xenius', 'leschs kosmos', 'abenteuer forschung',
    'wissen', 'w wie wissen', 'odysso', 'frag den lesch', 'scobel', 'alpha-centauri', 'wissenschaft', 'natur',
    'tiere', 'tier!', 'tierisch', 'wildnis', 'wildes', 'expedition', 'erlebnis erde', 'universum', 'forschung',
    'planet e', 'physik', 'chemie', 'astronom', 'technik', 'kosmos', 'ozean', 'meere!',
    'dschungel', 'zoo', 'tierpark', 'elefant', 'wolf!', 'wölfe', 'vögel', 'insekt', 'pflanzen', 'wald!',
    'wälder', 'medizin', 'gehirn', 'psychologie', 'mathematik', 'raumfahrt', 'weltall', 'erde!', 'planet schule',
    'quarks & co', 'die sendung mit dem elefanten', 'mysterien', 'rätsel', 'künstliche intelligenz',
    'die ernährungs-docs',
    'natürlich!', 'giraffe, erdmännchen', 'panda, gorilla', 'eisbär, affe', 'elefant, tiger', 'lesch', 'erdmännchen', 'wissenschaft'
  ],
  geschichte: [
    'geschichte', 'history', 'weltkrieg', 'mittelalter', 'antike', 'römer',
    'preußen', 'ddr!', 'nazi', 'hitler', 'zeitgeschichte', 'mauerfall', 'holocaust', 'ns-', 'dritte reich', 'stasi', 'zeitzeugen', 'archäologie', 'pharao',
    'wikinger', 'kelten', 'germanen',
    'kalter krieg', 'nachkrieg', 'gründerzeit', 'bonner republik', 'zdf-history', 'zdfhistory',
    'mdr zeitreise', 'unser dorf hat wochenende', 'retro', 'vor 50 jahren', 'die 50er', 'die 60er', 'die 70er',
    'die 80er', 'die 90er',
    'sellemols'
  ],
  reise: [
    'reise', 'länder!', 'von oben', 'unterwegs', 'abenteuer', 'traumziel', 'metropolen', 'inseln', 'insel!',
    'küste', 'alpen', 'berge', 'städte', 'stadt land kunst', 'stadt-land-kunst', '360° geo', 'geo reportage',
    'nordseereport', 'ostseereport', 'mare tv', 'länder menschen abenteuer', 'länder – menschen – abenteuer',
    'eisenbahn', 'mit dem zug', 'bahnstrecke', 'wanderung', 'wandern', 'roadtrip', 'weltreise', 'zu tisch',
    'europas', 'afrika', 'asien', 'amerika', 'australien', 'skandinavien', 'mittelmeer', 'karibik', 'norwegen',
    'schweden', 'italien', 'frankreich', 'spanien', 'griechenland', 'kanada', 'island', 'schottland', 'irland',
    'japan', 'china', 'indien', 'die schönsten', 'traumhaft', 'urlaub', 'ferien', 'kreuzfahrt', 'expeditionen',
    'nordsee', 'ostsee', 'bodensee', 'schwarzwald', 'bayern erleben', 'reisen',
    'rhein!', 'elbe!', 'donau!', 'nordtour', 'da will ich hin', 'bilder aus südtirol', 'schweizweit', 'entdeckung der welt', 'herr ostrowski', 'zwischen spessart und karwendel',
    'hierzuland', 'bergauf-bergab', 'fahr mal hin', 'der osten - entdecke', 'der osten – entdecke', 'schätze der welt', 'entdeckung!', 'eisenbahn-romantik', 'traumziele'
  ],
  kultur: [
    'kultur', 'kulturzeit', 'ttt', 'titel thesen temperamente', 'titel, thesen, temperamente', 'aspekte',
    'druckfrisch', 'konzert', 'oper!', 'opern', 'musik', 'jazz', 'rock!', 'pop!', 'festival',
    'theater', 'kunst', 'museum', 'literatur', 'buch!', 'bücher', 'lesung', 'tanz!', 'ballett', 'tracks',
    'metropolis', 'philharmonie', 'orchester', 'sinfonie', 'symphonie', 'beethoven', 'mozart', 'bach!', 'wagner',
    'rockpalast', 'arte concert', 'unplugged', 'chor', 'lied', 'songs', 'band!', 'künstler', 'maler',
    'architektur', 'design', 'fotografie', 'kulturjournal', 'kulturplatz', 'kino!', 'filmgeschichte', 'blow up',
    'karambolage', 'das literarische quartett', 'lesenswert', 'kunst + krempel', 'kunst und krempel', 'schlager',
    'volksmusik', 'musikantenstadl', 'hip-hop', 'hip hop', 'rap!', 'elektro', 'techno', 'oratorium', 'kammermusik',
    'klassik!', 'klassische musik', 'eurovision song contest', 'esc!', 'max ophüls', 'cinema strikes back', 'buchzeit', '3satbuchzeit', 'klassixs', 'erlesen', 'popkultur', 'kultur und pop',
    'rbbkultur', 'puls startrampe', 'kunscht', 'westart', 'landesart', 'masterclass', 'capriccio'
  ],
  comedy: [
    'comedy', 'kabarett', 'satire', 'extra 3', 'heute-show', 'heute show', 'zdf magazin royale', 'die anstalt',
    'mitternachtsspitzen', 'nuhr', 'kroymann', 'pussy terror', 'ladies night', 'nightwash', 'sketch', 'stand-up',
    'standup', 'kebekus', 'böhmermann', 'dittrich', 'lustig', 'humor', 'parodie', 'der schlachthof',
    'spätschicht', 'satire gipfel', 'satiregipfel', 'die carolin kebekus show', 'freitag nacht news', 'neo magazin',
    'browser ballett', 'mann, sieber', 'die bierbichler', 'olafs klub', 'quatsch', 'comedystreet',
    'kabarettfestival', 'schreinerei', 'mittermeier', 'pispers', 'priol', 'tegtmeier', 'loriot', 'otto!',
    'brettl-spitzen', 'world wide wohnzimmer', 'happy hour', 'pufpaff', 'schlachthof', 'pratersterne', 'vereinsheim schwabing', 'asül', 'schleichfernsehen', 'tafelrunde', 'noch nicht schicht', 'pelzig', 'karlsplatz', 'bosetti', 'till reiners', 'was gibt es neues', '3satfestival',
    'walulis', 'nockherberg',
    'quer mit'
  ],
  unterhaltung: [
    'show!', 'shows', 'quiz', 'gala', 'wer weiß denn sowas', 'gefragt – gejagt', 'gefragt gejagt', 'das quiz',
    'quizduell', 'klein gegen groß', 'immer wieder sonntags', 'fernsehgarten', 'feste der', 'silbereisen',
    'wetten, dass', 'verstehen sie spaß', 'bares für rares', 'die küchenschlacht', 'quiz-champion', 'da kommt kalle',
    'kaum zu glauben', 'hirschhausens quiz', 'frag doch mal die maus', 'die giovanni zarrella show',
    'die schlagerchance', 'promi', 'unterhaltung', 'rate mal', 'pointless',
    'samstagabend', 'familienduell', 'sag die wahrheit', 'was bin ich', 'dalli dalli',
    'zdf-fernsehgarten', 'riverboat', 'tietjen', 'inas nacht', 'nachtcafé', 'kölner treff', '3nach9', 'talk',
    'kurzstrecke', 'ehrlich brothers', 'zauber',
    'fastnacht', 'fasching', 'karneval', 'game two', 'mainzelmännchen'
  ],
  nachrichten: [
    'tagesschau', 'tagesthemen', 'heute journal', 'heute-journal', 'heute!', 'heute 19', 'heute 17', 'heute xpress',
    'heute in europa', 'heute in deutschland', 'nachrichten', 'zdfheute', 'politik', 'bericht aus berlin',
    'berlin direkt', 'report mainz', 'report münchen', 'monitor', 'panorama!', 'frontal', 'kontraste', 'fakt!',
    'presseclub', 'maischberger', 'hart aber fair', 'maybrit illner', 'markus lanz', 'anne will', 'caren miosga',
    'phoenix', 'wahl!', 'wahlen', 'wahlkampf', 'wahlabend', 'bundestag', 'landtag', 'abendschau', 'aktuell', 'journal', 'nachtmagazin', 'morgenmagazin',
    'mittagsmagazin', 'weltspiegel', 'auslandsjournal', 'brennpunkt', 'zdf spezial', 'ard extra', 'ard-extra',
    'wetter', 'rbb24', 'hessenschau', 'lokalzeit', 'landesschau', 'aktuelle stunde', 'buten un binnen',
    'sachsenspiegel', 'thüringen journal', 'sachsen-anhalt heute', 'mdr um', 'hallo niedersachsen',
    'schleswig-holstein magazin', 'nordmagazin', 'hamburg journal', 'niedersachsen 18', 'sr aktuell', 'aktueller bericht',
    'swr aktuell', 'br24', 'rundschau', 'frankenschau', 'abendschau', 'regionalnachrichten', 'zur sache',
    'europamagazin', 'bericht aus brüssel', 'pressekonferenz', 'bundespressekonferenz', 'regierungserklärung',
    'debatte', 'interview', 'unter den linden', 'phoenix runde', 'phoenix vor ort', 'tagesgespräch', 'ukraine',
    'nahost', 'israel', 'gaza', 'russland', 'usa!', 'trump', 'europawahl', 'bundestagswahl', 'landtagswahl',
    'zdf-morgenmagazin', 'moma', 'tagesschau24', 'ndr info', 'wdr aktuell', 'swr landesschau', 'heute-show!',
    'saarlandwetter', 'sr info', 'berichte vom tage', 'der tag in berlin', 'maintower', 'nordschau', 'schleswig-holstein 18', 'zapp!', 'kontrovers', 'daten der woche', 'ard sondersendung', 'wirtschaft', 'makro!', 'länderspiegel', 'info und gesellschaft', 'info et société',
    'politix', 'politbarometer', 'standpunkte', 'was nun'
  ],
  gesellschaft: [
    'gesellschaft', 'leben!', 'menschen', 'familie', 'religion', 'kirche', 'gottesdienst', 'glaube',
    'mensch!', 'alltag', 'sozial', 'lebensart', 'landleben', 'heimat', 'bauern', 'jugend', 'generation',
    'beruf', 'frauen', 'männer', 'kinder in', 'eltern', 'senioren', 'migration',
    'integration', 'rassismus', 'gerechtigkeit', 'armut', 'reichtum', 'wohnen', 'dorf', 'nachbarn',
    'mein land', 'hier und heute', 'mdr zeitreise', 'echtes leben', 'gott und die welt', 'wort zum sonntag',
    'sonntags', 'kirche in', 'evangelisch', 'katholisch', 'islam', 'judentum', 'philosophie', 'sternstunde',
    'precht', 'ethik', 'feminismus', 'queer', 'lgbt', 'die ard-themenwoche', 'themenwoche',
    'wir im saarland', 'hallo deutschland', 'hallo hessen', 'wir in bayern', 'swr1 leute', 'aus christlicher sicht', 'das! rote sofa', 'unser land!', 'schwaben + altbayern', 'liebesg', 'forum am freitag', 'peter voß', 'dinner für zwei', 'stöckl',
    'rund um den michel', 'alpha-forum', 'frau tv', 'unbubble', 'am puls'
  ],
  ratgeber: [],
  kinder: [
    'kika', 'logo!', 'die sendung mit der maus', 'sendung mit der maus', 'maus!', 'sandmann',
    'sesamstraße', 'löwenzahn', 'checker', 'pur+', 'wissen macht ah', 'tigerenten', 'tivi', 'zdftivi',
    '1, 2 oder 3', 'schloss einstein', 'pfefferkörner', 'knietzsche', 'schmatzo', 'siebenstein', 'bibi',
    'benjamin blümchen', 'wickie', 'biene maja', 'peppa', 'kikaninchen', 'baumhaus', 'sendung mit dem elefanten',
    'neuneinhalb', 'kakadu', 'pippi', 'pumuckl', 'die maus', 'die abenteuer', 'trickfilm', 'zeichentrick',
    'anna und die', 'willi wills wissen', 'erde an zukunft', 'erklärt', 'kindernachrichten', 'kinderfilm',
    'märchen', 'teens', 'abitur', 'planet schule', 'schulfernsehen',
    'kinder!', 'kinderfilm', 'kinderserie', 'kinderprogramm', 'kinderkurzfilm', 'kindermagazin', 'schule!', 'sandmännchen', 'unser sandmännchen', 'junior'
  ],
  sport: [
    'sport', 'sportschau', 'sportstudio', 'fußball', 'bundesliga', 'champions league', 'dfb-pokal', 'em!', 'wm!',
    'olympia', 'olympische', 'tennis', 'handball', 'basketball', 'eishockey', 'biathlon', 'ski!', 'skispringen',
    'ski alpin', 'langlauf', 'leichtathletik', 'formel', 'radsport', 'tour de france', 'boxen', 'schwimmen',
    'golf!', 'volleyball', 'darts', 'rodeln', 'bob!', 'sportclub', 'sport im osten', 'sport inside', 'sportplatz',
    'abpfiff', 'fifa', 'uefa', 'dfb', 'länderspiel', 'pokal', 'finale', 'halbfinale', 'liga', 'highlights',
    'zusammenfassung', 'paralympics', 'turnen', 'reiten', 'segeln', 'rudern', 'kanu', 'triathlon', 'marathon',
    'motorsport', 'dtm', 'snooker', 'tischtennis', 'hockey', 'american football', 'nfl',
    'die finals'
  ]
};

/**
 * Begriffe, die nur im Namen der Sendung zählen (Thema oder Serienname aus dem Titel), nicht im Titel einer Folge:
 * allgemeine Wörter („Krimi“, „Mord“, „Garten“, „Krieg“) und Namen von Sendereihen. Im Titel einer Folge sind sie
 * meist Zufall: „Sieg nach Elfmeter-Krimi“, „Ende dieses Krieges“, „Der stille Garten“.
 */
const NUR_IM_THEMA: Partial<Record<Exclude<GenreId, 'sonstiges'>, string[]>> = {
  krimi: [
    'tatort', 'polizeiruf', 'soko', 'krimi', 'kommissar', 'mord', 'ermittl', 'thriller', 'detektiv', 'der alte!',
    'die rosenheim-cops', 'rosenheim-cops', 'großstadtrevier', 'wapo', 'wilsberg', 'hubert und staller',
    'hubert ohne staller', 'ein starkes team', 'der staatsanwalt', 'bella block', 'nord bei nordwest',
    'der usedom-krimi', 'die toten vom', 'kripo', 'true crime', 'crime', 'verbrechen', 'täter', 'fahndung',
    'aktenzeichen xy', 'notruf hafenkante', 'heldt', 'morden im norden', 'der kriminalist', 'sherlock',
    'kommissarin', 'inspector', 'spreewaldkrimi', 'erzgebirgskrimi', 'harz-krimi', 'der bulle von tölz', 'sokos',
    'die chefin', 'der zürich-krimi', 'der kroatien-krimi', 'kommissar dupin', 'kommissarin lund', 'nachtschicht',
    'death in paradise', 'the rookie', 'harry wild', 'der letzte zeuge', 'letzte spur', 'ein fall für zwei',
    'detective', 'mörder', 'murder', 'helen dorn', 'dan sommerdahl', 'bron!', 'die brücke', 'racko',
    'belfort und lupin', 'mord mit aussicht', 'die füchsin', 'der kommissar und', 'kommissar rex', 'kommissar wallander',
    'wallander', 'der irland-krimi', 'der usedom', 'steirerkrimi', 'kluftinger', 'der bozen-krimi', 'der kroatien',
    'der barcelona-krimi', 'der lissabon-krimi', 'der tel-aviv-krimi', 'der masuren-krimi', 'die chefin', 'kripo holstein',
    'agatha christie', 'miss marple', 'poirot', 'inspector barnaby', 'vera!', 'shetland', 'line of duty', 'sløborn',
    'ridley!'
  ],
  ratgeber: [
    'ratgeber', 'verbraucher', 'markt!', 'marktcheck', 'plusminus', 'wiso', 'servicezeit', 'kochen',
    'rezept', 'lecker', 'küche', 'garten', 'gesundheit', 'visite', 'praxis!', 'doc fischer', 'hauptsache gesund',
    'volle kanne', 'kaffee oder tee', 'live nach neun', 'die ratgeber', 'haushalt', 'einfach genial', 'buffet',
    'bauen', 'geld!', 'finanz', 'recht!', 'reparatur', 'test!', 'tests', 'marktcheck', 'servicezeit',
    'mdr garten', 'grünzeug', 'abenteuer diagnose', 'die ernährungs-docs', 'diät', 'fitness', 'sprechstunde',
    'tipps', 'so geht', 'genial einfach', 'heimwerk', 'vorsorge', 'versicherung', 'steuer', 'rente', 'auto!',
    'mobilität', 'kaum zu glauben', 'marktplatz', 'die tricks', 'der vorkoster',
    'mex!', 'mit herz am herd', 'flohmarkt', 'schau hin', 'besseresser', 'esskulturen', 'kulinarik', 'essen und trinken',
    'querbeet', 'freizeit', 'lohnt sich das', 'schnittgut', 'room tour', 'ökochecker',
    'aktiv und gesund', 'hessen à la carte', 'genuss mit zukunft', 'landfrauenküche', 'kochs anders', 'tele-gym',
    'schrebergarten', 'made in südwest', 'mehr/wert', 'service!', 'landgasthäuser', 'iss besser', 'einfach & köstlich',
    'kochstories', 'aufgegabelt'
  ],
  geschichte: [
    'krieg!', 'kriege!', 'kaiser', 'könig', 'damals', 'jahrhundert', 'wende!', 'chronik', 'ritter', 'revolution',
    'imperium', 'dynastie', 'adel', 'monarchie', 'diesseits und jenseits der zonengrenze', 'ich trage einen großen namen',
    'schicksalsjahre', 'sophie scholl', '#onthisday'
  ],
  doku: [
    'mittendrin', 'bergmenschen', 'traumhäuser', 'feuer & flamme', 'die tierärzte', 'follow me.reports', 'exactly',
    '7 tage', 'tru doku', 'weltbilder', 'die nordreportage', 'der biograph'
  ],
  wissen: [
    'seehund, puma', 'leopard, seebär', 'tiger & co', 'mrwissen2go', 'ard alpha uni', 'weißt du das', 'psychologeek', 'campus magazin'
  ],
  reise: ['wunderschön!', '#hinreisend', 'meine traumreise', 'biwak', 'verrückt nach meer', 'maretv', 'nah und fern'],
  kultur: [
    'bigband', 'wirtshausmusikanten', 'startrampe', "zsammg'spuit", 'swr classic', 'kinokino', 'unicato', 'chat with a dj'
  ],
  comedy: [
    'phil laude', 'datteltäter', 'mainz bleibt mainz', 'alfons und gäste', 'freitagscomedy', 'michl müller',
    'hannes und der bürgermeister'
  ],
  unterhaltung: ['das schaffst du nie', 'strassenstars', 'chez krömer', 'lotto!', 'hessenquiz', 'krause kommt'],
  gesellschaft: [
    'brisant', 'wims!', 'treffpunkt!', 'die frage!', "ich mach's", 'unserding', 'sehen statt hören', 'luzyca',
    'auf klo', 'de noorden op platt', 'offen un', 'zur person', '#einmomentderbleibt', 'wuhladko', 'schwaben & altbayern',
    'respekt!', 'verurteilt!', 'weinkönigin', 'zeit und ewigkeit', 'glaubwürdig', 'zibb!', 'das!'
  ],
  nachrichten: ['swr extra', 'die da oben', 'saarthema', 'saartalk', 'umschau!', 'klartext!', 'im blickpunkt'],
  sport: [
    'dein vfb', 'dein scf', 'dein fck', 'dein fsv', 'heimspiel!', 'fussball', 'nations league', 'sailgp', 'manu thiele'
  ],
  kinder: ['pip und posy', 'maulwurf moley', 'rudis rasselbande', 'rabbit academy', 'animanimals', 'shaun das schaf'],
  serie: ['druck!']
};

/** Website-Pfade bei ZDF, 3sat und zdfheute */
const PFADE: [RegExp, GenreId[]][] = [
  [/^\/(video\/)?dokus?\b|^\/dokumentation\b/, ['doku']],
  [/^\/nachrichten\b|^\/politik\b|^\/wirtschaft\b|^\/video\/(nachrichten|politik)\b/, ['nachrichten']],
  [/^\/kinder\b|^\/video\/kinder\b|^\/zdftivi\b/, ['kinder']],
  [/^\/sport\b|^\/video\/sport\b/, ['sport']],
  [/^\/kultur\b|^\/video\/kultur\b/, ['kultur']],
  [/^\/wissen\b|^\/video\/wissen\b/, ['wissen']],
  [/^\/gesellschaft\b/, ['gesellschaft']],
  [/^\/comedy\b|^\/satire\b|^\/video\/(comedy|show)\b/, ['comedy']],
  [/^\/(video\/)?serien\b/, ['serie']],
  [/^\/(video\/)?filme?\b/, ['film']],
  [/^\/verbraucher\b|^\/ratgeber\b|^\/video\/ratgeber\b/, ['ratgeber']],
  [/^\/show\b|^\/video\/shows?\b/, ['unterhaltung']]
];

/** Quelle in der Adresse der ARD-Mediathek („crid://sportschau.de/…“, base64 im letzten Pfadteil) */
const ARD_QUELLEN: Record<string, GenreId[]> = {
  'sportschau.de': ['sport'],
  'tagesschau.de': ['nachrichten']
};

/** Haus der ARD-Adresse oder null: https://www.ardmediathek.de/video/<…>/Y3JpZDovL3Nwb3J0c2NoYXUuZGUv… */
export function ardQuelle(website: string): string | null {
  const m = /^https?:\/\/(?:www\.)?ardmediathek\.de\/video\/(?:.*\/)?([A-Za-z0-9_-]{16,})\/?$/.exec(website);
  if (!m) return null;
  try {
    const text = Buffer.from(m[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
    return /^crid:\/\/([^/]+)/.exec(text)?.[1].toLowerCase() ?? null;
  } catch {
    return null;
  }
}

/** Themen, die genau so heißen (Kleinschreibung) */
const THEMA_EXAKT: Record<string, GenreId[]> = {
  film: ['film'],
  filme: ['film'],
  spielfilm: ['film'],
  spielfilme: ['film'],
  fernsehfilm: ['film'],
  fernsehfilme: ['film'],
  kino: ['film'],
  'filme im zdf': ['film'],
  serien: ['serie'],
  serie: ['serie'],
  dave: ['serie'],
  quer: ['comedy']
};

/** Sender, deren Programm ein Genre vorgibt */
const SENDER: Record<string, GenreId[]> = {
  'ZDF-tivi': ['kinder'],
  tagesschau24: ['nachrichten'],
  'ARD-alpha': ['wissen']
};

/** Sammelthemen mit kurzen Regionalbeiträgen (SR „Beiträge“, BR „BR“): unter 10 Minuten sind das Nachrichten */
const REGIONAL_KURZ = new Set(['beiträge', 'br', 'sr', 'sr 3 videos']);

interface Regel {
  genre: GenreId;
  re: RegExp;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ein großer regulärer Ausdruck je Genre; Wortgrenzen über Unicode-Buchstaben, damit auch Umlaute passen. */
function regeln(quelle: Partial<Record<GenreId, string[]>>): Regel[] {
  return (Object.entries(quelle) as [GenreId, string[]][])
    .filter(([, begriffe]) => begriffe.length > 0)
    .map(([genre, begriffe]) => {
      const teile = begriffe.map((b) => (b.endsWith('!') ? `${escape(b.slice(0, -1))}(?![\\p{L}\\p{N}])` : escape(b)));
      return { genre, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${teile.join('|')})`, 'iu') };
    });
}

const REGELN = regeln(BEGRIFFE);
const THEMA_REGELN = regeln(NUR_IM_THEMA);
const KRIMI_THEMA = THEMA_REGELN.find((r) => r.genre === 'krimi');

export interface GenreQuelle {
  sender: string;
  thema: string;
  titel: string;
  website: string;
  dauer: number;
  /** Anfang der Beschreibung genügt („Fernsehfilm Deutschland 2021 …“) */
  beschreibung?: string;
}

/** Genres, deren Begriffe nur im Thema zählen (im Titel zu viele Zufallstreffer, z. B. Ortsnamen in Nachrichten) */
const NUR_THEMA = new Set<GenreId>(['reise']);

/** Hat eine Sendung eines dieser Genres, macht eine Folgen-Kennung „(S01/E05)“ sie nicht zur Serie */
const KEINE_SERIE = new Set<GenreId>(['doku', 'nachrichten', 'sport', 'kultur', 'wissen', 'ratgeber', 'geschichte', 'comedy', 'gesellschaft', 'reise', 'unterhaltung']);

const SPIELFILM_IM_TITEL = /\s[-–]\s(spielfilm|fernsehfilm|kinofilm|dokumentarfilm)\b/i;
const KRIMI_IM_TITEL = /\s[-–]\s(krimi|kriminalfilm|thriller)\b|\b(krimi|kriminalfilm|thriller),\s/i;
const DOKUMENTARFILM = /dokumentarfilm/i;

/** Formatangabe am Anfang der Beschreibung („Spielfilm Deutschland 2021“, „Doku-Serie“, „Reportage“) */
function ausBeschreibung(beschreibung: string): GenreId[] {
  const anfang = beschreibung.slice(0, 40).toLowerCase();
  if (/^(dokumentarfilm|dokumentation|doku-?serie|dokureihe|reportage)\b/.test(anfang)) return ['doku'];
  if (/^(krimi|kriminalfilm|thriller)\b/.test(anfang)) return ['krimi'];
  if (/^(spielfilm|fernsehfilm|kinofilm)\b/.test(anfang)) return ['film'];
  return [];
}

export function bestimmeGenres(e: GenreQuelle): GenreId[] {
  const genres = new Set<GenreId>(SENDER[e.sender] ?? []);
  const thema = e.thema.trim().toLowerCase();
  for (const g of THEMA_EXAKT[thema] ?? []) genres.add(g);

  if (/^https?:\/\/(www\.)?(zdf|3sat|zdfheute)\.de\//.test(e.website)) {
    const pfad = e.website.replace(/^https?:\/\/[^/]+/, '').toLowerCase();
    for (const [re, g] of PFADE) if (re.test(pfad)) g.forEach((x) => genres.add(x));
  }
  const ard = ardQuelle(e.website);
  if (ard) for (const g of ARD_QUELLEN[ard] ?? []) genres.add(g);

  // Name der Sendung: das Thema und bei Rubriken der Serienname aus dem Titel („Ridley - Staffel 1 (2/6)“)
  const name = `${e.thema} | ${serieAusTitel(e.titel)?.name ?? ''}`;
  const text = `${e.thema} | ${e.titel}`;
  for (const r of REGELN) {
    if (r.re.test(NUR_THEMA.has(r.genre) ? e.thema : text)) genres.add(r.genre);
  }
  for (const r of THEMA_REGELN) if (r.re.test(name)) genres.add(r.genre);

  // Formatangaben: „- Spielfilm, USA 1993“ im Titel (3sat, Arte), „Fernsehfilm Deutschland 2021“ in der Beschreibung
  if (SPIELFILM_IM_TITEL.test(e.titel)) genres.add(DOKUMENTARFILM.test(e.titel) ? 'doku' : 'film');
  if (KRIMI_IM_TITEL.test(e.titel)) genres.add('krimi');
  for (const g of ausBeschreibung(e.beschreibung ?? '')) genres.add(g);
  // Bei Spielfilmen sagt der Titel etwas über das Genre („Mordnacht - Fernsehfilm“, „Der Novembermörder“)
  if (genres.has('film') && e.dauer >= 60 * 60 && KRIMI_THEMA?.re.test(e.titel)) genres.add('krimi');
  // Dokumentarfilme sind keine Spielfilme, auch wenn 3sat sie unter /film/ führt
  if (DOKUMENTARFILM.test(`${e.thema} ${e.titel}`)) {
    genres.delete('film');
    genres.add('doku');
  }
  // Kurze Regionalbeiträge in Sammelthemen (SR „Beiträge“, BR „BR“)
  if (genres.size === 0 && REGIONAL_KURZ.has(thema) && e.dauer > 0 && e.dauer < 10 * 60) genres.add('nachrichten');

  // Ortsnamen im Thema machen einen Krimi nicht zur Reise („Die Toten vom Bodensee“)
  if (genres.has('reise') && (genres.has('krimi') || genres.has('film') || genres.has('serie'))) genres.delete('reise');
  // Folgen-Kennung „(S01/E17)“ = Serie, außer bei Dokureihen und Nachrichten
  if (/\(S\d{1,2}\/E\d+\)/.test(e.titel) && ![...genres].some((x) => KEINE_SERIE.has(x))) genres.add('serie');

  // Arte-Rubrik „Fernsehfilme und Serien - Serien“: Serie, kein Spielfilm
  if (/fernsehfilme und serien\s*[-–]\s*serien/i.test(e.thema)) {
    genres.delete('film');
    genres.add('serie');
  }

  // Kein Spielfilm: kurze Beiträge (außer Kurzfilmen) und Arte-Sendungen „rund um den Film“ (Porträts, Making-of).
  // Was dann übrig bleibt, ist ein Beitrag über Filme (kinokino, unicato): Kultur
  if (genres.has('film') && e.dauer > 0 && e.dauer < 50 * 60 && !/kurzfilm/i.test(text)) {
    genres.delete('film');
    if (genres.size === 0) genres.add('kultur');
  }
  // Arte „Kino - …“: nur „Filme“ und „Kurzfilme“ sind Filme, der Rest ist Kino-Kultur (Porträts, Festivals)
  if (/rund um den film/i.test(e.thema) || (e.sender.startsWith('ARTE') && /^kino\s*[-–]/i.test(e.thema) && !/[-–]\s*(kurz)?filme\s*$/i.test(e.thema))) {
    genres.delete('film');
    genres.add('kultur');
  }

  // Ausschlüsse: Ein Spielbericht ist kein Krimi, eine Doku über einen Mordfall auch nicht (True Crime ist ein Thema);
  // ein kurzer Nachrichtenbeitrag über einen Krieg ist keine Geschichte
  if (genres.has('krimi') && (genres.has('sport') || genres.has('nachrichten') || genres.has('doku'))) genres.delete('krimi');
  // (Archivclips aus „Retro“-Reihen bleiben Geschichte)
  if (genres.has('geschichte') && genres.has('nachrichten') && e.dauer > 0 && e.dauer < 10 * 60 && !/retro/i.test(e.thema)) genres.delete('geschichte');

  if (genres.size === 0) genres.add('sonstiges');
  return [...genres];
}
