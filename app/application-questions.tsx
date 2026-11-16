'use client';
import { useEffect, useState } from 'react';
import type { PublicJobQuestion } from '@/lib/job-questions';
import { useUi } from './ui-language';
export function ApplicationQuestions({
  jobId,
  onReady,
}: {
  jobId: string;
  onReady: (ready: boolean) => void;
}) {
  const { ui } = useUi();
  const [questions, setQuestions] = useState<PublicJobQuestion[] | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    const abort = new AbortController();
    fetch('/api/applications/questions?job=' + encodeURIComponent(jobId), {
      signal: abort.signal,
      cache: 'no-store',
    })
      .then(async (r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((value) => {
        setQuestions(value);
        onReady(true);
      })
      .catch(() => {
        if (!abort.signal.aborted) {
          setError(true);
          onReady(false);
        }
      });
    return () => abort.abort();
  }, [jobId, onReady]);
  if (!questions)
    return (
      <div>
        <p role={error ? 'alert' : 'status'}>
          {ui(
            error
              ? 'კითხვარი ვერ ჩაიტვირთა. განაახლე გვერდი.'
              : 'კითხვარი იტვირთება…',
          )}
        </p>
      </div>
    );
  return (
    <>
      {questions.map((q) => (
        <label key={q.id}>
          <span>{q.text}</span>
          {q.kind === 'text' ? (
            <input name={'question:' + q.id} required maxLength={500} />
          ) : (
            <select name={'question:' + q.id} required defaultValue="">
              <option value="" disabled>
                {ui('აირჩიე პასუხი')}
              </option>
              {(q.kind === 'yes_no' ? ['კი', 'არა'] : q.options).map((v) => (
                <option key={v} value={v}>
                  {q.kind === 'yes_no' ? ui(v) : v}
                </option>
              ))}
            </select>
          )}
        </label>
      ))}
    </>
  );
}
