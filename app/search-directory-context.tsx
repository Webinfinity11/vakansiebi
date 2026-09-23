'use client';

import {
  createContext,
  useContext,
  use,
  Suspense,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import {
  relatedLandings,
  type Landing,
  type LandingCount,
} from '@/lib/seo-landing';

const DirectoryContext = createContext<Promise<LandingCount[] | null> | null>(
  null,
);
export function useSearchDirectory() {
  const pending = useContext(DirectoryContext);
  return pending ? use(pending) : null;
}

export function SearchDirectoryProvider({
  rows,
  children,
}: {
  rows: Promise<LandingCount[] | null>;
  children: ReactNode;
}) {
  return (
    <DirectoryContext.Provider value={rows}>
      {children}
    </DirectoryContext.Provider>
  );
}

// Native details keeps every link in server HTML without making a wall of links.
export function DirectoryLinks({
  links,
  limit = 8,
}: {
  links: { path: string; label: string }[];
  limit?: number;
}) {
  /* The name alone. A count beside every link turns a short list of places to
     go into a table of numbers to compare, and the number is stale the moment
     a vacancy expires. */
  const list = (items: typeof links) => (
    <ul>
      {items.map(({ path, label }) => (
        <li key={path}>
          <Link href={path} prefetch={false}>
            {label}
          </Link>
        </li>
      ))}
    </ul>
  );
  return (
    <>
      {list(links.slice(0, limit))}
      {links.length > limit && (
        <details>
          <summary>მეტის ჩვენება ({links.length - limit})</summary>
          {list(links.slice(limit))}
        </details>
      )}
    </>
  );
}

export function SearchDirectoryRelated({ landing }: { landing: Landing }) {
  return (
    <Suspense fallback={null}>
      <RelatedLinks landing={landing} />
    </Suspense>
  );
}

function RelatedLinks({ landing }: { landing: Landing }) {
  const rows = useSearchDirectory();
  const links = relatedLandings(landing, rows);
  if (!links.length) return null;
  return (
    <div className="search-directory-related search-directory-group">
      <h2>მსგავსი ძიებები</h2>
      <DirectoryLinks links={links} />
    </div>
  );
}
