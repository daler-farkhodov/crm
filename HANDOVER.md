# TutorCRM — Backend Handover Document

Generated for a backend rewrite. Covers every model, page, server action, and the
business rules that aren't obvious from field names alone. Where something looks
like a bug or a gap rather than an intentional design choice, it's called out
explicitly in **Known Issues** at the end — read that section before assuming any
odd-looking behavior is intentional.

## 1. Stack

- **Framework:** Next.js 15 (App Router, React 19), server actions for all writes
  (no separate REST/GraphQL API except one CSV export route).
- **DB:** Postgres via Prisma 5. Currently pointed at a remote Neon instance
  (`.env` `DATABASE_URL`/`DIRECT_URL`); `docker-compose.yml` defines a local
  Postgres on port 54332 as an alternative.
- **Auth:** Cookie-based, no password — see §4.
- **i18n:** Custom (not next-intl), 3 locales: en/ru/uz — see §5.
- **Testing:** Playwright e2e (`e2e/*.spec.ts`), no unit test suite.
- **Styling:** Tailwind, dark mode via class + `ThemeScript`.

## 2. Data Model (prisma/schema.prisma)

### Enums
| Enum | Values |
|---|---|
| `UserRole` | SUPER_ADMIN, ADMIN, TEACHER |
| `AttendanceStatus` | PRESENT, ABSENT_SERIOUS, ABSENT_NON_SERIOUS, SCHOOL_CLOSED, CLASS_CANCELED, TRIAL |
| `ClassRole` | TEACHER, ASSISTANT |
| `SalaryType` | PERCENTAGE, FIXED |
| `InvoiceStatus` | PENDING, PAID, CANCELLED |
| `LedgerType` | INVOICE, PAYMENT, CREDIT, DEBIT, ADJUSTMENT |
| `RecurringInterval` | WEEKLY, BIWEEKLY, MONTHLY |
| `EnrollmentStatus` | ACTIVE, COMPLETED, TRANSFERRED, DROPPED |

### Models

**User** — `id, email (unique), fullName, role, createdAt` · reverse relation to one `Teacher` (optional).

**Student** — `id, studentNumber (unique, autoincrement), fullName, phone?, parentName?, parentTitle?, parentPhone?, startDate, nextPaymentDue?, isActive (default true), createdAt` · relations: `classes (StudentClass[])`, `attendance[]`, `invoices[]`, `ledger[]`.

**Teacher** — `id, fullName, userId? (unique FK to User), createdAt` · relations: `classes (ClassTeacher[])`, `attendance[]`, `earnings (TeacherEarnings[])`, `advances (TeacherAdvance[])`, `fines (TeacherFine[])`, `overridesAsOriginal / overridesAsSubstitute (ClassTeacherOverride[])`.

**Room** — `id, name, isHidden (default false), createdAt` · relation: `classes[]`. Hiding a room removes its classes from the attendance calendar without deleting anything; deletion is blocked while any `Class.roomId` still points at it (see `deleteRoom`).

**Class** — `id, classNumber (unique, autoincrement), name, roomId?, startHour (def 9), startMinute (def 0), endHour (def 10), endMinute (def 0), pricePerMonth, scheduleDays: String[] (e.g. ["MON","WED","FRI"]), createdAt` · relations: `students (StudentClass[])`, `teachers (ClassTeacher[])`, `attendance[]`, `closures (SchoolClosure[])`, `teacherOverrides (ClassTeacherOverride[])`.

**StudentClass** (enrollment join table) — `id, studentId, classId, startDate, endDate?, customRate? (per-student price override), isFree (default false), score? (1–5 in 0.5 steps), status (EnrollmentStatus, default ACTIVE)`. `endDate: null` = currently active enrollment.

**ClassTeacher** (teacher assignment) — `id, classId, teacherId, role (default TEACHER), salaryType (default PERCENTAGE), percentage (default 0), fixedAmount?`.

**ClassTeacherOverride** (substitution record) — `id, classId, date, originalTeacherId, substituteTeacherId?, reason?, createdAt`. Represents "on this date, `originalTeacher` didn't teach; `substituteTeacher` may have covered." Drives salary reallocation in `generateTeacherSalaries`.

