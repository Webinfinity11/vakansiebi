const amount =
  /(?:\d[\d\s,.–—-]*(?:-დან\s+\d[\d\s,.–—-]*)?\s*(?:₾|ლარ|GEL\b|USD\b|EUR\b|\$|€))|(?:[$€₾]\s*\d)/i;
const label =
  /^(?:(?:ფიქსირებული|საწყისი|ყოველთვიური|საათობრივი|დღიური|base|fixed|monthly|daily|hourly)\s+)?(?:ანაზღაურება|ხელფასი|შემოსავალი|salary|compensation|pay|wage)(?=[\s:–—-]|$)/i;
export function payExcerpts(text: string) {
  const lines = text
    .split('\n')
    /* cleanText marks list items two ways: "• " for a bulleted list and "4. " for a numbered one.
       Both are layout, not pay, so both go. The number needs the space after it, exactly as
       cleanText writes it, so an amount such as "1.500 ლარი" is never mistaken for a marker. */
    .map((line) => line.trim().replace(/^(?:[•*–—-]+\s*|\d{1,3}[.)]\s+)/, ''))
    .filter(Boolean);
  const result: string[] = [];
  let payBlock = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (
      /^(?:ანაზღაურება და (?:სამუშაო პირობები|პირობები|ბენეფიტები)|სახელფასო პირობები)\s*:?$/i.test(
        line,
      )
    ) {
      payBlock = 6;
      continue;
    }
    if (
      /^(?:საკვალიფიკაციო მოთხოვნები|მოთხოვნები|მოვალეობები|ფუნქციები|სამუშაო გრაფიკი)\s*:?$/i.test(
        line,
      )
    )
      payBlock = 0;
    const inPayBlock = payBlock-- > 0;
    if (
      line.length > 700 ||
      /რეფერალ|referral|ტრანსპორტის ხარჯ|საწვავის ხარჯ/i.test(line)
    )
      continue;
    if (inPayBlock && amount.test(line)) {
      result.push(line);
      continue;
    }
    if (label.test(line) || /^ანაზღაურების ოდენობა\s*:/i.test(line)) {
      if (
        /^(?:(?:ფიქსირებული|დღიური|საათობრივი|monthly|daily|base)\s+)?(?:ანაზღაურება|ხელფასი|salary|compensation)\s*[:–—-]?\s*$/i.test(
          line,
        )
      ) {
        const next = lines[i + 1];
        if (
          next &&
          next.length <= 600 &&
          amount.test(next) &&
          !/ბონუსი\s*[:–—-]|რეფერალ|ტრანსპორტ|საწვავ/i.test(next)
        )
          result.push(line.replace(/[:–—-]\s*$/, '') + ': ' + next);
      } else if (
        amount.test(line) ||
        /შეთანხმებით|კვალიფიკაცი|გამოცდილების მიხედვით|გამომუშავებით|საკომისიო|ფიქსირებული\s*\+|ხელფასი\s*\+|negotiable|commission/i.test(
          line,
        )
      )
        result.push(line);
      continue;
    }
    if (
      amount.test(line) &&
      /(?:^|[\s,;:(])(?:ანაზღაურება|ანაზღაურებას|ანაზღაურებადი სტაჟირება|ხელფასი|ხელფასს|თანამდებობრივი სარგო)(?=[\s,:–—-]|$)/.test(
        line,
      )
    )
      result.push(line);
    else if (amount.test(line) && /^(?:თვეში|დღეში|საათში)\s+\d/.test(line))
      result.push(line);
  }
  return [...new Set(result)].slice(0, 6);
}
export function payDisplay(excerpts: string[]) {
  const values = excerpts.map((line) =>
    line
      .replace(
        /^(ფიქსირებული|საწყისი|base|fixed)\s+(?:ანაზღაურება|ხელფასი|salary|pay)\s*[:–—-]\s*/i,
        '$1 ',
      )
      .replace(
        /^(?:ანაზღაურება|ხელფასი|salary|compensation)(?:\s*[:–—-]\s*|\s+(?=[$€₾\d]))/i,
        '',
      ),
  );
  const text = values.join(' · ');
  return text.length <= 300 ? text : '';
}
