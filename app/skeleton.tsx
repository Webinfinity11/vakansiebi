/* Loading placeholders in the shape of what is coming: rows of text, a card, a number. One place
   decides their look (design-system.css), so every page loads the same way. */
export function SkeletonRows({
  rows = 3,
  label = 'იტვირთება',
  block = false,
}: {
  rows?: number;
  label?: string;
  /** Card-sized blocks instead of text lines. */
  block?: boolean;
}) {
  return (
    <output className="ds-skeleton-group" aria-label={label}>
      {Array.from({ length: rows }, (_, i) => (
        <span
          key={i}
          className={`ds-skeleton${block ? ' ds-skeleton--block' : ''}`}
          // Text lines of slightly different lengths read as text, not as bars.
          style={
            block ? undefined : { width: `${[92, 78, 64, 86, 70][i % 5]}%` }
          }
        />
      ))}
    </output>
  );
}

export function SkeletonNumber() {
  return (
    <span className="ds-skeleton ds-skeleton--number" aria-hidden="true" />
  );
}
