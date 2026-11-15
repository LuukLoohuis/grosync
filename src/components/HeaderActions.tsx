import { useEffect, useState } from 'react';
import { Bell, Heart, LogOut, MoreVertical, Gauge, LifeBuoy, SquarePlus, Users } from 'lucide-react';
import { useTheme } from 'next-themes';
import { useAuth } from '@/hooks/useAuth';
import { useInstallHint } from '@/hooks/useInstallHint';
import { PlusMerk } from '@/components/PlusMerk';
import { useAppContext } from '@/contexts/AppContext';
import { useAdminMeldingen } from '@/hooks/useAdminMeldingen';
import AccountSheet, { AccountMenuItem } from '@/components/AccountSheet';
import GastUitlogDialog from '@/components/GastUitlogDialog';
import { LazySheet } from '@/components/LazyBoundary';
import { isIos } from '@/lib/installHint';
import { lazyPart, preloadWhenIdle } from '@/lib/lazyPart';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup,
  DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { type Taal, setTaal, t, taal } from '@/lib/i18n';
import { isGast } from '@/lib/accountUpgrade';

// The sheets behind these buttons load on demand, each in its own chunk.
const KoppelSheet = lazyPart(() => import('@/components/KoppelSheet'));
const UsageSheet = lazyPart(() => import('@/components/UsageSheet'));
const InstallSheet = lazyPart(() => import('@/components/InstallSheet'));
const MeldingenSheet = lazyPart(() => import('@/components/MeldingenSheet'));

const THEMES = [
  ['system', t('Auto')],
  ['light', t('Licht')],
  ['dark', t('Donker')],
] as const;

const TALEN: [Taal, string][] = [
  ['nl', 'Nederlands'],
  ['en', 'English'],
];

// Thema en taal als knoppen naast elkaar: twee regels in plaats van zeven.
const SEGMENT = 'min-h-10 justify-center rounded-lg px-2 text-[0.8125rem] font-medium text-muted-foreground [&>span:first-child]:hidden data-[state=checked]:bg-primary-soft data-[state=checked]:text-primary focus:bg-muted focus:text-foreground data-[state=checked]:focus:bg-primary-soft data-[state=checked]:focus:text-primary';

