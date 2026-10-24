import type { Metadata } from 'next';
import { readRemovalToken } from '@/lib/employer-opt-out';
import { db } from '@/lib/server/db';
import { Brand } from '../brand';
import './removal.css';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'ვაკანსიების ამოღება — JOBX',
  robots: { index: false, follow: false },
  referrer: 'same-origin',
};
export default async function EmployerRemoval({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; done?: string }>;
}) {
  const params = await searchParams;
  const claim = readRemovalToken(params.token || '');
  if (!claim)
    return (
      <main className="employer-removal">
        <Brand />
        <h1>ბმული არ მოქმედებს</h1>
        <p>
          ამოღების მოთხოვნისთვის მოგვწერეთ{' '}
          <a href="mailto:hr@jobx.ge">hr@jobx.ge</a>-ზე.
        </p>
      </main>
    );
  const rule = (
    await db().query(
      'SELECT id FROM employer_suppressions WHERE email=$1 AND active',
      [claim.email],
    )
  ).rows[0];
  return (
    <main className="employer-removal">
      <Brand />
      <h1>
        {rule
          ? 'თქვენი მოთხოვნა შესრულებულია'
          : 'კომპანიის ვაკანსიების ამოღება'}
      </h1>
      {rule ? (
        <p>
          თქვენი კომპანიის ვაკანსიები JOBX-დან ამოღებულია და მომავალშიც აღარ
          განთავსდება. დადასტურებას ელფოსტაზეც მიიღებთ.
        </p>
      ) : (
        <>
          <p>
            დადასტურების შემდეგ თქვენი კომპანიის ვაკანსიები JOBX-დან ამოიღება.
            მომავალ განთავსებებსა და ამ ვაკანსიებზე განაცხადების გაგზავნასაც
            შევაჩერებთ.
          </p>
          <p>
            მოთხოვნა უკავშირდება მისამართს: <strong>{claim.email}</strong>
          </p>
          <form method="post" action="/api/employer-removal">
            <input type="hidden" name="token" value={params.token} />
            <button className="ds-btn ds-btn--primary" type="submit">
              ვადასტურებ — ამოიღეთ ჩემი კომპანიის ვაკანსიები
            </button>
          </form>
        </>
      )}
      <p>
        კითხვებისთვის: <a href="mailto:hr@jobx.ge">hr@jobx.ge</a>
      </p>
    </main>
  );
}
