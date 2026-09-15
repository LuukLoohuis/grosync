/**
 * Een boodschap is één tekstregel: "Kipfilet (500g)", "2 bananen", "1 fles
 * sojasaus". Het ontwerp zet de hoeveelheid rechts en de naam links, dus die
 * moeten uit elkaar. Herkent alleen wat er echt als hoeveelheid uitziet.
 */
const UNITS = 'g|gr|gram|kg|ml|cl|dl|l|liter|stuks|stuk|st|blik|blikken|fles|flessen|pak|pakken|bos|bosje|zak|doos|el|tl|plak|plakken|bol|krop|pot|potje|tros|punt|rol';

const IN_BRACKETS = new RegExp(`^(.+?)\\s*\\((\\d+(?:[.,]\\d+)?\\s*(?:${UNITS})?)\\)\\s*$`, 'i');
const LEADING = new RegExp(`^(\\d+(?:[.,]\\d+)?)\\s*(${UNITS})?\\s+(.+)$`, 'i');

/** Ruimte tussen getal en eenheid: "500g" leest slechter dan "500 g". */
const tidy = (amount: string) =>
  amount.replace(/^(\d+(?:[.,]\d+)?)\s*([a-z]+)$/i, '$1 $2').trim();

export interface SplitName {
  name: string;
  amount: string | null;
}

export const splitAmount = (raw: string): SplitName => {
  const text = raw.trim();

  const brackets = text.match(IN_BRACKETS);
  if (brackets) return { name: brackets[1].trim(), amount: tidy(brackets[2]) };

  const leading = text.match(LEADING);
  // "1 fles sojasaus" wordt "sojasaus · 1 fles"; "2 bananen" wordt "bananen · 2".
  if (leading) return { name: leading[3].trim(), amount: tidy(`${leading[1]}${leading[2] ? ` ${leading[2]}` : ''}`) };

  return { name: text, amount: null };
};
