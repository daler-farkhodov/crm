"use client";

import { setStudentActive } from "@/app/actions/students";
import { useEffect, useState, useTransition } from "react";
import { useT } from "@/i18n/context";

export function StudentActiveToggle({
  id,
  isActive: initial,
}: {
  id: string;
  isActive: boolean;
}) {
  const tt = useT();
  const [on, setOn] = useState(initial);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    setOn(initial);
  }, [initial]);

  const toggle = () => {
    const next = !on;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("id", id);
      fd.set("isActive", String(next));
      await setStudentActive(fd);
      setOn(next);
    });
  };

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={pending}
      onClick={toggle}
      className={`inline-flex h-7 w-12 shrink-0 items-center rounded-full border px-1 transition ${
        on
          ? "justify-end border-emerald-200 bg-emerald-500 dark:border-emerald-600 dark:bg-emerald-600"
          : "justify-start border-slate-200 bg-slate-200 dark:border-slate-600 dark:bg-slate-700"
      } ${pending ? "opacity-60" : ""}`}
    >
      <span className="sr-only">{tt("shell.toggleActive")}</span>
      <span className="h-5 w-5 rounded-full bg-white shadow" />
    </button>
  );
}
