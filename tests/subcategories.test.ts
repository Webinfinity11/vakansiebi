import test from 'node:test';
import assert from 'node:assert/strict';
import { categories } from '../lib/types';
import {
  subcategories,
  subcategoryFor,
  subcategoryForTitle,
} from '../lib/subcategories';

// Fixed, manually reviewed titles from the 2026-09-15 COPY export. No database
// or local export is needed to run these regression tests. Misses include
// related roles, ambiguous titles and words that used to match by substring.
const examples: Record<string, { matches: string[]; miss: string }> = {
  'tech-security': {
    matches: [
      'ინფორმაციული უსაფრთხოების GRC ოფიცერი',
      'ინფორმაციული უსაფრთხოების ანალიტიკოსი / Junior/Middle',
      'ინფორმაციული უსაფრთხოების უმცროსი სპეციალისტი',
    ],
    miss: 'დაცვის თანამშრომელი',
  },
  'tech-business-systems': {
    matches: [
      '1C ოპერატორი',
      '1C ოპერატორი/ოფისის თანამშრომელი',
      '1C სისტემის არამედის ოპერატორი',
    ],
    miss: 'landscape designer',
  },
  'tech-product': {
    matches: [
      'IT პროექტების მართვის უფროსი',
      'IT პროექტის მენეჯერი - EST სამუშაო საათები',
      'UI/UX დიზაინერი',
    ],
    miss: 'საწყობის ოპერატორი',
  },
  'tech-data': {
    matches: [
      'IT ბიზნეს ანალიტიკოსი',
      'მონაცემთა ინჟინერი',
      'AI Developer / AI პროგრამისტი',
    ],
    miss: 'AI storyboard and scene breakdown assistant',
  },
  'tech-qa': {
    matches: ['Manual QA ინჟინერი', 'QA ინჟინერი', 'QA ტესტერი'],
    miss: 'ელექტროსკუტერების ტესტირების თანამშრომელი',
  },
  'tech-development': {
    matches: ['დეველოპერი', 'პითონის დეველოპერი', 'უფროსი Android დეველოპერი'],
    miss: 'business development manager',
  },
  'tech-systems': {
    matches: [
      'Cloud არქიტექტორი',
      'IT სისტემების და მონაცემთა გადაცემის ქსელების სპეციალისტი',
      'IT სისტემების და ქსელების სპეციალისტი',
    ],
    miss: 'მაღაზიების ქსელის მენეჯერი',
  },
  'tech-support': {
    matches: [
      'IT მხარდაჭერის სპეციალისტი',
      'IT სპეციალისტი',
      'ტექნიკური მხარდაჭერის სპეციალისტი',
    ],
    miss: 'item support specialist',
  },
  'sales-property': {
    matches: [
      'უძრავი ქონების აგენტი',
      'უძრავი ქონების აგენტი/ბროკერი',
      'უძრავი ქონების გაყიდვების აგენტი',
    ],
    miss: 'უძრავი ქონების ფოტოგრაფი',
  },
  'sales-store': {
    matches: [
      'მაღაზიის მენეჯერი',
      'მაღაზიის ადმინისტრატორი',
      'მაღაზიის მენეჯერის ასისტენტი',
    ],
    miss: 'ფილიალის ფოტოგრაფი',
  },
  'sales-retail': {
    matches: ['მოლარე-კონსულტანტი', 'გაყიდვების კონსულტანტი', 'მოლარე'],
    miss: 'კონსულტანტი',
  },
  'sales-representative': {
    matches: ['მერჩენდაიზერი', 'გაყიდვების აგენტი', 'სავაჭრო წარმომადგენელი'],
    miss: 'სამედიცინო წარმომადგენელი',
  },
  'sales-operations': {
    matches: [
      'გაყიდვების სპეციალისტი',
      'გაყიდვების ოპერატორი',
      'გაყიდვების ასისტენტი',
    ],
    miss: 'ოპერატორი',
  },
  'sales-management': {
    matches: [
      'გაყიდვების მენეჯერი',
      'კორპორატიული გაყიდვების მენეჯერი',
      'კორპორაციული გაყიდვების მენეჯერი',
    ],
    miss: 'ოფის მენეჯერი',
  },
  'marketing-promotion': {
    matches: [
      'რეკლამების დამრიგებელი',
      'Grohe-ს ბრენდის პრომოუტერი',
      'ბრენდის პრომოუტერი',
    ],
    miss: 'გრაფიკული დიზაინერი',
  },
  'marketing-design': {
    matches: [
      'გრაფიკული დიზაინერი',
      '3D გრაფიკული დიზაინერი',
      'სტაჟირება / გრაფიკული დიზაინერი',
    ],
    miss: 'ინტერიერის დიზაინერი',
  },
  'marketing-media': {
    matches: [
      'ვიდეო ოპერატორი',
      'Digital Media & Videography (Part-Timer University Student Welcome)',
      'photographer,photoshoper,seller',
    ],
    miss: 'ვიდეომონიტორინგის ოპერატორი',
  },
  'marketing-social': {
    matches: [
      'სოციალური მედიის მენეჯერი',
      'ედვერთაიზერი',
      'ოფის-მენეჯერი / SMM ადმინისტრატორი',
    ],
    miss: 'კონტენტ კრეატორი',
  },
  'marketing-content': {
    matches: ['კონტენტ კრეატორი', 'ჟურნალისტი', 'Content Operator TKT.ge'],
    miss: 'ჯგუფების და ღონისძიებების აღმასრულებელი',
  },
  'marketing-pr': {
    matches: [
      'ჯგუფების და ღონისძიებების აღმასრულებელი',
      'PR & Communications Manager',
      'PR ბიზნეს-პარტნიორი',
    ],
    miss: 'ტელეკომუნიკაციის ინჟინერი',
  },
  'marketing-management': {
    matches: [
      'მარკეტინგის მენეჯერი',
      'ბრენდ მენეჯერი',
      'მარკეტინგის სპეციალისტი',
    ],
    miss: 'რეკლამების დამრიგებელი',
  },
  'admin-hr': {
    matches: ['HR მენეჯერი', 'HR სპეციალისტი', 'HR ჯენერალისტი'],
    miss: 'პროგრამული უზრუნველყოფის დეველოპერი',
  },
  'admin-reception': {
    matches: [
      'რეგისტრატორი',
      'მორიგე რეგისტრატორი',
      'მიმღები ზონის სპეციალისტი',
    ],
    miss: 'მიმტანი',
  },
  'admin-projects': {
    matches: [
      'პროექტის მენეჯერი',
      'პროექტების მენეჯერი',
      'ინდუსტრიული პროექტების მენეჯერი',
    ],
    miss: 'პროექტის ბუღალტერი',
  },
  'admin-branch': {
    matches: [
      'ფილიალის მენეჯერი',
      'დარბაზის ადმინისტრატორი',
      'დარბაზის მენეჯერი',
    ],
    miss: 'ფილიალის მძღოლი',
  },
  'admin-office': {
    matches: [
      'ოფისის მენეჯერი',
      'ადმინისტრაციული ასისტენტი',
      'ადმინისტრაციული მენეჯერი',
    ],
    miss: 'მენეჯერის ასისტენტი',
  },
  'finance-audit': {
    matches: ['აუდიტორი', 'აუდიტის მენეჯერი', 'გამოცდილი აუდიტის ასისტენტი'],
    miss: 'ბუღალტერი',
  },
  'finance-accounting': {
    matches: ['ბუღალტერი', 'მთავარი ბუღალტერი', 'ბუღალტერ-ოპერატორი'],
    miss: 'Account Manager',
  },
  'finance-risk': {
    matches: [
      'პრობლემური სესხის ოფიცერი / PD',
      'სასესხო ვალდებულებების მართვის ოფიცერი',
      'ჰოსპიტალური სადაზღვევო შემთხვევების მართვის მენეჯერი',
    ],
    miss: 'მიკრო საკრედიტო ექსპერტი',
  },
  'finance-credit': {
    matches: [
      'მიკრო საკრედიტო ექსპერტი',
      'სესხის ოფიცრის ანაზღაურებადი სტაჟირება',
      'საკრედიტო ოფიცერი',
    ],
    miss: 'მოლარე',
  },
  'finance-cash': {
    matches: ['მოლარე', 'მოლარე-კონსულტანტი', 'მოლარე-ოპერატორი'],
    miss: 'კონსულტანტი',
  },
  'finance-banking': {
    matches: [
      'RB ბანკირის ასისტენტი',
      'დიჯიტალ სერვისების ოფიცერი',
      'რჩეული ბანკირი',
    ],
    miss: 'ოპერატორი',
  },
  'finance-analysis': {
    matches: [
      'ფინანსური მენეჯერი',
      'ფინანსური ანალიტიკოსი',
      'უმცროსი ფინანსური ანალიტიკოსი',
    ],
    miss: 'მენეჯერი',
  },
  'logistics-customs': {
    matches: [
      'ექსპორტის სტაჟიორი',
      'საბაჟო ბროკერი',
      'იმპორტ-ექსპორტის ლოგისტიკის სპეციალისტი',
    ],
    miss: 'მძღოლი',
  },
  'logistics-driving': {
    matches: ['მძღოლი', 'მძღოლ-ექსპედიტორი', 'კურიერი'],
    miss: 'სატრანსპორტო კომპანიის ბუღალტერი',
  },
  'logistics-distribution': {
    matches: [
      'დისტრიბუტორი',
      'ექსპედიტორი',
      'დისტრიბუტორი საკუთარი ავტომობილით',
    ],
    miss: 'საწყობის თანამშრომელი',
  },
  'logistics-warehouse': {
    matches: ['საწყობის თანამშრომელი', 'საწყობის მენეჯერი', 'მტვირთავი'],
    miss: 'თანამშრომელი',
  },
  'logistics-procurement': {
    matches: [
      'შესყიდვების მენეჯერი',
      'საერთაშორისო შესყიდვების სპეციალისტი',
      'შესყიდვების სამსახურის უფროსი',
    ],
    miss: 'საწყობის თანამშრომელი',
  },
  'logistics-dispatch': {
    matches: ['დისპეტჩერი', 'ლოჯისტიკის მენეჯერი', 'ლოგისტიკის მენეჯერი'],
    miss: 'ექსპორტის სტაჟიორი',
  },
  'service-reception': {
    matches: [
      'სასტუმროს ადმინისტრატორი',
      'რეცეფციონისტი',
      'რესტორნის მენეჯერი',
    ],
    miss: 'სასტუმროს ბუღალტერი',
  },
  'service-kitchen': {
    matches: ['მზარეული', 'მცხობელი', 'ჭურჭლის მრეცხავი'],
    miss: 'შეფასების სპეციალისტი',
  },
  'service-hospitality': {
    matches: ['მიმტანი', 'ბარისტა', 'ბარმენი'],
    miss: 'ავტო მრეცხავი',
  },
  'service-auto': {
    matches: ['ავტო მრეცხავი', 'ავტომობილის მრეცხავი', 'ავტომრეცხავი'],
    miss: 'ჭურჭლის მრეცხავი',
  },
  'service-cleaning': {
    matches: ['დიასახლისი', 'დამლაგებელი', 'დასუფთავების თანამშრომელი'],
    miss: 'ქიმიური კვლევის სპეციალისტი',
  },
  'service-care': {
    matches: ['ძიძა', 'მომვლელი', 'მოხუცის მომვლელი'],
    miss: 'ოჯახის ექიმი',
  },
  'service-support': {
    matches: [
      'ქოლ ცენტრის ოპერატორი',
      'ქოლ-ცენტრის ოპერატორი',
      'ქოლცენტრის ოპერატორი',
    ],
    miss: 'დიჯითალ ოპერატორი',
  },
  'medical-administration': {
    matches: [
      'რეგისტრატორი',
      'სამედიცინო მხარდაჭერის ოპერატორი',
      'მიმღების (ER) რეგისტრატორი',
    ],
    miss: 'სამედიცინო წარმომადგენელი',
  },
  'medical-commercial': {
    matches: [
      'სამედიცინო წარმომადგენელი',
      'სამედიცინო პროდუქციის მენეჯერი',
      'სამედიცინო წარმომადგენელი - მენეჯერი',
    ],
    miss: 'სტომატოლოგის ასისტენტი',
  },
  'medical-dental': {
    matches: [
      'სტომატოლოგის ასისტენტი',
      'სტომატოლოგი თერაპევტი',
      'სტომატოლოგიის ექთანი',
    ],
    miss: 'სტომატოლოგიური მასალის გამყიდველი',
  },
  'medical-nursing': {
    matches: ['ექთანი', 'მორიგე ექთანი', 'ამბულატორიის ექთანი'],
    miss: 'სამზარეულოს დამხმარე',
  },
  'medical-pharmacy': {
    matches: [
      'ფარმაცევტი',
      'ფარმაცევტის თანაშემწე',
      'მორიგე და დღის ფარმაცევტი',
    ],
    miss: 'ფსიქოლოგი',
  },
  'medical-mental-rehab': {
    matches: [
      'ფსიქოლოგი',
      'ბინაზე მოვლის პროგრამის ფსიქოლოგი',
      'ოკუპაციური თერაპევტი',
    ],
    miss: 'სარეაბილიტაციო ცენტრის ადმინისტრატორი',
  },
  'medical-laboratory': {
    matches: ['ლაბორანტი', 'ექიმი-ლაბორანტი', 'ფლებოტომისტი'],
    miss: 'ოჯახის ექიმი',
  },
  'medical-doctors': {
    matches: ['ოჯახის ექიმი', 'ოჯახის ექიმის ასისტენტი', 'უმცროსი ექიმი'],
    miss: 'სტომატოლოგიური კლინიკის ადმინისტრატორი',
  },
  'education-support': {
    matches: [
      'მასწავლებლის ასისტენტი',
      'სპეციალური მასწავლებელი',
      'შშმ პირის ასისტენტი',
    ],
    miss: 'ასისტენტი',
  },
  'education-preschool': {
    matches: ['აღმზრდელი', 'აღმზრდელ-პედაგოგი', 'აღმზრდელი (მასწავლებელი)'],
    miss: 'საბავშვო ბაღის ბუღალტერი',
  },
  'education-vocational': {
    matches: [
      'სატყეო საქმის პროფესიული საგანმანათლებლო პროგრამის პროფესიული მასწავლებელი',
      'თმისა და სილამაზის მომსახურების პროფესიული საგანმანათლებლო პროგრამის პროფესიული მასწავლებელი',
      'ინფორმაციის ტექნოლოგიის მხარდაჭერის პროფესიული საგანმანათლებლო პროგრამის პროფესიული მასწავლებელი',
    ],
    miss: 'პროფესიული კოლეჯის დარაჯი',
  },
  'education-training': {
    matches: [
      'ტექნიკური ტრენერი',
      'Excel-ის ონლაინ ტრენერი',
      'Soft Skill ტრენერი',
    ],
    miss: 'აკადემიური თანამდებობები',
  },
  'education-academic': {
    matches: [
      'აკადემიური თანამდებობები',
      'აკადემიური თანამდებობები - ინფორმაციული ტექნოლოგიები',
      'აკადემიური კონკურსი - ბიზნესის სკოლა',
    ],
    miss: 'ინგლისური ენის მასწავლებელი',
  },
  'education-school': {
    matches: [
      'ინგლისური ენის მასწავლებელი',
      'მათემატიკის მასწავლებელი',
      'პედაგოგი',
    ],
    miss: 'მასწავლებლის ასისტენტი',
  },
  'construction-architecture': {
    matches: ['არქიტექტორი', 'გეოდეზისტი', 'ჯუნიორ არქიტექტორი'],
    miss: 'კონსულტანტი',
  },
  'construction-management': {
    matches: [
      'მშენებლობის ზედამხედველი',
      'სამშენებლო პროექტების მენეჯერი',
      'საიტ მენეჯერი',
    ],
    miss: 'სამშენებლო მასალის გამყიდველი',
  },
  'construction-electrical': {
    matches: ['ელექტრიკოსი', 'ელექტრო მემონტაჟე', 'სანტექნიკოსი'],
    miss: 'ავეჯის ხელოსანი',
  },
  'construction-furniture': {
    matches: [
      'ავეჯის ხელოსანი',
      'ავეჯის დამამზადებელი და მონტაჟის ხელოსანი',
      'ავეჯის აწყობა მონტაჟი',
    ],
    miss: 'შემდუღებელი',
  },
  'construction-installation': {
    matches: [
      'შემდუღებელი',
      'ალუმინის კარფანჯრის და საფასადე სისტემების მემონტაჟე',
      'მეთუნუქე',
    ],
    miss: 'მღებავი',
  },
  'construction-finishing': {
    matches: [
      'მღებავი',
      'ავეჯის მღებავი',
      '599448754-ზვიადი. მესაჭიროება ფასანაურში ობიექტზე თაბაშირ-მუყაოს , ამსტრონგის და მეტლახის ხელოსანი',
    ],
    miss: 'არმატურის ხელოსანი',
  },
  'construction-structure': {
    matches: [
      'არმატურის ხელოსანი',
      'ბეტონის კონსტრუქციების წარმოების მენეჯერი',
      'მონოლითი',
    ],
    miss: 'დღიური მუშა',
  },
  'construction-labor': {
    matches: ['დღიური მუშა', 'დამხმარე მუშა', 'დღიური მშრომელი'],
    miss: 'თანამშრომელი',
  },
  'security-safety': {
    matches: [
      'შრომის უსაფრთხოების სპეციალისტი',
      'შრომის უსაფრთხოების მენეჯერი',
      'ანაზღაურებადი სტაჟირება - შრომის უსაფრთხოების მენეჯერი',
    ],
    miss: 'უსაფრთხოების თანამშრომელი',
  },
  'security-monitoring': {
    matches: [
      'მონიტორინგის თანამშრომელი',
      'ვიდეო მონიტორინგის თანამშრომელი',
      'ვიდეო მონიტორინგის ოპერატორი',
    ],
    miss: 'მონიტორის შემკეთებელი',
  },
  'security-cash': {
    matches: ['ინკასატორი', 'კახეთის წარმომადგენლობის მძღოლ-ინკასატორი'],
    miss: 'დაცვის თანამშრომელი',
  },
  'security-guard': {
    matches: ['დაცვის თანამშრომელი', 'უსაფრთხოების თანამშრომელი', 'დაცვა'],
    miss: 'შრომის უსაფრთხოების სპეციალისტი',
  },
  'production-engineering': {
    matches: [
      'MEP ინჟინერი',
      'HVAC ინჟინერი',
      'მექანიკური ინჟინერის HVAC პროექტანტი',
    ],
    miss: 'ინჟინერი',
  },
  'production-maintenance': {
    matches: ['ტექნიკოსი', 'მექანიკოსი', 'ელექტრო-მექანიკოსი'],
    miss: 'მკერავი',
  },
  'production-sewing': {
    matches: ['მკერავი', 'რბილი ავეჯის მკერავი', 'ავტომობილის სალონის მკერავი'],
    miss: 'ტანსაცმლის გამყიდველი',
  },
  'production-furniture': {
    matches: [
      'ავეჯის ამწყობი',
      '✅️ავეჯის საამქროში გვესაჭიროება ხელოსნის დამხმარეები.(სასურველია გამოცდილება)',
      'ავეჯის საწარმო იწვევს ხელოსნის დამხმარეს',
    ],
    miss: 'ავეჯის გამყიდველი',
  },
  'production-packing': {
    matches: ['შემფუთველი', 'დამსტიკერებელი', 'დამფასოებელი'],
    miss: 'დანადგარის ოპერატორი',
  },
  'production-line': {
    matches: [
      'დანადგარის ოპერატორი',
      'საწარმოს თანამშრომელი',
      'საწარმოს დამხმარე',
    ],
    miss: 'კერამიკის საწარმო',
  },
  'production-labor': {
    matches: ['მუშა', 'დამხმარე მუშა', 'დღიური მუშა'],
    miss: 'თანამშრომელი',
  },
  'legal-assistance': {
    matches: [
      'იურისტის ასისტენტი',
      'ადვოკატი/ადვოკატის თანაშემწე - სისხლის სამართალი',
      'იურისტის ასისტენტი - ქუთაისი',
    ],
    miss: 'ასისტენტი',
  },
  'legal-proceedings': {
    matches: [
      'ადამიანის უფლებათა ევროპულ სასამართლოში საქართველოდან ასარჩევი მოსამართლე (წარსადგენი კანდიდატების შესარჩევი კონკურსი)',
      'თეთრიწყაროს რაიონული სასამართლოს აპარატის სპეციალისტი',
      'უფროსი იურისტი - სამართალწარმოების განყოფილება',
    ],
    miss: 'იურისტი',
  },
  'legal-practice': {
    matches: [
      'იურისტი',
      'უმცროსი იურისტი',
      'სამართლებრივი ოპერაციების უმცროსი იურისტი',
    ],
    miss: 'კონსულტანტი',
  },
  'beauty-management': {
    matches: [
      'ადმინისტრატორი ფიტნეს-სპა ცენტრში',
      'ბარბერ შოპის მენეჯერი (მამაკაცი)',
      'სალონის ადმინისტრატორი',
    ],
    miss: 'სალონის დამლაგებელი',
  },
  'beauty-nails': {
    matches: [
      'მანიკურ-პედიკურის სპეციალისტი',
      'მანიკურის სპეციალისტი',
      'მანიკურისა და პედიკურის სპეციალისტი',
    ],
    miss: 'დერმატო-კოსმეტოლოგი/კოსმეტოლოგი',
  },
  'beauty-cosmetics': {
    matches: ['დერმატო-კოსმეტოლოგი/კოსმეტოლოგი', 'ვიზაჟისტი', 'კოსმეტოლოგი'],
    miss: 'მასაჟისტი',
  },
  'beauty-spa': {
    matches: [
      'მასაჟისტი',
      'ვეძებთ მასაჟისტ ქალს თბილისში',
      'მასაჟისტი / სამკურნალო მასაჟი',
    ],
    miss: 'სპა ცენტრი',
  },
  'beauty-hair': {
    matches: ['სტილისტი', 'ბარბერი', 'გვესაჭიროება სტილისტი'],
    miss: 'თმის საშუალებების გამყიდველი',
  },
};

