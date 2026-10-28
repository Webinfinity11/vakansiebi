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
  /** Contact-button presses, including outbound; not confirmed applications. */
  contactCounts: { current: number; previous: number };
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

/** Compact dashboard label; changes up to and including 1% stay neutral. */
export function comparisonIndicator(
  current: number,
  previous: number,
): {
  label: string;
  tone: 'neutral' | 'success' | 'danger';
} {
  if (previous === 0)
    return {
      label: current > 0 ? 'ახალი' : 'წინა პერიოდში 0',
      tone: current > 0 ? 'success' : 'neutral',
    };
  const difference = current - previous;
  return {
    label: comparisonChange(current, previous),
    tone:
      Math.abs(difference) * 100 <= previous
        ? 'neutral'
        : difference > 0
          ? 'success'
          : 'danger',
  };
}
