import { categories } from '../lib/types';

export type Category = (typeof categories)[number];
const known = new Set<string>(categories);
const ours = (value: string): Category | '' =>
  known.has(value) && value !== 'სხვა' ? (value as Category) : '';

/** jobs.ge listing categories (`cid`); the vacancy type filter `jid=1` excludes tenders and trainings. */
export const jobsCategories: {
  cid: number;
  label: string;
  category: string;
}[] = [
  { cid: 1, label: 'ადმინისტრაცია/მენეჯმენტი', category: 'ადმინისტრაცია' },
  { cid: 3, label: 'ფინანსები/სტატისტიკა', category: 'ფინანსები' },
  { cid: 2, label: 'გაყიდვები', category: 'გაყიდვები' },
  { cid: 4, label: 'PR/მარკეტინგი', category: 'მარკეტინგი' },
  { cid: 18, label: 'ზოგადი ტექნიკური პერსონალი', category: 'წარმოება' },
  { cid: 5, label: 'ლოგისტიკა/ტრანსპორტი/დისტრიბუცია', category: 'ლოჯისტიკა' },
  { cid: 11, label: 'მშენებლობა/რემონტი', category: 'მშენებლობა' },
  { cid: 16, label: 'დასუფთავება', category: 'მომსახურება' },
  { cid: 17, label: 'დაცვა/უსაფრთხოება', category: 'დაცვა' },
  { cid: 6, label: 'IT/პროგრამირება', category: 'ტექნოლოგიები' },
  { cid: 13, label: 'მედია/გამომცემლობა', category: 'მარკეტინგი' },
  { cid: 12, label: 'განათლება', category: 'განათლება' },
  { cid: 7, label: 'სამართალი', category: 'იურიდიული' },
  { cid: 8, label: 'მედიცინა/ფარმაცია', category: 'სამედიცინო' },
  { cid: 14, label: 'სილამაზე/მოდა', category: 'სილამაზე' },
  { cid: 10, label: 'კვება', category: 'მომსახურება' },
  { cid: 9, label: 'სხვა', category: 'სხვა' },
];

/** jobs.ss.ge spheres, keyed by the public `sphereId`; titles are read live from the page. */
const ssSpheres: Record<number, string> = {
  63: 'ფინანსები',
  61: 'მომსახურება',
  64: 'გაყიდვები',
  398: 'განათლება',
  397: 'გაყიდვები',
  47: 'მშენებლობა',
  66: 'მომსახურება',
  45: 'დაცვა',
  68: 'ტექნოლოგიები',
  69: 'იურიდიული',
  74: 'მარკეტინგი',
  55: 'სამედიცინო',
  391: 'მომსახურება',
  32: 'მომსახურება',
  393: 'წარმოება',
  392: 'წარმოება',
  57: 'ლოჯისტიკა',
  65: 'ფინანსები',
  59: 'ადმინისტრაცია',
  44: 'მომსახურება',
  41: 'სილამაზე',
  30: 'მომსახურება',
  4: 'მომსახურება',
  67: 'წარმოება',
  77: 'ადმინისტრაცია',
  72: 'ლოჯისტიკა',
  53: 'წარმოება',
  48: 'მშენებლობა',
  50: 'მომსახურება',
  452: 'მომსახურება',
};

/** A source's own classification, mapped onto the catalogue taxonomy. Empty when it says nothing. */
export function sourceCategory(
  source: 'jobs' | 'ss',
  value: string | number | null | undefined,
): Category | '' {
  if (value === null || value === undefined || value === '') return '';
  if (source === 'ss') return ours(ssSpheres[Number(value)] || '');
  const label = String(value).trim();
  return ours(
    jobsCategories.find((c) => c.label === label || String(c.cid) === label)
      ?.category || '',
  );
}

