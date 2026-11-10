import { t } from '@/lib/i18n';
import type { Stap } from '@/lib/stappen';

// Wat elke AI-functie achter elkaar doet, voor StappenVoortgang. De tijden zijn
// schattingen; de laatste stap wacht altijd op het echte antwoord.

const regels = (tekst: string) => tekst.split('\n').filter((r) => r.trim()).length;

/** translate-recipe: één aanroep met naam, ingrediënten en bereiding. */
export const vertaalStappen = (ingredienten: string, bereiding: string): Stap[] => {
  const n = regels(ingredienten);
  const m = regels(bereiding);
  return [
    { label: n ? t('{0} ingrediënten vertalen', [n]) : t('Ingrediënten vertalen'), ms: 2500 },
    { label: m ? t('{0} stappen bereiding vertalen', [m]) : t('Bereiding vertalen'), ms: 4000 },
  ];
};

/** calculate-macros: de ingrediënten naar het model, totalen voor het hele recept terug. */
export const macroStappen = (aantalIngredienten: number): Stap[] => [
  { label: t('{0} ingrediënten lezen', [aantalIngredienten]), ms: 1500 },
  { label: t('Voedingswaarden per ingrediënt schatten'), ms: 4500 },
  { label: t('Optellen voor het hele recept'), ms: 2000 },
];

/** pantry-scan: per foto verkleinen in de app, dan herkennen op de server. */
export const kastStappen = (fotos: number): Stap[] => [
  { label: fotos > 1 ? t('{0} foto’s klaarmaken', [fotos]) : t('Foto klaarmaken'), ms: 800 },
  { label: t('Producten op de plank herkennen'), ms: 5000 * Math.max(1, fotos) },
  { label: t('Lijstje maken om na te kijken'), ms: 1500 },
];

/** bonus-recipes: de aanbiedingen en je basisvoorraad naar het model. */
export const bonusStappen = (aanbiedingen: number, metVoorraad: boolean): Stap[] => [
  { label: t('{0} aanbiedingen van deze week bekijken', [aanbiedingen]), ms: 2000 },
  ...(metVoorraad ? [{ label: t('Rekening houden met wat je in huis hebt'), ms: 1500 }] : []),
  { label: t('Drie avondmaaltijden bedenken'), ms: 7000 },
];

/** suggest-recipes: wat op je lijst staat plus je basisvoorraad. */
export const suggestieStappen = (boodschappen: number, metVoorraad: boolean): Stap[] => [
  { label: t('{0} boodschappen op je lijst bekijken', [boodschappen]), ms: 1500 },
  ...(metVoorraad ? [{ label: t('Rekening houden met wat je in huis hebt'), ms: 1500 }] : []),
  { label: t('Gerechten bedenken'), ms: 7000 },
];
