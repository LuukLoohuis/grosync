import { Share2, MessageCircle, FileDown } from 'lucide-react';
import { useStore } from '@/store';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';
import jsPDF from 'jspdf';

const ShareButton = () => {
  const { groceryItems } = useStore();

  const getListText = () => {
    const unchecked = groceryItems.filter((i) => !i.checked);
    if (unchecked.length === 0) return '';
    return '🛒 Grocery List\n\n' + unchecked.map((i) => `• ${i.name}`).join('\n');
  };

  const shareWhatsApp = () => {
    const text = getListText();
    if (!text) {
      toast.error('No items to share!');
      return;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const downloadPDF = () => {
    const unchecked = groceryItems.filter((i) => !i.checked);
    if (unchecked.length === 0) {
      toast.error('No items to export!');
      return;
    }

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
        <Button variant="outline" size="icon">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={shareWhatsApp} className="gap-2 cursor-pointer">
          <MessageCircle className="h-4 w-4" /> Share via WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={downloadPDF} className="gap-2 cursor-pointer">
          <FileDown className="h-4 w-4" /> Download PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default ShareButton;
