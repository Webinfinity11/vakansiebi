export type ComparisonMetrics = {
  search: number;
  view: number;
  outbound: number;
  sends: number;
  receivedPosts: number;
};
export type AnalyticsComparison = {
  from: string;
  to: string;
  previousFrom: string;
  previousTo: string;
  mode: 'same-time' | 'completed-days' | 'full-day';
  available: boolean;
  current: ComparisonMetrics;
  previous: ComparisonMetrics;
};

/** A zero baseline has no percentage; show the count difference instead. */
export function comparisonChange(current: number, previous: number) {
  const difference = current - previous;
  if (!difference) return 'უცვლელია';
  const sign = difference > 0 ? '+' : '−';
  if (!previous)
    return `${sign}${new Intl.NumberFormat('ka-GE').format(Math.abs(difference))}`;
  const percent = Math.abs((difference / previous) * 100);
  return `${sign}${percent < 0.1 ? '<0.1' : new Intl.NumberFormat('ka-GE', { maximumFractionDigits: 1 }).format(percent)}%`;
}
