'use client';
import { useUi } from '@/app/ui-language';
export function VacancyStatus({ seen }: { seen: boolean }) {
  const { ui } = useUi();
  if (!seen) return null;
  return (
    <span className="vacancy-status status-seen">
      {ui('ნანახია')}
    </span>
  );
}
