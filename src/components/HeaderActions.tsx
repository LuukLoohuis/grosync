import { useState } from 'react';
import { Share2, Heart, LogOut, MoreVertical, Gauge, PieChart, LifeBuoy } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/contexts/AppContext';
import ShareListSheet from '@/components/ShareListSheet';
import UsageSheet from '@/components/UsageSheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const THEMES = [
  ['system', 'Zoals je telefoon'],
  ['light', 'Licht'],
  ['dark', 'Donker'],
] as const;

/** Share, theme menu and sign out. `onDark` styles them for the green plane on "Vandaag". */
const HeaderActions = ({ onDark = false }: { onDark?: boolean }) => {
  const { signOut } = useAuth();
  const { isAdmin } = useAppContext();
  const { theme, setTheme } = useTheme();
  const [shareOpen, setShareOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);

  const iconButton = `h-11 w-11 shrink-0 flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 ${
    onDark
      ? 'text-primary-foreground/85 hover:bg-primary-deep hover:text-primary-foreground focus-visible:ring-primary-foreground focus-visible:ring-offset-primary dark:text-foreground/85 dark:hover:bg-card dark:focus-visible:ring-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring'
  }`;

  return (
    <div className="-mr-2 flex items-center">
      <button type="button" onClick={() => setShareOpen(true)} aria-label="Lijst delen" title="Lijst delen" className={iconButton}>
        <Share2 className="h-5 w-5" strokeWidth={1.9} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label="Thema en meer" title="Thema en meer" className={iconButton}>
            <MoreVertical className="h-5 w-5" strokeWidth={1.9} />
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
          <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setUsageOpen(true)}>
            <PieChart className="h-4 w-4" /> Je tegoed
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
              <a href="#/admin"><Gauge className="h-4 w-4" /> Beheer</a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="mailto:couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
              <LifeBuoy className="h-4 w-4" /> Hulp nodig?
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="https://www.buymeacoffee.com/luukloohuis" target="_blank" rel="noopener noreferrer">
              <Heart className="h-4 w-4" /> Steun CoupleCart
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" onClick={signOut} aria-label="Uitloggen" title="Uitloggen" className={iconButton}>
        <LogOut className="h-5 w-5" strokeWidth={1.9} />
      </button>
      <ShareListSheet open={shareOpen} onOpenChange={setShareOpen} />
      <UsageSheet open={usageOpen} onOpenChange={setUsageOpen} />
    </div>
  );
};

export default HeaderActions;
