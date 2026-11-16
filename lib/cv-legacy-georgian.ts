/** Keyboard encoding, applied only when the source run declares a legacy font.
 * Synthetic mapping coverage only; not validated with a real legacy font file. */
const latin = 'abgdevzTiklmnopJrstufqRySCcZwWxjh';
const georgian = 'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ';
export function legacyGeorgian(text: string, font: string): string {
  if (!/(?:Acad|Lit)(?:Nusx|Mtavr)|Geo[-_]/i.test(font)) return text;
  return [...text].map(c => {
    const i = latin.indexOf(c);
    return i < 0 ? c : georgian[i];
  }).join('');
}

// Case-sensitive, whole-word evidence for keyboard-encoded Georgian. Ordinary
// place names and repeated occurrences of one keyword are deliberately excluded.
const legacyKeywords = [
  'ganaTleba', // განათლება
  'gamocdileba', // გამოცდილება
  'samuSao', // სამუშაო
  'unarebi', // უნარები
  'enebi', // ენები
  'dRemde', // დღემდე
  'gamocdilebis', // გამოცდილების
];

/** Conservative fallback for plain text with no source font metadata. */
export function legacyGeorgianText(text: string): string {
  if (/\p{Script=Georgian}/u.test(text)) return text;
  // Remove protected tokens from both evidence and conversion. A URL path or an
  // email local part must not accidentally trigger conversion of an English CV.
  const protectedToken = /(?:https?:\/\/|www\.)[^\s<>]+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|\b(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s<>]*)?|(?:\+|00)?\d[\d ()-]{7,}\d/gi;
  const parts = text.split(new RegExp(`(${protectedToken.source})`, 'gi'));
  const evidence = parts.filter((_, i) => i % 2 === 0).join(' ');
  const words = new Set(evidence.match(/[\p{L}\p{N}_]+/gu) ?? []);
  if (legacyKeywords.filter(word => words.has(word)).length < 2) return text;
  return parts.map((part, i) => i % 2 ? part : part.replace(/[A-Za-z0-9]+/g, word => {
    // Preserve Latin acronyms, proficiency codes and mixed-case product names
    // that cannot be written in this legacy keyboard alphabet (Excel, SQL, B2).
    return [...word].every(c => latin.includes(c))
      ? legacyGeorgian(word, 'AcadNusx') : word;
  })).join('');
}
