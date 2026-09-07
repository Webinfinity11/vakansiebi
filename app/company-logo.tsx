'use client';
import Image from 'next/image';
import { useState } from 'react';
import { safeExternalUrl } from '@/lib/vacancy-media';

export function CompanyLogo({
  company,
  url,
  large = false,
}: {
  company: string;
  url?: string;
  large?: boolean;
}) {
  const [failed, setFailed] = useState('');
  const src = safeExternalUrl(url || '');
  const initials =
    company
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => Array.from(p)[0])
      .join('')
      .toUpperCase() || '·';
  const tone =
    Array.from(company).reduce((n, c) => n + c.codePointAt(0)!, 0) % 4;
  return (
    <span
      className={`company-avatar avatar-${tone} ${large ? 'avatar-large' : ''}`}
    >
      {src && failed !== src ? (
        <Image
          src={src}
          alt={`${company} — ლოგო`}
          width={large ? 80 : 52}
          height={large ? 80 : 52}
          unoptimized
          referrerPolicy="no-referrer"
          onError={() => setFailed(src)}
        />
      ) : (
        <span aria-hidden="true">{initials}</span>
      )}
    </span>
  );
}
