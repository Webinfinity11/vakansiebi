/* Import runs record what happened in English, in parts joined by "; ". The admin reads them in
   Georgian; a part this list does not know is shown as written, so no detail is lost. */
const patterns: [RegExp, (...m: string[]) => string][] = [
  [
    /^Stopped after (\d+) consecutive detail failures; remaining items retained for retry$/,
    (n) =>
      `შეჩერდა ზედიზედ ${n} შეცდომის შემდეგ; დანარჩენი ვაკანსიები შემდეგ ჯერ მოწმდება`,
  ],
  [
    /^Stopped after (\d+) consecutive detail failures$/,
    (n) => `შეჩერდა ზედიზედ ${n} შეცდომის შემდეგ`,
  ],
  [
    /^remaining items retained for retry$/,
    () => 'დანარჩენი ვაკანსიები შემდეგ ჯერ მოწმდება',
  ],
  [
    /^(\d+) of (\d+) detail pages failed$/,
    (n, of) => `${of}-დან ${n} ვაკანსიის გვერდი ვერ ჩაიტვირთა`,
  ],
  [
    /^(\d+) detail pages? failed$/,
    (n) => `${n} ვაკანსიის გვერდი ვერ ჩაიტვირთა`,
  ],
  [
    /^(\d+) detail snapshots? held for quality review$/,
    (n) => `${n} ვაკანსიის ცვლილება დამატებით მოწმდება`,
  ],
  [
    /^Description refresh: (\d+) held, (\d+) failed, (\d+) remaining$/,
    (held, failed, remaining) =>
      `აღწერების განახლება: ${held} შეჩერებული, ${failed} ვერ ჩაიტვირთა, ${remaining} დარჩა`,
  ],
  [
    /^Pagination returned empty page; cursor retained for retry$/,
    () => 'სიის გვერდი ცარიელი დაბრუნდა; შემდეგ ჯერ იქიდანვე გაგრძელდება',
  ],
  [/^cursor retained for retry$/, () => 'შემდეგ ჯერ იქიდანვე გაგრძელდება'],
  [/^Pagination returned empty page$/, () => 'სიის გვერდი ცარიელი დაბრუნდა'],
  [
    /^Listing page count is unavailable; first page retained and discovery will retry$/,
    () => 'სიის გვერდების რაოდენობა უცნობია; ძებნა ხელახლა სცდება',
  ],
  [
    /^Listing returned no vacancy links; source structure may have changed$/,
    () => 'სიაში ვაკანსიის ბმული არ მოიძებნა; შესაძლოა წყაროს საიტი შეიცვალა',
  ],
  [
    /^Worker interrupted; next run retries pending items$/,
    () => 'გაშვება შეწყდა; შემდეგი გაშვება დარჩენილ ვაკანსიებს გაიმეორებს',
  ],
  [/^Listing page: ([^;]+)$/, (rest) => `სიის გვერდი: ${runMessage(rest)}`],
  [/^Source returned HTTP (\d+)$/, (code) => `წყარომ დააბრუნა HTTP ${code}`],
  [
    /^Employer returned HTTP (\d+)$/,
    (code) => `დამსაქმებლის საიტმა დააბრუნა HTTP ${code}`,
  ],
  [
    /^Source request failed: (?:ECONNREFUSED|ECONNRESET)$/,
    () => 'წყარო კავშირზე არ გამოვიდა',
  ],
  [
    /^Source request failed: (?:UND_ERR_CONNECT_TIMEOUT|.*[Tt]imeout.*)$/,
    () => 'წყარო დროულად არ უპასუხა',
  ],
  [
    /^Source request failed: ([^;]+)$/,
    (cause) => `წყაროსთან კავშირი ვერ მოხერხდა (${cause})`,
  ],
  [/^fetch failed$/, () => 'წყაროსთან კავშირი ვერ მოხერხდა'],
  [
    /^Too many redirects$/,
    () => 'წყარო ზედმეტად ბევრ გადამისამართებას აკეთებს',
  ],
];

function part(text: string): string {
  for (const [pattern, translate] of patterns) {
    const match = text.match(pattern);
    if (match) return translate(...match.slice(1));
  }
  return text;
}

export function runMessage(text: string): string {
  const trimmed = text.trim();
  const pieces: string[] = [];
  const parts = trimmed.split('; ');
  for (let i = 0; i < parts.length; i++) {
    const pair = i + 1 < parts.length ? `${parts[i]}; ${parts[i + 1]}` : '';
    const joined = pair && part(pair);
    if (pair && joined !== pair) {
      pieces.push(joined);
      i++;
    } else pieces.push(part(parts[i]));
  }
  return pieces.join('; ');
}
