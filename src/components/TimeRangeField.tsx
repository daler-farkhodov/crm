"use client";

import { useEffect, useRef, useState } from "react";

function parseTime(s: string): { h: number; m: number } {
  const [h, m] = s.split(":").map(Number);
  return {
    h: Number.isFinite(h) ? Math.max(0, Math.min(23, h)) : 0,
    m: Number.isFinite(m) ? Math.max(0, Math.min(59, m)) : 0,
  };
}

function mergeRefs<T>(...refs: (React.Ref<T> | undefined)[]): React.RefCallback<T> {
  return (el) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === "function") ref(el);
      else (ref as React.MutableRefObject<T | null>).current = el;
    }
  };
}

interface SpinnerProps {
  value: number;
  max: number;
  onChange: (v: number) => void;
  onAdvance?: () => void;
  onBack?: () => void;
  inputRef?: React.Ref<HTMLInputElement>;
}

function Spinner({ value, max, onChange, onAdvance, onBack, inputRef }: SpinnerProps) {
  const innerRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);

  const display =
    pending !== null ? pending.padEnd(2, "_").slice(0, 2) : String(value).padStart(2, "0");

  function commit(digit1: string, digit2: string) {
    const combined = parseInt(digit1 + digit2, 10);
    onChange(Math.min(max, combined));
    setPending(null);
    onAdvance?.();
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowRight") { e.preventDefault(); setPending(null); onAdvance?.(); return; }
    if (e.key === "ArrowLeft")  { e.preventDefault(); setPending(null); onBack?.();    return; }
    if (e.key === "ArrowUp")    { e.preventDefault(); setPending(null); onChange(value < max ? value + 1 : 0);   return; }
    if (e.key === "ArrowDown")  { e.preventDefault(); setPending(null); onChange(value > 0   ? value - 1 : max); return; }
    if (e.key === "Backspace" || e.key === "Delete") { e.preventDefault(); setPending(null); onChange(0); return; }
    if (e.key === "Tab") { setPending(null); return; }

    if (/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      const digit = parseInt(e.key, 10);
      const maxFirstDigit = Math.floor(max / 10);

      if (pending === null) {
        if (digit > maxFirstDigit) {
          // e.g. typing "5" in hour field (max first digit is 2) → value = 5, advance
          onChange(digit);
          onAdvance?.();
        } else {
          setPending(String(digit));
        }
      } else {
        commit(pending, String(digit));
      }
    }
  }

  return (
    <input
      ref={mergeRefs(innerRef, inputRef)}
      type="text"
      inputMode="numeric"
      value={display}
      onChange={() => {}}
      onKeyDown={handleKeyDown}
      onFocus={(e) => { setPending(null); requestAnimationFrame(() => e.target.select()); }}
      onBlur={() => setPending(null)}
      className="w-8 bg-transparent text-center text-sm outline-none dark:text-slate-100 cursor-default"
    />
  );
}

interface TimePickerProps {
  value: { h: number; m: number };
  onChange: (v: { h: number; m: number }) => void;
  onAdvanceFromMinute?: () => void;
  onBackFromHour?: () => void;
  error?: boolean;
  hourRef?: React.Ref<HTMLInputElement>;
  minuteRef?: React.Ref<HTMLInputElement>;
}

function TimePicker({ value, onChange, onAdvanceFromMinute, onBackFromHour, error, hourRef, minuteRef }: TimePickerProps) {
  const innerHourRef = useRef<HTMLInputElement>(null);
  const innerMinuteRef = useRef<HTMLInputElement>(null);

  const borderClass = error
    ? "border-red-400 dark:border-red-500"
    : "border-slate-200 dark:border-slate-600 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20";

  return (
    <div className={`inline-flex items-center rounded-lg border bg-white px-2 py-1.5 text-sm dark:bg-slate-800 ${borderClass}`}>
      <Spinner
        inputRef={mergeRefs(innerHourRef, hourRef)}
        value={value.h}
        max={23}
        onChange={(h) => onChange({ ...value, h })}
        onAdvance={() => innerMinuteRef.current?.focus()}
        onBack={onBackFromHour}
      />
      <span className="pointer-events-none select-none text-slate-400 dark:text-slate-500">:</span>
      <Spinner
        inputRef={mergeRefs(innerMinuteRef, minuteRef)}
        value={value.m}
        max={59}
        onChange={(m) => onChange({ ...value, m })}
        onBack={() => innerHourRef.current?.focus()}
        onAdvance={onAdvanceFromMinute}
      />
    </div>
  );
}

const labelClass =
  "mb-1 block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";

export function TimeRangeField({
  startDefault = "9:00",
  endDefault = "10:00",
  startLabel = "Start time",
  endLabel = "End time",
}: {
  startDefault?: string;
  endDefault?: string;
  startLabel?: string;
  endLabel?: string;
}) {
  const [start, setStart] = useState(() => parseTime(startDefault));
  const [end, setEnd] = useState(() => parseTime(endDefault));

  const startMinuteRef = useRef<HTMLInputElement>(null);
  const endHourRef = useRef<HTMLInputElement>(null);

  const startMins = start.h * 60 + start.m;
  const endMins = end.h * 60 + end.m;
  const error = endMins <= startMins ? "End must be after start" : "";

  useEffect(() => {
    endHourRef.current?.setCustomValidity(error);
  }, [error]);

  return (
    <>
      <input type="hidden" name="startTime" value={`${start.h}:${String(start.m).padStart(2, "0")}`} />
      <input type="hidden" name="endTime" value={`${end.h}:${String(end.m).padStart(2, "0")}`} />

      <div>
        <label className={labelClass}>{startLabel}</label>
        <TimePicker
          value={start}
          onChange={setStart}
          minuteRef={startMinuteRef}
          onAdvanceFromMinute={() => endHourRef.current?.focus()}
        />
      </div>

      <div>
        <label className={labelClass}>{endLabel}</label>
        <TimePicker
          value={end}
          onChange={setEnd}
          hourRef={endHourRef}
          onBackFromHour={() => startMinuteRef.current?.focus()}
          error={!!error}
        />
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
    </>
  );
}
