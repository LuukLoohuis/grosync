# CoupleCart

Gedeelde boodschappenlijst met recepten, maaltijdplanner en macro's.

- **Frontend:** Vite + React + TypeScript + Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Hosting:** Vercel

## Lokaal draaien

```sh
npm install
cp .env.example .env   # vul je eigen Supabase-gegevens in
npm run dev            # http://localhost:8080
```

Overige scripts: `npm run build`, `npm run lint`, `npm test`.

## Omgevingsvariabelen

Zie `.env.example`. Dezelfde variabelen zet je in Vercel onder Settings > Environment Variables
(build-time, want Vite bakt ze in de bundle).

## Supabase

```sh
supabase link --project-ref <project-ref>
supabase db push                      # migraties uit supabase/migrations
supabase functions deploy             # edge functions
supabase secrets set OPENAI_API_KEY=sk-...
```

Edge functions in `supabase/functions/`:
`suggest-recipes`, `suggest-meal-plan`, `translate-recipe`, `fetch-url-meta`,
`calculate-macros`. Ze gebruiken `OPENAI_API_KEY` (optioneel `FIRECRAWL_API_KEY`
voor het uitlezen van receptpagina's).

### Recept uit een link (`fetch-url-meta`)

| Link | Route |
|---|---|
| Receptsite | pagina scrapen → OpenAI |
| YouTube (video, Short, youtu.be) | beschrijving → gelinkte receptpagina → Gemini bekijkt de video |
| TikTok, Instagram | caption → gelinkte receptpagina |

Elke stap valt pas door naar de volgende als hij geen recept oplevert. Uit tekst
gehaalde ingrediënten moeten grotendeels in die tekst voorkomen; anders zijn ze
door het model verzonnen en worden ze weggegooid. Het antwoord bevat
`extractedFrom` (`page`, `description`, `linked-page`, `video` of `none`).

De videostap werkt alleen met `GEMINI_API_KEY` (optioneel `GEMINI_MODEL`,
standaard `gemini-3.8-flash`) en alleen voor openbare YouTube-video's.

Google-login loopt via de Google-provider in Supabase Auth
(Authentication > Providers > Google).

### AH-prijzen en -mandje (`ah-products`)

"AH-prijzen ophalen" op de boodschappenlijst stuurt de openstaande items naar
`ah-products`. Die kiest per item een AH-product met aantal en prijs; de app
bewaart dat op het item (`ah_*`-kolommen, `price` is het regelbedrag). "Alles in
AH-mandje" opent `ah.nl/mijnlijst/add-multiple?p=<id>:<aantal>&…`; na inloggen op
ah.nl staan de producten in je mandje.

AH heeft geen publieke API: de functie gebruikt de anonieme flow van de AH-app en
kan dus zonder waarschuwing breken. Jumbo krijgt alleen een zoeklink per item;
de voorwaarden van jumbo.com verbieden het automatisch uitlezen van site en app.

## Deploy

Push naar `main`; Vercel bouwt en publiceert. `vercel.json` legt de Vite-build
vast en stuurt paden die geen bestand zijn naar `index.html`, zodat client-side
routes werken.

De `VITE_*` variabelen zet je in Vercel onder Settings > Environment Variables,
voor Production en Preview; Vite bakt ze tijdens de build in de bundle.
