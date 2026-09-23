'use client';
import Image from 'next/image';
import { clearSearchPosition } from '@/lib/vacancy-navigation';
// A document navigation intentionally resets the catalogue and fetches fresh data.
/* The masthead logo is what a phone paints last and largest, so the header asks
   for it up front; the footer copy is below the fold and must not compete. */
export function Brand({ priority = false }: { priority?: boolean }) {
  return (
    // oxlint-disable-next-line next/no-html-link-for-pages -- Logo deliberately resets the document and transient state.
    <a
      className="brand jobx-brand"
      href="/"
      onClick={(event) => {
        if (
          event.button === 0 &&
          !event.metaKey &&
          !event.ctrlKey &&
          !event.shiftKey &&
          !event.altKey
        )
          clearSearchPosition();
      }}
      aria-label="JOBX — მთავარი გვერდი"
    >
      <Image
        src="/brand/jobx.png"
        alt="JOBX"
        width={180}
        height={60}
        sizes="(max-width: 360px) 132px, (max-width: 760px) 144px, 180px"
        priority={priority}
      />
    </a>
  );
}
