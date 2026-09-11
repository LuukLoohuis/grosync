import { MoreVertical, MessageCircle, FileDown, Link2, Heart, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { useAppContext } from '@/contexts/AppContext';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const AppMenu = () => {
  const { groceryItems, userId } = useAppContext();
  const { signOut } = useAuth();

  const getListText = () => {
    const unchecked = groceryItems.filter((i) => !i.checked);
    if (unchecked.length === 0) return '';
    return '🛒 Boodschappenlijst\n\n' + unchecked.map((i) => `• ${i.name}`).join('\n');
  };

  const shareWhatsApp = () => {
    const text = getListText();
    if (!text) { toast.error('Je lijst is leeg, er valt niets te delen'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaLink = async () => {
    if (!userId) { toast.error('Je moet ingelogd zijn om te delen'); return; }
    if (groceryItems.length === 0) { toast.error('Je lijst is leeg, er valt niets te delen'); return; }

    const loadingToast = toast.loading('Deellink aanmaken…');

    // Check if user already has a shared list (owner can query directly via RLS)
    const { data: existing } = await supabase
      .from('shared_lists')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    let shareCode: string;

    if (existing) {
      shareCode = existing.share_code;
    } else {
      const { data: list, error } = await supabase
        .from('shared_lists')
        .insert({ name: 'CoupleCart', user_id: userId })
        .select()
        .single();

      if (error || !list) {
        toast.dismiss(loadingToast);
        toast.error('Deellink aanmaken lukte niet. Probeer het opnieuw.');
        return;
      }
      shareCode = list.share_code;
    }

    const url = `${window.location.origin}/#/shared/${shareCode}`;
    await navigator.clipboard.writeText(url);
    toast.dismiss(loadingToast);
    toast.success('Link gekopieerd');
  };

  const downloadPDF = () => {
    const unchecked = groceryItems.filter((i) => !i.checked);
    if (unchecked.length === 0) { toast.error('Je lijst is leeg, er valt niets te downloaden'); return; }

    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Boodschappenlijst', 20, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    unchecked.forEach((item, i) => {
      const y = 40 + i * 8;
      if (y > 280) return;
      doc.text(`☐  ${item.name}`, 20, y);
    });
    doc.save('boodschappenlijst.pdf');
    toast.success('PDF gedownload');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label="Menu"
          className="-mr-2 h-11 w-11 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <MoreVertical className="h-5 w-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Lijst delen</DropdownMenuLabel>
        <DropdownMenuItem onSelect={shareWhatsApp} className="gap-2 min-h-11 cursor-pointer">
          <MessageCircle className="h-4 w-4" /> Delen via WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={shareViaLink} className="gap-2 min-h-11 cursor-pointer">
          <Link2 className="h-4 w-4" /> Deellink kopiëren
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadPDF} className="gap-2 min-h-11 cursor-pointer">
          <FileDown className="h-4 w-4" /> Download als PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
          <a href="https://www.buymeacoffee.com/luukloohuis" target="_blank" rel="noopener noreferrer">
            <Heart className="h-4 w-4" /> Steun CoupleCart
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut} className="gap-2 min-h-11 cursor-pointer">
          <LogOut className="h-4 w-4" /> Uitloggen
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default AppMenu;
