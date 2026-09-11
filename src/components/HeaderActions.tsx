import { useState } from 'react';
import { Share2, Heart, LogOut, MoreVertical } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import ShareListSheet from '@/components/ShareListSheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const ICON_BUTTON =
  'h-11 w-11 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const THEMES = [
  ['system', 'Zoals je telefoon'],
  ['light', 'Licht'],
  ['dark', 'Donker'],
] as const;

const HeaderActions = () => {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="-mr-2 flex items-center">
      <button type="button" onClick={() => setShareOpen(true)} aria-label="Lijst delen" title="Lijst delen" className={ICON_BUTTON}>
        <Share2 className="h-5 w-5" />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Thema en meer" title="Thema en meer" className={ICON_BUTTON}>
            <MoreVertical className="h-5 w-5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Thema</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
            {THEMES.map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value} className="min-h-11 cursor-pointer">
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="https://www.buymeacoffee.com/luukloohuis" target="_blank" rel="noopener noreferrer">
              <Heart className="h-4 w-4" /> Steun CoupleCart
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" onClick={signOut} aria-label="Uitloggen" title="Uitloggen" className={ICON_BUTTON}>
        <LogOut className="h-5 w-5" />
      </button>
      <ShareListSheet open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
};

export default HeaderActions;