**Attendance** — `id, studentId, classId, teacherId? (who recorded it), date, status, isTrial (default false), createdAt`. This is the row that actually triggers billing DEBITs (see §3.3), not the invoice.

**Invoice** — `id, invoiceNumber (unique, autoincrement), studentId, periodStart, periodEnd, totalAmount, creditApplied, finalAmount, status (default PENDING), createdAt`. Purely a billing document — creating one does **not** touch the ledger (see §3.2).

**Ledger** — `id, studentId, type (LedgerType), amount, referenceId? (usually an Invoice.id), referenceType?, createdAt`. This is the single source of truth for what a student owes/has prepaid. See §3.1 for the sign convention — it's the single most important thing to get right in a rewrite.

**TeacherEarnings** — `id, teacherId, month, year, totalAmount, isPaid (default false), createdAt`. One row per teacher per month, produced either manually (`createTeacherEarning`) or in bulk (`generateTeacherSalaries`).

**TeacherAdvance** — `id, teacherId, amount, date, deductMonth, deductYear, isDeducted (default false), note?, createdAt`. A cash advance to be subtracted from a specific future month's earnings.

**TeacherFine** — `id, teacherId, classId?, date, amount, reason?, isWaived (default false), createdAt`.

**ExpenseType** — `id, name, createdAt` · relations to `expenses[]` and `recurringExpenses[]`.

**Expense** — `id, title, amount, date, category? (legacy free-text, superseded by expenseTypeId), note?, expenseTypeId?, createdAt`.

**RecurringExpense** — `id, title, amount, interval (RecurringInterval), nextDueDate, expenseTypeId?, isActive (default true), createdAt`. Materialized into `Expense` rows manually via a "Generate due" button — **there is no cron/scheduler**, see Known Issues.

**SchoolClosure** — `id, date, classId? (null = school-wide), reason?, isPaid (default false)`. Consumed by every session-counting helper in `billing-cycle.ts` to exclude closed days from proration/billing math.

**AuditLog** — `id, userId?, action, entity, entityId, createdAt`. Written by nearly every mutating action via `writeAudit()`, but never read back except on the raw `/audit` table — it isn't used for anything functional (no revert, no diffing of before/after values).

## 3. Core Business Logic

This is the part that matters most for a rewrite — the UI is straightforward CRUD, but the money math has several interacting rules.

### 3.1 Ledger sign convention (get this right first)