/** Plus, Cart Club and one menu for the rest; sign out lives at the bottom of that menu. `onDark` styles them for the green plane on "Vandaag". */
const HeaderActions = ({ onDark = false }: { onDark?: boolean }) => {
  const { session, signOut } = useAuth();
  const { isAdmin, plus } = useAppContext();
  const adminMeldingen = useAdminMeldingen(isAdmin);
  const { theme, setTheme } = useTheme();
  const [shareOpen, setShareOpen] = useState(false);
  const [usageOpen, setUsageOpen] = useState(false);
  const install = useInstallHint();
  const [installOpen, setInstallOpen] = useState(false);
  const [meldOpen, setMeldOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [uitlogVraag, setUitlogVraag] = useState(false);
  const gast = isGast(session?.user);

  useEffect(() => preloadWhenIdle([KoppelSheet, UsageSheet, InstallSheet]), []);

  const iconButton = `h-11 w-11 shrink-0 flex items-center justify-center rounded-xl transition-colors focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 ${
    onDark
      ? 'text-primary-foreground/85 hover:bg-primary-deep hover:text-primary-foreground focus-visible:ring-primary-foreground focus-visible:ring-offset-primary dark:text-foreground/85 dark:hover:bg-card dark:focus-visible:ring-foreground'
      : 'text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-ring'
  }`;

  return (
    <div className="-mr-2 flex items-center">
      {/* Zonder Plus een rustig pilletje met het zegel; met Plus alleen het zegel, als teken dat je lid bent. */}
      <button
        type="button"
        onClick={() => setUsageOpen(true)}
        aria-label={plus ? t("Jouw Plus") : t("CoupleCart Plus")}
        title={plus ? t("Jouw Plus") : t("CoupleCart Plus")}
        className={`mr-1 flex h-8 shrink-0 items-center gap-1.5 rounded-full text-xs font-bold transition-colors duration-150 ease-smooth focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-offset-2 ${
          plus ? 'w-8 justify-center' : 'pl-[5px] pr-2.5'
        } ${
          onDark
            ? `${plus ? '' : 'bg-white/10 ring-1 ring-inset ring-white/15 hover:bg-white/15 dark:bg-card dark:ring-border dark:hover:bg-muted'} text-primary-foreground dark:text-foreground focus-visible:ring-primary-foreground focus-visible:ring-offset-primary dark:focus-visible:ring-foreground`
            : `${plus ? '' : 'bg-accent-soft hover:bg-accent-soft/70'} text-accent-ink focus-visible:ring-ring`
        }`}
      >
        <PlusMerk maat={plus ? 'md' : 'sm'} className={plus ? 'h-7 w-7 rounded-[9px]' : ''} />
        {!plus && t("Plus")}
      </button>
      {/* Met naam erbij: alleen een icoon zegt een nieuw lid niet dat hier het delen zit. */}
      <button type="button" onClick={() => setShareOpen(true)} className={`${iconButton} w-auto gap-1.5 px-2.5 text-[0.8125rem] font-semibold`}>
        <Users className="h-[18px] w-[18px]" strokeWidth={1.9} />
        <span className="sm:hidden">{t("Club")}</span>
        <span className="hidden sm:inline">{t("Cart Club")}</span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button type="button" aria-label={t("Thema en meer")} title={t("Thema en meer")} className={`relative ${iconButton}`}>
            <MoreVertical className="h-5 w-5" strokeWidth={1.9} />
            {adminMeldingen.ongelezen > 0 && (
              <span aria-hidden className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            )}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          {gast && <AccountMenuItem onSelect={() => setAccountOpen(true)} />}
          <DropdownMenuLabel>{t("Thema")}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={theme ?? 'system'} onValueChange={setTheme} className="grid grid-cols-3 gap-1 px-1 pb-1">
            {THEMES.map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value} className={SEGMENT}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuLabel>{t('Taal')}</DropdownMenuLabel>
          <DropdownMenuRadioGroup value={taal()} onValueChange={(waarde) => setTaal(waarde as Taal)} className="grid grid-cols-2 gap-1 px-1 pb-1">
            {TALEN.map(([value, label]) => (
              <DropdownMenuRadioItem key={value} value={value} className={SEGMENT}>
                {label}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setMeldOpen(true)}>
            <Bell className="h-4 w-4" /> {t("Meldingen")}
          </DropdownMenuItem>
          {install.offer && (
            <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={() => setInstallOpen(true)}>
              <SquarePlus className="h-4 w-4" /> {isIos(install.way) ? t("Zet op beginscherm") : t("Installeer als app")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {isAdmin && (
            <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
              <a href="#/admin">
                <Gauge className="h-4 w-4" /> {t("Beheer")}
                {adminMeldingen.ongelezen > 0 && (
                  <span className="ml-auto rounded-full bg-primary px-1.5 text-xs tabular-nums text-primary-foreground">
                    {adminMeldingen.ongelezen}
                    <span className="sr-only"> nieuwe meldingen</span>
                  </span>
                )}
              </a>
            </DropdownMenuItem>
          )}
          {/* Op de pagina met voorwaarden staat onderaan ook het hulpadres. */}
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="#/info/voorwaarden"><LifeBuoy className="h-4 w-4" /> {t("Hulp en voorwaarden")}</a>
          </DropdownMenuItem>
          <DropdownMenuItem asChild className="gap-2 min-h-11 cursor-pointer">
            <a href="https://ko-fi.com/couplecart" target="_blank" rel="noopener noreferrer">
              <Heart className="h-4 w-4" /> {t("Steun CoupleCart")}
            </a>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem className="gap-2 min-h-11 cursor-pointer" onSelect={gast ? () => setUitlogVraag(true) : () => { void signOut(); }}>
            <LogOut className="h-4 w-4" /> {t("Uitloggen")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <LazySheet open={shareOpen} onClose={() => setShareOpen(false)}>
        <KoppelSheet open={shareOpen} onOpenChange={setShareOpen} />
      </LazySheet>
      <LazySheet open={usageOpen} onClose={() => setUsageOpen(false)}>
        <UsageSheet open={usageOpen} onOpenChange={setUsageOpen} />
      </LazySheet>
      <LazySheet open={installOpen} onClose={() => setInstallOpen(false)}>
        <InstallSheet open={installOpen} onOpenChange={setInstallOpen} way={install.way} canPrompt={install.canPrompt} />
      </LazySheet>
      <LazySheet open={meldOpen} onClose={() => setMeldOpen(false)}>
        <MeldingenSheet
          open={meldOpen}
          onOpenChange={setMeldOpen}
          onBeginscherm={install.offer ? () => { setMeldOpen(false); setInstallOpen(true); } : undefined}
        />
      </LazySheet>
      <AccountSheet open={accountOpen} onOpenChange={setAccountOpen} />
      <GastUitlogDialog open={uitlogVraag} onOpenChange={setUitlogVraag} onSignOut={signOut} onCreateAccount={() => setAccountOpen(true)} />
    </div>
  );
};

export default HeaderActions;