void test('taxonomy IDs, parents and patterns remain valid and bounded', () => {
  assert.equal(
    new Set(subcategories.map((item) => item.id)).size,
    subcategories.length,
  );
  assert.deepEqual(
    Object.keys(examples).sort(),
    subcategories.map((item) => item.id).sort(),
  );
  for (const item of subcategories) {
    assert.match(item.id, /^[a-z]+-[a-z]+(?:-[a-z]+)*$/);
    assert.ok(item.id.length <= 40);
    assert.ok((categories as readonly string[]).includes(item.category));
    assert.doesNotThrow(() => new RegExp(item.pattern, 'i'));
    assert.equal(subcategoryFor(item.category, item.id), item);
    assert.equal(subcategoryFor('სხვა', item.id), undefined);
  }
  for (const category of categories) {
    const count = subcategories.filter(
      (item) => item.category === category,
    ).length;
    if (category === 'სხვა') assert.equal(count, 0);
    else assert.ok(count >= 3 && count <= 8, category);
  }
});

void test('the original 17 IDs keep their parent and saved-search meaning', () => {
  const original: Record<string, string[]> = {
    გაყიდვები: ['sales-retail', 'sales-management', 'sales-representative'],
    მომსახურება: [
      'service-hospitality',
      'service-kitchen',
      'service-cleaning',
      'service-support',
    ],
    ტექნოლოგიები: [
      'tech-development',
      'tech-qa',
      'tech-support',
      'tech-systems',
    ],
    ლოჯისტიკა: [
      'logistics-driving',
      'logistics-warehouse',
      'logistics-procurement',
    ],
    ფინანსები: ['finance-accounting', 'finance-analysis', 'finance-audit'],
  };
  for (const [category, ids] of Object.entries(original))
    for (const id of ids) assert.ok(subcategoryFor(category, id), id);
});

