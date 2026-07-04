-- ═══════════════════════════════════════════════════════════════════════
-- Step 1: additive changes — new enums, new tables, new nullable columns.
-- Safe to run without downtime.
-- ═══════════════════════════════════════════════════════════════════════

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'TRANSFER');

-- CreateEnum
CREATE TYPE "TeacherLedgerType" AS ENUM ('ACCRUAL', 'PAYOUT', 'ADVANCE_DEDUCTION', 'FINE_DEDUCTION');

-- CreateTable
CREATE TABLE "AssistantAttendance" (
    "id" TEXT NOT NULL,
    "classTeacherId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "present" BOOLEAN NOT NULL DEFAULT false,
    "recordedByTeacherId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssistantAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLine" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeacherLedger" (
    "id" TEXT NOT NULL,
    "teacherId" TEXT NOT NULL,
    "classId" TEXT,
    "date" TIMESTAMP(3),
    "type" "TeacherLedgerType" NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeacherLedger_pkey" PRIMARY KEY ("id")
);

-- AlterTable: Invoice — correction/"rewritten" invoice support
ALTER TABLE "Invoice" ADD COLUMN "originalInvoiceId" TEXT;
ALTER TABLE "Invoice" ADD COLUMN "returnedAmount" DOUBLE PRECISION;

-- AlterTable: Ledger — class attribution + cash/transfer tracking
ALTER TABLE "Ledger" ADD COLUMN "classId" TEXT;
ALTER TABLE "Ledger" ADD COLUMN "paymentMethod" "PaymentMethod";

-- AlterTable: TeacherEarnings — cash/transfer tracking
ALTER TABLE "TeacherEarnings" ADD COLUMN "paymentMethod" "PaymentMethod" DEFAULT 'CASH';
ALTER TABLE "TeacherEarnings" ADD COLUMN "isSplit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TeacherEarnings" ADD COLUMN "cashAmount" DOUBLE PRECISION;
ALTER TABLE "TeacherEarnings" ADD COLUMN "transferAmount" DOUBLE PRECISION;

-- AlterTable: Expense — teacher pre-payments (replaces TeacherAdvance) + cash/transfer tracking
ALTER TABLE "Expense" ADD COLUMN "teacherId" TEXT;
ALTER TABLE "Expense" ADD COLUMN "deductMonth" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "deductYear" INTEGER;
ALTER TABLE "Expense" ADD COLUMN "isDeducted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH';
ALTER TABLE "Expense" ADD COLUMN "isSplit" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Expense" ADD COLUMN "cashAmount" DOUBLE PRECISION;
ALTER TABLE "Expense" ADD COLUMN "transferAmount" DOUBLE PRECISION;

-- AddForeignKey
ALTER TABLE "AssistantAttendance" ADD CONSTRAINT "AssistantAttendance_classTeacherId_fkey" FOREIGN KEY ("classTeacherId") REFERENCES "ClassTeacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AssistantAttendance" ADD CONSTRAINT "AssistantAttendance_recordedByTeacherId_fkey" FOREIGN KEY ("recordedByTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceLine" ADD CONSTRAINT "InvoiceLine_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeacherLedger" ADD CONSTRAINT "TeacherLedger_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeacherLedger" ADD CONSTRAINT "TeacherLedger_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_originalInvoiceId_fkey" FOREIGN KEY ("originalInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Ledger" ADD CONSTRAINT "Ledger_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Expense" ADD CONSTRAINT "Expense_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- Step 2: data migration — backfill TeacherAdvance rows into Expense rows
-- (Item 2 in the handover: teacher pre-payments now live as Expense rows
-- with teacherId set, instead of a dedicated TeacherAdvance model).
-- ═══════════════════════════════════════════════════════════════════════

INSERT INTO "Expense" (
  "id", "title", "amount", "date", "note", "teacherId",
  "deductMonth", "deductYear", "isDeducted", "paymentMethod", "createdAt"
)
SELECT
  ta."id",
  'Pre-payment — ' || t."fullName",
  ta."amount",
  ta."date",
  ta."note",
  ta."teacherId",
  ta."deductMonth",
  ta."deductYear",
  ta."isDeducted",
  'CASH',
  ta."createdAt"
FROM "TeacherAdvance" ta
JOIN "Teacher" t ON t."id" = ta."teacherId";

-- ═══════════════════════════════════════════════════════════════════════
-- Step 3: guarded lossy step — drop ClassTeacherOverride rows that have no
-- substitute assigned, since substituteTeacherId is about to become
-- required (Item: mandatory override substitutes). RAISE NOTICE reports
-- the row count being dropped so this is visible in migration output
-- before it runs — inspect these rows first if the count is non-zero.
-- ═══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  affected_count INTEGER;
BEGIN
  SELECT count(*) INTO affected_count FROM "ClassTeacherOverride" WHERE "substituteTeacherId" IS NULL;
  RAISE NOTICE 'Deleting % ClassTeacherOverride row(s) with no substituteTeacherId', affected_count;
END $$;

DELETE FROM "ClassTeacherOverride" WHERE "substituteTeacherId" IS NULL;

-- ═══════════════════════════════════════════════════════════════════════
-- Step 4: enforce mandatory substitute — drop the old nullable FK, make
-- the column required, re-add the FK as RESTRICT (matches originalTeacherId).
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "ClassTeacherOverride" DROP CONSTRAINT "ClassTeacherOverride_substituteTeacherId_fkey";
ALTER TABLE "ClassTeacherOverride" ALTER COLUMN "substituteTeacherId" SET NOT NULL;
ALTER TABLE "ClassTeacherOverride" ADD CONSTRAINT "ClassTeacherOverride_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ═══════════════════════════════════════════════════════════════════════
-- Step 5: drop TeacherAdvance — fully replaced by Expense.teacherId above.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE "TeacherAdvance" DROP CONSTRAINT "TeacherAdvance_teacherId_fkey";
DROP TABLE "TeacherAdvance";
