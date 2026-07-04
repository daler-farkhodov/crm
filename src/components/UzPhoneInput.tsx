"use client";

import { useEffect, useRef, useState } from "react";

// Extracts up to 9 digits from any stored phone string (+998 prefix stripped)
function parseDigits(val: string | null | undefined): string {
  if (!val) return "";
  const stripped = val.replace(/\D/g, "");
  const body = stripped.startsWith("998") ? stripped.slice(3) : stripped;
  return body.slice(0, 9);
}

// Formats 0-9 digit string into the visual portion after "+998 "
function formatDisplay(digits: string): string {
  const d = digits.slice(0, 9);
  if (d.length === 0) return "";
  if (d.length <= 2) return "(" + d;
  let out = "(" + d.slice(0, 2) + ") ";
  if (d.length <= 5) return out + d.slice(2);
  out += d.slice(2, 5) + "-";
  if (d.length <= 7) return out + d.slice(5);
  out += d.slice(5, 7) + "-";
  return out + d.slice(7, 9);
}

// Full normalized value written to the hidden input
function formatFull(digits: string): string {
  if (digits.length !== 9) return "";
  return `+998 (${digits.slice(0, 2)}) ${digits.slice(2, 5)}-${digits.slice(5, 7)}-${digits.slice(7, 9)}`;
}

interface Props {
  name: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
  onValueChange?: (full: string) => void;
}

export function UzPhoneInput({ name, defaultValue, placeholder, required, onValueChange }: Props) {
  const [digits, setDigits] = useState(() => parseDigits(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  const isComplete = digits.length === 9;
  const isEmpty = digits.length === 0;
  const isInvalid = !isEmpty && !isComplete;

  // Keep custom validity in sync so the browser blocks form submit when incomplete
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.setCustomValidity(isInvalid ? "Enter all 9 digits of the Uzbekistan number" : "");
  }, [isInvalid]);

  function updateDigits(next: string) {
    setDigits(next);
    onValueChange?.(formatFull(next));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      e.preventDefault();
      updateDigits(digits.slice(0, -1));
      return;
    }
    if (e.key === "Delete") {
      e.preventDefault();
      updateDigits("");
      return;
    }
    // Allow only digit keys
    if (/^\d$/.test(e.key)) {
      e.preventDefault();
      if (digits.length < 9) updateDigits(digits + e.key);
      return;
    }
    // Block everything else (letters, symbols, etc.) but allow tab/arrows/clipboard triggers
    if (!["Tab", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"].includes(e.key)) {
      e.preventDefault();
    }
  }

  function handlePaste(e: React.ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text");
    const extracted = parseDigits(pasted);
    if (extracted) updateDigits(extracted);
  }

  const displayValue = digits.length > 0 ? "+998 " + formatDisplay(digits) : "";

  const borderClass = isInvalid
    ? "border-red-400 focus:border-red-500 focus:ring-red-500/20"
    : "border-slate-200 focus:border-blue-500 focus:ring-blue-500/20 dark:border-slate-600";

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        placeholder={placeholder ?? "+998 (90) 123-45-67"}
        onChange={() => {/* controlled via keydown */}}
        onKeyDown={handleKeyDown}
        onPaste={handlePaste}
        required={required}
        autoComplete="tel"
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:ring-2 dark:bg-slate-800 dark:text-slate-100 ${borderClass}`}
      />
      {/* hidden input carries the clean value for form submission */}
      <input type="hidden" name={name} value={formatFull(digits)} />
      {isInvalid && (
        <p className="mt-1 text-xs text-red-600">Enter all 9 digits after +998</p>
      )}
    </div>
  );
}
