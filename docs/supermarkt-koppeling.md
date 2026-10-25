# Boodschappen koppelen aan producten van andere supermarkten

Sinds 3480f98 koppelt CoupleCart regels met winkel AH vanzelf aan een AH-product
(`src/hooks/useAhKoppeling.ts` → edge function `ah-products`, modus `alternativesFor`). Dit
document zoekt uit welke andere ketens hetzelfde kunnen: zonder inloggen zoeken op een woord en
per product titel, foto, prijs en een link terugkrijgen.

Getest op 24 oktober 2026 vanaf een Mac (Node 25, gewone `fetch`, browser-User-Agent) met
"passata", "gember", "Mutti passata" en "halfvolle melk". Niet getest vanaf de servers van
Supabase; zie [Risico's](#risicos).

## Samenvatting

| Keten | Haalbaar | Hoe | Inloggen | Velden | robots.txt | Oordeel |
| --- | --- | --- | --- | --- | --- | --- |
| **Jumbo** | ja | zoekpagina, server-gerenderd (Nuxt, `__NUXT_DATA__`) | nee | titel, foto, prijs, actieprijs, actie, maat, link | **verbiedt** de zoek-URL | technisch goed, juridisch grijs |
| **Dirk** | ja | zoekpagina, server-gerenderd (Nuxt) | nee | titel, foto, prijs, aanbieding, maat, link | staat het toe | beste kandidaat |
| **Hoogvliet** | ja | zoekpagina, server-gerenderd (Next, Magento + Tweakwise) | nee | titel, merk, foto, prijs, actie, maat, link | **verbiedt** `/search` | traag (2–3 s), grijs |
| **Plus** | met moeite | OutSystems `screenservices` POST | nee, wel sessie + CSRF | titel, merk, foto, prijs, actie, maat, slug | – | fragiel, niet doen |
| **Aldi** | beperkt | Algolia, publieke zoeksleutel | nee | titel, prijs, maat | – | assortiment online heel klein |
| **Vomar** | nee | zoekpagina | nee | titel, prijs, maat | – | zoekresultaten onbruikbaar |
| **Lidl** | nee | `/q/api/search` | nee | – | – | geen boodschappen online |
| **Picnic** | nee | app-API | ja, account | – | – | alleen met een eigen account |
| Checkjebon | als prijsbron | één JSON-bestand per dag | nee | naam, prijs, maat, link; **geen foto** | – | aanvulling, geen vervanging |

Advies: **Dirk** als eerste naast AH (geen bezwaar in robots.txt, snel, compleet). **Jumbo**
werkt even goed, maar Jumbo vraagt crawlers met zoveel woorden de zoekpagina niet te gebruiken;
dat is een keuze voor jou, zie [Jumbo](#jumbo). Hoogvliet kan later op dezelfde manier.

## Per keten

### Jumbo

- **Endpoint:** `GET https://www.jumbo.com/producten/?searchType=keyword&searchTerms=<zoekterm>`
  geeft HTML (≈ 770 kB) met `<script id="__NUXT_DATA__">`, Nuxt's payload in devalue-formaat
  (een platte array waarin objecten naar indexen verwijzen). Producten staan in
  `pinia.productStore.products` (12–25 per pagina).
- **Velden per product:** `id` (`"723887PAK"`, artikelnummer + verpakkingscode), `title`
  (`"Jumbo Tomaten Gezeefd Passata 500 g"`), `subtitle` (maat, soms `null`; dan staat de maat in
  de titel), `image` (360×360 png), `link` (`/producten/<slug>-<id>`), `price.price` en
  `price.promoPrice` in centen, `price.pricePerUnit`, `promotions[].tags[].text` (`"1+1 gratis"`),
  `availability.isAvailable`, `sponsored`, `category`.
- **Inloggen/token:** geen. Gewone browser-User-Agent volstaat.
- **Snelheid:** 450–760 ms.
- **De mobiele API is dicht:** `mobileapi.jumbo.com/v17/search` en `/v19/search` geven 404 met een
  Akamai-botscript. Oude scrapers die daarop leunen werken niet meer.
- **robots.txt:** `Disallow: /producten/*?searchType=keyword&searchTerms=` voor alle bots. Dat is
  geen wet, maar wel Jumbo's uitgesproken wens, en precies de URL die we zouden gebruiken.
  CoupleCart zoekt per regel die een gebruiker zelf toevoegt (geen crawler), maar het blijft een
  geautomatiseerde aanvraag vanaf onze server. Productpagina's (`/producten/<slug>`) mogen wel.
- **Kwaliteit:** "Mutti passata" geeft precies de Mutti-passata's; "gember" zet een gembershot
  bovenaan en de verse gember op plek 4, dus de keuze door het model (`sameIngredient`) blijft nodig.

### Dirk

- **Endpoint:** `GET https://www.dirk.nl/zoeken/producten/<zoekterm>` (de term in het pad;
  `?query=` werkt niet). HTML (≈ 600 kB) met `__NUXT_DATA__`; producten in `data["search-<term>"]`.
- **Velden:** `productId` (getal), `headerText` (titel), `brand`, `packaging` (`"680 g"`),
  `image` (`web-fileserver.dirk.nl`), `url` (`/boodschappen/<afdeling>/<groep>/<naam>/<id>`),
  `price.normalPrice`, `price.offerPrice`, `price.priceToShow`, `price.isOffer`, `department`,
  `webgroup`.
- **Link uit alleen het id:** `https://www.dirk.nl/boodschappen/x/x/x/<id>` werkt (200).
- **Inloggen/token:** geen. **robots.txt:** geen bezwaar.
- **Snelheid:** 170–290 ms.
- **Kwaliteit:** goed. "Mutti passata" geeft 0 resultaten: Dirk verkoopt geen Mutti. Dan valt de
  bestaande terugval in (zoeken op de basisterm "passata").
- Dirk is van Detailresult, net als DekaMarkt; DekaMarkt heeft vermoedelijk dezelfde opzet
  (niet getest).

### Hoogvliet

- **Endpoint:** `GET https://hoogvliet.nl/search/<zoekterm>` (www.hoogvliet.com stuurt door).
  HTML met `__NEXT_DATA__`; producten in `props.pageProps.fallbackData.items` (20 per pagina,
  Magento GraphQL-vorm, gesorteerd door Tweakwise).
- **Velden:** `sku`, `name`, `brand`, `small_image.url`, `url_key` (`product/<slug>-<sku>`),
  `price_range.minimum_price.final_price.value`, `is_promotion`, `discount_label`,
  `sub_title_attributes` (volume, eenheid, prijs per eenheid), `gtin13`.
- **Inloggen/token:** geen. **robots.txt:** `Disallow: /search`.
- **Snelheid:** 2,2–3,2 s, te traag om vaak te doen.
- **Kwaliteit:** de eerste treffer klopt; daarna vult Tweakwise aan met losse rommel
  ("passata" → rookworst, kruidenmix). Het model filtert dat weg.

### Plus

- De zoekpagina is een lege OutSystems-schil (5 kB). De resultaten komen van
  `POST https://www.plus.nl/screenservices/ECP_Composition_CW/ProductLists/PLP_Content/DataActionGetProductListAndCategoryInfo`.
- Het antwoord is prima (`SKU`, `Brand`, `Name`, `Product_Subtitle` `"Per 500 g"`, `Slug`,
  `ImageURL`, `OriginalPrice`, `NewPrice`, `PromotionLabel` `"1+1 GRATIS"`, start- en einddatum),
  maar zo'n aanvraag vraagt een sessiecookie, een CSRF-token en de `moduleVersion`/`apiVersion`
  van de huidige uitrol. Die veranderen bij elke release van plus.nl; een koppeling breekt dan
  zonder waarschuwing. Niet nagebouwd.
- Onder water zoekt Plus via Tweakwise (`tn_q=…` in de filter-URL's), net als Hoogvliet.

### Aldi

- `aldi.nl/zoeken.html?query=` laadt resultaten uit Algolia
  (`2hu29pf6bh-dsn.algolia.net`, met een publieke alleen-zoeken-sleutel in de pagina, zoals
  Algolia bedoeld is).
- Maar het online assortiment is klein: "passata" geeft één product (All Seasons Passata rustica,
  € 1,87, 690 g). Checkjebon heeft voor Aldi op dit moment 0 producten. Aldi NL heeft geen
  webshop voor boodschappen. Een koppeling zou meestal niets vinden; niet de moeite.

### Vomar

- `vomar.nl/zoeken?search=passata` toont resultaten, maar zonder samenhang: noedels, bobotie,
  ketjap, en ergens halverwege "G'woon Gezeefde Tomaten". Checkjebon kent 887 Vomar-producten.
  Onbruikbaar als zoekbron.

### Lidl

- `GET https://www.lidl.nl/q/api/search?q=<term>&locale=nl_NL&assortment=NL&version=2.1.0`
  antwoordt zonder sleutel, maar geeft voor elke zoekterm dezelfde 48 non-food-artikelen
  (matrassen, steps); hooguit een paar "Food"-folderartikelen. Lidl NL verkoopt geen boodschappen
  online. Bevestigd: niet te koppelen.
- Checkjebon haalt Lidl-prijzen van boodschaapje.nl, een derde partij.

### Picnic

- Geen webwinkel; alles gaat via de app, en die API vraagt een ingelogd account (de bekende
  open-source clients loggen in met e-mail en wachtwoord). Anoniem zoeken bestaat niet. Niet
  verder getest.

### Checkjebon (open prijsdata)

- `https://raw.githubusercontent.com/supermarkt/checkjebon/main/data/supermarkets.json`,
  MIT-licentie, elke ochtend vernieuwd (laatste commits 22 en 23 oktober 2026). Eén bestand van
  10 MB.
- Per keten: `n` (naam), `u` (basis-URL), en per product `n` (naam), `l` (linkdeel of id),
  `p` (prijs), `s` (maat). **Geen foto's, geen acties.**
- Aantallen nu: AH 16.173, Jumbo 17.081, Plus 16.129, Lidl 22.070 (via boodschaapje.nl),
  DekaMarkt 10.728, Dirk 7.438, Hoogvliet 7.410, Spar 7.248, Poiesz 1.682, Vomar 887,
  Aldi 0, Ekoplaza 0.
- Bruikbaar als **prijsvergelijker** (wat kost dit lijstje bij Plus of Lidl?) zonder bij die
  ketens zelf te zoeken: één keer per dag downloaden, in een tabel zetten, zelf doorzoeken.
  Niet als vervanging van de koppeling, want de lijst toont dan geen foto. Voor Plus en Lidl is
  het de enige stabiele bron.

## Risico's

- **Alles is onofficieel.** Geen van deze ketens heeft een publieke API. Ook de AH-koppeling
  gebruikt de anonieme flow van de Appie-app. Een nieuwe versie van een site kan de koppeling
  stilletjes breken; dan vindt de app niets (de regel krijgt "Kies zelf"), er gaat niets stuk.
- **robots.txt van Jumbo en Hoogvliet** verbiedt precies de zoek-URL. Voor Dirk niet.
- **Vanaf Supabase niet getest.** Jumbo zit achter Akamai. Vanaf een thuisverbinding werkt de
  zoekpagina; of Akamai aanvragen vanaf de datacenter-IP's van Supabase (AWS) toelaat, blijkt pas
  na het uitrollen. AH werkt vanaf daar wel.
- **Gewicht:** een zoekpagina is 600–800 kB HTML tegen een paar kB JSON bij AH. Met één regel
  tegelijk (zoals `useAhKoppeling` doet) is dat geen probleem.
- **Volume laag houden:** één zoekopdracht per nieuwe regel, en alleen voor regels met dat
  winkellabel. Niet de hele catalogus binnenhalen.

## Prototype

Op deze branch, nog niet uitgerold en nog niet aan:

- **Edge function** `ah-products`: `alternativesFor` neemt een `store` (`'AH'` standaard,
  `'Jumbo'`, `'Dirk'`). Zoeken en uitlezen staat in `supabase/functions/ah-products/winkels.ts`
  (tests: `winkels_test.ts`). Elk alternatief krijgt een `productUrl`. De rest van de functie
  (zoekterm en keuze door gpt-4o-mini, terugval op een andere formulering) is hetzelfde voor elke
  winkel. Het mandje vullen (`items`) blijft alleen AH.
- **App:** `fetchAlternatives(store, …)` in `src/services/ahApi.ts`; `koppelWinkel`,
  `productWinkel`, `productUrl` en `teKoppelen` in `src/lib/ahKoppeling.ts` (tests:
  `ahKoppeling.test.ts`). `useAhKoppeling` zoekt bij de winkel van de regel. Het AH-totaal, het
  AH-mandje en het vullen van dat mandje laten Jumbo- en Dirk-producten erbuiten. "Bekijk op
  jumbo.com" en "Product bij Jumbo kiezen" volgen de winkel.
- **Schakelaar:** `ANDERE_WINKELS_AAN` in `src/lib/ahKoppeling.ts`. Op `false` werkt de app
  precies als voorheen. Sinds 25 oktober 2026 staat hij op `true`: migratie gedraaid, functie
  uitgerold, en vanaf Supabase antwoorden Jumbo en Dirk gewoon (2,5–4,5 s per regel inclusief
  de keuze door het model, net als AH). In de preview: gember → Jumbo Biologische Verse Gember,
  Mutti passata → Mutti Passata la Rossa 700ml (Jumbo), halfvolle melk → Melkunie Halfvolle melk
  (Dirk), passata → AH Tomaten passata gezeefd; het AH-totaal telt alleen de AH-regel.
- **Migratie (voorstel):** `supabase/migrations/20261024120000_product_store.sql` voegt
  `product_store` (NULL = AH) en `product_url` toe aan `grocery_items`. De `ah_*`-kolommen blijven
  en dienen voor elke winkel; bij Jumbo houdt `ah_product_id` het artikelnummer zonder
  verpakkingscode. Hernoemen naar `product_*` kan later apart.

### Aanzetten (jouw stappen)

1. Kiezen: alleen Dirk, of ook Jumbo (zie robots.txt hierboven). Voor alleen Dirk: haal `'Jumbo'`
   uit `KOPPELBAAR` in `src/lib/ahKoppeling.ts` en uit `STORES` in `winkels.ts`.
2. Migratie draaien: `scripts/supabase-sql.sh < supabase/migrations/20261024120000_product_store.sql`.
3. Functie uitrollen: `supabase functions deploy ah-products`.
4. In de logs van `ah-products` kijken of Jumbo en Dirk vanaf Supabase antwoorden (Akamai).
5. `ANDERE_WINKELS_AAN = true`, dan in de preview een regel met winkel Jumbo of Dirk toevoegen.
