import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import { Gift } from "lucide-react";
import {
  enrollStudent,
  transferStudent,
  updateEnrollmentHistory,
  updateEnrollmentSettings,
  updateStudentContact,
} from "@/app/actions/students";
import { ContactCard } from "@/components/ContactCard";
import { EndEnrollmentButton } from "@/components/EndEnrollmentButton";
import { EnrollToClassModal } from "@/components/EnrollToClassModal";
import { Card, Input, Label, PageTitle, Select, Submit, Table } from "@/components/ui";
import { getLocale } from "@/i18n/locale";
import { getMessages } from "@/i18n/messages";
import { t } from "@/i18n/t";
import { prisma } from "@/lib/prisma";

const STATUS_LABELS: Record<string, string> = {
  ACTIVE: "Active",
  COMPLETED: "Completed",
  TRANSFERRED: "Transferred",
  DROPPED: "Dropped",
};

const STATUS_STYLES: Record<string, string> = {
  ACTIVE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  COMPLETED:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  TRANSFERRED:
    "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
  DROPPED:
    "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400",
};

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const locale = await getLocale();
  const m = getMessages(locale);
  const { id } = await params;

  const student = await prisma.student.findUnique({
    where: { id },
    include: {
      classes: {
        include: {
          class: {
            include: {
              teachers: {
                where: { role: "TEACHER" },
                include: { teacher: true },
                take: 1,
              },
            },
          },
        },
        orderBy: { startDate: "asc" },
      },
      ledger: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!student) notFound();

  const classes = await prisma.class.findMany({ orderBy: { name: "asc" } });

  // Balance: positive = prepaid credit, negative = student owes (needs invoice)
  const ledgerBalance = student.ledger.reduce((sum, l) => sum + l.amount, 0);

  const activeEnrollments = student.classes.filter((sc) => !sc.endDate);
  // All enrollments chronologically for history (newest first)
  const allEnrollments = [...student.classes].sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );

  return (
    <div>
      <PageTitle
        title={student.fullName}
        subtitle={t(m, "studentsDetail.subtitle")}
        action={
          <EnrollToClassModal
            studentId={student.id}
            classes={classes}
            action={enrollStudent}
          />
        }
      />
      <div className="mb-4 text-sm">
        <Link href="/students" className="text-accent-blue hover:underline">
          {t(m, "studentsDetail.back")}
        </Link>
      </div>

      <ContactCard
        action={updateStudentContact}
        studentId={student.id}
        fullName={student.fullName}
        phone={student.phone}
        parentName={student.parentName}
        parentPhone={student.parentPhone}
      />

      <div className="grid gap-6">
        {/* ── Ledger ── */}
        <Card>
          <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {t(m, "studentsDetail.recentLedger")}
          </h2>
          <p className="mb-2 text-xs text-slate-500 dark:text-slate-400">
            Balance:{" "}
            <span
              className={`font-semibold ${
                ledgerBalance > 0
                  ? "text-emerald-600 dark:text-emerald-400"
                  : ledgerBalance < 0
                    ? "text-orange-600 dark:text-orange-400"
                    : "text-slate-600 dark:text-slate-400"
              }`}
            >
              {ledgerBalance > 0 ? "+" : ""}
              {ledgerBalance.toFixed(2)}
            </span>
            {ledgerBalance > 0 && (
              <span className="ml-1 text-slate-400 dark:text-slate-500">(prepaid credit)</span>
            )}
            {ledgerBalance < 0 && (
              <span className="ml-1 text-orange-500 dark:text-orange-400">(owes — invoice due)</span>
            )}
          </p>
          <Table
            emptyMessage={t(m, "ui.noRecords")}
            headers={[
              t(m, "studentsDetail.ledgerColType"),
              t(m, "studentsDetail.ledgerColAmount"),
              t(m, "studentsDetail.ledgerColWhen"),
            ]}
            rows={student.ledger.map((l) => [
              l.referenceType ?? l.type,
              l.amount.toFixed(2),
              format(l.createdAt, "MMM d, yyyy"),
            ])}
          />
        </Card>
      </div>

      {/* ── Active enrollments ── */}
      <div className="mt-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Active enrollments
        </h2>
        {activeEnrollments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No active enrollments.</p>
        ) : (
          <div className="space-y-4">
            {activeEnrollments.map((sc) => {
              const standardRate = sc.class.pricePerMonth;
              const effectiveRate = sc.customRate ?? standardRate;
              const isBelowRate = !sc.isFree && effectiveRate < standardRate - 0.01;

              return (
                <div
                  key={sc.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  <div className="mb-3 flex flex-wrap items-center gap-2">
                    <Link
                      href={`/classes/${sc.classId}`}
                      className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                    >
                      {sc.class.name}
                    </Link>
                    <span className="text-xs text-slate-400">
                      since {format(sc.startDate, "MMM d, yyyy")}
                    </span>
                    {sc.isFree && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
                        <Gift size={10} /> Free
                      </span>
                    )}
                    {isBelowRate && (
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
                        Below rate · ${effectiveRate}/mo
                      </span>
                    )}
                    {!sc.isFree && sc.customRate != null && !isBelowRate && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600 dark:bg-blue-900/30 dark:text-blue-300">
                        Custom rate · ${effectiveRate}/mo
                      </span>
                    )}
                  </div>

                  <div className="flex flex-wrap gap-4">
                    <form action={updateEnrollmentSettings} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={sc.id} />
                      <input type="hidden" name="isFree" value="false" />
                      <div>
                        <Label>Custom rate ($/mo)</Label>
                        <Input
                          name="customRate"
                          type="number"
                          step="0.01"
                          min={0}
                          placeholder={`${standardRate} (standard)`}
                          defaultValue={sc.customRate ?? ""}
                          className="w-40"
                        />
                      </div>
                      <Submit variant="blue">Set rate</Submit>
                    </form>

                    <form action={updateEnrollmentSettings} className="flex items-end">
                      <input type="hidden" name="id" value={sc.id} />
                      <input type="hidden" name="customRate" value="" />
                      <input type="hidden" name="isFree" value={sc.isFree ? "false" : "true"} />
                      <Submit variant={sc.isFree ? "orange" : "blue"}>
                        {sc.isFree ? "Mark as paying" : "Mark as free"}
                      </Submit>
                    </form>

                    <EndEnrollmentButton enrollmentId={sc.id} />

                    <form action={transferStudent} className="flex flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={sc.id} />
                      <div>
                        <Label>Transfer to class</Label>
                        <Select name="toClassId" required className="w-48">
                          <option value="">Select class</option>
                          {classes
                            .filter((c) => c.id !== sc.classId)
                            .map((c) => (
                              <option key={c.id} value={c.id}>
                                {c.name}
                              </option>
                            ))}
                        </Select>
                      </div>
                      <div>
                        <Label>Transfer date</Label>
                        <Input name="transferDate" type="date" required className="w-40" />
                      </div>
                      <Submit variant="orange">Transfer</Submit>
                    </form>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Academic History ── */}
      <div className="mt-8">
        <h2 className="mb-4 text-sm font-semibold text-slate-800 dark:text-slate-100">
          Academic History
        </h2>
        {allEnrollments.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">No enrollments yet.</p>
        ) : (
          <div className="space-y-3">
            {allEnrollments.map((sc) => {
              const teacher = sc.class.teachers[0]?.teacher;
              const statusStyle =
                STATUS_STYLES[sc.status] ?? STATUS_STYLES.DROPPED;
              const statusLabel =
                STATUS_LABELS[sc.status] ?? sc.status;

              return (
                <div
                  key={sc.id}
                  className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-900"
                >
                  {/* Header row */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3 dark:border-slate-700">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/classes/${sc.classId}`}
                        className="text-sm font-semibold text-blue-600 hover:underline dark:text-blue-400"
                      >
                        {sc.class.name}
                      </Link>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${statusStyle}`}
                      >
                        {statusLabel}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-4 text-xs text-slate-500 dark:text-slate-400">
                      {teacher && <span>Teacher: {teacher.fullName}</span>}
                      <span>Enrolled: {format(sc.startDate, "d MMM yyyy")}</span>
                      {sc.endDate && (
                        <span>Ended: {format(sc.endDate, "d MMM yyyy")}</span>
                      )}
                    </div>
                  </div>

                  {/* Score + status edit */}
                  <form
                    action={updateEnrollmentHistory}
                    className="flex flex-wrap items-end gap-4 px-5 py-3"
                  >
                    <input type="hidden" name="id" value={sc.id} />
                    <div>
                      <Label>Score</Label>
                      <select
                        name="score"
                        defaultValue={sc.score ?? ""}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="">— not set —</option>
                        {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((v) => (
                          <option key={v} value={v}>{v}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <Label>Status</Label>
                      <select
                        name="status"
                        defaultValue={sc.status}
                        className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                      >
                        <option value="ACTIVE">Active</option>
                        <option value="COMPLETED">Completed</option>
                        <option value="TRANSFERRED">Transferred</option>
                        <option value="DROPPED">Dropped</option>
                      </select>
                    </div>
                    <Submit variant="blue">Save</Submit>
                  </form>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
