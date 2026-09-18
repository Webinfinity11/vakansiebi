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
        'q',
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

export function latinUrl(value: string) {
  return value
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[ა-ჰ]/g, (letter) => letters[letter])
    .replace(/[а-яёіїєґ]/g, (letter) => cyrillic[letter])
    .replace(/ø/g, 'o')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '');
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
