'use client';
import Image from 'next/image';
import { useState } from 'react';
import { isLocalLogoUrl, safeExternalUrl } from '@/lib/vacancy-media';

export function CompanyLogo({
  company,
  url,
  large = false,
  fallback = 'illustration',
}: {
  company: string;
  url?: string;
  large?: boolean;
  category?: string;
  fallback?: 'illustration' | 'initial';
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
      {(!showLogo || loaded !== src) &&
        (fallback === 'initial' ? (
          <span className="company-fallback-initial" aria-hidden="true">
            {Array.from(company.trim())[0]?.toLocaleUpperCase() || '—'}
          </span>
        ) : (
          <Image
            src="/images/jobx-company-3d-v1.png"
            alt=""
            width={80}
            height={80}
            sizes={large ? '80px' : '48px'}
            className="company-fallback-3d"
          />
        ))}
    </span>
  );
}
