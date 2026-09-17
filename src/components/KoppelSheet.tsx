import { useCallback, useEffect, useState } from 'react';
import { FileDown, Link2, Loader2, MessageCircle, Unlink, Users } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { useAppContext } from '@/contexts/AppContext';
import { supabase } from '@/integrations/supabase/client';
import { t } from '@/lib/i18n';

interface KoppelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LinkState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; shareCode: string | null; members: number };

const koppelUrl = (code: string) => `${window.location.origin}/#/shared/${code}`;

const gekoppeldLabel = (count: number) =>
  count === 0
    ? t('Nog niemand gekoppeld — stuur de link naar je partner.')
    : count === 1 ? t('Gekoppeld · 1 persoon') : t('Gekoppeld · {0} personen', [count]);

/**
 * Koppelen: twee accounts in één omgeving. De eigenaar maakt een link, de
 * partner opent hem, en vanaf dan zien ze allebei alles. Ontkoppelen kan van
 * beide kanten; wat jullie samen deden blijft bij wie de link maakte.
 */
const KoppelSheet = ({ open, onOpenChange }: KoppelSheetProps) => {
  const { groceryItems, selfId, household } = useAppContext();
  const [state, setState] = useState<LinkState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);
  const lid = household.rol === 'lid';

  const load = useCallback(async () => {
    if (!selfId) return;
    setState({ status: 'loading' });
    const { data: lists, error } = await supabase
      .from('shared_lists')
      .select('share_code')
      .eq('user_id', selfId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) {
      console.error('Loading pairing link failed:', error);
      setState({ status: 'error' });
      return;
    }
    const shareCode = lists?.[0]?.share_code ?? null;
    if (!shareCode) {
      setState({ status: 'ready', shareCode: null, members: 0 });
      return;
    }
    // Je eigen link openen maakt jezelf ook lid; dat telt niet als partner.
    const { count } = await supabase
      .from('shared_list_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', selfId)
      .neq('member_id', selfId);
    setState({ status: 'ready', shareCode, members: count ?? 0 });
  }, [selfId]);

  useEffect(() => {
    if (open && !lid) void load();
  }, [open, lid, load]);

  const createLink = async () => {
    if (!selfId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('shared_lists')
      .insert({ name: 'CoupleCart', user_id: selfId })
      .select('share_code')
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error(t('Koppellink maken lukte niet. Probeer het opnieuw.'));
      return;
    }
    setState({ status: 'ready', shareCode: data.share_code, members: 0 });
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(koppelUrl(code));
      toast.success(t("Link gekopieerd"));
    } catch {
      toast.error(t("Kopiëren lukte niet. Houd de link ingedrukt en kies Kopiëren."));
    }
  };

  const sendLink = (code: string) => {
    const text = t('Koppel je CoupleCart met de mijne: {0}', [koppelUrl(code)]);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  /** Eigenaar: de link en alle koppelingen eraan verdwijnen (ON DELETE CASCADE). */
  const ontkoppelAlsEigenaar = async () => {
    if (!selfId) return;
    setBusy(true);
    const { data, error } = await supabase.from('shared_lists').delete().eq('user_id', selfId).select('id');
    setBusy(false);
    if (error || !data?.length) {
      if (error) console.error('Unpairing failed:', error);
      toast.error(t('Ontkoppelen lukte niet. Probeer het opnieuw.'));
      return;
    }
    setState({ status: 'ready', shareCode: null, members: 0 });
    await household.refresh();
    toast.success(t('Ontkoppeld'));
  };

  /** Lid: terug naar je eigen omgeving; de app laadt opnieuw met je eigen rijen. */
  const ontkoppelAlsLid = async () => {
    setBusy(true);
    const gelukt = await household.leave();
    setBusy(false);
    if (!gelukt) {
      toast.error(t('Ontkoppelen lukte niet. Probeer het opnieuw.'));
      return;
    }
    toast.success(t('Ontkoppeld'));
    window.setTimeout(() => window.location.reload(), 600);
  };

  const uncheckedNames = groceryItems.filter((i) => !i.checked).map((i) => i.name);

  const shareWhatsApp = () => {
    if (uncheckedNames.length === 0) { toast.error(t("Je lijst is leeg, er valt niets te sturen")); return; }
    const text = '🛒 Boodschappenlijst\n\n' + uncheckedNames.map((name) => `• ${name}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const downloadPDF = () => {
    if (uncheckedNames.length === 0) { toast.error(t("Je lijst is leeg, er valt niets te downloaden")); return; }
    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Boodschappenlijst', 20, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    uncheckedNames.forEach((name, i) => {
      const y = 40 + i * 8;
      if (y > 280) return;
      doc.text(`☐  ${name}`, 20, y);
    });
    doc.save('boodschappenlijst.pdf');
    toast.success(t("PDF gedownload"));
  };

  const ontkoppelKnop = (uitleg: string, actie: () => void) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          disabled={busy}
          className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10"
        >
          <Unlink className="h-4 w-4" /> {t('Ontkoppelen')}
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('Ontkoppelen?')}</AlertDialogTitle>
          <AlertDialogDescription>{uitleg}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Annuleren")}</AlertDialogCancel>
          <AlertDialogAction onClick={actie} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {t('Ontkoppelen')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90vh] [@supports(height:100dvh)]:max-h-[90dvh] max-w-lg flex-col gap-0 rounded-t-[20px] p-0 shadow-sheet">
        <SheetHeader className="px-5 pb-3 pt-5 pr-14 text-left">
          <SheetTitle className="font-display text-xl">{t('Koppelen')}</SheetTitle>
          <SheetDescription>
            {lid
              ? t('Je bent gekoppeld. Jullie delen lijst, recepten, kast, favorieten en weekplan.')
              : t('Koppel je CoupleCart met je partner. Vanaf dan zien jullie allebei alles: lijst, recepten, kast, favorieten en weekplan.')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          {lid && (
            <div className="space-y-3">
              <p className="flex items-center gap-2 rounded-[12px] border border-border bg-primary-soft px-3 py-2.5 text-sm text-primary-deep">
                <Users className="h-4 w-4 shrink-0" /> {t('Gekoppeld met je partner')}
              </p>
              {ontkoppelKnop(
                t('Je gaat terug naar je eigen omgeving. Alles wat jullie samen deden blijft bij je partner.'),
                () => void ontkoppelAlsLid(),
              )}
            </div>
          )}

          {!lid && state.status === 'loading' && (
            <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('Koppellink ophalen…')}
            </p>
          )}

          {!lid && state.status === 'error' && (
            <p className="text-sm text-muted-foreground">
              {t('Je koppellink ophalen lukte niet.')}{' '}
              <button type="button" onClick={() => void load()} className="min-h-11 font-medium text-primary hover:underline">
                {t("Opnieuw proberen")}
              </button>
            </p>
          )}

          {!lid && state.status === 'ready' && !state.shareCode && (
            <Button className="min-h-11 w-full gap-2" onClick={createLink} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
              {t('Maak een koppellink')}
            </Button>
          )}

          {!lid && state.status === 'ready' && state.shareCode && (
            <div className="space-y-3">
              <label htmlFor="koppel-link" className="sr-only">{t('Koppellink')}</label>
              <Input
                id="koppel-link"
                readOnly
                value={koppelUrl(state.shareCode)}
                onFocus={(e) => e.currentTarget.select()}
                className="bg-card font-body text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <Button className="min-h-11 gap-2" onClick={() => copyLink(state.shareCode!)}>
                  <Link2 className="h-4 w-4" /> {t("Link kopiëren")}
                </Button>
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => sendLink(state.shareCode!)}>
                  <MessageCircle className="h-4 w-4" /> {t('Stuur via WhatsApp')}
                </Button>
              </div>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4 shrink-0" /> {gekoppeldLabel(state.members)}
              </p>
              {ontkoppelKnop(
                t('Je partner gaat terug naar zijn eigen omgeving. Alles wat jullie samen deden blijft bij jou.'),
                () => void ontkoppelAlsEigenaar(),
              )}
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">{t("Of stuur de lijst zelf")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11 gap-2" onClick={shareWhatsApp}>
                <MessageCircle className="h-4 w-4" /> {t("Via WhatsApp")}
              </Button>
              <Button variant="outline" className="min-h-11 gap-2" onClick={downloadPDF}>
                <FileDown className="h-4 w-4" /> {t("Als PDF")}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default KoppelSheet;
