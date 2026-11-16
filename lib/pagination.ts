/** Nearby pages and longer jumps keep deep catalogue pages reachable. */
export function paginationPages(current: number, total: number): (number | 'gap')[] {
  if (total <= 1) return [];

  const pages = [...new Set([
    1, total, current,
    current - 1, current + 1,
    current - 2, current + 2,
    current - 10, current + 10,
    current - 50, current + 50,
  ])].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);

  const result: (number | 'gap')[] = [];
  for (const [index, page] of pages.entries()) {
    if (index > 0 && page - pages[index - 1] > 1) result.push('gap');
    result.push(page);
  }
  return result;
}
