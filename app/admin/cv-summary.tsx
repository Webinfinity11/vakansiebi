export type CvSummary = { total: number; week: number; people: number };

const whole = new Intl.NumberFormat('ka-GE');

/** The same person by e-mail, else by the phone's last nine digits; otherwise on their own. */
export function personKey(id: string, email: string, phone: string) {
  const mail = email.trim().toLowerCase();
  if (mail) return `e:${mail}`;
  const digits = phone.replace(/\D/g, '').slice(-9);
  return digits ? `p:${digits}` : `id:${id}`;
}

export function CvSummaryLine({
  summary,
  items,
}: {
  summary: CvSummary | null;
  items: [string, string];
}) {
  if (!summary) return null;
  return (
    <dl className="cv-summary">
      <div>
        <dt>{items[0]}</dt>
        <dd>{whole.format(summary.total)}</dd>
      </div>
      <div>
        <dt>ბოლო 7 დღეში</dt>
        <dd>{whole.format(summary.week)}</dd>
      </div>
      <div>
        <dt>{items[1]}</dt>
        <dd>{whole.format(summary.people)}</dd>
      </div>
    </dl>
  );
}
