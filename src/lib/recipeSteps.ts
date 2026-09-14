/**
 * Recipes arrive as one block of text: sometimes numbered, sometimes one long
 * paragraph. This turns any of that into separate steps, so the app can put them
 * under each other instead of running them together.
 */

// Words that end in a full stop without ending the sentence: "3 el. olijfolie", "ca. 5 min.".
// "180 °C." is left out on purpose: that one does end the sentence.
const ABBREVIATION = /\b(?:el|tl|ca|ong|evt|bijv|min|sec|gr|kg|ml|cl|dl|tsp|tbsp|approx|etc|nr|max|zgn)\.$/i;

/** "1. ", "2) ", "Stap 3:" — the numbering a recipe brought along. */
const LEADING_NUMBER = /^\s*(?:stap\s*)?\d{1,2}\s*[.):-]\s*/i;
const INLINE_NUMBER = /\s(?=(?:stap\s*)?\d{1,2}\s*[.)]\s+[A-ZÀ-Þ])/g;

const clean = (step: string) => step.replace(LEADING_NUMBER, '').trim();

/** Splits a paragraph on sentence ends, leaving abbreviations alone. */
const bySentence = (text: string): string[] => {
  const pieces = text.split(/(?<=[.!?])\s+/);
  const parts: string[] = [];
  let current = '';

  pieces.forEach((piece, index) => {
    current = current ? `${current} ${piece}` : piece;
    const next = pieces[index + 1] ?? '';
    // "ca. 25 min. tot hij gaar is" runs on, "10 min. Wok de broccoli" does not:
    // an abbreviation only continues the sentence when the next word is no capital.
    const runsOn = ABBREVIATION.test(current.trim()) && /^[a-zà-ÿ0-9]/.test(next);
    if (!runsOn) {
      parts.push(current.trim());
      current = '';
    }
  });

  if (current.trim()) parts.push(current.trim());
  return parts;
};

/** The preparation as separate steps, without the numbering it came with. */
export const splitSteps = (instructions: string | undefined | null): string[] => {
  const text = (instructions ?? '').trim();
  if (!text) return [];

  // Own lines win: whoever wrote them meant them as steps.
  let steps = text.split(/\r?\n+/).map(clean).filter(Boolean);

  // One line holding "1. … 2. …" is really several steps.
  steps = steps.flatMap((step) => step.split(INLINE_NUMBER).map(clean).filter(Boolean));

  // Still one block without numbering: every sentence is a step. One sentence
  // stays one step, so a short instruction is left alone.
  if (steps.length === 1) {
    steps = bySentence(steps[0]).map(clean).filter(Boolean);
  }

  return steps;
};

/** The same text with one step per line, ready to store or to edit. */
export const normalizeSteps = (instructions: string | undefined | null): string => {
  const steps = splitSteps(instructions);
  return steps.length > 1 ? steps.join('\n') : (instructions ?? '').trim();
};
