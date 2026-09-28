/** Count the same distinct groups the public vacancy list displays. */
export function employerJobCount(
  ids: readonly string[],
  visibleGroups: ReadonlyMap<string, string>,
) {
  return new Set(
    ids.flatMap((id) => {
      const group = visibleGroups.get(id);
      return group === undefined ? [] : [group];
    }),
  ).size;
}
