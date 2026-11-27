"use client";

// A number with − and ＋ buttons, big enough to tap.
// `subject` names what the number belongs to (a stop), so each pair of buttons is told apart.
export default function Stepper({ label, value, min, max, onChange, hint, subject = "" }) {
  return (
    <div className="plan-stepper">
      <span className="plan-stepper-label">{label}{hint && <small>{hint}</small>}</span>
      <span className="plan-stepper-control">
        <button type="button" aria-label={`${subject}${label}减一`} disabled={value <= min} onClick={() => onChange(value - 1)}>−</button>
        <output aria-live="polite">{value}</output>
        <button type="button" aria-label={`${subject}${label}加一`} disabled={value >= max} onClick={() => onChange(value + 1)}>＋</button>
      </span>
    </div>
  );
}
