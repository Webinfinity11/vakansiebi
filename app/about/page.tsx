import Link from 'next/link';
import { ContentPage } from '../content-page';
import { LocalText } from '../local-text';
import { contentMetadata } from '@/lib/content-seo';

export const metadata = contentMetadata(
  '/about',
  'ჩვენ შესახებ — ჯობიქსი',
  'ჯობიქსი აერთიანებს ვაკანსიებს დასაქმების საიტებიდან და დამსაქმებლებისგან. გაიგე, როგორ მუშაობს ძიება და სად უნდა გააგზავნო განაცხადი.',
);
export default function AboutPage() {
  return (
    <ContentPage
      path="/about"
      title={{ ka: 'ჩვენ შესახებ', en: 'About Jobx' }}
      intro={{
        ka: 'ჯობიქსი სამსახურის ძიების პლატფორმაა. აქ სხვადასხვა წყაროს ვაკანსიებს ერთ ადგილას ნახავ და პირობების მიხედვით შეადარებ.',
        en: 'Jobx brings job listings from different sources together so you can find and compare opportunities.',
      }}
    >
      <div className="content-prose">
        <section className="content-prose-section">
          <h2>
            <LocalText
              ka="საიდან მოდის ვაკანსიები"
              en="Where listings come from"
            />
          </h2>
          <p>
            <LocalText
              ka="ვაკანსიებს ვაგროვებთ დასაქმების საიტებიდან და უშუალოდ დამსაქმებლებისგან. თითოეულ განცხადებას ახლავს წყაროს ბმული, სადაც პირობებსა და განაცხადის გაგზავნის წესს გადაამოწმებ."
              en="Listings come from employment websites and employers. Each job page links to its source so you can check the terms and application instructions."
            />
          </p>
          <p>
            <LocalText
              ka="განცხადებაში ნახავ სამუშაოს პირობებს, განაცხადის ბოლო ვადასა და დამსაქმებლის საკონტაქტო ინფორმაციას."
              en="Each listing shows the working conditions, application deadline and employer contact details."
            />
          </p>
        </section>
        <section className="content-prose-section">
          <h2>
            <LocalText ka="როგორ მოძებნო სამსახური" en="Finding a job" />
          </h2>
          <p>
            <LocalText
              ka="აირჩიე ქალაქი, პროფესია, ანაზღაურება და სამუშაო პირობები. რუკაზე ჩანს ვაკანსიები, რომელთა სამუშაო მისამართიც ზუსტად არის განსაზღვრული."
              en="Filter by city, profession, pay and working conditions. The map shows jobs with a precisely identified workplace address."
            />
          </p>
          <p>
            <Link href="/help">
              <LocalText ka="ძიების ინსტრუქციები" en="Search instructions" />
            </Link>
          </p>
        </section>
        <section className="content-prose-section">
          <h2>
            <LocalText ka="განაცხადის გაგზავნა" en="Applying for a job" />
          </h2>
          <p>
            <LocalText
              ka="სასურველი ვაკანსიის შერჩევის შემდეგ განაცხადი უშუალოდ დამსაქმებელს გაუგზავნე, განცხადებაში მითითებული გზით. გასაუბრებასა და შერჩევის შედეგებზე დამსაქმებელი დაგიკავშირდება."
              en="Apply directly to the employer using the instructions in the listing. The employer handles interviews and recruitment decisions."
            />
          </p>
        </section>
        <section className="content-prose-section">
          <h2>
            <LocalText
              ka="რეზიუმე და პრაქტიკული რჩევები"
              en="Your CV and practical advice"
            />
          </h2>
          <p>
            <LocalText
              ka="რეზიუმეს შექმნა ქართულად ან ინგლისურად შეგიძლია. ბლოგში წაიკითხავ რჩევებს სამუშაოს ძიების, განაცხადის მომზადებისა და სამუშაო პირობების შედარების შესახებ."
              en="Create a CV in Georgian or English. Our blog offers practical guidance on job searches, applications and comparing working conditions."
            />
          </p>
          <p>
            <Link href="/cv">
              <LocalText ka="რეზიუმეს შექმნა" en="Create a CV" />
            </Link>{' '}
            ·{' '}
            <Link href="/blog">
              <LocalText ka="ბლოგი" en="Blog" />
            </Link>
          </p>
        </section>
      </div>
    </ContentPage>
  );
}
