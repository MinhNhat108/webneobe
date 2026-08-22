import React from 'react';
import { cn } from '../../lib/cn';

interface NumberFieldProps {
  label: string;
  value: number | undefined | null;
  onChange: (val: number) => void;
  unit?: string;
  step?: number | string;
  min?: number;
  max?: number;
  disabled?: boolean;
  helpText?: string;
  placeholder?: string;
  isEstimated?: boolean;
  className?: string;
}

/** `1.`, `-`, `1e`, `0.0` — legal keystrokes on the way to a number. */
const isPartialNumber = (raw: string) => /^-?\d*[.,]?\d*(e-?\d*)?$/i.test(raw);

export const NumberField: React.FC<NumberFieldProps> = ({
  label,
  value,
  onChange,
  unit,
  step = 'any',
  min = 0, // every quantity in this app is a non-negative physical value
  max,
  disabled = false,
  helpText,
  placeholder,
  isEstimated = false,
  className,
}) => {
  const [localStr, setLocalStr] = React.useState<string>(
    value !== undefined && value !== null ? String(value) : ''
  );
  const [error, setError] = React.useState<string | null>(null);
  const isEditing = React.useRef(false);
  const id = React.useId();

  // Sync down from the store ONLY when the user is not mid-edit. Without this
  // guard, typing "0.5" round-trips through the store as 0 and the effect
  // rewrites the field to "0", eating the decimal point as it is typed.
  React.useEffect(() => {
    if (isEditing.current) return;
    setLocalStr(value !== undefined && value !== null ? String(value) : '');
    setError(null);
  }, [value]);

  const validate = (num: number): string | null => {
    if (Number.isNaN(num)) return 'Giá trị nhập không hợp lệ';
    if (min !== undefined && num < min) return `Giá trị phải ≥ ${min}`;
    if (max !== undefined && num > max) return `Giá trị phải ≤ ${max}`;
    return null;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    isEditing.current = true;
    setLocalStr(raw);

    if (raw.trim() === '') {
      setError('Bắt buộc nhập giá trị');
      return;
    }

    // A half-typed number ("1.", "-", "1e") is not an error yet: keep the
    // caret where it is and simply do not publish a value.
    if (isPartialNumber(raw) && !/\d/.test(raw.replace(/^-/, ''))) {
      setError(null);
      return;
    }

    const num = parseFloat(raw.replace(',', '.'));
    const err = validate(num);
    setError(err);
    if (!err) onChange(num);
  };

  const handleBlur = () => {
    isEditing.current = false;
    // Re-normalise the display from the committed value on blur.
    if (!error) setLocalStr(value !== undefined && value !== null ? String(value) : '');
  };

  const isInvalid = error !== null;

  return (
    <div className={cn('flex flex-col gap-1 text-sm', className)}>
      <div className="flex items-center justify-between gap-2">
        <label htmlFor={id} className="field-label flex items-center gap-1.5">
          {label}
          {isEstimated && (
            <span
              className="badge badge-na !font-normal !px-1.5 !py-0 text-[10px]"
              title="Giá trị ước tính — cần kiểm chứng theo catalogue nhà sản xuất"
            >
              ước tính
            </span>
          )}
        </label>
        {unit && <span className="field-unit shrink-0">{unit}</span>}
      </div>

      <input
        id={id}
        type="number"
        inputMode="decimal"
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        value={localStr}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={() => { isEditing.current = true; }}
        placeholder={placeholder}
        aria-invalid={isInvalid}
        aria-describedby={isInvalid ? `${id}-err` : helpText ? `${id}-help` : undefined}
        className={cn(
          'field-input',
          isInvalid && 'field-input-invalid',
          disabled && 'field-input-disabled'
        )}
      />

      {helpText && !isInvalid && (
        <span id={`${id}-help`} className="field-help">{helpText}</span>
      )}
      {isInvalid && (
        <span id={`${id}-err`} role="alert" className="text-xs text-red-600 font-medium">
          {error}
        </span>
      )}
    </div>
  );
};
