import type { ReactNode } from 'react';
import { notFound, permanentRedirect } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';
import { getVacancyPage } from '@/lib/server/vacancy-page';
import { vacancyIdFrom, vacancySegment } from '@/lib/vacancy-navigation';

/* Whether this vacancy exists has to be settled here, above the skeleton. The
   skeleton is a Suspense boundary, and a streamed response has already sent 200
   by the time the page below calls notFound(): a retired vacancy answered every
   crawler with 200 and a "page is gone" body. A layout renders before that
   boundary, so the answer is a real 404.

   The lookup is React-cached, so the page below reads the same result rather
   than asking again, and the skeleton still covers a move from the list, where
   only the page re-renders. An admin is let through: a draft is invisible here
   but visible to the preview the page itself handles.

   The address the reader asked for is settled here for the same reason. An
   identifier on its own — every link the site published before vacancies were
   named, and every one already in the index — is answered once and permanently
   with the spelling that carries the vacancy's name, and so is a name that has
   since changed. Below the boundary the status has already gone out as 200 and
   only the browser would follow; here it is a real 308. */
export default async function VacancyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id: segment } = await params;
  const asked = decodeURIComponent(segment);
  const id = vacancyIdFrom(asked);
  const job = id ? await getVacancyPage(id) : null;
  const admin = await isAdmin();
  if (!job && !admin) notFound();
  /* A layout is not given the query string, so redirecting would drop it; the
     one address that carries a meaningful one is the admin's own ?preview=1. */
  if (job && !admin && asked !== vacancySegment(job))
    permanentRedirect(`/vacancies/${encodeURIComponent(vacancySegment(job))}`);
  return children;
}
