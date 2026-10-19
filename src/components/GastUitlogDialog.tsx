import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { t } from '@/lib/i18n';

interface GastUitlogDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSignOut: () => void;
  onCreateAccount: () => void;
}

/**
 * Een gast kan niet opnieuw inloggen: uitloggen laat zijn lijst voorgoed achter.
 * Daarom eerst deze vraag, met een account maken als eerste keus.
 */
const GastUitlogDialog = ({ open, onOpenChange, onSignOut, onCreateAccount }: GastUitlogDialogProps) => (
  <AlertDialog open={open} onOpenChange={onOpenChange}>
    <AlertDialogContent>
      <AlertDialogHeader>
        <AlertDialogTitle>{t('Uitloggen als gast?')}</AlertDialogTitle>
        <AlertDialogDescription>
          {t('Een gast kan niet opnieuw inloggen. Log je nu uit, dan ben je je lijst, recepten en kast kwijt. Maak eerst een account om ze te houden.')}
        </AlertDialogDescription>
      </AlertDialogHeader>
      <AlertDialogFooter className="gap-2 sm:space-x-0">
        <AlertDialogCancel className="mt-0">{t('Annuleren')}</AlertDialogCancel>
        <AlertDialogAction onClick={onSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
          {t('Toch uitloggen')}
        </AlertDialogAction>
        <AlertDialogAction onClick={onCreateAccount}>{t('Account aanmaken')}</AlertDialogAction>
      </AlertDialogFooter>
    </AlertDialogContent>
  </AlertDialog>
);

export default GastUitlogDialog;
