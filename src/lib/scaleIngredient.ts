/**
 * Scale an ingredient string by a multiplier.
 * Handles patterns like "500g kip", "2 eieren", "1.5 el olie", "½ cup flour"
 * Also handles numbers within parentheses or after descriptive words.
 */
export const scaleIngredient = (ingredient: string, multiplier: number): string => {
  if (multiplier === 1) return ingredient;

  // Fraction map for unicode fractions
  const fractionMap: Record<string, number> = { '½': 0.5, '¼': 0.25, '¾': 0.75, '⅓': 1/3, '⅔': 2/3 };

  // Function to format a number for display
  const formatNumber = (num: number) => {
    return num % 1 === 0 ? num.toString() : num.toFixed(1).replace(/\.0$/, '').replace('.', ',');
  };

  // 1. Check for unicode fractions
  let result = ingredient;
  for (const [char, val] of Object.entries(fractionMap)) {
    if (result.includes(char)) {
      const scaled = val * multiplier;
      result = result.replace(char, formatNumber(scaled));
    }
  }

  // 2. Match numbers (integers or decimals)
  // We use a regex that looks for numbers that are likely quantities.
  // This avoids scaling numbers that might be part of a brand name or instruction.
  // We target numbers at the start of the string or preceded by a space/parenthesis.
  return result.replace(/(\b\d+(?:[.,]\d+)?\b)/g, (match) => {
    const num = parseFloat(match.replace(',', '.'));
    if (isNaN(num)) return match;

    // Don't scale numbers that look like years or temperatures (heuristically)
    if (num > 1000 && !ingredient.toLowerCase().includes(' gram') && !ingredient.toLowerCase().includes(' ml')) {
      return match;
    }

    return formatNumber(num * multiplier);
  });
};
