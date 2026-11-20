import { useId } from 'react';

type Props = { value: string; onChange: (v: string) => void; label?: string; disabled?: boolean };

/** Ô PIN 6 số: chỉ nhận chữ số. */
export function PinInput({ value, onChange, label = 'Mã PIN 6 số', disabled }: Props) {
  const id = useId();
  return (
    <div className="ed-field">
      <label className="lab" htmlFor={id}>{label}</label>
      <input
        id={id}
        className="input pin"
        type="password"
        inputMode="numeric"
        autoComplete="off"
        maxLength={6}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      />
    </div>
  );
}
