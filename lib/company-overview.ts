export function companyOverview(description?: string | null) {
  const text = description?.trim() || '';
  if (!text) return null;
  const first = text.split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
  const summary =
    first.length > 320
      ? `${first.slice(0, 317).replace(/\s+\S*$/, '')}…`
      : first;
  return { summary, full: text.replace(/\s+/g, ' ') === summary ? null : text };
}
