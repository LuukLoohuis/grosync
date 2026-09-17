import { WifiOff } from 'lucide-react';
import { useOnlineStatus } from '@/hooks/useOnlineStatus';
import { cn } from '@/lib/utils';
import { t } from '@/lib/i18n';

const OfflineBanner = ({ className }: { className?: string }) => {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p role="status" className={cn('flex items-center gap-2.5 rounded-xl bg-info-soft px-3 py-2.5 text-[0.8125rem] font-medium text-info', className)}>
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      {t("Geen bereik. Je wijzigingen gaan mee zodra je weer online bent.")}
    </p>
  );
};

export default OfflineBanner;
