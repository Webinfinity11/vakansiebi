'use client';
import Link, { useLinkStatus } from 'next/link';
import { ArrowRight, LoaderCircle } from 'lucide-react';
import { vacancyCardCompany } from '@/lib/vacancy-card-labels';
import { CompanyLogo } from './company-logo';

function NavigationHint() {
  const { pending } = useLinkStatus();
  return (
    <output
      className="company-navigation-hint"
      data-pending={pending || undefined}
      aria-label={pending ? 'კომპანიის გვერდი იტვირთება' : undefined}
    >
      {pending ? (
        <LoaderCircle size={14} aria-hidden="true" />
      ) : (
        <ArrowRight size={14} aria-hidden="true" />
      )}
    </output>
  );
}
export function CompanyIdentity({
  company,
  logoUrl,
  category,
  href,
  large = false,
  onOpen,
  disabled = false,
}: {
  company: string;
  logoUrl?: string;
  category?: string;
  href?: string | null;
  large?: boolean;
  onOpen?: () => void;
  disabled?: boolean;
}) {
  const content = (
    <>
      <CompanyLogo
        company={company}
        url={logoUrl}
        category={category}
        large={large}
      />
      <span className="company-identity-name" title={company}>
        {(large ? company : vacancyCardCompany(company)) || 'კომპანია'}
      </span>
    </>
  );
  return href ? (
    <Link
      className={`company-identity ${large ? 'identity-large' : ''}`}
      href={href}
      prefetch={false}
      title={`${company} — კომპანიის ვაკანსიები`}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : undefined}
      onClick={(event) => {
        event.stopPropagation();
        if (disabled) event.preventDefault();
      }}
      onNavigate={(event) => {
        if (disabled) event.preventDefault();
        else onOpen?.();
      }}
    >
      {content}
      <NavigationHint />
    </Link>
  ) : (
    <span
      className={`company-identity is-static ${large ? 'identity-large' : ''}`}
    >
      {content}
    </span>
  );
}
