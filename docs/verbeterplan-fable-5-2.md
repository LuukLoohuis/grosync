# Verbeterplan CoupleCart (voor Claude Code op Fable 5.2)

Werklijst om CoupleCart stap voor stap beter te maken. Elke taak past in één
sessie: geef de sessie de regel "Doe taak X.Y uit docs/verbeterplan-fable-5-2.md".
Werk de fases op volgorde af; binnen een fase mogen taken los van elkaar.

Stand bij opstellen (2026-11-10): main op `d2f4c98` (recepten van alle clubleden).

## Spelregels voor elke sessie

- **UI is Nederlands** (Engels via `src/lib/en.ts` en `t()`); schrijf teksten in
  zinsletters, geen em-dashes, geen gloed/blur (taste-lint moet op 0 WARN blijven).
- **Productemoji in `productIcoon.ts` blijven**: bewuste keuze, niet vervangen.
- **Eerst plan, dan bouwen, één commit per fase/taak**, Conventional Commits in
  het Nederlands (`feat(lijst): …`, `fix(ux): …`).
- **Deploys en migraties toepassen zijn een stap van de gebruiker**, tenzij die
  het in de chat zelf vraagt. Schrijf migraties in `supabase/migrations/`,
  deploy edge functions niet zelf. SQL tegen productie alleen via
  `scripts/supabase-sql.sh` en alleen lezend, tenzij gevraagd.
- **Tests**: `vitest` hangt op Node 25. Draai pure logica met `node --test`
  (zie bestaande tests) of in een scratchkopie met Node 22.
- **Verifiëren in de browser**: dev server via `.claude/launch.json`
  (poort 5175, gastsessie). Laat het browserpaneel zichtbaar, anders bevriezen
  transities.
- **Gedeelde checkout**: andere sessies werken soms ook in `main`. Raak alleen
  de bestanden van je eigen taak aan en check `git status` vóór je commit.

---

## Fase 0: Open eindjes afmaken

| # | Taak | Klaar als |
|---|------|-----------|
| 0.1 | Controleer of migratie `20261110090000_club_recepten.sql` live staat (lees `pg_policies` voor `recipes`, policy "Club leest recepten"). Zo niet: meld het als gebruikersstap. | Bekend of de policy live is; RLS getest met twee clubleden (lid ziet recepten van eigenaar én andersom). |
| 0.2 | Prijsvergelijk (`supabase/functions/ah-products`): de bekende foute matches oplossen, flatbread → yoghurt en komkommer → snoepgroente. Voeg ze toe aan de replay-set en draai die. | Replay geeft voor beide de juiste productsoort; geen terugval op eerdere gevallen (eieren, gerookte kip, plantaardige kaas). |
| 0.3 | Checklist met wat nog bij de gebruiker ligt in `docs/gebruikersstappen.md`: pushmelding op twee echte telefoons (iPhone vanaf beginscherm), NL-mailtemplates plakken (`docs/supabase-mails.md`), Stripe live-sleutels en KvK-nummer, deploy van openstaande ah-products-commits. | Eén lijst met per punt wat te doen en hoe te controleren. |

## Fase 1: Lijstscherm rustiger (grootste UX-winst)

Uit de UX-review van 2026-10-27 (score 26/40, `.impeccable/critique/`).

| # | Taak | Klaar als |
|---|------|-----------|
| 1.1 | **Keuzestress boven de lijst**: nu staan er 4 rijen chips/knoppen boven de items (suggesties, winkels, afdelingen, volgorde/winkelmodus). Breng dit terug naar hooguit 2 rijen; de rest achter één "Filter"-knop of in de afdelingskoppen. Bestanden: `GroceryList.tsx`, `CategoryChip.tsx`, `WinkelLabel.tsx`. | Op 375 px breed staat het eerste item boven de vouw; geen functie verdwenen. Screenshot voor/na. |
| 1.2 | **Winkelmodus als hoofdactie**: de knop is nu outline zoals alles. Maak hem de enige gevulde knop op het lijstscherm (Von Restorff). | Eén primaire knop per scherm; contrast AA. |
| 1.3 | **"Prijzen zoeken…" bij AH** is nog een kale spinner. Gebruik dezelfde voortgang als `PrijsVergelijkSheet` (ZoekVoortgang). | Zelfde gevoel als prijsvergelijk; geen kale spinner meer in de app (`grep -rn Loader2 src`). |
| 1.4 | **PlusAanbod**: "Meest gekozen" alleen bij het jaarplan, prijsverschil per maand tonen. | Eén label, geen nep-urgentie. |

## Fase 2: Code gezonder maken (zodat latere taken goedkoper worden)