**Positive ledger balance = student has prepaid credit. Negative = student owes money.**
This is consistent everywhere in the actual code path:
- `attendance.ts`: a PRESENT (non-trial, non-free) session creates a `DEBIT` with a **negative** amount (`-debit`) — attending class costs the student money.
- `billing.ts` `updateInvoiceStatus`: marking an invoice PAID creates a `PAYMENT` with a **positive** amount (`+finalAmount`) — paying restores balance.
- `students.ts` `endEnrollment`: an early-drop refund creates a `CREDIT` with a **negative** amount (refund reduces what they'd already been charged, i.e. reduces the debt further into credit... actually nets against the debit — see 3.5).
- Every UI surface (`students/[id]/page.tsx`, `StudentInvoiceDueButton`, `DeleteStudentButton`, `InvoiceCreateForm`) treats `balance > 0` as credit (green) and `balance < 0` as owed (orange), and gates "you can generate an invoice" on `balance < 0`.

**Inconsistency to fix in the rewrite:** the manual ledger-entry form on `/ledger` (`ledger.amountHint` i18n string) tells admins to enter "`+` for charge, `–` for payment" — this is the **opposite** of the sign convention the automated code actually uses (charges/debits are negative, payments/credits are positive). An admin following that on-screen hint will post entries with inverted signs and silently corrupt a student's balance. `prisma/seed.ts` itself follows the *hint's* (wrong) convention, not the app's real one, which is why the seeded student's numbers look odd if you trace them by hand.

### 3.2 Invoices don't touch the ledger — only "PAID" does

`createInvoice` (manual) and `generateDueStudentInvoice` (automatic) both just insert an `Invoice` row. Nothing is posted to `Ledger` at creation time. The **only** ledger effect of the invoice lifecycle is in `updateInvoiceStatus`: transitioning to `PAID` posts a `PAYMENT` of `+finalAmount`. This means "outstanding debt" as shown on `/accounting` is computed from `sum(Invoice.finalAmount where status = PENDING)`, which is a **separate** number from the ledger balance — they are not reconciled against each other anywhere. A rewrite should decide whether these two "amount owed" concepts should be unified.

### 3.3 What actually charges a student day-to-day

Attendance, not invoices. `createAttendance` (attendance.ts): when a non-trial `PRESENT` record is created for a non-free enrollment, it:
1. Looks up the effective rate (`StudentClass.customRate ?? Class.pricePerMonth`).
2. Counts scheduled sessions in that calendar month for the class (`countScheduledSessionsInMonth`), excluding closures.
3. `debit = perClassCreditAmount(rate, sessionsInMonth) = round(rate / sessionsInMonth, 2)`.
4. Posts `Ledger{type: DEBIT, amount: -debit}` tagged `LEDGER_REF_ATTENDANCE_DEBIT`.

Deleting that attendance record deletes the matching ledger row(s) in the same transaction. `ABSENT_SERIOUS` used to generate a compensating credit (`LEDGER_REF_ATTENDANCE_SERIOUS_CREDIT` constant still exists) but no current code path creates that credit — it's a vestigial/legacy reference constant only.

### 3.4 Invoice generation & proration (`generateDueStudentInvoice`, billing.ts:65)

1. Establishes a per-student **billing anchor** = earliest `StudentClass.startDate` across all (even historical) enrollments (`billingAnchorFromEnrollments`).
2. `cycleIndex` = count of the student's existing PENDING/PAID invoices — i.e. this is their Nth invoice.
3. `billingPeriodForCycle(anchor, cycleIndex)` gives `[periodStart, periodEnd]` as calendar-month-length windows offset from the anchor (not real calendar months — anchor-relative).
4. Guards against a duplicate invoice for an overlapping period.
5. For every enrollment overlapping the period (including ones that already ended — mid-period drops/transfers still get billed for their partial window):
   - Skip if `isFree`.
   - `rate = customRate ?? class.pricePerMonth`.
   - Clip the enrollment's `[startDate, endDate]` to the period → `windowStart/windowEnd`.
   - `totalSessions = countSessionsBetween(scheduleDays, periodStart, periodEnd, closures)`, `windowSessions` = same over the clipped window.
   - `amount += rate * (windowSessions / totalSessions)`.
6. Round to cents. Bail if `<= 0`.
7. Apply existing prepaid credit: `creditApplied = min(totalAmount, max(0, currentBalance))`; `finalAmount = max(0, totalAmount - creditApplied)`.
8. Insert as `PENDING`. (No ledger write — see 3.2.)

`refreshStudentNextPaymentDue` (student-billing.ts) sets `Student.nextPaymentDue` to the **3rd scheduled session date** after enrollment, but **only while the student has zero PENDING/PAID invoices yet** — after their first invoice, this field stops being auto-maintained by this function (nothing else appears to update it going forward, which is itself worth checking during rewrite — it may go stale after the first billing cycle).

### 3.5 Early-drop refunds (`endEnrollment`, students.ts:258)

When an enrollment is ended mid-invoice-period (and not free): finds the invoice whose period contains `endDate`, computes sessions in `(endDate, periodEnd]` vs total sessions in the period, and refunds `rate * refundSessions/totalSessions` as a **negative** `CREDIT` ledger entry (`EarlyDropRefund`). Net effect: this nets *against* the DEBITs already posted by attendance during that period, rather than against the invoice itself (invoices, again, never post to the ledger).

### 3.6 Teacher pay

Two paths, both writing to `TeacherEarnings`:
- **Manual:** `createTeacherEarning` — admin types in a lump sum for a teacher/month.
- **Bulk generation:** `generateTeacherSalaries` (operations.ts:114–321) — the most complex function in the codebase:
  1. Pulls all PAID invoices overlapping the target month, all `ClassTeacherOverride`s, all classes+teachers, global closures (paid closures don't reduce pay; unpaid ones do), unpaid `TeacherAdvance`s targeting this month, and non-waived `TeacherFine`s dated this month.
  2. Attributes invoice income to classes proportionally to session overlap (same windowing logic as §3.4), including a **virtual income** contribution for free (`isFree`) enrollments at standard rate, so a teacher isn't penalized income-share-wise for having comped students in their class.
  3. Splits each class's attributed income across its teachers:
     - `FIXED` salary: `fixedAmount * (actualSessions / totalSessions)`, where `actualSessions` excludes sessions the teacher missed per `ClassTeacherOverride`; a substitute teacher is separately credited `(fixedAmount / totalSessions) * subSessionsCovered`.
     - `PERCENTAGE` salary: `(percentage/100) * classIncome * (actualSessions/totalSessions)`, with an analogous substitute credit.
  4. Subtracts that teacher's unpaid advances and unwaived fines for the month.
  5. **Upserts but does not overwrite**: if a `TeacherEarnings` row already exists for that teacher/month/year, it is left untouched (re-running this for an already-generated month is a no-op for existing rows, silently — worth flagging in a rewrite since there's no "regenerate" UX).
  6. Marks the consumed advances as `isDeducted = true`.

- **Fines:** not created directly by an admin form — only via `applyAttendanceFines` (operations.ts:414), which, given a `checkDate`, finds every class scheduled that day, and for each teacher on that class who has **no** attendance record logged for that date (and the day wasn't closed), creates a flat-amount `TeacherFine` with reason "Attendance not logged by midnight" (skips if a fine already exists for that teacher/date).

### 3.7 Recurring expenses — no scheduler

`generateDueRecurringExpenses` materializes any `RecurringExpense` with `nextDueDate <= today` into one `Expense` row (advancing `nextDueDate` by the interval — WEEKLY +7d, BIWEEKLY +14d, MONTHLY +1 calendar month) but is **only invoked by a manual "Generate due" button** on `/expenses?tab=recurring`. There is no cron job, Vercel cron config, or background worker anywhere in the repo.

## 4. Auth & Sessions

There is no password authentication. `/login` lists every `User` row in a `<select>`; picking one and submitting calls `loginAsUser` (auth.ts), which sets a plain, unsigned `crm_user_id` cookie (httpOnly, 30-day maxAge) to that user's id — no verification of identity at all. `getActorUserId()` (session.ts) just reads that cookie back for audit-log attribution.

**There is no server-side authorization anywhere.** `UserRole` (SUPER_ADMIN/ADMIN/TEACHER) is stored on `User` but never checked in any server action or page — `dashboard/layout.tsx` renders the same nav (including Users, Audit, Ledger, Teacher Pay) regardless of role, and no action verifies the caller's role before mutating data. Anyone who can set the cookie (or who is simply logged in as any user) has full admin access to every action. **This needs to be designed from scratch in a rewrite** if role separation is meant to be real.

## 5. i18n

Custom system under `src/i18n/` (not a library): `constants.ts` (locale list en/ru/uz), `messages/{en,ru,uz}.json` (flat-ish nested key trees), `messages.ts` (loader), `locale.ts` (reads/writes a `NEXT_LOCALE`-style cookie via `getLocale`/`setUserLocale` — actions/locale.ts), `t.ts` (server-side lookup by dotted key), `context.tsx` (`I18nProvider` + `useT()` hook for client components). Every page string goes through `t(m, "namespace.key")` server-side or `tt("namespace.key")` client-side — there is no dynamic/ICU interpolation beyond simple key lookup as far as observed.

## 6. Page-by-Page Reference

### `/login`
Server component. Lists all `User`s; form → `loginAsUser`. Second form → `logout` (clears cookie). Falls back to a `DbSetupNotice` component if the DB is unreachable (`isLikelyDbConnectivityIssue`).

### `/` (Dashboard)
Range picker (`DashboardDateBar`, default last 6 months, via `?from&to`). KPI cards: Income (`sum(Invoice.finalAmount where status=PAID, period overlaps range)`), Expenses (`sum(Expense.amount in range)`), Profit (income − expenses), plus distinct student/class/teacher counts touched by `Attendance` in range. `DashboardStudentCharts`: a joined/left line chart and a running-total bar chart, bucketed by day (≤62d range), month (≤730d), or year (bucketing logic client-computed from `Student.startDate` / `StudentClass.endDate` in range). Activity feed: last 6 `AuditLog` rows, color-coded by keyword in `action` (DELETE/FAIL=red, PAY=green, PENDING/CREATE=amber, else blue).

### `/students`
Filters (`StudentFilters`): status (active/inactive/all), class, "has debt" (`buildStudentWhere`/`debtStudentIdsFromLedger` in `lib/student-list.ts` — debt = negative ledger sum), enrollment start-date-from. Table columns: #, name (link), phone, class list, start date, active toggle (`StudentActiveToggle` → `setStudentActive`), balance (color-coded, same sign convention as §3.1), actions (View, `DeleteStudentButton`). CSV export button (`StudentsCsvExport`) hits `/api/students/export` with the same filter querystring. "Add Student" opens `AddStudentModal` → `StudentCreateForm` → `createStudentWithEnrollments` (creates student + 1..n initial enrollments in one transaction, then `refreshStudentNextPaymentDue`).

**`DeleteStudentButton`** is where `generateDueStudentInvoice` is actually wired up in the UI (see Known Issues — not where you'd expect): clicking "Delete" opens a confirm dialog; if balance > 0 it warns that deleting refunds the credit (creates an `ADJUSTMENT`); if balance < 0 it shows "Generate Invoice" (calls `generateDueStudentInvoice`) alongside "Delete Student" (`softDeleteStudent`, which also converts any *positive* balance to a refund `ADJUSTMENT` and closes all active enrollments).

### `/students/[id]`
Contact card (`ContactCard` → `updateStudentContact`, with phone/parentPhone uniqueness checks). Ledger card: last 20 entries + computed balance banner (green "prepaid credit" / orange "owes — invoice due"). Active enrollments: per-enrollment inline forms for custom rate (`updateEnrollmentSettings`), free/paying toggle (same action), and "End enrollment" (`endEnrollment`, triggers refund logic §3.5). Academic History: all enrollments (including ended) with editable score (0.5 steps, 1–5) and status (`updateEnrollmentHistory`). "Enroll to Class" modal → `enrollStudent`.

### `/classes`
KPI cards (class count, active-enrollment count, teacher-link count). Table: #, name, teacher(s), room, hours, active student count, price/month, view link. "Add class" modal (`AddClassModal`) → `createClass`.

### `/classes/[id]`
Edit-details form (name, room, time range, price, `scheduleDays` checkboxes, optional "lead teacher" which — if set — **deletes all existing `ClassTeacher` rows and replaces with a single 100%-share entry**, per `updateClassDetails`; also refreshes `nextPaymentDue` for every actively-enrolled student afterward). Students list (active enrollments). Teachers section: per-teacher inline salary-type/percentage/fixed editor (`updateClassTeacherShare`), remove (`removeClassTeacher`), add-teacher form (`assignClassTeacher`). Assistants section (role=ASSISTANT, fixed salary only). Teacher-override table + add form (`createTeacherOverride`/`deleteTeacherOverride`) — records a substitution for a specific date, consumed by `generateTeacherSalaries`.

### `/attendance`
Two tabs: **Calendar** (grid of room × hour for a selected day, cells show scheduled classes + attendance counts + cancellation markers; driven by `AttendanceTabs`/`CancelClassModal` client components → `createAttendance`/`deleteAttendance`/`cancelClass`) and **Students** (date-range aggregate present/absent counts per student). `cancelClass` (attendance.ts:130) bulk-creates `SchoolClosure` + `SCHOOL_CLOSED`/`CLASS_CANCELED` attendance rows for every affected enrollment across one or more dates/classes (or the whole school).

### `/invoices`
Table of all invoices (student, period, total, credit, final, status, inline status-change form → `updateInvoiceStatus`). "Create invoice" modal (`InvoiceCreateModal`/`InvoiceCreateForm`): student autocomplete, class picker (defaults total to class price, auto-fills credit as `min(positiveBalance, total)`), submits to `createInvoice` (manual/no-proration path — distinct from `generateDueStudentInvoice`).

### `/ledger`
Manual entry form (student, `LedgerType`, amount, optional invoice ref, note) → `createLedgerEntry` (see §3.1's sign-hint caveat). Table: last 50 entries.

### `/accounting`
Tabs: All / Income / Expenses, each with its own date range (default current month) and KPI cards (Income/Expenses/Balance, or Income/Outstanding-debt). Income table = PAID invoices in range; "Income by class" splits each invoice evenly across the student's classes active during the invoice period (approximation, not proportional to actual per-class cost). Expenses table includes both real `Expense` rows and `TeacherEarnings` rows tagged as salary (inline-editable amount → `updateExpense`/`updateTeacherEarningAmount`, delete → `deleteExpense`; salary rows are editable but not deletable here). 6-month trend chart (`AccountingChart`). "Add expense" modal (`AddExpenseModal`) → `createExpense` (supports picking an `ExpenseType` or a one-off custom type name).

### `/expenses`
Tab query-param (`?tab=one-time|recurring`). One-time: add form → `createExpense`, table with delete (`deleteExpense`). Recurring: add form (title/amount/interval/nextDueDate/type) → `createRecurringExpense`, "Generate due" button → `generateDueRecurringExpenses` (§3.7 — manual only), per-row pause/resume (`toggleRecurringExpenseActive`) and delete (`deleteRecurringExpense`).

### `/teacher-pay`
Three sections: **Earnings** (add accrual → `createTeacherEarning`; mark paid/unpaid → `toggleTeacherEarningPaid`); **Advances** (add → `createTeacherAdvance`, shows Pending/Deducted badge, delete → `deleteTeacherAdvance`); **Fines** (no manual "add" form — populated only by `applyAttendanceFines`, given a check-date + flat fine amount; per-row waive/reinstate → `waiverTeacherFine`, delete → `deleteTeacherFine`). Note: `generateTeacherSalaries` (the bulk monthly calculator, §3.6) is **not wired to any button on this page** in the files reviewed — confirm whether it's invoked elsewhere or is effectively dead/unreachable from the UI.

### `/closures`
Add form (date, class scope — blank = school-wide, reason, paid/unpaid) → `createClosure`; table with delete (`deleteClosure`).

### `/teachers`
Add form (full name) → `createTeacher`. Table: name (inline rename → `updateTeacher`), linked user (dropdown + link button → `linkTeacherUser`), classes list with % share.

### `/users`
Add form (email, full name, role) → `createUser`. Table: name, email, role, created date. (No edit/delete observed.)

### `/audit`
Read-only table of the last 100 `AuditLog` rows (when, user id, action, entity, entity id).

### `/settings`
`RoomsManager` (create/rename/hide/delete rooms, with guardrails: hide warns if the room has classes, delete is blocked outright if the room has classes) and `ExpenseTypesManager` (create/delete expense categories). Profile and Organization sections are **hardcoded display-only stubs** ("Admin User" / "admin@tutorcrm.com" / "TutorCRM Learning Center" / timezone "ET") — not backed by real data or forms.

### Layout / Navigation (`layout.tsx` + `AppShell`)
Collapsible sidebar (state persisted in `localStorage`), main nav (Dashboard/Students/Teachers/Classes/Attendance/Invoices/Accounting/Settings) always visible, "admin" links (Ledger/Teacher Pay/Expenses/Closures/Users/Audit) shown in the same sidebar with **no role-based filtering** (see §4). Language switcher (en/ru/uz) and light/dark theme toggle live in the sidebar footer.

## 7. Server Actions Reference (by file)

Full inputs/guards/side-effects for every function are in §3 where they involve money logic; this table is the quick index for everything else.

| File | Exports |
|---|---|
| `actions/billing.ts` | `createInvoice`, `generateDueStudentInvoice`, `updateInvoiceStatus`, `createLedgerEntry` |
| `actions/students.ts` | `createStudentWithEnrollments`, `setStudentActive`, `updateStudent`, `updateStudentContact`, `softDeleteStudent`, `enrollStudent`, `updateEnrollmentHistory`, `endEnrollment`, `returnStudentRefund`, `updateEnrollmentSettings` |
| `actions/classes.ts` | `createClass`, `updateClass`, `updateClassDetails`, `assignClassTeacher`, `updateClassTeacherShare`, `removeClassTeacher`, `createTeacherOverride`, `deleteTeacherOverride` |
| `actions/attendance.ts` | `createAttendance`, `deleteAttendance`, `cancelClass` |
| `actions/operations.ts` | `createTeacherEarning`, `toggleTeacherEarningPaid`, `createExpense`, `updateExpense`, `createExpenseType`, `deleteExpenseType`, `generateTeacherSalaries`, `updateTeacherEarningAmount`, `deleteExpense`, `createClosure`, `deleteClosure`, `createUser`, `createTeacherAdvance`, `deleteTeacherAdvance`, `applyAttendanceFines`, `waiverTeacherFine`, `deleteTeacherFine`, `createRecurringExpense`, `toggleRecurringExpenseActive`, `deleteRecurringExpense`, `generateDueRecurringExpenses` |
| `actions/teachers.ts` | `createTeacher`, `updateTeacher`, `linkTeacherUser` |
| `actions/rooms.ts` | `createRoom`, `updateRoomName`, `setRoomHidden`, `deleteRoom` |
| `actions/auth.ts` | `loginAsUser`, `logout` |
| `actions/locale.ts` | `setUserLocale` |

Common patterns across nearly all of them: read `FormData`, validate required fields with an early silent `return` (no error surfaced to the user on failure in most non-`useActionState` forms), write via Prisma, call `writeAudit(actorId, action, entity, entityId)`, call one or more `revalidatePath(...)`. Multi-step mutations (`createStudentWithEnrollments`, `updateClassDetails`, `endEnrollment`, `createAttendance`/`deleteAttendance`, `generateTeacherSalaries`) wrap the DB work in `prisma.$transaction`.

## 8. API Routes

Only one: `GET /api/students/export` (`src/app/api/students/export/route.ts`). Requires the `crm_user_id` cookie to be present (401 otherwise — this is the *only* place in the app that checks for a logged-in session rather than just reading it for attribution). Reuses `buildStudentWhere`/`debtStudentIdsFromLedger` (`lib/student-list.ts`) so its filtering exactly matches the `/students` page's querystring filters, then streams a CSV (id, name, classes, start date, active, balance, next payment due).

## 9. Known Issues / Gaps Found During This Audit

Flagging these because they'll shape rewrite decisions — none of these are things I changed, just things observed while reading the code:

1. **Ledger manual-entry UI hint is inverted** (§3.1). The `/ledger` page's amount-hint text tells admins the opposite sign convention from what every automated code path uses. High risk of admins silently corrupting balances.
2. **No authorization anywhere** (§4). `UserRole` is stored but never checked; login is a dropdown with no credential. Every page/action is reachable by anyone with the session cookie.
3. **`StudentInvoiceDueButton.tsx` is dead code** — fully built (props, i18n labels `students.invoice.*`) but not imported/rendered anywhere. The actual "generate invoice for a student who owes" entry point is buried inside `DeleteStudentButton`'s delete-confirmation dialog, which is a confusing place to put a non-destructive billing action.
4. **`generateTeacherSalaries` (the bulk monthly payroll calculator) doesn't appear wired to any button** on `/teacher-pay` — worth confirming whether it's dead, reachable some other way, or genuinely missing from the UI.
5. **No scheduler/cron anywhere.** Recurring expenses (§3.7) require a manual click; there's no automatic monthly invoice generation either — `generateDueStudentInvoice` is per-student and manually triggered.
6. **Two disconnected "amount owed" concepts**: ledger balance vs. `sum(PENDING invoice.finalAmount)` (§3.2). They can diverge since invoices don't post to the ledger until paid.
7. **`Student.nextPaymentDue` goes stale after the first invoice** — `refreshStudentNextPaymentDue` only maintains it pre-first-invoice; confirm what (if anything) updates it afterward before relying on it in a rewrite.
8. **`AuditLog` is write-only** — nothing reads it for anything functional (no revert/diff), it only powers the `/audit` table and the dashboard's last-6-actions widget.
9. **Settings → Profile/Organization sections are hardcoded stubs**, not real data.
10. **`Expense.category` is a legacy free-text field** superseded by `expenseTypeId`/`ExpenseType`, both still present in the schema.
