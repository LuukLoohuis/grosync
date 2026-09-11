import { useState } from 'react';
import { Share2, Heart, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import ShareListSheet from '@/components/ShareListSheet';

const ICON_BUTTON =
  'h-11 w-11 shrink-0 flex items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';

const HeaderActions = () => {
  const { signOut } = useAuth();
  const [shareOpen, setShareOpen] = useState(false);

  return (
    <div className="-mr-2 flex items-center">
      <button type="button" onClick={() => setShareOpen(true)} aria-label="Lijst delen" title="Lijst delen" className={ICON_BUTTON}>
        <Share2 className="h-5 w-5" />
      </button>
      <a
        href="https://www.buymeacoffee.com/luukloohuis"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Steun CoupleCart"
        title="Steun CoupleCart"
        className={ICON_BUTTON}
      >
        <Heart className="h-5 w-5" />
      </a>
      <button type="button" onClick={signOut} aria-label="Uitloggen" title="Uitloggen" className={ICON_BUTTON}>
        <LogOut className="h-5 w-5" />
      </button>
      <ShareListSheet open={shareOpen} onOpenChange={setShareOpen} />
    </div>
  );
};

export default HeaderActions;
