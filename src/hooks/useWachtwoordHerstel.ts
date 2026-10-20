import { useSyncExternalStore } from 'react';
import { herstelVoor, volgHerstel } from '@/lib/wachtwoordHerstel';

/** Kwam deze gebruiker binnen via de link uit "Wachtwoord vergeten?", zonder al een nieuw wachtwoord te kiezen? */
export const useWachtwoordHerstel = (userId: string | null | undefined): boolean => {
  const voor = useSyncExternalStore(volgHerstel, herstelVoor);
  return Boolean(userId) && voor === userId;
};
