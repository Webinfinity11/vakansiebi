import type { PublicJob as Job } from '@/lib/types';
export function formatDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return '';
  const [year, month, day] = value.slice(0, 10).split('-').map(Number);
  if (!year || !month || !day) return '';
  return `${day} ${['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'][month - 1]}`;
}
function TextLinks({ text }: { text: string }) {
  return text.split(/(https:\/\/[^\s<>"']+)/g).map((part, i) => {
    if (!part.startsWith('https://')) return part;
    const url = part.replace(/[.,;]+$/, '');
    try {
      const parsed = new URL(url);
      if (parsed.username || parsed.password) return part;
    } catch {
      return part;
    }
    return (
      <span key={i}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        {part.slice(url.length)}
      </span>
    );
  });
}
export function Description({ text }: { text: string }) {
  const lines = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const blocks: {
    kind: 'ul' | 'ol' | 'heading' | 'p';
    lines: { text: string; value?: number }[];
  }[] = [];
  for (const line of lines) {
    const numbered = line.match(/^(\d+)[.)]\s+(.+)$/);
    const bullet = line.match(/^(?:[•▪–]|\*{1,2})\s+(.+)$/);
    if (numbered || bullet) {
      const kind = numbered ? 'ol' : 'ul';
      if (blocks.at(-1)?.kind !== kind) blocks.push({ kind, lines: [] });
      blocks
        .at(-1)!
        .lines.push({
          text: numbered ? numbered[2] : bullet![1],
          value: numbered ? Number(numbered[1]) : undefined,
        });
    } else
      blocks.push({
        kind: line.length < 110 && /[:：]$/.test(line) ? 'heading' : 'p',
        lines: [{ text: line }],
      });
  }
  return (
    <div className="vacancy-description">
      {blocks.map((block, i) => {
        if (block.kind === 'ul' || block.kind === 'ol') {
          const Tag = block.kind;
          return (
            <Tag key={i}>
              {block.lines.map((line, k) => (
                <li key={k} value={line.value}>
                  <TextLinks text={line.text} />
                </li>
              ))}
            </Tag>
          );
        }
        return block.kind === 'heading' ? (
          <h3 key={i}>
            <TextLinks text={block.lines[0].text} />
          </h3>
        ) : (
          <p key={i}>
            <TextLinks text={block.lines[0].text} />
          </p>
        );
      })}
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
