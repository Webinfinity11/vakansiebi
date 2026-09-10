// Conservative extraction from labelled, public vacancy text. Company history,
// contact addresses and arbitrary numbers must not become job location/pay.
export function labelledValue(text: string, label: RegExp): string {
  for (const line of text.split('\n')) {
    const match = line.replace(/^[\s*•–-]+/, '').match(label);
    if (match?.[1]?.trim()) return match[1].trim().slice(0, 300);
  }
  return '';
}
export function visibleFields(text: string) {
  const location =
    labelledValue(
      text,
      /^(?:(?:სამუშაო|სამსახურის)\s+)?(?:ადგილმდებარეობა|ლოკაცია|ადგილი|მისამართი)\s*[:–-]\s*(.+)$/i,
    ) || labelledValue(text, /^(?:job\s+|work\s+)?location\s*[:–-]\s*(.+)$/i);
  const dailyPay = labelledValue(
    text,
    /^(?:დღიური\s+(?:ანაზღაურება|ხელფასი)|(?:ანაზღაურება|ხელფასი)\s+(?:დღეში|დღიურად)|daily\s+(?:pay|salary|wage))\s*[:–-]?\s*(\d.+)$/i,
  );
  const pay =
    labelledValue(
      text,
      /^(?:ხელფასი|ანაზღაურება|ფიქსირებული ხელფასი|salary|compensation)\s*[:–-]\s*(.+)$/i,
    ) || dailyPay;
  const format = labelledValue(
    text,
    /^(?:სამუშაო ფორმატი|მუშაობის ფორმატი|work format)\s*[:–-]\s*(.+)$/i,
  );
  const mode = /ჰიბრიდ|hybrid/i.test(format)
    ? 'ჰიბრიდული'
    : /დისტანციურ|remote/i.test(format)
      ? 'დისტანციური'
      : /ადგილზე|ოფისიდან|on.?site/i.test(format)
        ? 'ადგილზე'
        : '';
  // Keep the visible text (net/gross, bonus, period). Only an unambiguous
  // leading amount with explicit currency becomes a numeric filter value.
  const amountText = pay.replace(/^(?:დღეში|დღიურად|daily|per day)\s+/i, '');
  const match = amountText.match(
    /^(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:[-–—]\s*(\d{1,3}(?:[ ,]\d{3})+|\d+)(?:\.(\d{1,2}))?\s*)?(₾|ლარი|ლარამდე|ლარიდან|GEL|USD|დოლარი|\$|EUR|ევრო|€)(?=$|[\s.,/+])/i,
  );
  let min: number | null = null;
  let currency = '';
  let warning = '';
  if (match) {
    const amount = Number(
      match[1].replace(/[ ,]/g, '') + (match[2] ? '.' + match[2] : ''),
    );
    const maximum = match[3]
      ? Number(match[3].replace(/[ ,]/g, '') + (match[4] ? '.' + match[4] : ''))
      : null;
    if (
      amount > 0 &&
      amount <= 100000000 &&
      (maximum === null || (maximum >= amount && maximum <= 100000000))
    ) {
      currency = /₾|ლარ|GEL/i.test(match[5])
        ? 'GEL'
        : /USD|დოლარ|\$/i.test(match[5])
          ? 'USD'
          : 'EUR';
      if (!/ლარამდე/i.test(match[5])) min = amount;
    } else warning = 'ხელფასის დიაპაზონი გადასამოწმებელია.';
  }
  const periodText = (dailyPay && pay === dailyPay ? 'დღეში ' : '') + pay;
  const period = /თვეში|ყოველთვ|\/\s*თვე|monthly|per month/i.test(periodText)
    ? 'თვე'
    : /საათში|\/\s*საათი|hourly|per hour/i.test(periodText)
      ? 'საათი'
      : /დღეში|დღიურად|\/\s*დღე|daily|per day/i.test(periodText)
        ? 'დღე'
        : '';
  if (
    dailyPay &&
    pay === dailyPay &&
    /თვეში|ყოველთვ|\/\s*თვე|monthly|per month|საათში|per hour|hourly/i.test(pay)
  ) {
    warning =
      'დღიური ხელფასის პერიოდი ტექსტს არ ემთხვევა. გადაამოწმე პირველწყარო.';
    min = null;
    currency = '';
  }
  return {
    location,
    salary: warning
      ? ''
      : dailyPay &&
          pay === dailyPay &&
          !/დღეში|დღიურად|\/\s*დღე|daily|per day/i.test(pay)
        ? pay + ' / დღე'
        : pay,
    salaryMin: min,
    currency,
    salaryPeriod: currency ? period : '',
    mode,
    warning,
  };
}
