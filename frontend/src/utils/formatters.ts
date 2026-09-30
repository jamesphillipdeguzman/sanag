/**
 * Formats an affected population number into a human-readable regional string
 * (e.g., 1,200,000 -> "1.2M affected", 840,000 -> "840K affected").
 *
 * @param population The total affected population count
 * @param includeSuffix Whether to append " affected" to the formatted string
 * @returns Formatted population string
 */
export function formatAffectedPopulation(population?: number | null, includeSuffix = true): string {
  if (population === undefined || population === null || isNaN(population) || population <= 0) {
    return includeSuffix ? '0 affected' : '0';
  }

  const suffix = includeSuffix ? ' affected' : '';

  if (population >= 1_000_000) {
    const millions = population / 1_000_000;
    const formatted = millions.toFixed(1).replace(/\.0$/, '');
    return `${formatted}M${suffix}`;
  }

  if (population >= 1_000) {
    const thousands = Math.round(population / 1_000);
    return `${thousands}K${suffix}`;
  }

  return `${population.toLocaleString()}${suffix}`;
}

/**
 * Returns a compact formatted string for metrics cards (e.g., "1.2M" or "840K").
 */
export function formatAffectedCompact(population?: number | null): string {
  return formatAffectedPopulation(population, false);
}
