'use client';
import { useState } from 'react';
import { initials } from './company-api';

/* Eight soft colour pairs; a name always lands on the same one, so a person keeps their colour
   across the list, the board and the CV base. */
const tones = 8;
function tone(seed: string) {
  let h = 0;
  for (const ch of seed) h = (h * 31 + ch.codePointAt(0)!) | 0;
  return Math.abs(h) % tones;
}

/** A candidate's photo from their JOBX resume, or coloured initials when there is none. */
export function Avatar({
  name,
  entry,
  photo,
  size = 'md',
}: {
  name: string;
  entry?: string;
  photo?: boolean;
  size?: 'sm' | 'md' | 'lg';
}) {
  const [failed, setFailed] = useState(false);
  const src =
    photo && entry && !failed
      ? `/api/company/candidates/photo?entry=${encodeURIComponent(entry)}`
      : null;
  return (
    <span
      className="cp-person-avatar"
      data-size={size}
      data-tone={tone(name || entry || '?')}
      aria-hidden
    >
      {src ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
      ) : (
        initials(name)
      )}
    </span>
  );
}
