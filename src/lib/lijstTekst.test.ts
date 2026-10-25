import { describe, expect, it } from 'vitest';
import { lijstAlsTekst } from '@/lib/lijstTekst';
import { t } from '@/lib/i18n';

const item = (name: string, extra: Record<string, unknown> = {}) => ({ name, checked: false, ahProduct: null, ...extra });

// Kop en voet gaan door t(): die volgt navigator.language (jsdom en Node 25: en-US),
// dus de test vergelijkt met dezelfde vertaling in plaats van met vast Nederlands.
describe('lijstAlsTekst', () => {
  it('zet de open boodschappen per afdeling onder elkaar', () => {
    const tekst = lijstAlsTekst([item('5 bananen'), item('melk'), item('brood'), item('kaas', { checked: true })]);
    expect(tekst.startsWith(`${t('Boodschappen ({0})', [3])}\n\n`)).toBe(true);
    expect(tekst).toContain('• 5 bananen');
    expect(tekst).toContain('• melk');
    expect(tekst).not.toContain('kaas');
    expect(tekst.endsWith(t('Via CoupleCart · couplecart.nl'))).toBe(true);
  });

  it('volgt de looproute: groente voor zuivel', () => {
    const tekst = lijstAlsTekst([item('melk'), item('5 bananen')]);
    expect(tekst.indexOf('bananen') < tekst.indexOf('melk')).toBe(true);
  });

  it('noemt het aantal van een AH-product', () => {
    const tekst = lijstAlsTekst([item('Halfvolle melk', { ahProduct: { quantity: 3, category: 'Zuivel, eieren' } })]);
    expect(tekst).toContain('• Halfvolle melk (3×)');
  });

  it('zet de notitie achter de boodschap', () => {
    const tekst = lijstAlsTekst([item('yoghurtdrank', { note: 'Optimel, de blauwe' })]);
    expect(tekst).toContain('• yoghurtdrank – Optimel, de blauwe');
  });

  it('geeft niets terug als alles in de kar ligt', () => {
    expect(lijstAlsTekst([item('melk', { checked: true })])).toBe('');
  });
});
