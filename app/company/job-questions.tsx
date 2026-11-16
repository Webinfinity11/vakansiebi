'use client';
import { SelectField } from '../select-field';
import { questionPresets } from '@/lib/company-job-steps';
import type { JobQuestion } from '@/lib/job-questions';
export function JobQuestions({
  value = [],
  onChange,
}: {
  value?: JobQuestion[];
  onChange: (questions: JobQuestion[]) => void;
}) {
  function patch(index: number, fields: Partial<JobQuestion>) {
    onChange(value.map((q, i) => (i === index ? { ...q, ...fields } : q)));
  }
  return (
    <section className="company-job-questions">
      <h3>მოკლე კითხვარი</h3>
      <p>
         მაქსიმუმ 5 კითხვა. სასურველი პასუხი მხოლოდ შერჩევაში დაგეხმარებათ — ავტომატური უარი არ გაიგზავნება. </p>
      {value.length < 5 && <div className="jw-question-presets" aria-label="მზა კითხვები">
        {questionPresets.filter(preset => !value.some(q => q.text === preset.text)).map(preset => <button key={preset.text} type="button" className="cp-chip" onClick={() => onChange([...value, { ...preset, options: [...preset.options], id: crypto.randomUUID() }])}>{preset.text}</button>)}
      </div>}
      {value.map((q, i) => (
        <fieldset key={q.id} className="jw-question-card">
          <legend>კითხვა {i + 1}</legend><div className="jw-question-head">          <button
            type="button"
            className="cp-icon-btn"
            aria-label="კითხვის წაშლა"
            title="კითხვის წაშლა"
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            ×
          </button></div>
          <label>
             კითხვა <input
              className="cp-input"
              required
              maxLength={300}
              value={q.text}
              onChange={(e) => patch(i, { text: e.target.value })}
            />
          </label>
          <label>
             პასუხის ტიპი <SelectField label="პასუხის ტიპი" placeholder="აირჩიეთ" value={q.kind} onChange={kind => patch(i, { kind: kind as JobQuestion['kind'], options: kind === 'choice' ? ['', ''] : [], preferred: '' })} options={[{value:'yes_no',label:'კი / არა'},{value:'choice',label:'ერთი არჩევანი'},{value:'text',label:'მოკლე ტექსტი'}]} />
          </label>
          {q.kind === 'choice' && (
            <>
              {q.options.map((option, j) => (
                <label key={j}>
                   პასუხი {j + 1}
                  <input
                    className="cp-input"
                    required
                    maxLength={150}
                    value={option}
                    onChange={(e) =>
                      patch(i, {
                        options: q.options.map((v, k) =>
                          k === j ? e.target.value : v,
                        ),
                        preferred: '',
                      })
                    }
                  />
                  {q.options.length > 2 && (
                    <button
                      type="button"
                      className="cp-btn cp-btn--ghost"
                      onClick={() =>
                        patch(i, {
                          options: q.options.filter((_, k) => k !== j),
                          preferred: '',
                        })
                      }
                    >
                       პასუხის წაშლა </button>
                  )}
                </label>
              ))}
              {q.options.length < 8 && (
                <button
                  type="button"
                  className="cp-btn cp-btn--ghost"
                  onClick={() => patch(i, { options: [...q.options, ''] })}
                >
                   პასუხის დამატება </button>
              )}
            </>
          )}
          <label>
             სასურველი პასუხი (არასავალდებულო) {q.kind === 'text' ? (
              <input
                className="cp-input"
                maxLength={500}
                value={q.preferred}
                onChange={(e) => patch(i, { preferred: e.target.value })}
              />
            ) : (
              <SelectField label="სასურველი პასუხი (არასავალდებულო)" placeholder="აირჩიეთ" value={q.preferred} onChange={preferred => patch(i, { preferred })} options={[{ value: '', label: 'არ არის მითითებული' }, ...Array.from(new Set((q.kind === 'yes_no' ? ['კი', 'არა'] : q.options).filter(Boolean)))]} />
            )}
          </label>

        </fieldset>
      ))}
      {value.length < 5 && (
        <button
          type="button"
          className="cp-btn cp-btn--ghost"
          onClick={() =>
            onChange([
              ...value,
              {
                id: crypto.randomUUID(),
                text: '',
                kind: 'yes_no',
                options: [],
                preferred: '',
              },
            ])
          }
        >
           კითხვის დამატება </button>
      )}
    </section>
  );
}
