import { generateDueStudentInvoice } from "@/app/actions/billing";

export function StudentInvoiceDueButton({
  studentId,
  balance,
  hasEnrollments,
  labels,
}: {
  studentId: string;
  /** Current ledger balance: positive = prepaid credit, negative = student owes. */
  balance: number;
  /** Whether the student has at least one active enrollment. */
  hasEnrollments: boolean;
  labels: {
    empty: string;
    generate: string;
  };
}) {
  if (!hasEnrollments) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500">{labels.empty}</span>
    );
  }

  // Invoice button visible only when balance is negative (student owes money).
  if (balance >= 0) {
    return (
      <span className="text-xs text-slate-400 dark:text-slate-500">—</span>
    );
  }

  return (
    <form action={generateDueStudentInvoice} className="inline">
      <input type="hidden" name="studentId" value={studentId} />
      <button
        type="submit"
        className="rounded-lg bg-orange-500 px-2.5 py-1 text-xs font-semibold text-white shadow-sm hover:bg-orange-600 dark:bg-orange-500 dark:hover:bg-orange-400"
      >
        {labels.generate}
      </button>
    </form>
  );
}
