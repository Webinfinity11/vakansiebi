'use client';
import { useUi } from '@/app/ui-language';
import { Eye } from 'lucide-react';
export function VacancyStatus({ seen }: { seen: boolean }) {
  const { ui } = useUi();
  if (!seen) return null;
  return (
    <span className="vacancy-status status-seen">
      <Eye size={14} aria-hidden="true" />
      {ui('ნანახია')}
    </span>
  );
}
