import { ContentPage } from '../content-page';
import { LocalText } from '../local-text';
import { contentMetadata } from '@/lib/content-seo';
import { invoiceContact } from '@/lib/billing';

export const metadata = contentMetadata(
  '/contact',
  'კონტაქტი — ჯობიქსი',
  'დაგვიკავშირდი ვაკანსიის განთავსების, მომსახურების ან ინვოისის საკითხებზე. სამუშაოზე განაცხადი უშუალოდ დამსაქმებელს გაუგზავნე.',
);
export default function ContactPage() {
  return (
    <ContentPage
      path="/contact"
      title={{ ka: 'კონტაქტი', en: 'Contact' }}
      intro={{
        ka: 'დაგვიკავშირდი ჯობიქსზე განცხადების განთავსებისა და მომსახურების საკითხებზე.',
        en: 'Contact us about posting a job or using Jobx services.',
      }}
    >
      <div className="content-prose">
        <section className="content-prose-section">
          <h2>
            <LocalText
              ka="განთავსება და მომსახურება"
              en="Job posting and services"
            />
          </h2>
          <p>
            <a href={`tel:${invoiceContact.telephone}`}>
              {invoiceContact.phone}
            </a>
          </p>
        </section>
        <section className="content-prose-section">
          <h2>
            <LocalText ka="ინვოისი და გადახდა" en="Invoices and payments" />
          </h2>
          <p>
            <a href={`mailto:${invoiceContact.email}`}>
              {invoiceContact.email}
            </a>
          </p>
          <p>
            <LocalText
              ka="წერილში მიუთითე კომპანიის სახელი და ინვოისის ნომერი, თუ უკვე გაქვს."
              en="Include your company name and invoice number, if you have one."
            />
          </p>
        </section>
      </div>
      <p className="content-contact-note">
        <LocalText
          ka="თუ სამსახურის დაწყება გინდა, რეზიუმე ვაკანსიაში მითითებულ დამსაქმებელს გაუგზავნე. კონკრეტული პოზიციის პირობებსა და შერჩევის შედეგებზე ინფორმაციას დამსაქმებელი გაწვდის."
          en="To apply for a job, send your CV to the employer named in the listing. The employer can answer questions about the role and your application."
        />
      </p>
    </ContentPage>
  );
}
