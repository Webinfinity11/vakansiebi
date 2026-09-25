'use client';
import { useState } from 'react';
import { CalendarDays, X } from 'lucide-react';
import { ka } from 'date-fns/locale/ka';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

/* The editor's deadline: the site's own calendar in place of the browser's date input, the
   same trigger and menu as every other dropdown. The value stays YYYY-MM-DD, empty allowed. */
const months = [
  'იანვარი',
  'თებერვალი',
  'მარტი',
  'აპრილი',
  'მაისი',
  'ივნისი',
  'ივლისი',
  'აგვისტო',
  'სექტემბერი',
  'ოქტომბერი',
  'ნოემბერი',
  'დეკემბერი',
];
const toDay = (value: string) => {
  const [y, m, d] = (value || '').split('-').map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
};
const fromDay = (day: Date) =>
  `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;

export default function DateField({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = toDay(value);
  return (
    <span className="admin-date">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          id={id}
          type="button"
          className="ds-select admin-date-trigger"
        >
          {selected ? (
            <span>{`${selected.getDate()} ${months[selected.getMonth()]}, ${selected.getFullYear()}`}</span>
          ) : (
            <span className="ds-select-placeholder">აირჩიე თარიღი</span>
          )}
          <CalendarDays aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent
          className="ds-select-menu admin-date-menu"
          align="start"
        >
          <Calendar
            mode="single"
            locale={ka}
            weekStartsOn={1}
            selected={selected}
            defaultMonth={selected}
            onSelect={(day) => {
              if (!day) return;
              onChange(fromDay(day));
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
      {value && (
        <button
          type="button"
          className="ds-btn ds-btn--ghost ds-btn--icon ds-btn--sm admin-date-clear"
          aria-label="ვადის წაშლა"
          onClick={() => onChange('')}
        >
          <X aria-hidden="true" />
        </button>
      )}
    </span>
  );
}