void test('bare ambiguous roles never assign a child in any parent', () => {
  const titles = [
    'მენეჯერი',
    'სპეციალისტი',
    'ოპერატორი',
    'კონსულტანტი',
    'ასისტენტი',
    'ინჟინერი',
    'კოორდინატორი',
    'manager',
    'specialist',
    'operator',
    'consultant',
    'assistant',
    'engineer',
    'coordinator',
    'კონსულტანტი, ასისტენტი',
    'მენეჯერის ასისტენტი',
    'ოპერატორ-კონსულტანტი',
    '',
  ];
  for (const title of titles) {
    for (const item of subcategories)
      assert.doesNotMatch(
        title,
        new RegExp(item.pattern, 'i'),
        `${item.id}: ${title}`,
      );
    for (const category of categories)
      assert.equal(
        subcategoryForTitle(category, title),
        undefined,
        `${category}: ${title}`,
      );
  }
});

for (const [id, fixture] of Object.entries(examples)) {
  void test(`${id}: real titles, exclusive SQL pattern and counterexample`, () => {
    const item = subcategories.find((rule) => rule.id === id)!;
    assert.ok(fixture.matches.length >= 2 && fixture.matches.length <= 3);
    assert.equal(new Set(fixture.matches).size, fixture.matches.length);
    for (const title of fixture.matches) {
      const normalized = title.normalize('NFKC').toLowerCase();
      assert.match(normalized, new RegExp(item.pattern, 'i'));
      assert.equal(subcategoryForTitle(item.category, title)?.id, id);
      assert.deepEqual(
        subcategories
          .filter(
            (rule) =>
              rule.category === item.category &&
              new RegExp(rule.pattern, 'i').test(normalized),
          )
          .map((rule) => rule.id),
        [id],
      );
    }
    assert.doesNotMatch(
      fixture.miss.normalize('NFKC').toLowerCase(),
      new RegExp(item.pattern, 'i'),
    );
  });
}

