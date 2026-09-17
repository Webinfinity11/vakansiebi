/* The reader's own last searches, kept in their browser and nowhere else. They
   are the fastest way back to a search they have already made; a job hunt is the
   same few words repeated over days. */
const key = 'ertad-recent-searches';
const limit = 6;

export function readRecentSearches(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(value)
      ? value
          .filter((v) => typeof v === 'string' && v.trim() && v.length <= 80)
          .slice(0, limit)
      : [];
  } catch {
    return [];
  }
}
export function rememberRecentSearch(raw: string) {
  const value = raw.replace(/\s+/g, ' ').trim().slice(0, 80);
  if (value.length < 2) return;
  try {
    const kept = readRecentSearches().filter(
      (v) => v.toLowerCase() !== value.toLowerCase(),
    );
    localStorage.setItem(key, JSON.stringify([value, ...kept].slice(0, limit)));
  } catch {}
}
export function forgetRecentSearch(value: string) {
  try {
    localStorage.setItem(
      key,
      JSON.stringify(readRecentSearches().filter((v) => v !== value)),
    );
  } catch {}
}
export function clearRecentSearches() {
  try {
    localStorage.removeItem(key);
  } catch {}
}
