import { useCallback, useEffect, useState } from 'react';
import { FileDown, Link2, Loader2, MessageCircle, Users } from 'lucide-react';
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

interface ShareListSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ShareState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; shareCode: string | null; members: number };

const shareUrl = (code: string) => `${window.location.origin}/#/shared/${code}`;

const membersLabel = (count: number) =>
  count === 0 ? 'Nog niemand doet mee' : count === 1 ? '1 persoon doet mee' : `${count} mensen doen mee`;

const ShareListSheet = ({ open, onOpenChange }: ShareListSheetProps) => {
  const { groceryItems, userId } = useAppContext();
  const [state, setState] = useState<ShareState>({ status: 'loading' });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    setState({ status: 'loading' });
    const { data: lists, error } = await supabase
      .from('shared_lists')
      .select('share_code')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (error) {
      console.error('Loading share link failed:', error);
      setState({ status: 'error' });
      return;
    }
    const shareCode = lists?.[0]?.share_code ?? null;
    if (!shareCode) {
      setState({ status: 'ready', shareCode: null, members: 0 });
      return;
    }
    // Opening your own link also makes you a member; that does not count as someone joining.
    const { count } = await supabase
      .from('shared_list_members')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .neq('member_id', userId);
    setState({ status: 'ready', shareCode, members: count ?? 0 });
  }, [userId]);

  useEffect(() => {
    if (open) void load();
  }, [open, load]);

  const createLink = async () => {
    if (!userId) return;
    setBusy(true);
    const { data, error } = await supabase
      .from('shared_lists')
      .insert({ name: 'CoupleCart', user_id: userId })
      .select('share_code')
      .single();
    setBusy(false);
    if (error || !data) {
      toast.error('Deellink maken lukte niet. Probeer het opnieuw.');
      return;
    }
    setState({ status: 'ready', shareCode: data.share_code, members: 0 });
  };

  const copyLink = async (code: string) => {
    try {
      await navigator.clipboard.writeText(shareUrl(code));
      toast.success('Link gekopieerd');
    } catch {
      toast.error('Kopiëren lukte niet. Houd de link ingedrukt en kies Kopiëren.');
    }
  };

  const stopSharing = async () => {
    if (!userId) return;
    setBusy(true);
    // Removing the shared list also removes every membership (ON DELETE CASCADE).
    const { data, error } = await supabase.from('shared_lists').delete().eq('user_id', userId).select('id');
    setBusy(false);
    if (error || !data?.length) {
      if (error) console.error('Stop sharing failed:', error);
      toast.error('Stoppen met delen lukte niet. Probeer het opnieuw.');
      return;
    }
    setState({ status: 'ready', shareCode: null, members: 0 });
    toast.success('Je lijst wordt niet meer gedeeld');
  };

  const uncheckedNames = groceryItems.filter((i) => !i.checked).map((i) => i.name);

  const shareWhatsApp = () => {
    if (uncheckedNames.length === 0) { toast.error('Je lijst is leeg, er valt niets te sturen'); return; }
    const text = '🛒 Boodschappenlijst\n\n' + uncheckedNames.map((name) => `• ${name}`).join('\n');
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const downloadPDF = () => {
    if (uncheckedNames.length === 0) { toast.error('Je lijst is leeg, er valt niets te downloaden'); return; }
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
    toast.success('PDF gedownload');
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="mx-auto flex max-h-[90dvh] max-w-lg flex-col gap-0 rounded-t-2xl p-0">
        <SheetHeader className="px-5 pb-3 pt-5 pr-14 text-left">
          <SheetTitle className="font-display text-xl">Deel je lijst</SheetTitle>
          <SheetDescription>Wie de link opent, kijkt en vinkt mee op je lijst.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-5 overflow-y-auto px-5 pb-5">
          {state.status === 'loading' && (
            <p className="flex min-h-11 items-center gap-2 text-sm text-muted-foreground" role="status">
              <Loader2 className="h-4 w-4 animate-spin" /> Deellink ophalen…
            </p>
          )}

          {state.status === 'error' && (
            <p className="text-sm text-muted-foreground">
              Je deellink ophalen lukte niet.{' '}
              <button type="button" onClick={() => void load()} className="min-h-11 font-medium text-primary hover:underline">
                Opnieuw proberen
              </button>
            </p>
          )}

          {state.status === 'ready' && !state.shareCode && (
            <div className="space-y-3">
              <p className="text-sm text-foreground">Je lijst wordt nog niet gedeeld.</p>
              <Button className="min-h-11 w-full gap-2" onClick={createLink} disabled={busy}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />}
                Maak een deellink
              </Button>
            </div>
          )}

          {state.status === 'ready' && state.shareCode && (
            <div className="space-y-3">
              <label htmlFor="share-link" className="sr-only">Deellink</label>
              <Input
                id="share-link"
                readOnly
                value={shareUrl(state.shareCode)}
                onFocus={(e) => e.currentTarget.select()}
                className="bg-card font-body text-sm"
              />
              <Button className="min-h-11 w-full gap-2" onClick={() => copyLink(state.shareCode!)}>
                <Link2 className="h-4 w-4" /> Link kopiëren
              </Button>
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" /> {membersLabel(state.members)}
              </p>
            </div>
          )}

          <div className="space-y-2 border-t border-border pt-4">
            <p className="text-sm font-medium text-foreground">Of stuur de lijst zelf</p>
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="min-h-11 gap-2" onClick={shareWhatsApp}>
                <MessageCircle className="h-4 w-4" /> Via WhatsApp
              </Button>
              <Button variant="outline" className="min-h-11 gap-2" onClick={downloadPDF}>
                <FileDown className="h-4 w-4" /> Als PDF
              </Button>
            </div>
          </div>

          {state.status === 'ready' && state.shareCode && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  type="button"
                  disabled={busy}
                  className="min-h-11 w-full rounded-md text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  Stop met delen
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Stoppen met delen?</AlertDialogTitle>
                  <AlertDialogDescription>Wie de link heeft, ziet je lijst niet meer.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuleren</AlertDialogCancel>
                  <AlertDialogAction onClick={stopSharing} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Stop met delen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ShareListSheet;
