"use client";

import {
  endOfMonth,
  format,
  startOfMonth,
} from "date-fns";
import { useCallback, useEffect, useId, useMemo, useRef, useState, useTransition } from "react";
import { createInvoice } from "@/app/actions/billing";
import { Input, Label, Submit } from "@/components/ui";
import { useT } from "@/i18n/context";

export type StudentClassOption = {
  classId: string;
  name: string;
  pricePerMonth: number;
};

export type StudentInvoiceOption = {
  id: string;
  fullName: string;
  studentNumber: number;
  /** Ledger sum: positive = student owes, negative = credit on account */
  balance: number;
  classes: StudentClassOption[];
};

const MAX_SUGGESTIONS = 8;

function formatMoney(n: number) {
  return `$${n.toFixed(2)}`;
}

function defaultPeriod() {
  const now = new Date();
  return {
    start: format(startOfMonth(now), "yyyy-MM-dd"),
    end: format(endOfMonth(now), "yyyy-MM-dd"),
  };
}

export function InvoiceCreateForm({
  students,
  onSuccess,
}: {
  students: StudentInvoiceOption[];
  onSuccess?: () => void;
}) {
  const tt = useT();
  const listId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const [nameQuery, setNameQuery] = useState("");
  const [studentId, setStudentId] = useState("");
  const [classId, setClassId] = useState("");
  const [listOpen, setListOpen] = useState(false);
  const [highlight, setHighlight] = useState(-1);

  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [totalAmount, setTotalAmount] = useState("");
  const [creditApplied, setCreditApplied] = useState("");

  const selected = useMemo(
    () => students.find((s) => s.id === studentId) ?? null,
    [students, studentId],
  );

  const filtered = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return students.slice(0, MAX_SUGGESTIONS);
    return students
      .filter(
        (s) =>
          s.fullName.toLowerCase().includes(q) ||
          String(s.studentNumber).includes(q),
      )
      .slice(0, MAX_SUGGESTIONS);
  }, [students, nameQuery]);

  const selectedClass = useMemo(() => {
    if (!selected || !classId) return null;
    return selected.classes.find((c) => c.classId === classId) ?? null;
  }, [selected, classId]);

  const applyClassDefaults = useCallback(
    (student: StudentInvoiceOption, cls: StudentClassOption) => {
      const { start, end } = defaultPeriod();
      setPeriodStart(start);
      setPeriodEnd(end);
      const total = cls.pricePerMonth;
      setTotalAmount(total.toFixed(2));
      // Positive balance = prepaid credit to apply against this invoice.
      const creditOnAccount = student.balance > 0 ? student.balance : 0;
      const credit = Math.min(creditOnAccount, total);
      setCreditApplied(credit.toFixed(2));
    },
    [],
  );

  const pickStudent = useCallback(
    (s: StudentInvoiceOption) => {
      setStudentId(s.id);
      setNameQuery(`${s.fullName} (#${s.studentNumber})`);
      setClassId("");
      setPeriodStart("");
      setPeriodEnd("");
      setTotalAmount("");
      setCreditApplied("");
      setListOpen(false);
      setHighlight(-1);
    },
    [],
  );

  useEffect(() => {
    function onDocMouseDown(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) {
        setListOpen(false);
        setHighlight(-1);
      }
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, []);

  const onClassChange = (nextClassId: string) => {
    setClassId(nextClassId);
    if (!selected || !nextClassId) return;
    const cls = selected.classes.find((c) => c.classId === nextClassId);
    if (cls) applyClassDefaults(selected, cls);
  };

  const totalNum = Number(totalAmount);
  const creditNum = Number(creditApplied);
  const finalPreview =
    !Number.isNaN(totalNum) && !Number.isNaN(creditNum)
      ? totalNum - creditNum
      : null;

  const needsClass = Boolean(selected && selected.classes.length > 0);
  const classOk = !needsClass || classId !== "";

  const canSubmit =
    Boolean(studentId) &&
    classOk &&
    Boolean(periodStart) &&
    Boolean(periodEnd) &&
    totalAmount !== "" &&
    creditApplied !== "" &&
    !Number.isNaN(totalNum) &&
    !Number.isNaN(creditNum) &&
    totalNum - creditNum >= 0;

  const [submitting, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!canSubmit || submitting) return;
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      await createInvoice(fd);
      onSuccess?.();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 lg:grid-cols-3">
      <input type="hidden" name="studentId" value={studentId} />
      <input type="hidden" name="classId" value={classId} />

      <div ref={containerRef} className="relative lg:col-span-3">
        <Label>{tt("invoiceForm.student")}</Label>
        <input
          type="text"
          role="combobox"
          aria-expanded={listOpen}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          value={nameQuery}
          placeholder={tt("invoiceForm.placeholderName")}
          onChange={(e) => {
            setNameQuery(e.target.value);
            setStudentId("");
            setClassId("");
            setPeriodStart("");
            setPeriodEnd("");
            setTotalAmount("");
            setCreditApplied("");
            setListOpen(true);
            setHighlight(-1);
          }}
          onFocus={() => setListOpen(true)}
          onKeyDown={(e) => {
            if (!listOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
              setListOpen(true);
              return;
            }
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setHighlight((h) => {
                if (filtered.length === 0) return -1;
                return Math.min(h + 1, filtered.length - 1);
              });
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setHighlight((h) => {
                if (filtered.length === 0) return -1;
                return Math.max(h - 1, 0);
              });
            } else if (e.key === "Enter" && listOpen && highlight >= 0) {
              e.preventDefault();
              const s = filtered[highlight];
              if (s) pickStudent(s);
            } else if (e.key === "Escape") {
              setListOpen(false);
            }
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        />
        {listOpen && nameQuery.trim() !== "" && filtered.length > 0 ? (
          <ul
            id={listId}
            role="listbox"
            className="absolute z-30 mt-1 max-h-56 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-600 dark:bg-slate-900"
          >
            {filtered.map((s, i) => (
              <li key={s.id} role="option" aria-selected={highlight === i}>
                <button
                  type="button"
                  className={`flex w-full px-3 py-2 text-left text-sm ${
                    highlight === i
                      ? "bg-blue-50 text-blue-900 dark:bg-blue-950/60 dark:text-blue-100"
                      : "text-slate-800 hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-800"
                  }`}
                  onMouseEnter={() => setHighlight(i)}
                  onClick={() => pickStudent(s)}
                >
                  <span className="font-medium">{s.fullName}</span>
                  <span className="ml-2 text-slate-500 dark:text-slate-400">
                    #{s.studentNumber}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {listOpen && nameQuery.trim() !== "" && filtered.length === 0 ? (
          <p className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-500 shadow-lg dark:border-slate-600 dark:bg-slate-900 dark:text-slate-400">
            {tt("invoiceForm.noMatch")}
          </p>
        ) : null}
      </div>

      <div className="lg:col-span-3">
        <Label>{tt("invoiceForm.class")}</Label>
        <select
          value={classId}
          disabled={!selected || selected.classes.length === 0}
          onChange={(e) => onClassChange(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        >
          <option value="">
            {!selected
              ? tt("invoiceForm.chooseStudentFirst")
              : selected.classes.length === 0
                ? tt("invoiceForm.noClasses")
                : tt("invoiceForm.selectClass")}
          </option>
          {selected?.classes.map((c) => (
            <option key={c.classId} value={c.classId}>
              {c.name} — {formatMoney(c.pricePerMonth)}
              {tt("invoiceForm.perMonth")}
            </option>
          ))}
        </select>
      </div>

      {selected ? (
        <div className="lg:col-span-3 rounded-lg border border-slate-200 bg-slate-50/80 px-4 py-3 text-sm dark:border-slate-600 dark:bg-slate-800/50">
          <p className="font-medium text-slate-800 dark:text-slate-100">
            {tt("invoiceForm.ledgerBalance")}{" "}
            <span
              className={
                selected.balance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : selected.balance < 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-slate-600 dark:text-slate-400"
              }
            >
              {formatMoney(selected.balance)}
            </span>
            {selected.balance > 0 ? (
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                {tt("invoiceForm.creditHint")}
              </span>
            ) : selected.balance < 0 ? (
              <span className="ml-2 text-slate-500 dark:text-slate-400">
                {tt("invoiceForm.owed")}
              </span>
            ) : null}
          </p>
          {selectedClass && finalPreview !== null && !Number.isNaN(finalPreview) ? (
            <p className="mt-2 text-slate-600 dark:text-slate-300">
              <span className="font-medium text-slate-800 dark:text-slate-100">
                {selectedClass.name}
              </span>
              {" · "}
              {tt("invoiceForm.summaryTotal")} {formatMoney(totalNum)}
              {creditNum > 0 ? (
                <>
                  {" "}
                  {tt("invoiceForm.summaryCredit")} {formatMoney(creditNum)}
                </>
              ) : null}
              {" "}
              = <span className="font-semibold">{formatMoney(finalPreview)}</span>{" "}
              {tt("invoiceForm.summaryCharged")}
            </p>
          ) : null}
        </div>
      ) : null}

      <div>
        <Label>{tt("invoiceForm.periodStart")}</Label>
        <Input
          name="periodStart"
          type="date"
          required
          value={periodStart}
          onChange={(e) => setPeriodStart(e.target.value)}
        />
      </div>
      <div>
        <Label>{tt("invoiceForm.periodEnd")}</Label>
        <Input
          name="periodEnd"
          type="date"
          required
          value={periodEnd}
          onChange={(e) => setPeriodEnd(e.target.value)}
        />
      </div>
      <div>
        <Label>{tt("invoiceForm.total")}</Label>
        <Input
          name="totalAmount"
          type="number"
          step="0.01"
          min="0"
          required
          value={totalAmount}
          onChange={(e) => setTotalAmount(e.target.value)}
        />
      </div>
      <div>
        <Label>{tt("invoiceForm.creditApplied")}</Label>
        <Input
          name="creditApplied"
          type="number"
          step="0.01"
          min="0"
          required
          value={creditApplied}
          onChange={(e) => setCreditApplied(e.target.value)}
        />
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {tt("invoiceForm.creditHelp")}
        </p>
      </div>
      <div className="flex items-end">
        <Submit variant="orange" disabled={!canSubmit || submitting}>
          {submitting ? tt("invoiceForm.submitting") : tt("invoiceForm.submit")}
        </Submit>
      </div>
    </form>
  );
}
