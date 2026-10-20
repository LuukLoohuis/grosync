import { useTheme } from 'next-themes';
import logo from '@/assets/couplecart-logo.webp';
import logoDonker from '@/assets/couplecart-logo-donker.webp';

/**
 * The whole logo: emblem, wordmark and slogan (made by scripts/logo-assets.py). The dark theme
 * gets a copy with light letters. One image, so only that copy downloads; until next-themes
 * knows the theme, the class index.html set before the first paint decides.
 */
const Logo = ({ className }: { className?: string }) => {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme ? resolvedTheme === 'dark' : document.documentElement.classList.contains('dark');
  return (
    <img
      src={dark ? logoDonker : logo}
      alt="CoupleCart – Two People. One Cart."
      width={768}
      height={593}
      className={className}
    />
  );
};

export default Logo;
