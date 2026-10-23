import React, { useCallback, useEffect, useState } from 'react';
import { FileDown, Link2, Loader2, LogOut, MessageCircle, QrCode, Unlink, UserMinus, UserPlus, Users } from 'lucide-react';
import { toast } from 'sonner';
import { lijstAlsTekst } from '@/lib/lijstTekst';
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
import { clubUrl, initialen, leesCode, toonCode } from '@/lib/cartClub';

interface KoppelSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type LinkState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; shareCode: string | null };

interface Lid { user_id: string; naam: string | null; eigenaar: boolean; jij: boolean }

// jsPDF is big and only needed for "Als PDF", so it loads once this sheet opens. By the time
// you tap the button it is in, and the tap still counts as the one that starts the download.
const loadPdf = () => import('jspdf');
// The QR code is only drawn when you ask for it.
const loadQr = () => import('qrcode-generator');

const AVATAR = [
  'bg-primary text-primary-foreground',
  'bg-secondary/20 text-accent-ink',
  'bg-info/15 text-info',
  'bg-primary-soft text-primary-deep',
];

/**
 * Cart Club: één CoupleCart voor iedereen die je erbij haalt — je partner,
 * huisgenoten, het hele gezin. De oprichter maakt een uitnodiging (link, QR of
 * code); wie hem gebruikt stapt in en ziet vanaf dan alles: lijst, recepten,
 * kast, favorieten en weekplan. Uitstappen kan altijd; wat de club samen deed
 * blijft bij de oprichter.
 */