void test('first matching role in array wins, including independent SQL filters', () => {
  // Both raw role signals occur. The earlier child's exported pattern owns
  // the title; the later child's pattern excludes it even when queried alone.
  const cases = [
    [
      'ლოჯისტიკა',
      'მძღოლ-ექსპედიტორი',
      'logistics-driving',
      'logistics-distribution',
    ],
    [
      'განათლება',
      'პროფესიული მასწავლებელი',
      'education-vocational',
      'education-school',
    ],
    [
      'სამედიცინო',
      'ექთანი - გინეკოლოგიის დეპარტამენტი',
      'medical-nursing',
      'medical-doctors',
    ],
    ['იურიდიული', 'იურისტის ასისტენტი', 'legal-assistance', 'legal-practice'],
    [
      'მარკეტინგი',
      'ციფრული მარკეტინგის მენეჯერი',
      'marketing-social',
      'marketing-management',
    ],
    [
      'მშენებლობა',
      'ელექტრო მემონტაჟე',
      'construction-electrical',
      'construction-installation',
    ],
    [
      'ფინანსები',
      'პრობლემური სესხის ოფიცერი',
      'finance-risk',
      'finance-credit',
    ],
    [
      'გაყიდვები',
      'გაყიდვების შემდგომი მომსახურების მენეჯერი',
      'sales-operations',
      'sales-management',
    ],
  ];
  for (const [category, title, first, later] of cases) {
    assert.ok(
      subcategories.findIndex((r) => r.id === first) <
        subcategories.findIndex((r) => r.id === later),
    );
    assert.equal(subcategoryForTitle(category, title)?.id, first);
    assert.doesNotMatch(
      title,
      new RegExp(subcategoryFor(category, later)!.pattern, 'i'),
    );
  }
});

