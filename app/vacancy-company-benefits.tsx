import type { PublicJob } from '@/lib/types';

export function VacancyCompanyBenefits({ owned, profile, heading }: {
  owned?: boolean;
  profile?: PublicJob['companyProfile'];
  heading: string;
}) {
  if (!owned) return null;
  const benefits = profile?.benefits?.filter(benefit => benefit.trim()) ?? [];
  const whyUs = profile?.whyUs?.trim() ?? '';
  if (!benefits.length && !whyUs) return null;
  return <section className="company-about vacancy-company-benefits">
    <h2>{heading}</h2>
    {benefits.length > 0 && <ul>{benefits.map((benefit, index) => <li key={index}>{benefit}</li>)}</ul>}
    {whyUs && <p>{whyUs}</p>}
  </section>;
}
