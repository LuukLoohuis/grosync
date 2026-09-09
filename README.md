# CoupleCart

Gedeelde boodschappenlijst met recepten, maaltijdplanner en macro's.

- **Frontend:** Vite + React + TypeScript + Tailwind + shadcn/ui
- **Backend:** Supabase (Postgres, Auth, Edge Functions)
- **Hosting:** Cloudflare Pages

## Lokaal draaien

```sh
npm install
cp .env.example .env   # vul je eigen Supabase-gegevens in
npm run dev            # http://localhost:8080
```

Overige scripts: `npm run build`, `npm run lint`, `npm test`.

## Omgevingsvariabelen

Zie `.env.example`. Dezelfde variabelen zet je in Cloudflare Pages onder
Settings > Environment variables (build-time, want Vite bakt ze in de bundle).

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

Google-login loopt via de Google-provider in Supabase Auth
(Authentication > Providers > Google).

## Deploy

Push naar `main`; Cloudflare Pages bouwt met `npm run build` en publiceert `dist`.
`public/_redirects` zorgt voor SPA-routing.
