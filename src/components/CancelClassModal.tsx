"use client";

import { format, parseISO } from "date-fns";
import { X, XCircle } from "lucide-react";
import { useRef, useState, useTransition } from "react";
import { cancelClass } from "@/app/actions/attendance";

type ClassOption = {
  id: string;
  name: string;
  scheduleDays: string[];
};

function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500/40 ${
          checked ? "bg-blue-600" : "bg-slate-300 dark:bg-slate-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-4" : "translate-x-0.5"
          }`}
        />
      </button>
      {label}
    </label>
  );
}

export function CancelClassModal({
  classes,
  onClose,
}: {
  classes: ClassOption[];
  onClose: () => void;
}) {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [isToday, setIsToday] = useState(true);
  const [dates, setDates] = useState<string[]>([todayStr]);
  const [pickerVal, setPickerVal] = useState(todayStr);
  const [allClasses, setAllClasses] = useState(false);
  const [selectedClassIds, setSelectedClassIds] = useState<string[]>([]);
  const [reasonType, setReasonType] = useState<"school_closed" | "teacher_absent" | "other">(
    "school_closed",
  );
  const [customReason, setCustomReason] = useState("");
  const [isPaid, setIsPaid] = useState(false);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  // Derive classes scheduled for any selected date
  const activeDates = isToday ? [todayStr] : dates;
  const scheduledClasses = classes.filter((cls) =>
    activeDates.some((d) => {
      const dayCode = format(parseISO(d), "EEE").toUpperCase().slice(0, 3);
      return cls.scheduleDays.includes(dayCode);
    }),
  );

  function addDate() {
    if (pickerVal && !dates.includes(pickerVal)) {
      setDates((prev) => [...prev, pickerVal].sort());
    }
  }

  function removeDate(d: string) {
    setDates((prev) => prev.filter((x) => x !== d));
  }

  function toggleClass(id: string) {
    setSelectedClassIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fd = new FormData();
    fd.append("dates", JSON.stringify(activeDates));
    fd.append("classIds", JSON.stringify(selectedClassIds));
    fd.append("allClasses", String(allClasses));
    fd.append("reasonType", reasonType);
    fd.append("customReason", customReason);
    fd.append("isPaid", String(isPaid));
    startTransition(async () => {
      await cancelClass(fd);
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
            Cancel Class
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} ref={formRef} className="space-y-5 px-5 py-5">
          {/* Today toggle */}
          <div className="space-y-3">
            <Toggle checked={isToday} onChange={setIsToday} label="Today" />

            {!isToday && (
              <div className="space-y-2">
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={pickerVal}
                    onChange={(e) => setPickerVal(e.target.value)}
                    className="flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  />
                  <button
                    type="button"
                    onClick={addDate}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                {dates.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {dates.map((d) => (
                      <span
                        key={d}
                        className="flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                      >
                        {format(parseISO(d), "MMM d")}
                        <button type="button" onClick={() => removeDate(d)}>
                          <XCircle size={12} className="opacity-70 hover:opacity-100" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* All classes toggle + dropdown */}
          <div className="space-y-3">
            <Toggle checked={allClasses} onChange={setAllClasses} label="All classes" />

            {!allClasses && (
              <div className="space-y-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
                  Select classes
                </p>
                {scheduledClasses.length === 0 ? (
                  <p className="text-sm text-slate-400">No classes scheduled for selected day(s)</p>
                ) : (
                  <div className="max-h-36 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-600">
                    {scheduledClasses.map((cls) => (
                      <label
                        key={cls.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                      >
                        <input
                          type="checkbox"
                          checked={selectedClassIds.includes(cls.id)}
                          onChange={() => toggleClass(cls.id)}
                          className="rounded border-slate-300"
                        />
                        <span className="text-sm text-slate-700 dark:text-slate-300">
                          {cls.name}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Paid / unpaid */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Billing
            </p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  [false, "Unpaid — students are not charged for this closure"],
                  [true, "Paid — students are still charged as normal"],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={String(val)}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="isPaidChoice"
                    checked={isPaid === val}
                    onChange={() => setIsPaid(val)}
                    className="accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div className="space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Reason
            </p>
            <div className="flex flex-col gap-1.5">
              {(
                [
                  ["school_closed", "School closed"],
                  ["teacher_absent", "Teacher absent"],
                  ["other", "Other"],
                ] as const
              ).map(([val, label]) => (
                <label
                  key={val}
                  className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-300"
                >
                  <input
                    type="radio"
                    name="reasonType"
                    value={val}
                    checked={reasonType === val}
                    onChange={() => setReasonType(val)}
                    className="accent-blue-600"
                  />
                  {label}
                </label>
              ))}
            </div>
            {reasonType === "other" && (
              <textarea
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value.slice(0, 200))}
                maxLength={200}
                rows={3}
                placeholder="Describe the reason..."
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              />
            )}
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={
                pending ||
                activeDates.length === 0 ||
                (!allClasses && selectedClassIds.length === 0)
              }
              className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
            >
              {pending ? "Cancelling…" : "Cancel Class"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
