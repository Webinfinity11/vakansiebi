import Link from 'next/link';
import { Mail, Phone, Search } from 'lucide-react';
import { ContentPage } from '../content-page';
import { LocalText } from '../local-text';
import { contentMetadata } from '@/lib/content-seo';
import { invoiceContact } from '@/lib/billing';
import './contact.css';

export const metadata = contentMetadata(
  '/contact',
  'კონტაქტი',
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
      <div className="contact-grid">
        <section className="contact-card" aria-labelledby="contact-phone-title">
          <span className="contact-icon" aria-hidden="true">
            <Phone size={22} />
          </span>
          <h2 id="contact-phone-title">
            <LocalText
              ka="განთავსება და მომსახურება"
              en="Job posting and services"
            />
          </h2>
          <p>
            <LocalText
              ka="ვაკანსიის დამატება, კომპანიის ანგარიში და ფასიანი განთავსება."
              en="Posting a job, the company account and paid placement."
            />
          </p>
          <a
            className="contact-value"
            href={`tel:${invoiceContact.telephone}`}
          >
            {invoiceContact.phone}
          </a>
          <a
            className="ds-btn ds-btn--primary contact-action"
            href={`tel:${invoiceContact.telephone}`}
          >
            <Phone size={17} aria-hidden="true" />
            <LocalText ka="დარეკვა" en="Call" />
          </a>
        </section>
        <section className="contact-card" aria-labelledby="contact-mail-title">
          <span className="contact-icon" aria-hidden="true">
            <Mail size={22} />
          </span>
          <h2 id="contact-mail-title">
            <LocalText ka="ინვოისი და გადახდა" en="Invoices and payments" />
          </h2>
          <p>
            <LocalText
              ka="წერილში მიუთითე კომპანიის სახელი და ინვოისის ნომერი, თუ უკვე გაქვს."
              en="Include your company name and invoice number, if you have one."
            />
          </p>
          <a className="contact-value" href={`mailto:${invoiceContact.email}`}>
            {invoiceContact.email}
          </a>
          <a
            className="ds-btn ds-btn--secondary contact-action"
            href={`mailto:${invoiceContact.email}`}
          >
            <Mail size={17} aria-hidden="true" />
            <LocalText ka="წერილის მიწერა" en="Write an email" />
          </a>
        </section>
      </div>
      <section className="contact-seeker" aria-labelledby="contact-seeker-title">
        <div>
          <h2 id="contact-seeker-title">
            <LocalText ka="სამსახურს ეძებ?" en="Looking for a job?" />
          </h2>
          <p>
            <LocalText
              ka="რეზიუმე ვაკანსიაში მითითებულ დამსაქმებელს გაუგზავნე. პოზიციის პირობებსა და შერჩევის შედეგებზე ინფორმაციას დამსაქმებელი გაწვდის."
              en="Send your CV to the employer named in the listing. The employer can answer questions about the role and your application."
            />
          </p>
        </div>
        <Link
          href="/"
          prefetch={false}
          className="ds-btn ds-btn--secondary contact-action"
        >
          <Search size={17} aria-hidden="true" />
          <LocalText ka="ვაკანსიების ნახვა" en="Browse jobs" />
        </Link>
      </section>
    </ContentPage>
  );
}
