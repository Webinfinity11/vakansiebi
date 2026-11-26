import type { Metadata } from 'next';
import { cvInvite } from '@/lib/server/cv-base-invites';
import { cvBaseConsentText } from '@/lib/cv-base-consent';
import ConsentAction from './consent-action';
export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title:'მოწვევა JOBX-ის CV ბაზაში', robots:{index:false,follow:false},referrer:'no-referrer' };
export default async function ConsentPage({params}:{params:Promise<{token:string}>}) {
  const {token}=await params;
  const invite=await cvInvite(token);
  return <main style={{width:'100%',padding:'48px 24px',boxSizing:'border-box',lineHeight:1.8}}>
    <h1 style={{fontSize:'clamp(24px, 4vw, 36px)',overflowWrap:'anywhere'}}>მოწვევა JOBX-ის CV ბაზაში</h1>
    {!invite ? <p>ბმული აღარ მოქმედებს ან ვერ მოიძებნა. ახალი მოწვევისთვის დაუკავშირდით კომპანიას.</p>
      : invite.withdrawn_at ? <><h2>თანხმობა გაუქმებულია</h2><p>თქვენი რეზიუმე JOBX-ის საერთო ბაზაში აღარ ჩანს. მომწვევ კომპანიას თავისი ასლი დარჩა.</p></>
      : invite.consented_at ? <><h2>თანხმობა მიღებულია</h2><p>თქვენი რეზიუმე ხელმისაწვდომია JOBX-ის CV ბაზაში შემოწმებული დამსაქმებლებისთვის.</p><ConsentAction token={token} action="withdraw" /></>
      : <><p>{invite.name}, კომპანია „{invite.company}“ გიწვევთ JOBX-ის CV ბაზაში.</p><div style={{maxWidth:'80ch',marginBlock:24}}>{cvBaseConsentText.split(/(?<=ვაკანსიებისთვის\.|აღირიცხება\.) /).map(text=><p key={text} style={{marginBlock:16}}>{text}</p>)}</div><ConsentAction token={token} action="consent" /><p>თუ თანხმობას არ მისცემთ, თქვენი რეზიუმე საერთო ბაზაში არ დაემატება.</p></>}
  </main>;
}
