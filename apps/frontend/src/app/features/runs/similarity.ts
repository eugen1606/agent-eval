/**
 * Tokenize a string into normalized words for comparison.
 * Lowercases, strips punctuation, splits on whitespace.
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Calculate similarity between two strings using Jaccard index on word tokens.
 * Returns a score from 0 to 100.
 */
export function calculateSimilarity(expected: string, actual: string): number {
  if (!expected && !actual) return 100;
  if (!expected || !actual) return 0;

  const tokensA = tokenize(expected);
  const tokensB = tokenize(actual);

  if (tokensA.length === 0 && tokensB.length === 0) return 100;
  if (tokensA.length === 0 || tokensB.length === 0) return 0;

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);

  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) intersection++;
  }

  const union = new Set([...setA, ...setB]).size;
  return Math.round((intersection / union) * 100);
}

/**
 * Get a similarity level for styling purposes.
 */
export function getSimilarityLevel(score: number): 'high' | 'medium' | 'low' {
  if (score >= 80) return 'high';
  if (score >= 50) return 'medium';
  return 'low';
}
