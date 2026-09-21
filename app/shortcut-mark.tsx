/* The four marks are quarters of one sprite, drawn as a CSS background: as <img> elements
   they were the largest pictures on the home and landing pages, and search engines took
   them for the page's own image. */
export function ShortcutMark({
  kind,
}: {
  kind: 'daily' | 'remote' | 'entry' | 'salary';
}) {
  return (
    <span
      className="category-mark shortcut-mark shortcut-3d"
      data-kind={kind}
      aria-hidden="true"
    />
  );
}
