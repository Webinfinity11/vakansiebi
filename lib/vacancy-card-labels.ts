import { compactSalary } from './vacancy-presentation';

const government = (source: string) => source === 'vacancy.hr.gov.ge';

/** Display labels only: the original title and conditions stay in the vacancy details. */
export function vacancyCardTitle(title: string, source: string) {
  if (!government(source)) return title;
  const program = title.match(/პროფესიული საგანმანათლებლო პროგრამის\s*[„"“](.+?)[”"“]\s*პროფესიული განათლების მასწავლებელი/);
  if (program) return `მასწავლებელი — ${program[1]}`;
  if (title.length > 110 && /საარქივო ფონდის დოკუმენტების გამოყენების/.test(title) && /განყოფილების სპეციალისტი$/.test(title))
    return 'სპეციალისტი — საარქივო დოკუმენტების გამოყენება';
  // Unknown long titles are visibly abbreviated, never assigned an invented profession.
  if (title.length > 110) {
    const role = title.match(/((?:მთავარი |უფროსი |წამყვანი )?(?:სპეციალისტი|კონსულტანტი|ინსპექტორი|იურისტი|მასწავლებელი))$/);
    if (role) {
      const context = title.slice(0, -role[0].length).trim();
      return `${role[0]} — ${context.slice(0, 65).replace(/\s+\S*$/, '')}…`;
    }
  }
  return title;
}

export function vacancyCardSalary(salary: string, period: string, source: string) {
  if (government(source)) {
    const contactHour = salary.match(/1\s+საკონტაქტო\s+ს[თტ]\.?\s*[-–—:]\s*(\d+(?:[.,]\d+)?)\s*(?:₾|ლ(?:არი)?\.?)\s*$/);
    if (contactHour) return `${contactHour[1].replace(',', '.')} ₾ / საკონტაქტო სთ`;
  }
  return compactSalary(salary, period);
}
