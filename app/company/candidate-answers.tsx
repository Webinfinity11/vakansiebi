import { StatusMark } from './status-mark';
import type { Candidate } from '@/lib/company-candidates';
import './branding.css';
export function CandidateSignals({ candidate: c }: { candidate: Candidate }) {
  return (
    <>
      {c.source === 'cv_box' && <StatusMark kind="all">CV ყუთი</StatusMark>}
      {c.requirementsMatch === true && (
        <StatusMark kind="hired">ემთხვევა მოთხოვნებს</StatusMark>
      )}
    </>
  );
}
export function CandidateAnswers({ candidate: c }: { candidate: Candidate }) {
  if (!c.answers?.length) return null;
  return (
    <section className="cc-question-answers">
      <h3>პასუხები</h3>
      <p>
        პასუხები კანდიდატმა განაცხადის გაგზავნისას შეავსო. შედარება ავტომატურ
        უარს არ იწვევს.
      </p>
      <dl>
        {c.answers.map((answer) => (
          <div key={answer.id}>
            <dt>{answer.question}</dt>
            <dd>{answer.answer}</dd>
            {answer.preferred && (
              <dd>
                <small>
                  სასურველი პასუხი: {answer.preferred} ·{' '}
                  {answer.matches ? 'ემთხვევა' : 'არ ემთხვევა'}
                </small>
              </dd>
            )}
          </div>
        ))}
      </dl>
    </section>
  );
}
