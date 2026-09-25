import { Eye } from 'lucide-react';
export function VacancyStatus({ seen }: { seen: boolean }) {
  if (!seen) return null;
  return (
    <span className="vacancy-status status-seen">
      <Eye size={14} aria-hidden="true" />
      ნანახია
    </span>
  );
}
