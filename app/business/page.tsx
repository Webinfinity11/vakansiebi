import type { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import {
  ArrowUpRight,
  Building2,
  Check,
  CheckCircle2,
  ChevronDown,
  Phone,
} from 'lucide-react';
import { PublicHeader } from '../public-header';
import { ServerSiteFooter } from '../server-site-footer';
import { invoiceContact, premiumDays, premiumPriceGEL } from '@/lib/billing';
import { introductoryDays } from '@/lib/placement';
import { billingSettings } from '@/lib/server/billing';
import { breadcrumbs, jsonLd, shareImage, siteUrl } from '@/lib/seo';
import './business.css';

export const dynamic = 'force-dynamic';

const title = 'უფასო ვაკანსიის განთავსება — ბიზნესისთვის | JOBX';
const description =
  'უფასო ვაკანსიის განთავსება JOBX-ზე რეგისტრაციის გარეშე. გამოაქვეყნე განცხადება, გააცანი შენი კომპანია კანდიდატებს და შეადარე სტანდარტული, VIP და პრემიუმ პირობები.';
export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: `${siteUrl}/business` },
  robots: { index: true, follow: true },
  openGraph: {
    title,
    description,
    url: `${siteUrl}/business`,
    locale: 'ka_GE',
    type: 'website',
    images: [shareImage],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: [shareImage.url],
  },
};

