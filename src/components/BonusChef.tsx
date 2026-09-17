import { useCallback, useEffect, useState } from 'react';
import { ChefHat, Loader2, Plus, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import AddToListSheet from '@/components/AddToListSheet';
import RecipeViewDialog from '@/components/RecipeViewDialog';
import { useAppContext } from '@/contexts/AppContext';
import { leesBonusGeheugen, schrijfBonusGeheugen } from '@/lib/bonusMemory';
import { splitAmount } from '@/lib/itemAmount';
import { normalizeSteps, splitSteps } from '@/lib/recipeSteps';
import { fetchBonusMatches, fetchBonusRecipes, type BonusHit, type BonusMatch, type BonusOffer, type BonusRecipe, type BonusResult } from '@/services/bonusApi';
import type { Recipe } from '@/types';

const euro = new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' });

// Zo lang doet het ophalen er meestal over; alleen voor de balk en een "nog ± ".
const DUURT_MS = 8500;

/**
 * "1 + 1 gratis" scheelt echt iets, "2% volume voordeel" niet. AH's tekst nemen
 * we letterlijk over, maar alleen een echte korting krijgt de bonuskleur.
 */
const zegtIets = (vorm: string | null) => Boolean(vorm) && !/volume\s*voordeel/i.test(vorm ?? '');

const geldigLabel = (endDate: string | null) => {
  if (!endDate) return null;
  const datum = new Date(endDate);
  if (Number.isNaN(datum.getTime())) return null;
  const dagen = Math.ceil((datum.getTime() - Date.now()) / 86_400_000);
  const tot = `t/m ${datum.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}`;
  return dagen > 0 ? `${tot}, nog ${dagen === 1 ? '1 dag' : `${dagen} dagen`}` : tot;
};

/** Hoeveel van dit recept in de bonus ligt bepaalt hoeveel gewicht het krijgt. */
const dekking = (match: BonusMatch) => match.hits.length / Math.max(1, match.ingredientCount);

const Vorm = ({ vorm, klein = false }: { vorm: string | null; klein?: boolean }) => {
  if (!vorm) return null;
  return (
    <span
      className={`block font-display ${klein ? 'text-[0.625rem]' : 'text-[0.625rem]'} font-semibold uppercase tracking-[0.05em] ${
        zegtIets(vorm) ? 'text-[hsl(var(--ah-bonus))]' : 'text-muted-foreground'
      }`}
    >
      {vorm}
    </span>
  );
};

const Foto = ({ url, formaat }: { url: string | null; formaat: number }) => (
  url
    ? <img src={url} alt="" loading="lazy" className="shrink-0 rounded-[9px] border border-border bg-white object-contain" style={{ width: formaat, height: formaat }} onError={(e) => { e.currentTarget.style.visibility = 'hidden'; }} />
    : <span className="shrink-0 rounded-[9px] border border-border bg-muted" style={{ width: formaat, height: formaat }} aria-hidden="true" />
);

/** Bonuschef: welke van jouw recepten deze week goedkoper zijn bij Albert Heijn. */
const BonusChef = ({ onNavigate }: { onNavigate?: (tab: 'recipes' | 'list') => void }) => {
  const { recipes, addRecipe, pantryStaples, addGroceryItem } = useAppContext();
  const [result, setResult] = useState<BonusResult | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [listRecipe, setListRecipe] = useState<Recipe | null>(null);
  const [ideas, setIdeas] = useState<BonusRecipe[]>([]);
  const [thinking, setThinking] = useState(false);
  const [saved, setSaved] = useState<string[]>([]);
  const [toonAlles, setToonAlles] = useState(false);
  // Hoe lang het ophalen al duurt, zodat de balk iets zegt in plaats van te zwaaien.
  const [wacht, setWacht] = useState(0);
  const [vorige] = useState(leesBonusGeheugen);

  const load = useCallback(async () => {
    setStatus('loading');
    try {
      const uitkomst = await fetchBonusMatches(recipes);
      setResult(uitkomst);
      setStatus('ready');
      schrijfBonusGeheugen({
        aanbiedingen: uitkomst.bonusCount,
        voordeel: uitkomst.matches.reduce((som, match) => som + match.saving, 0),
        recepten: uitkomst.matches.map((match) => ({
          id: match.recipeId,
          naam: match.name,
          voordeel: match.saving,
          treffers: match.hits.length,
        })),
        tot: uitkomst.endDate,
      });
    } catch (error) {
      console.error('Bonus matches failed:', error);
      setStatus('error');
    }
  }, [recipes]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (status !== 'loading') return;
    setWacht(0);
    const begin = Date.now();
    const tik = window.setInterval(() => setWacht(Date.now() - begin), 250);
    return () => window.clearInterval(tik);
  }, [status]);

  const think = async () => {
    const offers = result?.sample ?? [];
    if (offers.length < 10) return;
    setThinking(true);
    try {
      setIdeas(await fetchBonusRecipes(offers, pantryStaples));
    } catch (error) {
      console.error('Bonus recipes failed:', error);
      toast.error('Recepten bedenken lukte niet. Probeer het zo nog eens.');
    } finally {
      setThinking(false);
    }
  };

  const keep = async (idea: BonusRecipe) => {
    await addRecipe({
      name: idea.name,
      description: idea.description,
      ingredients: idea.ingredients,
      instructions: normalizeSteps(idea.instructions),
      servings: idea.servings,
    });
    setSaved((previous) => [...previous, idea.name]);
    toast.success(`“${idea.name}” staat bij je recepten`);
  };

  const opLijst = (naam: string) => {
    addGroceryItem(naam);
    toast.success(`“${naam}” op je lijst gezet`);
  };

  // Het meeste voordeel bovenaan; daarna wat het meest compleet in de bonus ligt.
  const matches = [...(result?.matches ?? [])].sort((a, b) => b.saving - a.saving || dekking(b) - dekking(a));
  const geldig = geldigLabel(result?.endDate ?? null);
  const aanbiedingen = result?.sample ?? [];

  // Bonuschef noemt producten bij naam; de prijs en de kortingsvorm halen we
  // terug uit dezelfde aanbiedingen die we hem gestuurd hebben.
  const offerVoor = (naam: string) => {
    const schoon = naam.trim().toLowerCase();
    return aanbiedingen.find((offer) => offer.title.toLowerCase() === schoon)
      ?? aanbiedingen.find((offer) => offer.title.toLowerCase().includes(schoon) || schoon.includes(offer.title.toLowerCase()))
      ?? null;
  };
  const voordeelVan = (offer: BonusOffer | null) =>
    offer && offer.price != null && offer.price_before != null && offer.price_before > offer.price
      ? offer.price_before - offer.price
      : 0;

  const ideeOpLijst = (idea: BonusRecipe) => {
    for (const regel of idea.ingredients) addGroceryItem(regel);
    toast.success(`${idea.ingredients.length} boodschappen op je lijst`);
  };
  const aantalBekeken = result?.bonusCount ?? 0;

  const paar = (hit: BonusHit, formaat: number) => (
    <div key={hit.productId} className="flex min-h-14 items-center gap-3 border-t border-border px-3 py-2 first:border-t-0">
      <Foto url={hit.imageUrl} formaat={formaat} />
      <span className="min-w-0 flex-1">
        <span className="block text-xs text-muted-foreground">jouw {splitAmount(hit.ingredient).name.toLowerCase()}</span>
        <span className="mt-px block truncate text-[0.90625rem] font-medium leading-tight text-foreground">{hit.title}</span>
        <Vorm vorm={hit.mechanism} />
      </span>
      <span className="shrink-0 text-right">
        {hit.price != null && (
          <span className="block font-display text-[0.9375rem] font-bold tabular-nums text-foreground">{euro.format(hit.price)}</span>
        )}
        {hit.priceBefore != null && hit.price != null && hit.priceBefore > hit.price && (
          <span className="block font-display text-[0.71875rem] font-medium tabular-nums text-muted-foreground line-through">
            {euro.format(hit.priceBefore)}
          </span>
        )}
      </span>
    </div>
  );

  const kaart = (match: BonusMatch) => {
    const recipe = recipes.find((r) => r.id === match.recipeId);
    if (!recipe) return null;
    const deel = dekking(match);
    const label = `${match.hits.length} van ${match.ingredientCount} in de bonus`;

    // Veel treffers: een vol groen vlak met de bedragen groot.
    if (deel >= 0.6) {
      return (
        <article key={match.recipeId} className="rounded-[18px] bg-primary p-4">
          <span className="inline-block rounded-[6px] bg-primary-foreground/15 px-[7px] py-1 font-display text-[0.625rem] font-bold uppercase tracking-[0.07em] text-primary-foreground">
            {label}
          </span>
          <h2 className="mt-2 font-display text-[1.375rem] font-bold leading-tight text-primary-foreground">{match.name}</h2>
          {match.saving > 0 && (
            <div className="mb-3.5 mt-2.5 flex items-end gap-2.5">
              <span className="font-display text-[2rem] font-bold leading-none tabular-nums text-primary-foreground">{euro.format(match.saving)}</span>
              <span className="pb-1 text-[0.8125rem] text-primary-foreground/75">goedkoper deze week</span>
            </div>
          )}
          <div className="overflow-hidden rounded-xl bg-card">
            {match.hits.map((hit) => paar(hit, 40))}
          </div>
          <div className="mt-3 flex gap-2">
            <RecipeViewDialog
              recipe={recipe}
              onAddToList={() => setListRecipe(recipe)}
              trigger={
                <Button variant="outline" className="min-h-[46px] shrink-0 border-primary-foreground/30 bg-transparent px-4 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground">
                  Recept
                </Button>
              }
            />
            <Button variant="secondary" className="min-h-[46px] flex-1" onClick={() => setListRecipe(recipe)}>
              Op de lijst
            </Button>
          </div>
        </article>
      );
    }

    // Wat treffers: een gewone kaart, compacte paren.
    if (deel >= 0.25) {
      return (
        <article key={match.recipeId} className="rounded-[14px] border border-border bg-card px-3.5 py-3">
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1">
              <span className="block font-display text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-accent-ink">{label}</span>
              <span className="mt-0.5 block font-display text-[1.0625rem] font-bold leading-tight text-foreground">{match.name}</span>
            </span>
            {match.saving > 0 && (
              <span className="shrink-0 font-display text-[1.0625rem] font-bold tabular-nums text-foreground">{euro.format(match.saving)}</span>
            )}
          </div>
          <div className="mt-2 space-y-1.5">
            {match.hits.map((hit) => (
              <div key={hit.productId} className="flex items-center gap-2.5">
                <Foto url={hit.imageUrl} formaat={30} />
                <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                  {splitAmount(hit.ingredient).name} <span className="text-foreground/70">→ {hit.title}</span>
                </span>
                {hit.price != null && (
                  <span className="shrink-0 font-display text-xs font-bold tabular-nums text-foreground">{euro.format(hit.price)}</span>
                )}
              </div>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <RecipeViewDialog
              recipe={recipe}
              onAddToList={() => setListRecipe(recipe)}
              trigger={<Button variant="outline" className="min-h-11 shrink-0 px-4">Recept</Button>}
            />
            <Button className="min-h-11 flex-1" onClick={() => setListRecipe(recipe)}>Op de lijst</Button>
          </div>
        </article>
      );
    }

    // Eén treffer: een regel, geen vlak.
    return (
      <button
        key={match.recipeId}
        type="button"
        onClick={() => setListRecipe(recipe)}
        className="flex w-full items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2.5 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block font-display text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">{label}</span>
          <span className="mt-0.5 block truncate text-[0.96875rem] font-medium text-foreground">{match.name}</span>
          {match.hits[0] && (
            <span className="block truncate text-xs text-muted-foreground">
              {splitAmount(match.hits[0].ingredient).name}{match.hits[0].mechanism ? ` · ${match.hits[0].mechanism}` : ''}
            </span>
          )}
        </span>
        {match.saving > 0 && (
          <span className="shrink-0 font-display text-sm font-semibold tabular-nums text-muted-foreground">{euro.format(match.saving)}</span>
        )}
      </button>
    );
  };

  return (
    <div className="space-y-3">
      <header className="px-1">
        <h1 className="font-display text-[1.75rem] font-bold tracking-[-0.02em] text-foreground">Deze week</h1>
        <p className="mt-0.5 text-[0.8125rem] text-muted-foreground">
          {status === 'loading'
            ? 'De bonus van deze week wordt opgehaald'
            : matches.length > 0
              ? `${matches.length} van je ${recipes.length} recepten ${matches.length === 1 ? 'is' : 'zijn'} goedkoper${geldig ? ` · ${geldig}` : ''}`
              : aantalBekeken > 0
                ? `${aantalBekeken.toLocaleString('nl-NL')} aanbiedingen bekeken${geldig ? ` · ${geldig}` : ''}`
                : 'Albert Heijn, elke woensdag nieuw'}
        </p>
      </header>

      {/* Het wachten duurt acht seconden; dat verdient een scherm. */}
      {status === 'loading' && (
        <section className="rounded-[18px] bg-primary p-5">
          <p className="font-display text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-primary-foreground/70">
            Bonus van deze week ophalen
          </p>
          <p className="mt-1.5 font-display text-[1.375rem] font-bold leading-tight text-primary-foreground">
            {vorige
              ? `${vorige.aanbiedingen.toLocaleString('nl-NL')} aanbiedingen langs je recepten`
              : recipes.length > 0
                ? 'Alle aanbiedingen langs je recepten'
                : 'Alle aanbiedingen van deze week'}
          </p>
          <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-primary-foreground/20">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300 ease-smooth"
              style={{ width: `${Math.min(95, (wacht / DUURT_MS) * 100)}%` }}
            />
          </div>
          <p className="mt-2 flex items-baseline justify-between gap-2 text-[0.8125rem] text-primary-foreground/75">
            <span>Je hoeft niet te wachten — het staat er zo.</span>
            {wacht < DUURT_MS && (
              <span className="shrink-0 tabular-nums">nog ± {Math.max(1, Math.ceil((DUURT_MS - wacht) / 1000))} sec</span>
            )}
          </p>
          {vorige && vorige.voordeel > 0 && (
            <p className="mt-3 border-t border-primary-foreground/15 pt-3 text-[0.8125rem] text-primary-foreground/75">
              Vorige keer scheelde het jullie {euro.format(vorige.voordeel)}.
            </p>
          )}
        </section>
      )}

      {status === 'error' && (
        <div className="rounded-[14px] border border-border bg-card p-4">
          <p className="text-sm text-foreground">De bonus ophalen lukte niet.</p>
          <Button variant="outline" className="mt-3 gap-2" onClick={() => void load()}>
            <RefreshCw className="h-4 w-4" /> Opnieuw proberen
          </Button>
        </div>
      )}

      {status === 'ready' && recipes.length === 0 && (
        <section className="rounded-[18px] border border-border bg-card p-5 text-center">
          {aantalBekeken > 0 && (
            <>
              <p className="font-display text-[2.75rem] font-bold leading-none tabular-nums text-primary">
                {aantalBekeken.toLocaleString('nl-NL')}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">aanbiedingen keken we langs</p>
            </>
          )}
          <h2 className="mt-4 font-display text-2xl font-bold tracking-[-0.01em] text-foreground">
            We weten nog niet wat jij kookt
          </h2>
          <p className="mx-auto mt-2 max-w-[20rem] text-sm text-muted-foreground">
            Bewaar een recept, dan kijkt CoupleCart elke week welke ervan goedkoper zijn.
          </p>
          {onNavigate && (
            <Button variant="secondary" className="mt-4 min-h-[50px] w-full" onClick={() => onNavigate('recipes')}>
              Eerste recept ophalen
            </Button>
          )}
        </section>
      )}

      {status === 'ready' && recipes.length > 0 && matches.length === 0 && (
        <section className="rounded-[18px] border border-border bg-card p-5">
          <h2 className="font-display text-2xl font-bold tracking-[-0.01em] text-foreground">Deze week niets van jou</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Geen van je {recipes.length} recepten zit er deze week in. De aanbiedingen wisselen woensdag.
          </p>
          {aanbiedingen.length >= 10 && (
            <Button variant="secondary" className="mt-4 min-h-[50px] w-full gap-2" onClick={() => void think()} disabled={thinking}>
              {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {thinking ? 'Even koken…' : 'Laat iets verzinnen uit de bonus'}
            </Button>
          )}
        </section>
      )}

      {matches.map(kaart)}

      {status === 'ready' && matches.length > 0 && aanbiedingen.length >= 10 && (
        <section className="rounded-[14px] border border-accent/25 bg-accent-soft p-3.5">
          <h2 className="font-display text-[1.0625rem] font-semibold text-foreground">Drie avonden uit de bonus</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Gemaakt met wat deze week in de aanbieding ligt.</p>
          <Button variant="secondary" className="mt-3 min-h-11 w-full gap-2" onClick={() => void think()} disabled={thinking}>
            {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {thinking ? 'Even koken…' : ideas.length > 0 ? 'Drie andere verzinnen' : 'Laat iets verzinnen'}
          </Button>
        </section>
      )}

      {ideas.map((idea) => {
        const producten = idea.usedBonus.map((naam) => ({ naam, offer: offerVoor(naam) }));
        const scheelt = producten.reduce((som, { offer }) => som + voordeelVan(offer), 0);
        return (
          <article key={idea.name} className="rounded-[16px] border border-border bg-card p-3.5">
            <h3 className="font-display text-[1.1875rem] font-bold leading-tight text-foreground">{idea.name}</h3>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {idea.minutes ? `${idea.minutes} min · ` : ''}voor {idea.servings}
              {scheelt > 0 ? ` · ± ${euro.format(scheelt)} goedkoper` : ''}
            </p>

            {producten.length > 0 && (
              <ul className="mt-2.5 space-y-1.5">
                {producten.map(({ naam, offer }) => (
                  <li key={naam} className="flex items-center gap-2.5">
                    <Foto url={offer?.image_url ?? null} formaat={30} />
                    <span className="min-w-0 flex-1 truncate text-[0.8125rem] text-foreground">{offer?.title ?? naam}</span>
                    {offer?.mechanism
                      ? <Vorm vorm={offer.mechanism} />
                      : offer?.price != null && (
                        <span className="shrink-0 font-display text-xs font-bold tabular-nums text-foreground">{euro.format(offer.price)}</span>
                      )}
                  </li>
                ))}
              </ul>
            )}

            <div className="mt-3 flex gap-2">
              <Button
                variant="outline"
                className="min-h-11 shrink-0 gap-1 px-4"
                disabled={saved.includes(idea.name)}
                onClick={() => void keep(idea)}
              >
                <Plus className="h-3.5 w-3.5" /> {saved.includes(idea.name) ? 'Bewaard' : 'Bewaren'}
              </Button>
              <Button variant="accent" className="min-h-11 flex-1" onClick={() => ideeOpLijst(idea)}>
                Op de lijst
              </Button>
            </div>

            <details className="mt-2.5 text-xs text-muted-foreground">
              <summary className="min-h-11 cursor-pointer font-medium text-primary">Ingrediënten en bereiding</summary>
              <ul className="mt-1.5 space-y-0.5">
                {idea.ingredients.map((ingredient) => <li key={ingredient}>• {ingredient}</li>)}
              </ul>
              <ol className="mt-2 space-y-1.5">
                {splitSteps(idea.instructions).map((step, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="font-semibold tabular-nums text-primary">{index + 1}.</span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </details>
          </article>
        );
      })}

      {status === 'ready' && aanbiedingen.length > 0 && (
        <section>
          <h2 className="px-1 font-display text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-muted-foreground">
            {matches.length > 0 ? 'Deze week in de bonus' : 'Wel in de bonus deze week'}
          </h2>
          <ul className="mt-1.5 space-y-1.5">
            {aanbiedingen.slice(0, toonAlles ? 24 : 6).map((offer) => (
              <li key={offer.title} className="flex min-h-[3.25rem] items-center gap-3 rounded-[12px] border border-border bg-card px-3 py-2">
                <Foto url={offer.image_url ?? null} formaat={40} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.90625rem] font-medium leading-tight text-foreground">{offer.title}</span>
                  <Vorm vorm={offer.mechanism} />
                </span>
                <span className="shrink-0 text-right">
                  {offer.price != null && (
                    <span className="block font-display text-[0.9375rem] font-bold tabular-nums text-foreground">{euro.format(offer.price)}</span>
                  )}
                  {offer.price_before != null && offer.price != null && offer.price_before > offer.price && (
                    <span className="block font-display text-[0.71875rem] font-medium tabular-nums text-muted-foreground line-through">
                      {euro.format(offer.price_before)}
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => opLijst(offer.title)}
                  aria-label={`Zet ${offer.title} op je lijst`}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] bg-accent-soft text-accent-ink transition-colors duration-150 ease-smooth hover:bg-accent hover:text-accent-foreground"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
          {aanbiedingen.length > 6 && (
            <button
              type="button"
              onClick={() => setToonAlles((aan) => !aan)}
              className="mt-2 min-h-11 w-full text-center text-[0.8125rem] font-medium text-primary hover:underline"
            >
              {toonAlles ? 'Minder tonen' : `Nog ${Math.min(aanbiedingen.length, 24) - 6} aanbiedingen`}
            </button>
          )}
        </section>
      )}

      {status === 'ready' && recipes.length === 0 && aanbiedingen.length >= 10 && (
        <Button variant="outline" className="min-h-[50px] w-full gap-2" onClick={() => void think()} disabled={thinking}>
          {thinking ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Laat iets verzinnen uit de bonus
        </Button>
      )}

      {status === 'ready' && matches.length > 0 && (
        <p className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <ChefHat className="h-3 w-3" aria-hidden="true" /> Prijzen en acties komen van Albert Heijn.
        </p>
      )}

      <AddToListSheet recipe={listRecipe} onClose={() => setListRecipe(null)} onNavigate={onNavigate} />
    </div>
  );
};

export default BonusChef;
