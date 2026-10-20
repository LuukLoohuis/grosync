import { t } from '@/lib/i18n';

/**
 * The start screen: the logo on the page colour, light or dark. index.html has the same
 * markup inside #root, so the phone shows it from the first frame; React keeps it up while
 * sign-in and the household load, and while a page comes in. Change both together.
 */
const Splash = () => (
  <div role="status" className="fixed inset-0 flex items-center justify-center bg-background">
    <img src="/favicon.png" alt="" width={96} height={96} className="h-24 w-24" />
    <span className="sr-only">{t("Laden...")}</span>
  </div>
);

export default Splash;
