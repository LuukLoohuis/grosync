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
import { meldNieuwLid } from '@/lib/meldingen';

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
            {bezig && <Loader2 className="h-4 w-4 animate-spin" />} {t('Instappen')}
          </Button>
          <Button variant="ghost" className="min-h-11 w-full" onClick={() => window.location.assign(`${window.location.origin}/#/`)}>
            {t('Nee, bedankt')}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            {t('Uitstappen kan altijd. Wat je zelf al had, blijft bewaard.')}
          </p>
        </div>
      </main>
    </div>
  );
};

const SharedList = () => {
  const { shareCode } = useParams<{ shareCode: string }>();
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [uitnodiging, setUitnodiging] = useState<Uitnodiging | null>(null);
  const [bezig, setBezig] = useState(false);

  // Wisselt de code in voor lidmaatschap van de club; vanaf dan geeft RLS
  // toegang tot de rijen van de oprichter.
  const stapIn = useCallback(async () => {
    if (!shareCode) return;
    setBezig(true);
    // De deelpagina heeft een sessie nodig: de policies op de lijst kijken
    // naar auth.uid(). Wie nog niet ingelogd is krijgt een gastaccount.
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      const { error: signInError } = await supabase.auth.signInAnonymously();
      if (signInError) {
        setBezig(false);
        toast.error(t('Instappen lukte niet. Probeer het opnieuw.'));
        return;
      }
    }

    const { data: ownerId, error } = await supabase
      .rpc('join_shared_list', { _share_code: shareCode });

    if (error || !ownerId) {
      setBezig(false);
      setUitnodiging(null);
      setNotFound(true);
      setLoading(false);
      return;
    }

    await meldNieuwLid();

    // Met een eigen account zit je nu in de club en hoor je in de app zelf,
    // niet op deze kijkpagina. Gasten blijven hier.
    if (session && !session.user.is_anonymous) {
      window.location.replace(`${window.location.origin}/#/`);
      window.location.reload();
      return;
    }
    setUitnodiging(null);
    setUserId(ownerId);
    setBezig(false);
    setLoading(false);
  }, [shareCode]);

  useEffect(() => {
    if (!shareCode) return;

    const laad = async () => {
      // Eerst de uitnodiging laten zien; instappen pas na een tik.
      const { data, error } = await supabase.rpc('cart_club_uitnodiging', { _share_code: shareCode });
      const rij = data?.[0];
      // Kan de uitnodiging niet gelezen worden (geen verbinding, of de
      // databasefunctie staat er nog niet), dan meteen instappen zoals vroeger.
      if (error) {
        console.error('Reading Cart Club invite failed:', error);
        await stapIn();
        return;
      }
      if (!rij) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      if (rij.al_lid) {
        await stapIn();
        return;
      }
      setUitnodiging({ eigenaarNaam: rij.eigenaar_naam, leden: rij.leden });
      setLoading(false);
    };

    void laad();
  }, [shareCode, stapIn]);

  if (uitnodiging && !loading) {
    return <InstapScherm uitnodiging={uitnodiging} bezig={bezig} onInstappen={() => void stapIn()} />;
  }

  if (loading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <p className="text-muted-foreground">{t("Laden...")}</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl font-display text-foreground">{t("Uitnodiging niet gevonden")}</p>
          <p className="text-muted-foreground mt-2">{t("Controleer de link en probeer opnieuw.")}</p>
        </div>
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
