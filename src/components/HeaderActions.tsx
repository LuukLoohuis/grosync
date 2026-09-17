import { useState } from 'react';
import { Heart, LogOut, MoreVertical, Gauge, PieChart, LifeBuoy, FileText, Link2 } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useAppContext } from '@/contexts/AppContext';
import KoppelSheet from '@/components/KoppelSheet';
import UsageSheet from '@/components/UsageSheet';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Taal, setTaal, t, taal } from '@/lib/i18n';

const THEMES = [
  ['system', t('Zoals je telefoon')],
  ['light', t('Licht')],
  ['dark', t('Donker')],
] as const;

const TALEN: [Taal, string][] = [
  ['nl', 'Nederlands'],
  ['en', 'English'],
];

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
      <button type="button" onClick={() => setShareOpen(true)} aria-label={t("Koppelen")} title={t("Koppelen")} className={iconButton}>
        <Link2 className="h-5 w-5" strokeWidth={1.9} />
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t("Thema en meer")} title={t("Thema en meer")} className={iconButton}>
            <MoreVertical className="h-5 w-5" strokeWidth={1.9} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>{t("Thema")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme}>
            {THEMES.map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value} className="min-h-11 cursor-pointer">
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t('Taal')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={taal()} onValueChange={(waarde) => setTaal(waarde as Taal)}>
            {TALEN.map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value} className="min-h-11 cursor-pointer">
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setUsageOpen(true)}>
            <PieChart className="h-4 w-4" /> {t("Je tegoed")}
          </DropdownMenuItem>
          {isAdmin && (
            <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
              <a href="#/admin"><Gauge className="h-4 w-4" /> {t("Beheer")}</a>
            </DropdownMenuItem>
          )}
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="#/info/voorwaarden"><FileText className="h-4 w-4" /> {t("Voorwaarden en privacy")}</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="mailto:couplecart@gmail.com?subject=Hulp%20bij%20CoupleCart">
              <LifeBuoy className="h-4 w-4" /> {t("Hulp nodig?")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="https://www.buymeacoffee.com/luukloohuis" target="_blank" rel="noopener noreferrer">
              <Heart className="h-4 w-4" /> {t("Steun CoupleCart")}
            </a>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <button type="button" onClick={signOut} aria-label={t("Uitloggen")} title={t("Uitloggen")} className={iconButton}>
        <LogOut className="h-5 w-5" strokeWidth={1.9} />
      </button>
      <KoppelSheet open={shareOpen} onOpenChange={setShareOpen} />
      <UsageSheet open={usageOpen} onOpenChange={setUsageOpen} />
    </div>
  );
};

export default HeaderActions;
