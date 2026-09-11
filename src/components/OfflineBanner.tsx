import { useOnlineStatus } from '@/hooks/useOnlineStatus';

const OfflineBanner = () => {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <p role="status" className="bg-amber-100 px-4 py-1.5 text-center text-sm font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-100">
      Geen verbinding · je wijzigingen worden bewaard
    </p>
  );
};

export default OfflineBanner;
