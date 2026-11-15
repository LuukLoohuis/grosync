import { Camera, ChefHat, Lightbulb, Link2, Salad, ShoppingBasket, Users, type LucideIcon } from 'lucide-react';
import { t } from '@/lib/i18n';

export interface PlusGroep {
  kop: string;
  perks: { icon: LucideIcon; text: string }[];
}

// In drie groepjes, zodat je in één blik ziet wat erbij komt in plaats van vijf keer "onbeperkt".
// Eén lijst voor het aanbod, het welkom na betalen en "Jouw Plus".
export const PLUS_GROEPEN: PlusGroep[] = [
  {
    kop: t('Onbeperkt'),
    perks: [
      { icon: Link2, text: t('Recepten ophalen uit een link of video') },
      { icon: Camera, text: t('Je kast scannen met een foto') },
      { icon: ShoppingBasket, text: t('Prijzen zoeken en vergelijken') },
    ],
  },
  {
    kop: t('Slimme hulp'),
    perks: [
      { icon: ChefHat, text: t('Bonuschef: recepten uit de bonus van deze week') },
      { icon: Lightbulb, text: t('Wat je kunt koken met wat je hebt') },
      { icon: Salad, text: t('Voedingswaarden per recept') },
    ],
  },
  {
    kop: t('Samen'),
    perks: [{ icon: Users, text: t('Een Cart Club starten en anderen uitnodigen') }],
  },
];
