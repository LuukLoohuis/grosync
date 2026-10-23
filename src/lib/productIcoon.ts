import { countParts } from '@/lib/itemCount';


/**
 * Een pictogram per boodschap: 🍌 bij bananen. De volgorde telt: specifieke
 * woorden ("pindakaas", "kokosmelk") staan voor de algemene ("kaas", "melk").
 */
const PRODUCTEN: [RegExp, string][] = [
  [/tandenborstel|tandpasta/, '🪥'],
  [/pinda ?kaas/, '🥜'],
  [/kokos/, '🥥'],
  [/hagelslag|chocola|cacao|nutella/, '🍫'],
  [/diepvries|ijsje|\bijs\b|ijsblok/, '🧊'],
  [/banaan|bananen/, '🍌'],
  [/appelsap|jus d|sinaasappelsap|\bsap\b|smoothie/, '🧃'],
  [/appel(?!moes)/, '🍎'],
  [/peer|peren/, '🍐'],
  [/mandarijn|sinaasappel|clementine/, '🍊'],
  [/citroen|limoen/, '🍋'],
  [/meloen|watermeloen/, '🍉'],
  [/druif|druiven/, '🍇'],
  [/aardbei/, '🍓'],
  [/blauwe bes|bosbes/, '🫐'],
  [/kers(en)?\b/, '🍒'],
  [/perzik|nectarine/, '🍑'],
  [/mango/, '🥭'],
  [/ananas/, '🍍'],
  [/kiwi/, '🥝'],
  [/avocado/, '🥑'],
  [/saus|passata|pesto|tomatenblokjes|tomatenpuree/, '🥫'],
  [/tomaat|tomaten/, '🍅'],
  [/aubergine/, '🍆'],
  [/broccoli|bloemkool/, '🥦'],
  [/sla\b|salade|spinazie|andijvie|rucola|kool\b|boerenkool|prei/, '🥬'],
  [/komkommer|courgette|augurk/, '🥒'],
  [/paprika/, '🫑'],
  [/peper|chili|jalape/, '🌶️'],
  [/mais|maïs/, '🌽'],
  [/wortel|peen/, '🥕'],
  [/knoflook/, '🧄'],
  [/\bui\b|uien|sjalot/, '🧅'],
  [/zoete aardappel/, '🍠'],
  [/aardappel|krieler|friet|patat/, '🥔'],
  [/champignon|paddenstoel|zwam|shiitake|portobello|cantharel|eekhoorntjesbrood/, '🍄'],
  [/croissant/, '🥐'],
  [/stokbrood|baguette/, '🥖'],
  [/brood|boterham|pistolet|bolletje|beschuit/, '🍞'],
  [/pannenkoek|poffertje/, '🥞'],
  [/kaas|parmezaan|parmigiano|gran padano|pecorino|gorgonzola|fontina|mozzarella|burrata|ricotta|mascarpone|feta|halloumi|brie|camembert|gouda|cheddar|emmentaler|gruy[eè]re|manchego|taleggio/, '🧀'],
  [/\bei\b|eieren/, '🥚'],
  [/boter|margarine/, '🧈'],
  [/yoghurt|kwark|vla|melk|karnemelk|room\b|slagroom/, '🥛'],
  [/spek|bacon|prosciutto|parmaham|serrano|pancetta|coppa|bresaola/, '🥓'],
  [/mortadella|salami|chorizo|rosbief|pastrami|rookvlees|fricandeau|leverworst|paté/, '🍖'],
  [/kip|kalkoen/, '🍗'],
  [/gehakt|biefstuk|steak|rund|varken|lam\b|vlees/, '🥩'],
  [/worst|frikandel|knakworst/, '🌭'],
  [/hamburger|burger/, '🍔'],
  [/garnaal|garnalen|scampi/, '🦐'],
  [/zalm|tonijn|kabeljauw|\bvis\b|haring|makreel|vissticks?/, '🐟'],
  [/sushi/, '🍣'],
  [/pizza/, '🍕'],
  [/wrap|taco|tortilla/, '🌮'],
  [/pasta|spaghetti|penne|macaroni|lasagne|tagliatelle/, '🍝'],
  [/noedel|noodle|\bmie\b|bami/, '🍜'],
  [/rijst|nasi|sushirijst/, '🍚'],
  [/soep|bouillon/, '🍲'],
  [/curry/, '🍛'],
  [/koekje|koek\b|koeken|biscuit|stroopwafel/, '🍪'],
  [/snoep|drop|winegum/, '🍬'],
  [/chips|popcorn/, '🍿'],
  [/noot|noten|pinda|cashew|amandel|walnoot/, '🥜'],
  [/honing/, '🍯'],
  [/zout/, '🧂'],
  [/koffie|espresso|cappuccino/, '☕'],
  [/thee\b|theezakjes/, '🍵'],
  [/bier|pils/, '🍺'],
  [/wijn|prosecco|cava/, '🍷'],
  [/cola|fris|limonade|ice ?tea|energy/, '🥤'],
  [/water/, '💧'],
  [/toiletpapier|wc-?papier|keukenpapier|keukenrol/, '🧻'],
  [/zeep|afwasmiddel|wasmiddel/, '🧼'],
  [/spons|sponzen/, '🧽'],
  [/shampoo|douchegel|conditioner|bodylotion|zonnebrand|deodorant/, '🧴'],
  [/kaars|theelicht/, '🕯️'],
  [/batterij/, '🔋'],
  [/paracetamol|ibuprofen|vitamine|pleister/, '💊'],
  [/luier/, '👶'],
  [/kattenvoer|kattenbak/, '🐈'],
  [/hondenvoer/, '🐕'],
  [/bloemen|tulpen|rozen/, '💐'],
];

/**
 * Het pictogram, of null als we het product niet kennen. Dan liever een
 * letter (zie ItemThumb) dan een plaatje dat iets anders zegt dan er staat.
 */
export const productIcoon = (naam: string): string | null => {
  const kaal = countParts(naam).rest.toLocaleLowerCase('nl');
  return PRODUCTEN.find(([patroon]) => patroon.test(kaal))?.[1] ?? null;
};

/** De eerste letter van de naam, zonder aantal: "2 Gran padano" → "G". */
export const beginletter = (naam: string): string => {
  const letter = countParts(naam).rest.match(/\p{L}/u)?.[0] ?? '?';
  return letter.toLocaleUpperCase('nl');
};
