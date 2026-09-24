'use client';
import { LocateFixed } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

/* The one dropdown the site uses — never the browser's own <select>, whose menu is drawn by the
   operating system and ignores the site's type, colour and spacing. "ყველა" is prepended and
   shows the label instead. */
export function Choice({
  label,
  id,
  value,
  onChange,
  options,
  onLocate,
  locating = false,
  mobile = false,
}: {
  label: string;
  id?: string;
  value: string;
  onChange: (s: string) => void;
  options: string[];
  onLocate?: () => void;
  locating?: boolean;
  mobile?: boolean;
}) {
  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (v === '__near_me__') onLocate?.();
        else onChange(v || 'ყველა');
      }}
    >
      <SelectTrigger id={id} aria-label={label} className="choice">
        <SelectValue>
          {locating ? 'ქალაქს ვადგენთ…' : value === 'ყველა' ? label : value}
        </SelectValue>
      </SelectTrigger>
      <SelectContent
        className={`job-choice-options${mobile ? ' mobile-filter-options' : ''}`}
        alignItemWithTrigger={false}
        align="start"
        sideOffset={8}
      >
        {onLocate && (
          <SelectItem value="__near_me__" disabled={locating}>
            <LocateFixed size={16} aria-hidden="true" /> ჩემთან ახლოს
          </SelectItem>
        )}
        {['ყველა', ...options].map((o) => (
          <SelectItem key={o} value={o}>
            {o}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
