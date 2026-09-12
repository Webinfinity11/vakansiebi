/* A list that depends on nothing but the filters is the same list for everyone, and the same
   filters are asked for over and over — the unfiltered first page most of all, which measured
   around two seconds every time. Those answers are held at the edge for a minute and served
   stale for five more while one request refreshes them behind the reader's back.

   Three kinds of request are never cached, because their answer belongs to one person: the
   admin preview, a saved list (`ids`), and a list with someone's hidden vacancies removed
   (`exclude`). Getting this wrong would hand one reader another reader's list, so the rule is
   a whitelist: cache only when none of the three is present. */
export function cacheHeader(params: URLSearchParams) {
  const personal =
    params.get('preview') === '1' || params.has('ids') || params.has('exclude');
  return personal
    ? 'private, no-store'
    : 'public, s-maxage=60, stale-while-revalidate=300';
}
