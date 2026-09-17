'use client';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { markListHop } from '@/lib/vacancy-navigation';
/* A link from a list of vacancies into one of them. The list it leaves is
   recorded, so that the vacancy's own "back" control steps back onto this very
   page — with its scroll and its loaded pages — instead of pushing a second
   copy of it on top of the one the reader is standing on. */
export function ListHopLink({
  href,
  from,
  className,
  children,
}: {
  href: string;
  from: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={className}
      onClick={() => markListHop(from)}
    >
      {children}
    </Link>
  );
}
