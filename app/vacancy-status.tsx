import { Eye, CheckCheck, Clock3 } from 'lucide-react';
import { applicationStatuses, type Application } from '@/lib/personal-space';
export function VacancyStatus({
  status,
  seen,
}: {
  status?: Application['status'];
  seen: boolean;
}) {
  if (!status && !seen) return null;
  const Icon = status === 'applied' ? CheckCheck : status ? Clock3 : Eye;
  return (
    <span className={`vacancy-status status-${status || 'seen'}`}>
      <Icon size={12} aria-hidden="true" />
      {status ? applicationStatuses[status] : 'ნანახია'}
    </span>
  );
}
