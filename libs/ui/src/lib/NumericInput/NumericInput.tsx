import { useState, useEffect, useCallback, InputHTMLAttributes } from 'react';

export interface NumericInputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'min' | 'max' | 'step'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
}

export function NumericInput({
  value,
  onChange,
  min,
  max,
  step,
  ...rest
}: NumericInputProps) {
  const [draft, setDraft] = useState(String(value));

  useEffect(() => {
    setDraft(String(value));
  }, [value]);

  const commit = useCallback(() => {
    let num = parseFloat(draft);
    if (isNaN(num)) {
      num = min ?? 0;
    }
    if (step != null && step >= 1) {
      num = Math.round(num / step) * step;
    } else {
      num = Math.round(num);
    }
    if (min != null) num = Math.max(min, num);
    if (max != null) num = Math.min(max, num);
    setDraft(String(num));
    if (num !== value) {
      onChange(num);
    }
  }, [draft, min, max, step, value, onChange]);

  return (
    <input
      {...rest}
      type="text"
      inputMode="numeric"
      value={draft}
      onChange={(e) => {
        const v = e.target.value;
        if (v === '' || v === '-' || /^-?\d*$/.test(v)) {
          setDraft(v);
          const num = parseFloat(v);
          if (!isNaN(num)) {
            onChange(num);
          }
        }
      }}
      onBlur={(e) => {
        commit();
        rest.onBlur?.(e);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit();
        }
        rest.onKeyDown?.(e);
      }}
    />
  );
}
