export function normalizeName(name: string): string {
  return name.trim().toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function slugify(name: string): string {
  return normalizeName(name).replace(/\s+/g, '-');
}

export function detectAlly(name: string): { isAlly: boolean; house?: 'Gardener' | 'Lannister' | 'Stark' | null } {
  const n = normalizeName(name);
  if (n.includes('gardener') || n.includes('gardner')) return { isAlly: true, house: 'Gardener' };
  if (n.includes('lannister') || n.includes('lannyster')) return { isAlly: true, house: 'Lannister' };
  if (n.includes('stark')) return { isAlly: true, house: 'Stark' };
  return { isAlly: false, house: null };
}

const currencyPatterns = [
  { pattern: /(ouro|gold|g\b|moedas? de ouro)/i, type: 'ouro' as const },
  { pattern: /(prata|silver)/i, type: 'prata' as const },
  { pattern: /(bronze|cobre)/i, type: 'bronze' as const },
];

export function parseCurrency(text: string) {
  for (const c of currencyPatterns) {
    if (c.pattern.test(text)) return c.type;
  }
  return 'ouro' as const;
}

export function parseMoneyValue(text: string): { value: number; currencyText: string } {
  // matches 300, 300 moedas, 300 ouro, 300.50, 1.200, etc
  const match = text.match(/([\d.,]+)\s*(.*)/);
  if (!match) return { value: 0, currencyText: text };
  let numStr = match[1].replace(/\./g, '').replace(',', '.');
  // If contains both . and ,? Already treated . as thousand separator. Edge: 300.50 -> becomes 30050? Better handle
  if (match[1].includes('.') && match[1].includes(',')) {
    numStr = match[1].replace(/\./g, '').replace(',', '.');
  } else if (match[1].includes('.') && !match[1].includes(',') ) {
    // could be decimal: if after . there are 2 digits, keep as decimal
    const parts = match[1].split('.');
    if (parts[parts.length-1].length === 2) {
      // decimal dot
      numStr = match[1];
    } else if (parts[parts.length-1].length === 3) {
      // thousand
      numStr = match[1].replace(/\./g, '');
    }
  }
  const value = parseFloat(numStr) || 0;
  return { value, currencyText: match[2] || '' };
}

export function fuzzyMatch(a: string, b: string): number {
  // simple levenshtein similarity 0-1
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.9;
  const longer = na.length > nb.length ? na : nb;
  const shorter = na.length > nb.length ? nb : na;
  if (longer.length === 0) return 1;
  const dist = levenshtein(longer, shorter);
  return (longer.length - dist) / longer.length;
}

function levenshtein(a: string, b: string): number {
  const matrix = Array.from({ length: b.length + 1 }, (_, i) => [i]).concat(
    Array.from({ length: a.length }, () => Array(b.length + 1).fill(0))
  ) as any;
  // Actually simpler DP
  const dp: number[][] = Array(b.length + 1).fill(0).map(() => Array(a.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[0][i] = i;
  for (let j = 0; j <= b.length; j++) dp[j][0] = j;
  for (let j = 1; j <= b.length; j++) {
    for (let i = 1; i <= a.length; i++) {
      const cost = a[i-1] === b[j-1] ? 0 : 1;
      dp[j][i] = Math.min(dp[j][i-1]+1, dp[j-1][i]+1, dp[j-1][i-1]+cost);
    }
  }
  return dp[b.length][a.length];
}
