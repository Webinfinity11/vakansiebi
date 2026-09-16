import type { ReactNode } from 'react';
import { notFound } from 'next/navigation';
import { isAdmin } from '@/lib/server/auth';
import { getVacancyPage } from '@/lib/server/vacancy-page';

/* Whether this vacancy exists has to be settled here, above the skeleton. The
   skeleton is a Suspense boundary, and a streamed response has already sent 200
   by the time the page below calls notFound(): a retired vacancy answered every
   crawler with 200 and a "page is gone" body. A layout renders before that
   boundary, so the answer is a real 404.

   The lookup is React-cached, so the page below reads the same result rather
   than asking again, and the skeleton still covers a move from the list, where
   only the page re-renders. An admin is let through: a draft is invisible here
   but visible to the preview the page itself handles. */
export default async function VacancyLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  if (!(await getVacancyPage(id)) && !(await isAdmin())) notFound();
  return children;
}