// Specific occupations first, so "გაყიდვების მენეჯერი" is sales and "ოფის მენეჯერი" is
// administration; the generic manager/specialist rule comes last. Short stems are anchored to
// a word start where a Georgian suffix could otherwise contain them ("გაყიდვების" holds "ვებ").
const rules: [RegExp, string][] = [
  [
    /იურისტ|lawyer|legal|იურიდიულ|სამართ|ადვოკატ|attorney|ნოტარიუს|კომპლაენს|compliance|paralegal/u,
    'იურიდიული',
  ],
  [
    /ექიმ|doctor|physician|ექთან|nurse|ფარმაც|pharm|სტომატოლოგ|dent(?:ist|al)|ლაბორანტ|მედიცინ|medic|კლინიკ|clinic|ფსიქოლოგ|psycholog|ვეტერინარ|veterinar|რეაბილიტ|ფიზიოთერაპ|therapist|რენტგენ|ანესთეზ|ქირურგ|surgeon/u,
    'სამედიცინო',
  ],
  [
    /მასწავლებ|teacher|ლექტორ|lecturer|პედაგოგ|რეპეტიტორ|tutor|(?<!ფიტნეს[- ])ტრენერ|(?<!fitness |personal )trainer|აღმზრდელ|ბაგა-ბაღ|kindergarten|ინსტრუქტორ|instructor|მენტორ|coach|პროფესორ|professor|educat/u,
    'განათლება',
  ],
  [
    /დეველოპერ|developer|პროგრამისტ|programmer|software|devops|\bsre\b|ტესტერ|tester|\bqa\b|\bit\b|\bit[- ]|ინფორმაციულ|information technolog|information security|security (?:engineer|analyst)|სისტემ(?:ურ|ის)\s+ადმინისტრატორ|sysadmin|\bdata\b|მონაცემთა|frontend|front-end|backend|back-end|full.?stack|android|\bios\b|python|java|\.net|c#|php|react|angular|node\.?js|კიბერ|cyber|database|(?<!მაღაზი(?:ათა|ების) |სავაჭრო |რესტორნების |სააფთიაქო )ქსელის (?:ინჟინერ|ადმინისტრატორ|მართვ|მონიტორინგ|სპეციალისტ|ტექნიკოს)|network (?:engineer|administrator|specialist)|\bai\b|\bml\b|machine learning|artificial intelligence|ხელოვნური ინტელექტ|\bux\b|ui\/ux|ux\/ui|(?<!\p{L})ვებ|\bweb|ერპ|\berp\b|\b1c\b|\bsap\b|helpdesk|help desk|ტექნიკური მხარდაჭერ|technical support|cloud|(?:solutions?|systems?|enterprise) architect/u,
    'ტექნოლოგიები',
  ],
  [/დაცვ|security|guard|მცველ|ბოდიგარდ|უსაფრთხოებ/u, 'დაცვა'],
  [
    /სილამაზ|beauty|სტილისტ|stylist|პარიკმახერ|hairdress|მანიკურ|nail|კოსმეტოლოგ|cosmetolog|მასაჟისტ|massage|ვიზაჟისტ|makeup|ბარბერ|barber|(?<!\p{L})სპა(?!\p{L})|\bspa\b|ლაშმეიკერ|lash|ბროუ/u,
    'სილამაზე',
  ],
  [
    /მძღოლ|driver|მძღოლი|საწყობ|warehouse|ლოჯისტ|ლოგისტ|logist|დისპეტჩ|dispatch|კურიერ|courier|ექსპედიტორ|მიწოდებ|delivery|მტვირთავ|loader|ავტოფარეხ|supply chain|შესყიდვ|procurement|purchas|იმპორტ|ექსპორტ|საბაჟო|customs|ავიაც|ტვირთ|cargo|შიპინგ|shipping|დისტრიბუ|distribut/u,
    'ლოჯისტიკა',
  ],
  [
    /მშენებ|construct|რემონტ|ელექტრიკ|electric|შემდუღებ|welder|სანტექნიკ|plumb|მღებავ|painter|დურგალ|carpenter|(?<!ვიდეო[- ]?)მონტაჟ|install|ხელოსან|handyman|(?<!\p{L})არქიტექტ|architect|გეოდეზ|survey|კალატოზ|ამწ(?:ის|ე)|crane|მოპირკეთ|ბეტონ|გზის მუშ|საპროექტო|ინტერიერ/u,
    'მშენებლობა',
  ],
  [
    /ბუღალტ|ფინანს|accountant|financ|აუდიტ|audit|საკრედიტო|credit|სესხ|loan|(?<!\p{L})ბანკ|\bbank|ეკონომისტ|economist|ანალიტიკოს|analyst|დაზღვევ|insurance|საგადასახადო|\btax|ხაზინ|treasury|ინვესტ|invest|ბიუჯეტ|budget|ლიზინგ|leasing/u,
    'ფინანსები',
  ],
  [
    /მარკეტინგ|marketing|რეკლამ|advertis|\bsmm\b|\bpr\b|ბრენდ|brand|კონტენტ|content|დიზაინერ|designer|copywriter|კოპირაიტერ|ჟურნალისტ|journalist|მედია|media|ვიდეო|video|ფოტოგრაფ|photograph|გრაფიკულ|graphic|საზოგადოებასთან|(?<!tele)communicat|(?<!ტელე)კომუნიკაცი|ციფრულ|digital|\bseo\b|ივენთ|event/u,
    'მარკეტინგი',
  ],
  [
    /გაყიდვ|sales|მოლარე|cashier|კონსულტანტ|consultant|გამყიდველ|seller|მერჩენდაიზ|merchandis|ექაუნთ|account manager|ტელემარკეტ|telemarket|სავაჭრო|\btrade|წარმომადგენ|representative|აგენტ|\bagent|ბროკერ|broker|რეალტორ|realtor|დილერ|dealer|მაღაზი|\bshop\b|\bstore\b|რითეილ|retail|ბიზნესის განვითარებ|business development|\bb2b\b|კომერციულ|commercial/u,
    'გაყიდვები',
  ],
  [
    /მიმტან|waiter|waitress|ბარისტ|barista|ბარმენ|bartender|მზარეულ|\bcook|chef|(?<!\p{L})შეფ|მცხობელ|baker|დამლაგებ|დასუფთავ|cleaner|cleaning|დიასახლის|housekeep|რეცეფ|reception|სასტუმრო|hotel|ჰოსტეს|hostess|ძიძა|nanny|მომვლელ|caregiver|კვებ|catering|რესტორ|restaurant|კაფე|cafe|ტურ(?:ისტ|იზმ|ოპერატ)|tourism|(?<!\p{L})გიდ|\bguide|ფიტნეს|fitness|სპორტ|sport|ცხოველ|animal|ქოლ.?ცენტრ|call.?cent|მომხმარებელთა|customer|სერვის|service|მხარდაჭერ|support|კონსიერჟ|concierge|სტიუარდ|steward|ლანდშაფტ|მებაღ|garden|ავტოსერვის|მრეცხავ|wash/u,
    'მომსახურება',
  ],
  [
    /წარმოებ|საწარმო|production|manufactur|ქარხ|factory|ფაბრიკ|დანადგარ|machine|ჩარხ|მუშა(?!კ)|worker|labou?rer|შემფუთ|packer|packag|მკერავ|tailor|sewing|ხარისხის კონტროლ|quality control|ტექნიკოს|technician|მექანიკ|mechanic|ინჟინერ|engineer|ტექნოლოგ|technolog|ზეინკალ|locksmith|ხარატ|turner|ენერგეტიკ|energy|ცვლის უფროს|საამქრო|ამწყობ|assembl|ავეჯ|furniture|\bwood|ლითონ|metal|სამრეწველო|industrial|სოფლის მეურნეობ|agricultur|აგრონომ|ფერმ|farm|ღვინ|wine/u,
    'წარმოება',
  ],
  // A bare operator is usually a call-centre or service desk; machine operators matched above.
  [/ოპერატორ|operator/u, 'მომსახურება'],
  [
    /ადმინისტრ|administr|ასისტენტ|assistant|ოფის|office|მდივან|secretary|ადამიანური|\bhr\b|human resources|რეკრუტ|recruit|მენეჯერ|manager|სპეციალისტ|specialist|კოორდინატორ|coordinator|ხელმძღვანელ|\bhead\b|დირექტორ|director|უფროსი|senior|კონსულტაცი|პროექტ|project|ოპერაციებ|operations|ანალიზ|საქმის მწარმოებ|clerk|რეგისტრატორ|registrar|დოკუმენტ|document|არქივ|archiv|თარჯიმან|translat|interpret|რედაქტორ|editor/u,
    'ადმინისტრაცია',
  ],
];

/** Title-based classification, used when the source itself offers no category. */
export function titleCategory(title: string): Category {
  const t = title.normalize('NFKC').toLowerCase();
  return (rules.find(([r]) => r.test(t))?.[1] as Category) || 'სხვა';
}
export function classify(
  title: string,
  fromSource: Category | '' = '',
): Category {
  return fromSource || titleCategory(title);
}
