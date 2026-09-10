// Conservative extraction from labelled, public vacancy text. Company history,
// contact addresses and arbitrary numbers must not become job location/pay.
import { payExcerpts, payDisplay } from '../lib/pay-excerpts';
export function labelledValue(text: string, label: RegExp): string {
  for (const line of text.split('\n')) {
    const match = line.replace(/^[\s*•–-]+/, '').match(label);
    if (match?.[1]?.trim()) return match[1].trim().slice(0, 300);
  }
  return '';
}
export function vacancyLocation(text: string) {
  const opening = text.split(/\n\s*\n/)[0].trim();
  if (
    opening.length > 500 ||
    !/აცხადებს\s+ვაკანსიას/.test(opening) ||
    !/პოზიციაზე|თანამდებობაზე/.test(opening)
  )
    return '';
  const cities: Record<string, string> = {
    თბილისში: 'თბილისი',
    ბათუმში: 'ბათუმი',
    ქუთაისში: 'ქუთაისი',
    რუსთავში: 'რუსთავი',
    გორში: 'გორი',
    ზუგდიდში: 'ზუგდიდი',
    თელავში: 'თელავი',
    ფოთში: 'ფოთი',
    კახეთში: 'კახეთი',
  };
  const end = opening.match(/\s([^\s.,;]+)[.,;]?\s*$/)?.[1];
  return end ? cities[end] || '' : '';
}
export function visibleFields(text: string) {
  const location =
    labelledValue(
      text,
      /^(?:(?:სამუშაო|სამსახურის)\s+)?(?:ადგილმდებარეობა|ლოკაცია|ადგილი|მისამართი)\s*[:–-]\s*(.+)$/i,
    ) ||
    labelledValue(text, /^(?:job\s+|work\s+)?location\s*[:–-]\s*(.+)$/i) ||
    vacancyLocation(text);
  const dailyPay = labelledValue(
    text,
    /^(?:დღიური\s+(?:ანაზღაურება|ხელფასი)|(?:ანაზღაურება|ხელფასი)\s+(?:დღეში|დღიურად)|daily\s+(?:pay|salary|wage))\s*[:–-]?\s*(\d.+)$/i,
  );
  const excerpts = payExcerpts(text);
  const labelledPay =
    labelledValue(
      text,
      /^(?:ხელფასი|ანაზღაურება|ფიქსირებული ხელფასი|salary|compensation)\s*[:–-]\s*(.+)$/i,
    ) || dailyPay;
  const pay =
    excerpts.length > 1
      ? payDisplay(excerpts)
      : labelledPay || payDisplay(excerpts);
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
  const amountText = pay
    .replace(/^(?:დღეში|დღიურად|daily|per day)\s+/i, '')
    .replace(/^(?:ფიქსირებული|fixed)\s+/i, '');
  const normalizedAmount = amountText
    .replace(
      /^([$€₾])\s*(\d[\d,.]*)(?:\s*[-–—]\s*\1?\s*(\d[\d,.]*))?/,
      (_, symbol: string, min: string, max?: string) =>
        `${min}${max ? '–' + max : ''} ${symbol}`,
    )
    .replace(/(\d)-დან\s*(\d[\d\s,]*)\s*-?\s*ლარამდე/i, '$1–$2 ლარი');
  const match = normalizedAmount.match(
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
  const rateText = pay
    .replace(
      /(?:გადახდა|გაიცემა|დარიცხვა)\s+თვეში\s+(?:ორჯერ|ერთხელ|2-ჯერ|1-ჯერ)/g,
      '',
    )
    .replace(/თვეში\s+ორჯერ\s+დარიცხვით/g, '');
  const periodText = (dailyPay && pay === dailyPay ? 'დღეში ' : '') + rateText;
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
    /თვეში|ყოველთვ|\/\s*თვე|monthly|per month|საათში|per hour|hourly/i.test(
      rateText,
    )
  ) {
    warning =
      'დღიური ხელფასის პერიოდი ტექსტს არ ემთხვევა. გადაამოწმე პირველწყარო.';
    min = null;
    currency = '';
  }
  if (
    excerpts.length > 1 ||
    /საშუალოდ|საშუალო|გამომუშავებით|საკომისიო|average|commission|ბონუსთან ერთად|ხელფასი\s*\+\s*ბონუსი/i.test(
      rateText,
    )
  )
    min = null;
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
    payExcerpts: excerpts,
  };
}
