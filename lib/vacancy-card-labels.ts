import { compactSalary } from './vacancy-presentation';

const government = (source: string) => source === 'vacancy.hr.gov.ge';
export const cardTitleLimit = 95;
export const cardSalaryLimit = 48;
function ellipsis(value: string, limit: number) {
  const clean = value.replace(/\s+/g, ' ').trim();
  const chars = Array.from(clean);
  if (chars.length <= limit) return clean;
  const prefix = chars.slice(0, limit - 1).join('');
  const boundary = prefix.lastIndexOf(' ');
  return (boundary >= limit / 2 ? prefix.slice(0, boundary) : prefix) + '…';
}

/** Display labels only: the original title and conditions stay in the vacancy details. */
export function vacancyCardTitle(title: string, source = '') {
  title = title.replace(/\s+/g, ' ').trim();
  const program = title.match(
    /პროფესიული საგანმანათლებლო პროგრამის\s*[„"“](.+?)[”"“]\s*პროფესიული განათლების მასწავლებელი/,
  );
  if (program) return ellipsis(`მასწავლებელი — ${program[1]}`, cardTitleLimit);
  if (
    government(source) &&
    title.length > 110 &&
    /საარქივო ფონდის დოკუმენტების გამოყენების/.test(title) &&
    title.endsWith('განყოფილების სპეციალისტი')
  )
    return 'სპეციალისტი — საარქივო დოკუმენტების გამოყენება';
  const territorialRole = title.match(
    /(?:დეპარტამენტის|სამმართველოს|სამსახურის|განყოფილების)\s+((?:(?:მთავარი|უფროსი|წამყვანი)\s+)?(?:სოციალური მუშაკი|ფსიქოლოგი|სპეციალისტი|ინსპექტორი))\s*\(სამოქმედო ტერიტორია\s*[-–—:]\s*(.+)\)$/,
  );
  if (territorialRole)
    return ellipsis(
      `${territorialRole[1]} — ${territorialRole[2]}`,
      cardTitleLimit,
    );
  // Unknown long titles are visibly abbreviated, never assigned an invented profession.
  if (Array.from(title).length > cardTitleLimit) {
    const role = title.match(
      /((?:მთავარი |უფროსი |წამყვანი )?(?:სპეციალისტი|კონსულტანტი|ინსპექტორი|იურისტი|მასწავლებელი|სოციალური მუშაკი|ფსიქოლოგი))$/,
    );
    if (role) {
      const context = title.slice(0, -role[0].length).trim();
      return ellipsis(`${role[0]} — ${context}`, cardTitleLimit);
    }
  }
  return ellipsis(title, cardTitleLimit);
}

export function vacancyCardSalary(
  salary: string,
  period: string,
  source: string,
) {
  if (government(source)) {
    const contactHour = salary.match(
      /1\s+საკონტაქტო\s+ს[თტ]\.?\s*[-–—:]\s*(\d+(?:[.,]\d+)?)\s*(?:₾|ლ(?:არი)?\.?)\s*$/,
    );
    if (contactHour)
      return `${contactHour[1].replace(',', '.')} ₾ / საკონტაქტო სთ`;
  }
  if (
    !/\d/.test(salary) &&
    /შეთანხმებით|ინდივიდუალურ|კვალიფიკაცი|გამოცდილებ/.test(salary)
  )
    return 'შეთანხმებით';
  // Match the whole condition: never drop a trailing bonus, tax or schedule clause.
  const range = salary
    .trim()
    .match(
      /^(საშუალოდ\s+)?(\d+(?:[ \u00a0\u202f]\d{3})*)\s*ლარიდან\s+(\d+(?:[ \u00a0\u202f]\d{3})*)\s*ლარამდე(\s+და\s+მეტი)?[.!]?$/,
    );
  if (range) {
    const amount = compactSalary(`${range[2]}–${range[3]} ₾`, period).replace(
      ' ₾',
      `${range[4] ? '+' : ''} ₾`,
    );
    return `${range[1] ? 'საშ. ' : ''}${amount}`;
  }
  const label = compactSalary(salary, period).replace(
    /^(?:შრომის ანაზღაურება|ანაზღაურება|ხელფასი)\s*:\s*/,
    '',
  );
  // Do not extract a single amount from complex pay: that could hide a range,
  // bonus condition, different periods, or a gross/net qualification.
  return Array.from(label).length <= cardSalaryLimit
    ? label
    : 'ანაზღაურება — იხ. დეტალები';
}

/** Legal forms add no useful distinction to the card; full identity remains available. */
export function vacancyCardCompany(company: string) {
  return ellipsis(
    company.replace(/^(?:სსიპ|შპს|სს|ა\(ა\)იპ)\s*(?:[-–—]\s*|\s+)/, ''),
    72,
  );
}

export function vacancyCardLocation(location: string) {
  const text = location
    .split(/https?:\/\//i)[0]
    .split(/ტრანსპორტირებას უზრუნველყოფს|კომპანია თანამშრომელს უზრუნველყოფს/)[0]
    .replace(/[,;\s(]+$/, '');
  return ellipsis(text, 64);
}
