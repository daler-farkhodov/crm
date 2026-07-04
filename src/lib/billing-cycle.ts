import { addDays, addMonths, endOfDay, format, getDay, getDaysInMonth, isAfter, startOfDay, startOfMonth } from "date-fns";

const DAY_MAP: Record<string, number> = {
  SUN: 0,
  MON: 1,
  TUE: 2,
  WED: 3,
  THU: 4,
  FRI: 5,
  SAT: 6,
};

/** Nth scheduled class on or after enrollment start (1-based). */
export function nthScheduledSessionDate(
  enrollmentStart: Date,
  scheduleDays: string[],
  n: number,
): Date | null {
  if (n < 1 || scheduleDays.length === 0) return null;
  const wanted = new Set(
    scheduleDays.map((d) => DAY_MAP[d]).filter((x) => x !== undefined),
  );
  if (wanted.size === 0) return null;

  let d = startOfDay(enrollmentStart);
  let count = 0;
  for (let i = 0; i < 800; i++) {
    if (wanted.has(getDay(d))) {
      count++;
      if (count === n) return d;
    }
    d = addDays(d, 1);
  }
  return null;
}

export function billingAnchorFromEnrollments(activeStarts: Date[]): Date | null {
  if (activeStarts.length === 0) return null;
  const t = Math.min(...activeStarts.map((x) => startOfDay(x).getTime()));
  return startOfDay(new Date(t));
}

/**
 * Service window for billing cycle k (0 = first month from anchor).
 * e.g. anchor Apr 3, k=0 → Apr 3 … May 2 inclusive; next payment on May 3.
 */
export function billingPeriodForCycle(anchor: Date, cycleIndex: number) {
  const periodStart = startOfDay(addMonths(startOfDay(anchor), cycleIndex));
  const nextAnchor = startOfDay(addMonths(startOfDay(anchor), cycleIndex + 1));
  const lastDay = addDays(nextAnchor, -1);
  const periodEnd = endOfDay(lastDay);
  return { periodStart, periodEnd };
}

/** Payment due date after invoicing cycle `cycleIndex` (0-based). */
export function nextAnniversaryDueAfterCycle(anchor: Date, cycleIndex: number) {
  return startOfDay(addMonths(startOfDay(anchor), cycleIndex + 1));
}

export function perClassCreditAmount(pricePerMonth: number, classesPerMonth: number): number {
  if (classesPerMonth < 1 || pricePerMonth <= 0) return 0;
  return Math.round((pricePerMonth / classesPerMonth) * 100) / 100;
}

export type ClosureRecord = { date: Date; isPaid: boolean };

/**
 * Counts scheduled sessions for a class between two dates (inclusive),
 * optionally excluding unpaid closure dates. Paid closures count as normal
 * billable/scheduled sessions.
 */
export function countSessionsBetween(
  scheduleDays: string[],
  from: Date,
  to: Date,
  closures: ClosureRecord[] = [],
): number {
  const wanted = new Set(
    scheduleDays.map((d) => DAY_MAP[d]).filter((x) => x !== undefined),
  );
  if (wanted.size === 0) return 0;

  const closureSet = new Set(
    closures.filter((c) => !c.isPaid).map((c) => format(c.date, "yyyy-MM-dd")),
  );
  let count = 0;
  let d = startOfDay(from);
  const end = startOfDay(to);

  while (!isAfter(d, end)) {
    if (wanted.has(getDay(d)) && !closureSet.has(format(d, "yyyy-MM-dd"))) {
      count++;
    }
    d = addDays(d, 1);
  }
  return count;
}

/**
 * Counts how many scheduled sessions a class has in a given calendar month,
 * excluding unpaid closure dates. Paid closures count as normal
 * billable/scheduled sessions.
 */
export function countScheduledSessionsInMonth(
  scheduleDays: string[],
  referenceDate: Date,
  closures: ClosureRecord[],
): number {
  const wanted = new Set(
    scheduleDays.map((d) => DAY_MAP[d]).filter((x) => x !== undefined),
  );
  if (wanted.size === 0) return 0;

  const closureSet = new Set(
    closures.filter((c) => !c.isPaid).map((c) => format(c.date, "yyyy-MM-dd")),
  );
  const monthStart = startOfMonth(referenceDate);
  const daysInMonth = getDaysInMonth(referenceDate);

  let count = 0;
  for (let i = 0; i < daysInMonth; i++) {
    const d = addDays(monthStart, i);
    if (wanted.has(getDay(d)) && !closureSet.has(format(d, "yyyy-MM-dd"))) {
      count++;
    }
  }
  return count;
}
