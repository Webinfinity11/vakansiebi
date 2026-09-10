import type { PublicJob as Job } from '@/lib/types';
export function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${day} ${['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'][month - 1]}`;
}
export function Description({ text }: { text: string }) {
  const paragraphs = text
    .split(/\n+/)
    .map((p) => p.trim())
    .filter(Boolean);
  const blocks: { kind: 'list' | 'heading' | 'p'; lines: string[] }[] = [];
  for (const line of paragraphs) {
    if (/^[•*▪–]\s|^\d+[.)]\s/.test(line)) {
      if (blocks.at(-1)?.kind !== 'list')
        blocks.push({ kind: 'list', lines: [] });
      blocks.at(-1)!.lines.push(line.replace(/^[•*▪–]\s*|^\d+[.)]\s*/, ''));
    } else
      blocks.push({
        kind: line.length < 110 && /[:：]$/.test(line) ? 'heading' : 'p',
        lines: [line],
      });
  }
  return (
    <div className="vacancy-description">
      {blocks.map((b, i) =>
        b.kind === 'list' ? (
          <ul key={i}>
            {b.lines.map((line, k) => (
              <li key={k}>{line}</li>
            ))}
          </ul>
        ) : b.kind === 'heading' ? (
          <h3 key={i}>{b.lines[0].replace(/:$/, '')}</h3>
        ) : (
          <p key={i}>{b.lines[0]}</p>
        ),
      )}
    </div>
  );
}

export function SourceStatus({ job }: { job: Job }) {
  const checked = job.sources
    .filter((s) => s.health === 'recent' && s.checkedAt)
    .sort((a, b) => b.checkedAt!.localeCompare(a.checkedAt!))[0];
  const unavailable =
    job.sources.length > 0 &&
    job.sources.every((s) => s.health === 'unavailable');
  return (
    <div className="job-evidence">
      {job.sources.length > 1 && <span>{job.sources.length} პირველწყარო</span>}
      <span>
        {checked
          ? `წყარო შემოწმდა ${formatDate(checked.checkedAt!)}`
          : unavailable
            ? 'წყაროს შემოწმება ვერ მოხერხდა'
            : 'აქტუალურობა გადაამოწმე პირველწყაროზე'}
      </span>
    </div>
  );
}
