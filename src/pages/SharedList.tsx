import { useCallback, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { CalendarDays, ChefHat, Link2, Loader2, Package, Plus, ShoppingCart, Sparkles, Star, Users } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AppProvider } from '@/contexts/AppContext';
import GroceryList from '@/components/GroceryList';
import RecipeList from '@/components/RecipeList';
import UsualsList from '@/components/UsualsList';
import OfflineBanner from '@/components/OfflineBanner';
import { t } from '@/lib/i18n';
import { initialen } from '@/lib/cartClub';
import { meldAanvraag, meldNieuwLid } from '@/lib/meldingen';
import { useTurnstile } from '@/hooks/useTurnstile';

const SharedListContent = () => {
  const [tab, setTab] = useState<'list' | 'usuals' | 'recipes'>('list');

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success(t("Link gekopieerd!"));
  };

  return (
    <div className="min-h-dvh bg-background">
      <header className="sticky top-0 z-10 bg-background border-b border-border">
        <div className="max-w-lg mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/favicon.png" alt="" className="h-11 w-11 shrink-0" width={44} height={44} />
            <div>
              <h1 className="font-display text-xl text-foreground">{t("CoupleCart")}</h1>
              <p className="text-xs text-muted-foreground">{t("Cart Club")}</p>
            </div>
          </div>
          <Button variant="outline" size="icon" onClick={copyLink} title={t("Kopieer link")}>
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="mx-auto max-w-lg px-4"><OfflineBanner className="mb-2" /></div>
      </header>

      <div className="max-w-lg mx-auto px-4 pt-4">
        <div className="flex bg-muted rounded-lg p-1 gap-1">
          <button
            onClick={() => setTab('list')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'list' ? 'bg-card shadow-flat text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShoppingCart className="h-4 w-4" /> {t("Boodschappen")}
          </button>
          <button
            onClick={() => setTab('usuals')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'usuals' ? 'bg-card shadow-flat text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Star className="h-4 w-4" /> {t("Favorieten")}
          </button>
          <button
            onClick={() => setTab('recipes')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-md text-sm font-medium transition-colors ${
              tab === 'recipes' ? 'bg-card shadow-flat text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <ChefHat className="h-4 w-4" /> {t("Recepten")}
          </button>
        </div>
      </div>

      <main className="max-w-lg mx-auto px-4 py-6">
        {tab === 'list' && <GroceryList aboveTabBar={false} />}
        {tab === 'usuals' && <UsualsList />}
        {tab === 'recipes' && <RecipeList />}
      </main>
    </div>
  );
};

interface Uitnodiging { eigenaarNaam: string | null; leden: number }

const DELEN = [
  { icon: ShoppingCart, label: 'Boodschappen' },
  { icon: ChefHat, label: 'Recepten' },
  { icon: Package, label: 'Voorraadkast' },
  { icon: CalendarDays, label: 'Weekplan' },
  { icon: Star, label: 'Favorieten' },
  { icon: Sparkles, label: 'Plus' },
] as const;

/** Wat je ziet vóór je instapt: wie je uitnodigt en wat je dan samen deelt. */
const InstapScherm = ({ uitnodiging, bezig, onInstappen }: { uitnodiging: Uitnodiging; bezig: boolean; onInstappen: () => void }) => {
  const { eigenaarNaam, leden } = uitnodiging;
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pb-8 pt-14">
        <div className="text-center">
          <div className="mb-4 flex justify-center" aria-hidden="true">
            <span className="flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-background bg-primary text-sm font-medium text-primary-foreground">
              {initialen(eigenaarNaam) || <Users className="h-5 w-5" />}
            </span>
            {leden > 1 && (
              <span className="-ml-3 flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-background bg-secondary/20 text-sm font-medium text-accent-ink">
                +{leden - 1}
              </span>
            )}
            <span className="-ml-3 flex h-12 w-12 items-center justify-center rounded-full border-2 border-dashed border-primary bg-card text-primary">
              <Plus className="h-5 w-5" />
            </span>
          </div>
          <h1 className="font-display text-2xl text-foreground">
            {eigenaarNaam
              ? t('{0} vraagt je erbij in de Cart Club', [eigenaarNaam])
              : t('Je bent uitgenodigd voor een Cart Club')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {leden === 1 ? t('1 in de club') : t('{0} in de club', [leden])}
          </p>
        </div>

        <section className="mt-6 rounded-[14px] border border-border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium text-foreground">{t('Na instappen delen jullie:')}</h2>
          <ul className="grid grid-cols-2 gap-x-3 gap-y-2 text-sm text-muted-foreground">
            {DELEN.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> {t(label)}
              </li>
            ))}
          </ul>
        </section>

        <div className="mt-auto space-y-3 pt-8">
          <Button className="min-h-12 w-full gap-2 text-base" onClick={onInstappen} disabled={bezig}>
            {bezig && <Loader2 className="h-4 w-4 animate-spin" />} {t('Vraag om erbij te mogen')}
          </Button>
          <Button variant="ghost" className="min-h-11 w-full" onClick={() => window.location.assign(`${window.location.origin}/#/`)}>
            {t('Nee, bedankt')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('{0} krijgt je vraag en laat je toe. Uitstappen kan altijd; wat je zelf al had, blijft bewaard.', [eigenaarNaam ?? t('De oprichter')])}
          </p>
        </div>
      </main>
    </div>
  );
};

type Stand = 'laden' | 'uitnodiging' | 'wacht' | 'geweigerd' | 'vol' | 'onbekend' | 'lid';

/** Na het vragen: wachten tot de oprichter je toelaat. Gaat vanzelf verder. */
const WachtScherm = ({ uitnodiging, stand, bezig, onIntrekken, onOpnieuw }: {
  uitnodiging: Uitnodiging | null;
  stand: 'wacht' | 'geweigerd' | 'vol';
  bezig: boolean;
  onIntrekken: () => void;
  onOpnieuw: () => void;
}) => {
  const naam = uitnodiging?.eigenaarNaam ?? null;
  const titel = stand === 'wacht'
    ? (naam ? t('Gevraagd aan {0}', [naam]) : t('Je vraag is verstuurd'))
    : stand === 'vol'
      ? t('Er staan al te veel vragen open')
      : t('Je vraag staat niet meer open');
  const uitleg = stand === 'wacht'
    ? (naam
      ? t('Zodra {0} je toelaat, ga je vanzelf verder. Laat dit scherm gerust open.', [naam])
      : t('Zodra de oprichter je toelaat, ga je vanzelf verder. Laat dit scherm gerust open.'))
    : stand === 'vol'
      ? t('Vraag de oprichter om eerst de open vragen in Cart Club af te handelen, en probeer het dan opnieuw.')
      : t('De oprichter heeft je vraag afgewezen of hij is verlopen. Je kunt het opnieuw vragen.');
  return (
    <div className="min-h-dvh bg-background">
      <main className="mx-auto flex min-h-dvh max-w-sm flex-col px-5 pb-8 pt-14 text-center">
        <div className="mb-4 flex justify-center" aria-hidden="true">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary text-sm font-medium text-primary-foreground">
            {initialen(naam) || <Users className="h-5 w-5" />}
          </span>
        </div>
        <h1 className="font-display text-2xl text-foreground">{titel}</h1>
        <p className="mt-2 text-sm text-muted-foreground" role="status">{uitleg}</p>
        {stand === 'wacht' && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {t('Wachten op toelating…')}
          </p>
        )}
        <div className="mt-auto space-y-3 pt-8">
          {stand === 'wacht' ? (
            <Button variant="ghost" className="min-h-11 w-full" onClick={onIntrekken} disabled={bezig}>
              {t('Vraag intrekken')}
            </Button>
          ) : (
            <Button className="min-h-12 w-full gap-2 text-base" onClick={onOpnieuw} disabled={bezig}>
              {bezig && <Loader2 className="h-4 w-4 animate-spin" />} {t('Opnieuw vragen')}
            </Button>
          )}
          <Button variant="ghost" className="min-h-11 w-full" onClick={() => window.location.assign(`${window.location.origin}/#/`)}>
            {t('Naar mijn eigen lijst')}
          </Button>
        </div>
      </main>
    </div>
  );
};