| # | Taak | Klaar als |
|---|------|-----------|
| 2.1 | **Gedeelde AI-client voor edge functions**. Zeven functies (`translate-recipe`, `suggest-recipes`, `fetch-url-meta`, `bonus-recipes`, `calculate-macros`, `ah-bonus`, `ah-products`, `pantry-scan`) bouwen elk zelf key/endpoint/fetch. Maak `supabase/functions/_shared/ai.ts` met één `vraagModel({ taak, berichten, json })`, timeouts, retry en logging van tokens. Gedrag gelijk houden. | Alle functies gebruiken `_shared/ai.ts`; `deno check` slaagt; geen gedragswijziging (zelfde prompts/modellen). |
| 2.2 | **`RecipeList.tsx` (777 regels) opknippen** in filterbalk, raster en lege staat; logica naar een hook. | Geen bestand > 400 regels; gedrag gelijk in browser. |
| 2.3 | **`GroceryList.tsx` (706 regels) opknippen**, na fase 1. | Idem. |
| 2.4 | **`fetch-url-meta` (855 regels) opsplitsen** in ophalen, parsen (JSON-LD/HTML), AI-terugval en Gemini-video. | Losse modules met tests op vaste HTML-fixtures. |
| 2.5 | **Testrunner die werkt**: kies één aanpak (Node 22 via `.nvmrc` + vitest, of alles naar `node --test`) en zet `npm test` daarop. | `npm test` draait groen op deze Mac zonder te hangen. |

## Fase 3: AI-functies meetbaar beter

| # | Taak | Klaar als |
|---|------|-----------|
| 3.1 | **Evalset per AI-functie**: 20–30 vaste voorbeelden voor link-import (receptsites), kastfoto (foto's), macro's en AH-matching, met verwachte uitkomst. Script `scripts/eval.ts` dat score per functie print. | Eén commando geeft een score per functie; uitgangsscore vastgelegd in `docs/ai-eval.md`. |
| 3.2 | **Kosten per functie zichtbaar** in `Admin.tsx` (tokens/kosten per dag uit de logging van 2.1). | Admin toont kosten per functie over 7 dagen. |
| 3.3 | **Modelkeuze per taak vergelijken** met de evalset (huidig gpt-4o-mini/Gemini tegen alternatieven). Alleen rapport, niet omzetten zonder akkoord. | Tabel kwaliteit × kosten × snelheid in `docs/ai-eval.md` met advies. |

## Fase 4: Toegankelijkheid en snelheid

| # | Taak | Klaar als |
|---|------|-----------|
| 4.1 | **WCAG 2.2 AA-audit** van lijst, winkelmodus, recepten, voorraad en inloggen (toetsenbord, schermlezer-labels, focus, doelgrootte ≥ 24 px). | Rapport + fixes; geen AA-fouten op die vijf schermen. |
| 4.2 | **Laadtijd**: Lighthouse mobiel op de gebouwde app, bundel per route bekijken, zware sheets lazy laden (`LazyBoundary` bestaat al). | LCP < 2,5 s en INP < 200 ms op mobiel profiel; voor/na-cijfers in de commit. |
| 4.3 | **Offline**: lijst afvinken en toevoegen zonder netwerk, wachtrij die synct bij terugkomst (`OfflineBanner.tsx`, service worker). | Vliegtuigmodus-test: wijzigingen komen na herverbinden bij het andere clublid aan. |

## Fase 5: Product (alleen na akkoord van de gebruiker)

Voorstellen, niet zonder overleg bouwen. Laat de sessie eerst een korte opzet
(scherm + datamodel) voorleggen.

| # | Voorstel | Waarom |
|---|----------|--------|
| 5.1 | **Weekmenu**: recepten op dagen zetten, ingrediënten in één keer naar de lijst, voorraad ervan af. | Bindt recepten, voorraad en lijst aan elkaar; reden om wekelijks terug te komen. |
| 5.2 | **Wie haalt wat** in de Cart Club: item toewijzen aan een lid, melding bij toewijzing. | Bouwt op push en Cart Club die er al zijn. |
| 5.3 | **Uitgaven per maand** uit `purchase_history` + prijsvergelijk. | Maakt de waarde van Plus zichtbaar. |
| 5.4 | **Slimme vaste boodschappen**: "je koopt melk elke ~5 dagen" als suggestie. | Gebruikt geschiedenis die al wordt opgeslagen. |

---

## Volgorde in het kort

1. Fase 0 (snel, haalt risico weg)
2. Fase 1 (zichtbaar voor gebruikers)
3. Fase 2.1 + 2.5 (fundament voor fase 3)
4. Fase 3 (meten vóór je AI verandert)
5. Fase 2.2–2.4 en fase 4 door elkaar
6. Fase 5 per voorstel, na akkoord
