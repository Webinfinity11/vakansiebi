import { ArrowUpRight, ChevronDown, FileText, Search } from 'lucide-react';
import './help.css';
import Link from 'next/link';
import { ContentPage } from '../content-page';
import { LocalText } from '../local-text';
import { contentMetadata } from '@/lib/content-seo';

export const metadata = contentMetadata(
  '/help',
  'დახმარება — ვაკანსიების ძიება და რეზიუმე',
  'როგორ მოძებნო ვაკანსია, შეადარო სამუშაო პირობები, შექმნა რეზიუმე და გააგზავნო განაცხადი ჯობიქსზე.',
);
const questions = [
  {
    q: 'როგორ მოვძებნო სასურველი ვაკანსია?',
    enQ: 'How do I find a suitable job?',
    a: 'ძიების ველში ჩაწერე პოზიცია ან კომპანია და აირჩიე ქალაქი. შეგიძლია დაამატო ხელფასის, სამუშაო გრაფიკისა და გამოცდილების ფილტრები. თუ შედეგი ცოტაა, ჯერ ერთი პირობა მოხსენი.',
    enA: 'Enter a position or company and select a city. Refine the results by pay, schedule or experience. If there are too few results, remove one filter first.',
  },
  {
    q: 'როგორ ვიპოვო სამსახური გამოცდილების გარეშე?',
    enQ: 'How do I find work without experience?',
    a: 'ჩართე „გამოცდილების გარეშე“ ან ნახე სტაჟირების ვაკანსიები. შემდეგ წაიკითხე სრული აღწერა: ცალკე შეამოწმე აუცილებელი მოთხოვნები, სწავლების პირობები და გრაფიკი.',
    enA: 'Use the “No experience required” filter or browse internships. Read the full description and check required skills, training and working hours.',
  },
  {
    q: 'რატომ არ ჩანს ყველა ვაკანსია რუკაზე?',
    enQ: 'Why are some jobs missing from the map?',
    a: 'რუკაზე მხოლოდ ზუსტი სამუშაო მისამართის მქონე ვაკანსიები ჩანს. განცხადება, რომელშიც მხოლოდ ქალაქი ან რეგიონია მითითებული, ძიების საერთო სიაში შეგიძლია ნახო.',
    enA: 'Only jobs with a precise workplace address appear on the map. Jobs that name only a city or region remain available in the regular search results.',
  },
  {
    q: 'სად გავაგზავნო განაცხადი?',
    enQ: 'Where do I send my application?',
    a: 'გახსენი ვაკანსია და გამოიყენე მასში მითითებული ელფოსტა ან განაცხადის ბმული. გადაამოწმე ბოლო ვადა და წერილის სათაურის მოთხოვნა. შერჩევის შესახებ პასუხს დამსაქმებელი გაწვდის.',
    enA: 'Open the listing and use its application email or link. Check the deadline and any required email subject. The employer will respond about the recruitment process.',
  },
  {
    q: 'როგორ შევქმნა და შევინახო რეზიუმე?',
    enQ: 'How do I create and save a CV?',
    a: 'გახსენი „რეზიუმეს შექმნა“, აირჩიე დოკუმენტის ენა და შეავსე საკონტაქტო ინფორმაცია, გამოცდილება, განათლება და უნარები. შენახვამდე გადაამოწმე წინასწარი ხედი და შემდეგ შეინახე PDF.',
    enA: 'Open “Create a CV”, choose the document language and enter your contact details, experience, education and skills. Check the preview before saving the PDF.',
  },
  {
    q: 'რატომ არ ჩანს შენახული ვაკანსიები სხვა ტელეფონზე?',
    enQ: 'Why can’t I see saved jobs on another device?',
    a: 'შენახული ვაკანსიების სია ამ ბრაუზერში ინახება. სხვა მოწყობილობაზე ან ბრაუზერზე ავტომატურად არ გადადის. მნიშვნელოვანი ვაკანსიის ბმული ცალკეც შეინახე.',
    enA: 'Saved jobs are stored in this browser and do not automatically sync to other browsers or devices. You can also save the listing’s link separately.',
  },
  {
    q: 'ხელფასი რატომ არ არის ყველა ვაკანსიაში?',
    enQ: 'Why don’t all jobs show a salary?',
    a: 'ხელფასს ვაჩვენებთ მაშინ, როცა ის განცხადებაშია მითითებული. უცნობ თანხას არ ვავსებთ სავარაუდო რიცხვით. „ხელფასი მითითებულია“ ფილტრით მხოლოდ ანაზღაურების მქონე განცხადებებს ნახავ.',
    enA: 'We show pay when it is stated in the listing. Missing salaries are not replaced with guesses. Use “Salary listed” to see jobs with stated pay.',
  },
];
export default function HelpPage() {
  return (
    <ContentPage
      path="/help"
      title={{ ka: 'დახმარება', en: 'Help' }}
      intro={{
        ka: 'პასუხები ვაკანსიის ძიების, განაცხადისა და რეზიუმეს შესახებ.',
        en: 'Answers about finding jobs, applying and creating your CV.',
      }}
    >
      <div className="help-actions">
        <Link href="/" className="ds-btn ds-btn--secondary">
          <Search size={16} />
          <LocalText ka="ვაკანსიების ძიება" en="Find jobs" />
        </Link>
        <Link href="/cv" className="ds-btn ds-btn--secondary">
          <FileText size={16} />
          <LocalText ka="რეზიუმეს შექმნა" en="Create a CV" />
        </Link>
      </div>
      <div className="help-layout">
        <section className="help-questions" aria-label="კითხვები და პასუხები">
          {questions.map((item) => (
            <details className="help-item" key={item.q}>
              <summary>
                <LocalText ka={item.q} en={item.enQ} />
                <ChevronDown size={18} aria-hidden="true" />
              </summary>
              <p>
                <LocalText ka={item.a} en={item.enA} />
              </p>
            </details>
          ))}
        </section>
        <aside className="help-guides">
          <h2>
            <LocalText ka="პრაქტიკული გზამკვლევები" en="Practical guides" />
          </h2>
          <p>
            <Link href="/blog/reziume-gamotsdilebis-gareshe">
              <LocalText
                ka="რეზიუმე გამოცდილების გარეშე"
                en="A CV without work experience"
              />
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </p>
          <p>
            <Link href="/blog/gasaubrebistvis-momzadeba">
              <LocalText
                ka="გასაუბრებისთვის მომზადება"
                en="Preparing for an interview"
              />
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </p>
          <p>
            <Link href="/contact">
              <LocalText ka="დაგვიკავშირდი" en="Contact us" />
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </p>
        </aside>
      </div>
    </ContentPage>
  );
}