void test('NFKC, case folding, Latin role names and parent boundaries', () => {
  const cases = [
    ['ტექნოლოგიები', 'ＩＴ მხარდაჭერის სპეციალისტი', 'tech-support'],
    ['გაყიდვები', 'ᲛᲝᲚᲐᲠᲔ', 'sales-retail'],
    ['გაყიდვები', 'SALES REPRESENTATIVE', 'sales-representative'],
    ['მარკეტინგი', 'Graphic Designer', 'marketing-design'],
    ['ადმინისტრაცია', 'HR specialist', 'admin-hr'],
    ['ფინანსები', 'Accountant', 'finance-accounting'],
    ['ლოჯისტიკა', 'Delivery Courier', 'logistics-driving'],
    ['მომსახურება', 'Customer Support Agent', 'service-support'],
    ['სამედიცინო', 'Dental Assistant', 'medical-dental'],
    ['განათლება', 'Vocational Teacher', 'education-vocational'],
    ['განათლება', 'Teaching Assistant', 'education-support'],
    ['მშენებლობა', 'Electrician', 'construction-electrical'],
    ['დაცვა', 'Security Guard', 'security-guard'],
    ['წარმოება', 'Machine Operator', 'production-line'],
    ['იურიდიული', 'Legal Assistant', 'legal-assistance'],
    ['სილამაზე', 'Spa Manager', 'beauty-management'],
  ];
  for (const [category, title, id] of cases)
    assert.equal(subcategoryForTitle(category, title)?.id, id);
  assert.equal(subcategoryForTitle('ფინანსები', 'IT მხარდამჭერი'), undefined);
  assert.equal(subcategoryForTitle('სხვა', 'ბუღალტერი'), undefined);
  assert.equal(subcategoryForTitle('უცნობი', 'მოლარე'), undefined);
  assert.equal(subcategoryFor('გაყიდვები', 'unknown'), undefined);
});

void test('manual audit corrections keep concrete duties and reject a vague digital operator', () => {
  const cases = [
    [
      'გაყიდვები',
      'გაყიდვების შემდგომი მომსახურების მენეჯერი',
      'sales-operations',
    ],
    ['გაყიდვები', 'მოლარის დამხმარე საცხობში', 'sales-retail'],
    ['ადმინისტრაცია', 'VIP სტუმრების კოორდინატორი', 'admin-reception'],
    ['ლოჯისტიკა', 'დაფასოების უბნის უფროსი', 'logistics-warehouse'],
    ['მომსახურება', 'ქიმწმენდის სპეციალისტი', 'service-cleaning'],
    [
      'წარმოება',
      'საწარმოს წიბოს შემოკვრის სპეციალისტი',
      'production-furniture',
    ],
  ];
  for (const [category, title, id] of cases)
    assert.equal(subcategoryForTitle(category, title)?.id, id);
  assert.equal(
    subcategoryForTitle('მომსახურება', 'დიჯითალ ოპერატორი'),
    undefined,
  );
});
