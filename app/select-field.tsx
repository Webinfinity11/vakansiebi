'use client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export type SelectOption = { value: string; label: string };

/* The menu's inner spacing and rows, shared with Choice: an inset list whose rows are a
   comfortable 36px (44px on a phone), wrap long Georgian labels instead of clipping them, and show the chosen one
   in the accent ink as well as with its tick. */
export const menuClass =
  'p-1 max-h-[min(22rem,var(--available-height))] overscroll-contain';
export const itemClass =
  'min-h-9 max-[760px]:min-h-11 rounded-[var(--ds-radius-sm)] py-1.5 pl-2.5 pr-8 text-[length:var(--ds-text-md)] leading-snug [&>span:first-child]:whitespace-normal data-selected:font-semibold data-selected:text-[var(--ds-accent-ink)]';

/* A form's dropdown: the site's own menu in place of the browser's <select>, whose list is drawn
   by the operating system. Unlike the filter dropdown (Choice) it has no "ყველა" entry; an empty
   value shows the placeholder. `name` keeps it working inside a plain <form>. */
export function SelectField({
  id,
  name,
  value,
  onChange,
  options,
  placeholder = 'აირჩიე',
  disabled,
  invalid,
  label,
  describedBy,
}: {
  id?: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  options: (string | SelectOption)[];
  placeholder?: string;
  disabled?: boolean;
  invalid?: boolean;
  /** For screen readers when no <label htmlFor> points at `id`. */
  label?: string;
  /** The id of the hint or error text that belongs to this field. */
  describedBy?: string;
}) {
  const list = options.map((o) =>
    typeof o === 'string' ? { value: o, label: o } : o,
  );
  const current = list.find((o) => o.value === value);
  return (
    <>
      <Select
        value={value || null}
        disabled={disabled}
        onValueChange={(v) => onChange(typeof v === 'string' ? v : '')}
      >
        <SelectTrigger
          id={id}
          aria-label={label}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          className="ds-select"
        >
          <SelectValue>
            {current ? (
              current.label
            ) : (
              <span className="ds-select-placeholder">{placeholder}</span>
            )}
          </SelectValue>
        </SelectTrigger>
        <SelectContent
          className={`ds-select-menu ${menuClass}`}
          alignItemWithTrigger={false}
          align="start"
          sideOffset={6}
        >
          {list.map((o) => (
            <SelectItem key={o.value} value={o.value} className={itemClass}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {name && <input type="hidden" name={name} value={value} />}
    </>
  );
}