const KoppelSheet = ({ open, onOpenChange }: KoppelSheetProps) => {
  const { groceryItems, selfId, household } = useAppContext();
  const [state, setState] = useState<LinkState>({ status: 'loading' });
  const [leden, setLeden] = useState<Lid[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [codeFout, setCodeFout] = useState(false);
  const lid = household.rol === 'lid';
  const anderen = (leden ?? []).filter((l) => !l.jij);

  const laadLeden = useCallback(async () => {
    const { data, error } = await supabase.rpc('cart_club_leden');
    if (error) { console.error('Loading Cart Club members failed:', error); return; }
    setLeden(data ?? []);
  }, []);

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
    setState({ status: 'ready', shareCode: lists?.[0]?.share_code ?? null });
  }, [selfId]);

  useEffect(() => {
    if (!open) { setQr(null); return; }
    void laadLeden();
    if (!lid) void load();
  }, [open, lid, load, laadLeden]);

  useEffect(() => {
    if (open) loadPdf().catch(() => undefined);
  }, [open]);

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
      toast.error(t('Uitnodiging maken lukte niet. Probeer het opnieuw.'));
      return;
    }
    setState({ status: 'ready', shareCode: data.share_code });
  };

  const copyLink = async (shareCode: string) => {
    try {
      await navigator.clipboard.writeText(clubUrl(shareCode));
      toast.success(t("Link gekopieerd"));
    } catch {
      toast.error(t("Kopiëren lukte niet. Houd de link ingedrukt en kies Kopiëren."));
    }
  };

  const sendLink = (shareCode: string) => {
    const text = t('Kom erbij in mijn Cart Club op CoupleCart, dan delen we de boodschappenlijst: {0}', [clubUrl(shareCode)]);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const toonQr = async (shareCode: string) => {
    if (qr) { setQr(null); return; }
    const mod = await loadQr().catch(() => null);
    if (!mod) { toast.error(t('De QR-code kon niet laden. Controleer je verbinding en probeer het opnieuw.')); return; }
    const maak = (mod as unknown as { default?: typeof mod }).default ?? mod;
    const q = (maak as unknown as (type: number, level: string) => { addData(d: string): void; make(): void; createSvgTag(o: object): string })(0, 'M');
    q.addData(clubUrl(shareCode));
    q.make();
    setQr(q.createSvgTag({ cellSize: 6, margin: 2, scalable: true }));
  };

  /** Oprichter haalt één persoon uit de club. */
  const verwijderLid = async (l: Lid) => {
    if (!selfId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('shared_list_members')
      .delete()
      .eq('owner_id', selfId)
      .eq('member_id', l.user_id)
      .select('id');
    setBusy(false);
    if (error || !data?.length) {
      if (error) console.error('Removing member failed:', error);
      toast.error(t('Verwijderen lukte niet. Probeer het opnieuw.'));
      return;
    }
    await Promise.all([laadLeden(), household.refresh()]);
    toast.success(t('{0} is uit de club', [l.naam ?? t('Gast')]));
  };

  /** Oprichter: de uitnodiging en alle lidmaatschappen eraan verdwijnen (ON DELETE CASCADE). */
  const hefOp = async () => {
    if (!selfId) return;
    setBusy(true);
    const { data, error } = await supabase.from('shared_lists').delete().eq('user_id', selfId).select('id');
    setBusy(false);
    if (error || !data?.length) {
      if (error) console.error('Unpairing failed:', error);
      toast.error(t('Opheffen lukte niet. Probeer het opnieuw.'));
      return;
    }
    setState({ status: 'ready', shareCode: null });
    setQr(null);
    await Promise.all([laadLeden(), household.refresh()]);
    toast.success(t('Cart Club opgeheven'));
  };

  /** Lid: terug naar je eigen omgeving; de app laadt opnieuw met je eigen rijen. */
  const stapUit = async () => {
    setBusy(true);
    const gelukt = await household.leave();
    setBusy(false);
    if (!gelukt) {
      toast.error(t('Uitstappen lukte niet. Probeer het opnieuw.'));
      return;
    }
    toast.success(t('Je bent uitgestapt'));
    window.setTimeout(() => window.location.reload(), 600);
  };

  const gebruikCode = (e: React.FormEvent) => {
    e.preventDefault();
    const gelezen = leesCode(code);
    if (!gelezen) { setCodeFout(true); return; }
    window.location.assign(clubUrl(gelezen));
  };

  const uncheckedNames = groceryItems.filter((i) => !i.checked).map((i) => i.name);

  const shareWhatsApp = () => {
    if (uncheckedNames.length === 0) { toast.error(t("Je lijst is leeg, er valt niets te sturen")); return; }
    // Dezelfde tekst als 'Delen als tekst' op de lijst: per afdeling, met aantallen.
    const text = lijstAlsTekst(groceryItems);
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const downloadPDF = async () => {
    if (uncheckedNames.length === 0) { toast.error(t("Je lijst is leeg, er valt niets te downloaden")); return; }
    const pdf = await loadPdf().catch(() => null);
    if (!pdf) { toast.error(t("De PDF kon niet laden. Controleer je verbinding en probeer het opnieuw.")); return; }
    const doc = new pdf.jsPDF();
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

  const bevestig = (
    trigger: React.ReactNode,
    titel: string,
    uitleg: string,
    knop: string,
    actie: () => void,
  ) => (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titel}</AlertDialogTitle>
          <AlertDialogDescription>{uitleg}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Annuleren")}</AlertDialogCancel>
          <AlertDialogAction onClick={actie} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {knop}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );

  const rodeKnop = (Icon: typeof Unlink, label: string) => (
    <button
      type="button"
      disabled={busy}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md text-sm font-medium text-destructive hover:bg-destructive/10"
    >
      <Icon className="h-4 w-4" /> {label}
    </button>
  );

  const ledenAantal = leden?.length ?? 0;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90vh] [@supports(height:100dvh)]:max-h-[90dvh] max-w-lg flex-col gap-0 rounded-t-[20px] p-0 shadow-sheet">
        <SheetHeader className="px-5 pb-3 pt-5 pr-14 text-left">
          <SheetTitle className="flex items-center gap-2 font-display text-xl">
            <Users className="h-5 w-5 text-primary" aria-hidden="true" /> {t('Cart Club')}
          </SheetTitle>
          <SheetDescription>
            {t('Haal je partner, huisgenoten of het hele gezin erbij. Iedereen in de club ziet en bewerkt alles: lijst, recepten, kast, favorieten en weekplan.')}
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          {leden && ledenAantal > 1 && (
            <section aria-labelledby="club-leden">
              <h3 id="club-leden" className="mb-1 text-sm font-medium text-foreground">
                {t('{0} in de club', [ledenAantal])}
              </h3>
              <ul className="divide-y divide-border">
                {leden.map((l, i) => (
                  <li key={l.user_id} className="flex min-h-12 items-center gap-3 py-2">
                    <span
                      aria-hidden="true"
                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-medium ${AVATAR[i % AVATAR.length]}`}
                    >
                      {initialen(l.naam) || <Users className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm text-foreground">
                      {l.naam ?? t('Gast')}
                      {l.jij && <span className="text-muted-foreground"> ({t('jij')})</span>}
                    </span>
                    {l.eigenaar && (
                      <span className="rounded-full bg-primary-soft px-2 py-0.5 text-xs text-primary-deep">{t('Oprichter')}</span>
                    )}
                    {!lid && !l.jij && bevestig(
                      <button
                        type="button"
                        disabled={busy}
                        aria-label={t('{0} uit de club halen', [l.naam ?? t('Gast')])}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-destructive"
                      >
                        <UserMinus className="h-4 w-4" />
                      </button>,
                      t('{0} uit de club halen?', [l.naam ?? t('Gast')]),
                      t('Die persoon gaat terug naar een eigen omgeving. Alles wat jullie samen deden blijft bij jou.'),
                      t('Uit de club halen'),
                      () => void verwijderLid(l),
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {lid && bevestig(
            rodeKnop(LogOut, t('Uitstappen')),
            t('Uitstappen?'),
            t('Je gaat terug naar je eigen omgeving. Alles wat jullie samen deden blijft in de club.'),
            t('Uitstappen'),
            () => void stapUit(),
          )}

          {!lid && state.status === 'loading' && (
            <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> {t('Uitnodiging ophalen…')}
            </p>
          )}

          {!lid && state.status === 'error' && (
            <p className="text-sm text-muted-foreground">
              {t('Je uitnodiging ophalen lukte niet.')}{' '}
              <button type="button" onClick={() => void load()} className="min-h-11 font-medium text-primary hover:underline">
                {t("Opnieuw proberen")}
              </button>
            </p>
          )}

          {!lid && state.status === 'ready' && !state.shareCode && (
            <Button className="min-h-11 w-full gap-2" onClick={createLink} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {t('Iemand uitnodigen')}
            </Button>
          )}

          {!lid && state.status === 'ready' && state.shareCode && (
            <section aria-labelledby="club-uitnodigen" className="space-y-3 rounded-[14px] border border-border bg-card p-3">
              <h3 id="club-uitnodigen" className="text-sm font-medium text-foreground">
                {ledenAantal > 1 ? t('Nog iemand erbij halen') : t('Iemand erbij halen')}
              </h3>
              <Button className="min-h-11 w-full gap-2" onClick={() => sendLink(state.shareCode!)}>
                <MessageCircle className="h-4 w-4" /> {t('Uitnodigen via WhatsApp')}
              </Button>
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="min-h-11 gap-2" onClick={() => void copyLink(state.shareCode!)}>
                  <Link2 className="h-4 w-4" /> {t("Link kopiëren")}
                </Button>
                <Button variant="outline" className="min-h-11 gap-2" aria-expanded={Boolean(qr)} onClick={() => void toonQr(state.shareCode!)}>
                  <QrCode className="h-4 w-4" /> {qr ? t('QR verbergen') : t('Laat QR zien')}
                </Button>
              </div>
              {qr && (
                <div className="flex flex-col items-center gap-2 pt-1">
                  <div
                    role="img"
                    aria-label={t('QR-code van je uitnodiging')}
                    className="h-48 w-48 rounded-[12px] bg-white p-2 text-black [&_svg]:h-full [&_svg]:w-full"
                    dangerouslySetInnerHTML={{ __html: qr }}
                  />
                  <p className="text-xs text-muted-foreground">{t('Laat scannen met de camera van de ander.')}</p>
                </div>
              )}
              <p className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                {t('Of geef de code:')}
                <span className="rounded-md bg-muted px-2 py-0.5 font-mono text-base tracking-widest text-foreground">
                  {toonCode(state.shareCode)}
                </span>
              </p>
            </section>
          )}

          {!lid && state.status === 'ready' && state.shareCode && bevestig(
            rodeKnop(Unlink, ledenAantal > 1 ? t('Club opheffen') : t('Uitnodiging intrekken')),
            ledenAantal > 1 ? t('Club opheffen?') : t('Uitnodiging intrekken?'),
            ledenAantal > 1
              ? t('Iedereen gaat terug naar een eigen omgeving en de uitnodiging werkt niet meer. Alles wat jullie samen deden blijft bij jou.')
              : t('De link, QR-code en code werken dan niet meer.'),
            ledenAantal > 1 ? t('Opheffen') : t('Intrekken'),
            () => void hefOp(),
          )}

          {!lid && ledenAantal <= 1 && (
            <form onSubmit={gebruikCode} className="space-y-2 border-t border-border pt-4" noValidate>
              <label htmlFor="club-code" className="text-sm font-medium text-foreground">{t('Heb je een code gekregen?')}</label>
              <div className="flex gap-2">
                <Input
                  id="club-code"
                  value={code}
                  onChange={(e) => { setCode(e.target.value); setCodeFout(false); }}
                  placeholder="7F3A-9C1B"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={codeFout}
                  aria-describedby={codeFout ? 'club-code-fout' : undefined}
                  className="bg-card font-mono tracking-widest"
                />
                <Button type="submit" variant="outline" className="min-h-11 shrink-0">{t('Instappen')}</Button>
              </div>
              {codeFout && (
                <p id="club-code-fout" className="text-sm text-destructive">{t('Een code heeft 8 tekens, zoals 7F3A-9C1B.')}</p>
              )}
            </form>
          )}
          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">{t("Of stuur de lijst zelf")}</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11 gap-2" onClick={shareWhatsApp}>
                <MessageCircle className="h-4 w-4" /> {t("Via WhatsApp")}
              </Button>
              <Button variant="outline" className="min-h-11 gap-2" onClick={() => void downloadPDF()}>
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
