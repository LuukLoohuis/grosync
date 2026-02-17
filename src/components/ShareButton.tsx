import { Share2, MessageCircle, FileDown, Link2 } from 'lucide-react';
import { useAppContext } from '@/contexts/AppContext';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import { supabase } from '@/integrations/supabase/client';

const ShareButton = () => {
  const { groceryItems, userId } = useAppContext();

  const getListText = () => {
    const unchecked = groceryItems.filter((i) => !i.checked);
    if (unchecked.length === 0) return '';
    return '🛒 Grocery List\n\n' + unchecked.map((i) => `• ${i.name}`).join('\n');
  };

  const shareWhatsApp = () => {
    const text = getListText();
    if (!text) { toast.error('No items to share!'); return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const shareViaLink = async () => {
    if (!userId) { toast.error('Je moet ingelogd zijn om te delen'); return; }
    if (groceryItems.length === 0) { toast.error('No items to share!'); return; }

    toast.loading('Deellink aanmaken...');

    // Check if user already has a shared list
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
        .insert({ name: 'Grovera', user_id: userId })
        .select()
        .single();

      if (error || !list) {
        toast.dismiss();
        toast.error('Kon geen deellink aanmaken');
        return;
      }
      shareCode = list.share_code;
    }

    const url = `${window.location.origin}/shared/${shareCode}`;
    await navigator.clipboard.writeText(url);
    toast.dismiss();
    toast.success('Link gekopieerd naar klembord!');
  };

  const downloadPDF = () => {
    const unchecked = groceryItems.filter((i) => !i.checked);
    if (unchecked.length === 0) { toast.error('No items to export!'); return; }

    const doc = new jsPDF();
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(20);
    doc.text('Grocery List', 20, 25);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(12);
    unchecked.forEach((item, i) => {
      const y = 40 + i * 8;
      if (y > 280) return;
      doc.text(`☐  ${item.name}`, 20, y);
    });
    doc.save('grocery-list.pdf');
    toast.success('PDF downloaded!');
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon"><Share2 className="h-4 w-4" /></Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={shareWhatsApp} className="gap-2 cursor-pointer">
          <MessageCircle className="h-4 w-4" /> Share via WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPDF} className="gap-2 cursor-pointer">
          <FileDown className="h-4 w-4" /> Download PDF
        </DropdownMenuItem>
        <DropdownMenuItem onClick={shareViaLink} className="gap-2 cursor-pointer">
          <Link2 className="h-4 w-4" /> Deel via link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareButton;