const WACHT_POLL_MS = 5_000;

const SharedList = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [stand, setStand] = useState<Stand>('laden');
  const [uitnodiging, setUitnodiging] = useState<Uitnodiging | null>(null);
  const [bezig, setBezig] = useState(false);
  // Zonder sessie wordt instappen een gastaccount; daarvoor vraagt Supabase een bot-check.
  const [zonderSessie, setZonderSessie] = useState(false);
  const { neemToken, reset: resetCaptcha } = useTurnstile('gast', zonderSessie, true);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data: { session } }) => setZonderSessie(!session));
  }, []);

  // Je bent lid: met een eigen account naar de app zelf, als gast blijf je op deze kijkpagina.
  const naarClub = useCallback(async (nieuw: boolean) => {
    if (!shareCode) return;
    const { data: ownerId, error } = await supabase.rpc('join_shared_list', { _share_code: shareCode });
    if (error || !ownerId) { setStand('onbekend'); setBezig(false); return; }
    if (nieuw) await meldNieuwLid();
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !session.user.is_anonymous) {
      window.location.replace(`${window.location.origin}/#/`);
      window.location.reload();
      return;
    }
    setUserId(ownerId);
    setStand('lid');
    setBezig(false);
  }, [shareCode]);

  // Vraagt de oprichter om erbij te mogen. Wie al lid is, gaat meteen door.
  const vraag = useCallback(async () => {
    if (!shareCode) return;
    setBezig(true);
    // De policies kijken naar auth.uid(); wie nog niet ingelogd is krijgt een gastaccount.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const captchaToken = await neemToken();
      const { error: signInError } = await supabase.auth.signInAnonymously({ options: { captchaToken } });
      resetCaptcha();
      if (signInError) {
        setBezig(false);
        toast.error(t('Instappen lukte niet. Probeer het opnieuw.'));
        return;
      }
    }

    const { data, error } = await supabase.rpc('vraag_toegang', { _share_code: shareCode });
    if (error) {
      console.error('Asking to join failed:', error);
      setBezig(false);
      toast.error(t('Instappen lukte niet. Probeer het opnieuw.'));
      return;
    }
    if (data === 'lid') { await naarClub(false); return; }
    if (data === 'wacht') void meldAanvraag();
    setStand(data === 'wacht' || data === 'vol' ? data : 'onbekend');
    setBezig(false);
  }, [shareCode, neemToken, resetCaptcha, naarClub]);

  const trekIn = async () => {
    if (!shareCode) return;
    setBezig(true);
    await supabase.rpc('trek_aanvraag_in', { _share_code: shareCode });
    setBezig(false);
    window.location.assign(`${window.location.origin}/#/`);
  };

  useEffect(() => {
    if (!shareCode) return;
    const laad = async () => {
      // Eerst de uitnodiging laten zien; vragen pas na een tik.
      const { data, error } = await supabase.rpc('cart_club_uitnodiging', { _share_code: shareCode });
      const rij = data?.[0];
      if (error) {
        console.error('Reading Cart Club invite failed:', error);
        setStand('uitnodiging');
        return;
      }
      if (!rij) { setStand('onbekend'); return; }
      setUitnodiging({ eigenaarNaam: rij.eigenaar_naam, leden: rij.leden });
      if (rij.al_lid) { await naarClub(false); return; }
      setStand(rij.aangevraagd ? 'wacht' : 'uitnodiging');
    };
    void laad();
  }, [shareCode, naarClub]);

  // Tijdens het wachten: elke paar seconden kijken of de oprichter je al toeliet.
  useEffect(() => {
    if (stand !== 'wacht' || !shareCode) return;
    let weg = false;
    const kijk = async () => {
      const { data } = await supabase.rpc('cart_club_uitnodiging', { _share_code: shareCode });
      const rij = data?.[0];
      if (weg || !rij) return;
      if (rij.al_lid) { weg = true; await naarClub(true); return; }
      if (!rij.aangevraagd) setStand('geweigerd');
    };
    const timer = window.setInterval(() => void kijk(), WACHT_POLL_MS);
    return () => { weg = true; window.clearInterval(timer); };
  }, [stand, shareCode, naarClub]);

  if (stand === 'uitnodiging' && uitnodiging) {
    return <InstapScherm uitnodiging={uitnodiging} bezig={bezig} onInstappen={() => void vraag()} />;
  }

  if (stand === 'wacht' || stand === 'geweigerd' || stand === 'vol') {
    return (
      <WachtScherm
        uitnodiging={uitnodiging}
        stand={stand}
        bezig={bezig}
        onIntrekken={() => void trekIn()}
        onOpnieuw={() => void vraag()}
      />
    );
  }

  if (stand === 'onbekend' || (stand === 'uitnodiging' && !uitnodiging)) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-display text-foreground">{t("Uitnodiging niet gevonden")}</p>
          <p className="text-muted-foreground mt-2">{t("Controleer de link en probeer opnieuw.")}</p>
        </div>
      </div>
    );
  }

  if (stand !== 'lid' || !userId) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("Laden...")}</p>
      </div>
    );
  }

  return (
    <AppProvider userId={userId}>
      <SharedListContent />
    </AppProvider>
  );
};

export default SharedList;
