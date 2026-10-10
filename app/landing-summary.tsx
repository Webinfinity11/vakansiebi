'use client';

import {
  createContext,
  Suspense,
  use,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import { landingCopy, type Landing } from '@/lib/seo-landing';
import { factsText, type LandingFacts } from '@/lib/landing-facts';

type Seed = { path: string; facts: Promise<LandingFacts | null> };
const SeedContext = createContext<Seed | null>(null);

/* The first page's summary is read on the server, so a crawler finds it in the
   HTML; a list reached by changing filters asks for its own. */
export function LandingFactsProvider({
  seed,
  children,
}: {
  seed: Seed | null;
  children: ReactNode;
}) {
  return <SeedContext.Provider value={seed}>{children}</SeedContext.Provider>;
}

export function LandingSummary({
  landing,
  total,
}: {
  landing: Landing;
  total?: number;
}) {
  const seed = useContext(SeedContext);
  /* One paragraph, the size the sentence alone had: what the list is, then the
     figures only this list has. The figures are what make the page its own. */
  /* The sentence names the list; the figures that follow are what only this
     page has. Until they arrive, the sentence stands alone. */
  return (
    <p className="landing-copy">
      {landingCopy(landing)}
      <Suspense fallback={null}>
        {seed?.path === landing.path ? (
          <Seeded facts={seed.facts} total={total} />
        ) : (
          <Fetched key={landing.path} landing={landing} total={total} />
        )}
      </Suspense>
    </p>
  );
}

function Seeded({
  facts,
  ...props
}: {
  facts: Promise<LandingFacts | null>;
  total?: number;
}) {
  const value = use(facts);
  return value ? <Facts facts={value} {...props} /> : null;
}

function Fetched({ landing, total }: { landing: Landing; total?: number }) {
  const [facts, setFacts] = useState<LandingFacts | null>(null);
  const path = landing.path;
  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/landing-facts' + path.slice(1), { signal: controller.signal })
      .then((response) => (response.ok ? response.json() : null))
      .then(setFacts, () => {});
    return () => controller.abort();
  }, [path]);
  return facts ? <Facts facts={facts} total={total} /> : null;
}

function Facts({
  facts,
  total = facts.total,
}: {
  facts: LandingFacts;
  total?: number;
}) {
  const text = factsText(facts, total);
  const employers = total > 0 ? facts.employers.slice(0, 3) : [];
  return (
    <>
      {' '}
      {text.lead}
      {text.salary && ` ${text.salary}`}
      {employers.length > 0 && (
        <>
          {` ${text.employers} `}
          {employers.map((employer, index) => (
            <span key={employer.slug}>
              {index > 0 && (index === employers.length - 1 ? ' და ' : ', ')}
              <Link
                href={`/companies/${encodeURIComponent(employer.slug)}`}
                prefetch={false}
              >
                {employer.name}
              </Link>
            </span>
          ))}
          .
        </>
      )}
    </>
  );
}
