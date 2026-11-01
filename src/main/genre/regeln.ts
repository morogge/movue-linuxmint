import type { GenreId } from '@shared/genres';

/**
 * Leitet Genres aus den Feldern der Filmliste ab. Reihenfolge der Quellen:
 *  1. Sender (z. B. ZDFtivi → Kinder)
 *  2. Website-Pfad bei ZDF und 3sat (/dokumentation/, /kinder/ …)
 *  3. Begriffe in Thema und Titel (bekannte Reihen und Schlüsselwörter)
 * Was nichts trifft, landet in „Weitere Sendungen“.
 *
 * Neue Reihen oder Korrekturen: in BEGRIFFE ergänzen und mit `npx vitest run --config vitest.echt.config.ts`
 * gegen die echte Liste prüfen (zeigt Abdeckung und die häufigsten nicht zugeordneten Themen).
 */

/**
 * Begriffe je Genre. Treffer am Wortanfang („doku“ trifft „Dokumentation“).
 * Ein „!“ am Ende verlangt das ganze Wort („heute!“ trifft nicht „heutige“).
 */
const BEGRIFFE: Record<Exclude<GenreId, 'sonstiges'>, string[]> = {
  krimi: [
    'tatort', 'polizeiruf', 'soko', 'krimi', 'kommissar', 'mord', 'ermittl', 'thriller', 'detektiv', 'der alte!',
    'die rosenheim-cops', 'rosenheim-cops', 'großstadtrevier', 'wapo', 'wilsberg', 'hubert und staller',
    'hubert ohne staller', 'ein starkes team', 'der staatsanwalt', 'bella block', 'nord bei nordwest',
    'der usedom-krimi', 'die toten vom', 'kripo', 'true crime', 'crime', 'verbrechen', 'täter', 'fahndung',
    'aktenzeichen xy', 'notruf hafenkante', 'heldt', 'morden im norden', 'der kriminalist', 'sherlock',
    'kommissarin', 'inspector', 'spreewaldkrimi', 'erzgebirgskrimi', 'harz-krimi', 'der bulle von tölz', 'sokos',
    'die chefin', 'der zürich-krimi', 'der kroatien-krimi', 'kommissar dupin', 'kommissarin lund', 'nachtschicht'
  ],
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
    'geschichte', 'history', 'weltkrieg', 'krieg!', 'kriege', 'mittelalter', 'antike', 'römer',
    'preußen', 'ddr!', 'nazi', 'hitler', 'kaiser', 'könig', 'zeitgeschichte', 'damals', 'jahrhundert', 'mauerfall',
    'wende!', 'holocaust', 'ns-', 'dritte reich', 'stasi', 'zeitzeugen', 'chronik', 'archäologie', 'pharao',
    'wikinger', 'kelten', 'germanen', 'ritter', 'revolution', 'imperium', 'dynastie', 'adel', 'monarchie',
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
    'brettl-spitzen', 'world wide wohnzimmer', 'quer!', 'happy hour', 'pufpaff', 'schlachthof', 'pratersterne', 'vereinsheim schwabing', 'asül', 'schleichfernsehen', 'tafelrunde', 'noch nicht schicht', 'pelzig', 'karlsplatz', 'bosetti', 'till reiners', 'was gibt es neues', '3satfestival',
    'walulis', 'nockherberg'
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
    'phoenix', 'wahl', 'bundestag', 'landtag', 'abendschau', 'aktuell', 'journal', 'nachtmagazin', 'morgenmagazin',
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
  ratgeber: [
    'ratgeber', 'verbraucher', 'markt!', 'marktcheck', 'plusminus', 'wiso', 'servicezeit', 'kochen',
    'rezept', 'lecker', 'küche', 'garten', 'gesundheit', 'visite', 'praxis!', 'doc fischer', 'hauptsache gesund',
    'volle kanne', 'kaffee oder tee', 'live nach neun', 'die ratgeber', 'haushalt', 'einfach genial', 'buffet',
    'bauen', 'geld!', 'finanz', 'recht!', 'reparatur', 'test!', 'tests', 'marktcheck', 'servicezeit',
    'mdr garten', 'grünzeug', 'abenteuer diagnose', 'die ernährungs-docs', 'diät', 'fitness', 'sprechstunde',
    'tipps', 'so geht', 'genial einfach', 'heimwerk', 'vorsorge', 'versicherung', 'steuer', 'rente', 'auto!',
    'mobilität', 'mittagsmagazin', 'brisant', 'kaum zu glauben', 'marktplatz', 'die tricks', 'der vorkoster',
    'mex!', 'mit herz am herd', 'flohmarkt', 'schau hin', 'besseresser', 'esskulturen', 'kulinarik', 'essen und trinken',
    'querbeet', 'freizeit', 'lohnt sich das', 'schnittgut', 'room tour', 'ökochecker'
  ],
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

/** Website-Pfade bei ZDF und 3sat */
const PFADE: [RegExp, GenreId[]][] = [
  [/^\/(video\/)?dokus?\b|^\/dokumentation\b/, ['doku']],
  [/^\/nachrichten\b|^\/politik\b|^\/video\/(nachrichten|politik)\b/, ['nachrichten']],
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
  dave: ['serie']
};

/** Sender, deren Programm ein Genre vorgibt */
const SENDER: Record<string, GenreId[]> = {
  'ZDF-tivi': ['kinder'],
  tagesschau24: ['nachrichten'],
  'ARD-alpha': ['wissen']
};

interface Regel {
  genre: GenreId;
  re: RegExp;
}

function escape(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Ein großer regulärer Ausdruck je Genre; Wortgrenzen über Unicode-Buchstaben, damit auch Umlaute passen. */
const REGELN: Regel[] = (Object.entries(BEGRIFFE) as [GenreId, string[]][]).map(([genre, begriffe]) => {
  const teile = begriffe.map((b) => (b.endsWith('!') ? `${escape(b.slice(0, -1))}(?![\\p{L}\\p{N}])` : escape(b)));
  return { genre, re: new RegExp(`(?<![\\p{L}\\p{N}])(?:${teile.join('|')})`, 'iu') };
});

export interface GenreQuelle {
  sender: string;
  thema: string;
  titel: string;
  website: string;
  dauer: number;
}

/** Genres, deren Begriffe nur im Thema zählen (im Titel zu viele Zufallstreffer, z. B. Ortsnamen in Nachrichten) */
const NUR_THEMA = new Set<GenreId>(['reise']);

/** Hat eine Sendung eines dieser Genres, macht eine Folgen-Kennung „(S01/E05)“ sie nicht zur Serie */
const KEINE_SERIE = new Set<GenreId>(['doku', 'nachrichten', 'sport', 'kultur', 'wissen', 'ratgeber', 'geschichte', 'comedy', 'gesellschaft', 'reise', 'unterhaltung']);

const SPIELFILM_IM_TITEL = /\s[-–]\s(spielfilm|fernsehfilm|kinofilm|dokumentarfilm)\b/i;

export function bestimmeGenres(e: GenreQuelle): GenreId[] {
  const genres = new Set<GenreId>(SENDER[e.sender] ?? []);
  for (const g of THEMA_EXAKT[e.thema.trim().toLowerCase()] ?? []) genres.add(g);

  if (/^https?:\/\/(www\.)?(zdf|3sat)\.de\//.test(e.website)) {
    const pfad = e.website.replace(/^https?:\/\/[^/]+/, '').toLowerCase();
    for (const [re, g] of PFADE) if (re.test(pfad)) g.forEach((x) => genres.add(x));
  }

  const text = `${e.thema} | ${e.titel}`;
  for (const r of REGELN) {
    if (r.re.test(NUR_THEMA.has(r.genre) ? e.thema : text)) genres.add(r.genre);
  }

  // „- Spielfilm, USA 1993“ im Titel (3sat, Arte) und lange Einzelsendungen ohne Reihe
  if (SPIELFILM_IM_TITEL.test(e.titel)) genres.add(/dokumentarfilm/i.test(e.titel) ? 'doku' : 'film');
  // Folgen-Kennung „(S01/E17)“ = Serie, außer bei Dokureihen und Nachrichten
  if (/\(S\d{1,2}\/E\d+\)/.test(e.titel) && ![...genres].some((x) => KEINE_SERIE.has(x))) genres.add('serie');

  // Arte-Rubrik „Fernsehfilme und Serien - Serien“: Serie, kein Spielfilm
  if (/fernsehfilme und serien\s*[-–]\s*serien/i.test(e.thema)) {
    genres.delete('film');
    genres.add('serie');
  }

  if (genres.size === 0) genres.add('sonstiges');
  return [...genres];
}