export default async function BusinessPage() {
  const premiumAvailable = !!(await billingSettings().catch(() => null));
  const plans = [
    {
      tier: 'standard',
      name: 'სტანდარტული',
      price: 'უფასო',
      period: 'საწყისი განთავსება',
      description: 'როცა გინდა შენი ვაკანსია ძიების შედეგებში გამოჩნდეს.',
      features: [
        'ვაკანსიის სრული აღწერა და პირობები',
        'კომპანიის სახელი და ლოგო',
        'შენ მიერ მითითებული განაცხადის გზა',
      ],
      className: 'business-plan-standard',
    },
    {
      tier: 'vip',
      name: 'VIP',
      price: 'უფასო',
      period: `პირველი ${introductoryDays} დღე`,
      description: 'პირველი VIP განთავსება — ერთხელ თითო კომპანიაზე.',
      features: [
        'სტანდარტული განთავსების შესაძლებლობები',
        'სტანდარტულ შედეგებზე წინ გამოჩენა',
        `${introductoryDays} დღე გააქტიურებიდან`,
      ],
      className: 'business-plan-vip',
    },
    {
      tier: 'premium',
      name: 'პრემიუმი',
      price: `${premiumPriceGEL} ₾`,
      period: `${premiumDays} დღით`,
      description: 'მეტი ხილვადობა შესაბამისი ძიების შედეგების სათავეში.',
      features: [
        'სტანდარტული განთავსების შესაძლებლობები',
        'VIP და სტანდარტულ შედეგებზე წინ გამოჩენა',
        `${premiumDays} დღე გააქტიურებიდან`,
      ],
      className: 'business-plan-premium',
    },
  ];
  const questions = [
    {
      question: 'შემიძლია ვაკანსია უფასოდ განვათავსო?',
      answer:
        'დიახ. აირჩიე სტანდარტული განთავსება და შეავსე ვაკანსიის ფორმა. განცხადების გამოქვეყნება უფასოა, რეგისტრაცია საჭირო არ არის. ვაკანსია ადმინისტრატორის შემოწმებისა და დამტკიცების შემდეგ გამოჩნდება.',
    },
    {
      question: 'მჭირდება რეგისტრაცია?',
      answer:
        'განცხადების დასამატებლად რეგისტრაცია საჭირო არ არის. შეავსე ვაკანსიისა და კომპანიის მონაცემები და მიუთითე, როგორ დაგიკავშირდეს კანდიდატი.',
    },
    {
      question: 'როდის გამოჩნდება ვაკანსია?',
      answer:
        'განაცხადის გაგზავნის შემდეგ განცხადებას ადმინისტრატორი ამოწმებს. საიტზე ის დამტკიცების შემდეგ გამოჩნდება. პრემიუმ განთავსებისთვის გადახდის დადასტურებაც საჭიროა.',
    },
    {
      question: 'ვის შეუძლია უფასო VIP-ის გამოყენება?',
      answer: `პირველი VIP განთავსება ${introductoryDays} დღით უფასოა — ერთხელ თითო კომპანიაზე. შეთავაზების გამოყენების შესაძლებლობა განცხადების შემოწმებისას დგინდება.`,
    },
    {
      question: 'როგორ გადავიხადო პრემიუმის საფასური?',
      answer: `განაცხადში პრემიუმის არჩევისას მიიღებ ინვოისს საბანკო რეკვიზიტებითა და გადარიცხვის დანიშნულებით. ფასი ${premiumPriceGEL} ₾-ია ${premiumDays} დღისთვის. განთავსება განცხადებისა და ჩარიცხვის დადასტურების შემდეგ გააქტიურდება. თანხა ავტომატურად არ ჩამოიჭრება.`,
    },
  ];
  return (
    <div className="board-shell business-page">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: jsonLd(
            breadcrumbs([
              { name: 'JOBX', path: '/' },
              { name: 'ბიზნესისთვის', path: '/business' },
            ]),
          ),
        }}
      />
      <PublicHeader />
      <main className="business-main">
        <section className="business-hero" aria-labelledby="business-title">
          <div className="business-hero-art" aria-hidden="true">
            <Image
              src="/images/jobx-business-team-v2.webp"
              alt=""
              fill
              sizes="(max-width: 760px) 180vw, (max-width: 1200px) 100vw, 1200px"
              preload
            />
          </div>
          <div className="business-hero-copy">
            <span className="business-eyebrow">
              <Building2 size={15} aria-hidden="true" /> JOBX ბიზნესისთვის
            </span>
            <h1 id="business-title">
              {/* The spaces keep the words apart in the heading's text, which
                  is what search results and screen readers read. */}
              კარგ გუნდს <br />
              კარგი ადამიანები <br />
              <span>ქმნიან.</span>
            </h1>
            <p>
              უფასო ვაკანსიის განთავსება JOBX-ზე — რეგისტრაციის გარეშე. გააცანი
              შენი გუნდი მომავალ თანამშრომელს.
            </p>
            <div className="business-actions">
              <Link
                href="/post-job"
                prefetch={false}
                className="ds-btn ds-btn--primary"
              >
                ვაკანსიის დამატება <ArrowUpRight size={18} aria-hidden="true" />
              </Link>
              <a href="#placements" className="ds-btn ds-btn--secondary">
                განთავსების პირობები{' '}
                <ChevronDown size={16} aria-hidden="true" />
              </a>
            </div>
            <span className="business-hero-note">
              <CheckCircle2 size={15} aria-hidden="true" /> დაიწყე უფასო
              სტანდარტული განთავსებით
            </span>
          </div>
        </section>
        <ul className="business-facts" aria-label="განთავსება JOBX-ზე">
          <li>
            <Check size={16} aria-hidden="true" /> რეგისტრაციის გარეშე
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> უფასო სტანდარტული განთავსება
          </li>
          <li>
            <Check size={16} aria-hidden="true" /> კანდიდატთან პირდაპირი კავშირი
          </li>
        </ul>

        <section
          className="business-process"
          aria-labelledby="business-process-title"
        >
          <div className="business-section-heading">
            <h2 id="business-process-title">როგორ განათავსო ვაკანსია უფასოდ</h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <h3>შეავსე განცხადება</h3>
              <p>
                მიუთითე პოზიცია, პირობები, კომპანიის მონაცემები და განაცხადის
                მიღების გზა.
              </p>
            </li>
            <li>
              <span>02</span>
              <h3>გაიარე შემოწმება</h3>
              <p>
                გაგზავნილ განცხადებას ადმინისტრატორი განიხილავს და
                გამოქვეყნებამდე ამოწმებს.
              </p>
            </li>
            <li>
              <span>03</span>
              <h3>გამოჩნდი ძიებაში</h3>
              <p>
                დამტკიცებული ვაკანსია ხელმისაწვდომი გახდება; კანდიდატები
                მითითებული გზით დაგიკავშირდებიან.
              </p>
            </li>
          </ol>
        </section>

        <section
          className="business-placements"
          id="placements"
          aria-labelledby="business-placements-title"
        >
          <div className="business-section-heading">
            <h2 id="business-placements-title">
              აირჩიე შენთვის შესაფერისი განთავსება
            </h2>
            <p>განთავსების ტიპს განცხადების შევსებისას აირჩევ.</p>
          </div>
          <div className="business-plan-grid">
            {plans.map((plan) => (
              <article
                key={plan.name}
                className={`business-plan ${plan.className}`}
              >
                <div className="business-plan-top">
                  <h3 className="business-plan-label">{plan.name}</h3>
                  {plan.name === 'VIP' ? (
                    <span className="business-plan-offer">
                      დროებითი შეთავაზება
                    </span>
                  ) : null}
                </div>
                <p className="business-plan-price">
                  {plan.price}
                  <span>{plan.period}</span>
                </p>
                <p className="business-plan-description">{plan.description}</p>
                <ul>
                  {plan.features.map((feature) => (
                    <li key={feature}>
                      <Check size={15} aria-hidden="true" />
                      {feature}
                    </li>
                  ))}
                </ul>
                {plan.name === 'პრემიუმი' && !premiumAvailable && (
                  <small className="business-plan-unavailable">
                    პრემიუმის გადახდა ამჟამად მიუწვდომელია.
                  </small>
                )}
                {plan.tier !== 'premium' || premiumAvailable ? (
                  <Link
                    href={`/post-job?placement=${plan.tier}`}
                    prefetch={false}
                    className="business-plan-button"
                  >
                    {plan.tier === 'standard'
                      ? 'უფასოდ განთავსება'
                      : plan.tier === 'vip'
                        ? 'VIP-ის არჩევა'
                        : 'პრემიუმის არჩევა'}
                    <ArrowUpRight size={17} aria-hidden="true" />
                  </Link>
                ) : (
                  <button className="business-plan-button" disabled>
                    ამჟამად მიუწვდომელია
                  </button>
                )}
              </article>
            ))}
          </div>
          <p className="business-plan-terms">
            VIP-ის უფასო შეთავაზება შემოწმდება დამტკიცებისას. VIP და პრემიუმ
            პერიოდი ითვლება გააქტიურებიდან; ვადის გასვლის შემდეგ განცხადება
            სტანდარტულ რეჟიმში რჩება, მის მითითებულ ბოლო ვადამდე. თანხა
            ავტომატურად არ ჩამოიჭრება.
          </p>
        </section>

        <section className="business-faq" aria-labelledby="business-faq-title">
          <div className="business-section-heading">
            <h2 id="business-faq-title">კითხვები და პასუხები</h2>
          </div>
          <div>
            {questions.map(({ question, answer }) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} aria-hidden="true" />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section
          className="business-start"
          aria-labelledby="business-start-title"
        >
          <div>
            <h2 id="business-start-title">დავიწყოთ შენი ვაკანსიით.</h2>
            <p>თუ შევსებისას კითხვა გაგიჩნდება, დაგვირეკე.</p>
          </div>
          <div className="business-start-actions">
            <Link
              href="/post-job"
              prefetch={false}
              className="ds-btn ds-btn--primary"
            >
              ვაკანსიის დამატება <ArrowUpRight size={18} aria-hidden="true" />
            </Link>
            <a
              href={`tel:${invoiceContact.telephone}`}
              className="business-contact"
            >
              <Phone size={15} aria-hidden="true" />
              განთავსებაზე კითხვა გაქვს? {invoiceContact.phone}
            </a>
          </div>
        </section>
      </main>
      <ServerSiteFooter showDirectory={false} />
    </div>
  );
}
