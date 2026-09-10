'use client';
import Image from 'next/image';
import { useState } from 'react';
import { Building2 } from 'lucide-react';
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
  const showLogo = Boolean(src && failed !== src);
  return (
    <span
      className={`company-avatar ${showLogo ? '' : 'company-placeholder'} ${large ? 'avatar-large' : ''}`}
    >
      {showLogo ? (
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
        <Building2
          aria-hidden="true"
          size={large ? 30 : 24}
          strokeWidth={1.4}
        />
      )}
    </span>
  );
}
