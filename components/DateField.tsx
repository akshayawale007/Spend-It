'use client';
import { fullDate } from '@/lib/format';
import { I } from './icons';

/** Shows "03 Nov 2026" with a calendar icon; a transparent native date input sits on top. */
export function DateField({ value, onChange, className, placeholder = 'Pick a date', name = 'date', required }: {
  value: string;
  onChange: (v: string) => void;
  className: string;
  placeholder?: string;
  name?: string;
  required?: boolean;
}) {
  return (
    <label className={`${className} datef`}>
      <span className={value ? 'dv' : 'dv ph'}>{value ? fullDate(value) : placeholder}</span>
      <I.cal />
      <input
        type="date"
        name={name}
        value={value}
        required={required}
        aria-label="Date"
        onChange={e => onChange(e.target.value)}
        onClick={e => {
          try { (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.(); } catch { /* unsupported */ }
        }}
      />
    </label>
  );
}
