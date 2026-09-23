'use client';
import Image from 'next/image';
import { useState } from 'react';
import { isLocalLogoUrl, safeExternalUrl } from '@/lib/vacancy-media';

const legalForms = /^(შპს|სს|ი\/მ|ააიპ|სპს|კს|llc|ltd|inc|jsc)$/i;
/* Two letters say more than one: "JOBX ტესტი" becomes two initials, skipping legal forms like შპს. */
export function companyInitials(company: string) {
  const words = company
    .replace(/["'«»„“”()]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && !legalForms.test(word.replace(/[.,]/g, '')));
  const letters = words
    .slice(0, 2)
    .map((word) => Array.from(word)[0]?.toLocaleUpperCase() || '');
  return letters.join('') || '—';
}

export function CompanyLogo({
  company,
  url,
  large = false,
}: {
  company: string;
  url?: string;
  large?: boolean;
  category?: string;
}) {
  const [failed, setFailed] = useState('');
  const [loaded, setLoaded] = useState('');
  const src = isLocalLogoUrl(url) ? url : safeExternalUrl(url || '');
  const showLogo = Boolean(src && failed !== src);
  return (
    <span
      className={`company-avatar ${showLogo && loaded === src ? '' : 'company-placeholder'} ${showLogo ? '' : 'company-none'} ${large ? 'avatar-large' : ''}`}
    >
      {showLogo && (
        <Image
          src={src}
          alt={`${company} — ლოგო`}
          width={large ? 80 : 52}
          height={large ? 80 : 52}
          unoptimized
          referrerPolicy="no-referrer"
          className={loaded === src ? 'logo-ready' : 'logo-loading'}
          onLoad={() => setLoaded(src)}
          onError={() => setFailed(src)}
        />
      )}
      {/* Always the mark, never the company's first letter: a single Georgian
          character told the reader nothing and read as a placeholder someone
          forgot to fill in.
          A CSS background, not an <img>: as an image element the stand-in was the largest
          picture on a company page, and Google showed a briefcase as that page's thumbnail. */}
      {(!showLogo || loaded !== src) && (
        <span className="company-fallback-3d" aria-hidden="true" />
      )}
    </span>
  );
}
