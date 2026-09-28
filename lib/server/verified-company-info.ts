import { logoCompanyKey } from '../company-logo-identity';

// Short factual summaries checked against official sources on 2026-09-28.
// Administrator-provided profile fields take precedence over these defaults.
const tbc = {
  description:
    'თიბისი ბანკი ფიზიკურ პირებსა და ბიზნესებს საბანკო მომსახურებას სთავაზობს. მის სერვისებში შედის ანგარიშები, ბარათები, სესხები, ანაბრები და ციფრული ბანკინგი.',
  website: 'https://tbcbank.ge/ka',
  source: 'https://tbcbank.ge/ka',
};
const bog = {
  description:
    'საქართველოს ბანკი ემსახურება ფიზიკურ პირებსა და ბიზნესებს. ბანკის მომსახურება მოიცავს საბანკო ანგარიშებს და ციფრულ სერვისებს, მათ შორის ინტერნეტბანკსა და მობილბანკს.',
  website: 'https://bankofgeorgia.ge/ka/retail',
  source:
    'https://bankofgeorgia.ge/blog/shetavazebebi/biznes-shetavazebebi/gaxsenit-saqartvelos-bankis-biznes-angarishi-31-dekembramde-da-isargeblet-gansakutrebuli-shetavazebit/',
};
const biblusi = {
  description:
    'ბიბლუსი საქართველოში წიგნების მაღაზიათა ქსელია. კომპანია ხელს უწყობს წიგნის ხელმისაწვდომობასა და კითხვის პოპულარიზაციას.',
  website: 'https://biblusi.ge/',
  source: 'https://biblusi.ge/about',
};
const profiles = new Map([
  ['თიბისი', tbc],
  ['თიბისიბანკი', tbc],
  ['tbcbank', tbc],
  ['საქართველოსბანკი', bog],
  ['bankofgeorgia', bog],
  ['ბიბლუსი', biblusi],
  ['biblusi', biblusi],
]);

export function verifiedCompanyInfo(names: readonly string[]) {
  return names.map((name) => profiles.get(logoCompanyKey(name))).find(Boolean);
}
