const letters: Record<string, string> = Object.fromEntries(
  'აბგდევზთიკლმნოპჟრსტუფქღყშჩცძწჭხჯჰ'
    .split('')
    .map((letter, index) => [
      letter,
      [
        'a',
        'b',
        'g',
        'd',
        'e',
        'v',
        'z',
        't',
        'i',
        'k',
        'l',
        'm',
        'n',
        'o',
        'p',
        'zh',
        'r',
        's',
        't',
        'u',
        'f',
        'k',
        'gh',
        'y',
        'sh',
        'ch',
        'ts',
        'dz',
        'ts',
        'ch',
        'kh',
        'j',
        'h',
      ][index],
    ]),
);

const legacyLetters = { ...letters, ყ: 'q' };

function transliterate(value: string, alphabet: Record<string, string>) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ა-ჰ]/g, (letter) => alphabet[letter])
    .replace(/[а-яёіїєґ]/g, (letter) => cyrillic[letter])
    .replace(/ø/g, 'o')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
}

export function latinUrl(value: string) {
  return transliterate(value, letters);
}

// Recognize URLs shared before ყ changed from q to y; Latin company names stay literal.
export function legacyLatinUrl(value: string) {
  return transliterate(value, legacyLetters);
}

const cyrillic: Record<string, string> = {
  а: 'a',
  б: 'b',
  в: 'v',
  г: 'g',
  д: 'd',
  е: 'e',
  ё: 'yo',
  ж: 'zh',
  з: 'z',
  и: 'i',
  й: 'y',
  к: 'k',
  л: 'l',
  м: 'm',
  н: 'n',
  о: 'o',
  п: 'p',
  р: 'r',
  с: 's',
  т: 't',
  у: 'u',
  ф: 'f',
  х: 'kh',
  ц: 'ts',
  ч: 'ch',
  ш: 'sh',
  щ: 'shch',
  ъ: '',
  ы: 'y',
  ь: '',
  э: 'e',
  ю: 'yu',
  я: 'ya',
  і: 'i',
  ї: 'yi',
  є: 'ye',
  ґ: 'g',
};
