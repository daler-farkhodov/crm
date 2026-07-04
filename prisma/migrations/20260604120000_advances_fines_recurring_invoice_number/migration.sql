-- Item 7: invoice auto-numbering
CREATE SEQUENCE "Invoice_invoiceNumber_seq";
ALTER TABLE "Invoice" ADD COLUMN "invoiceNumber" INTEGER NOT NULL DEFAULT nextval('"Invoice_invoiceNumber_seq"');
ALTER SEQUENCE "Invoice_invoiceNumber_seq" OWNED BY "Invoice"."invoiceNumber";
CREATE UNIQUE INDEX "Invoice_invoiceNumber_key" ON "Invoice"("invoiceNumber");

-- Item 9: paid vs unpaid closures
ALTER TABLE "SchoolClosure" ADD COLUMN "isPaid" BOOLEAN NOT NULL DEFAULT false;

-- Item 2: teacher advances
CREATE TABLE "TeacherAdvance" (
  "id"          TEXT NOT NULL,
  "teacherId"   TEXT NOT NULL,
  "amount"      DOUBLE PRECISION NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "deductMonth" INTEGER NOT NULL,
  "deductYear"  INTEGER NOT NULL,
  "isDeducted"  BOOLEAN NOT NULL DEFAULT false,
  "note"        TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherAdvance_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TeacherAdvance" ADD CONSTRAINT "TeacherAdvance_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Item 10: teacher fines
CREATE TABLE "TeacherFine" (
  "id"        TEXT NOT NULL,
  "teacherId" TEXT NOT NULL,
  "classId"   TEXT,
  "date"      TIMESTAMP(3) NOT NULL,
  "amount"    DOUBLE PRECISION NOT NULL,
  "reason"    TEXT,
  "isWaived"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeacherFine_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "TeacherFine" ADD CONSTRAINT "TeacherFine_teacherId_fkey"
  FOREIGN KEY ("teacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Item 17: recurring interval enum + recurring expenses
CREATE TYPE "RecurringInterval" AS ENUM ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
CREATE TABLE "RecurringExpense" (
  "id"            TEXT NOT NULL,
  "title"         TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "interval"      "RecurringInterval" NOT NULL,
  "nextDueDate"   TIMESTAMP(3) NOT NULL,
  "expenseTypeId" TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "RecurringExpense_pkey" PRIMARY KEY ("id")
);
ALTER TABLE "RecurringExpense" ADD CONSTRAINT "RecurringExpense_expenseTypeId_fkey"
  FOREIGN KEY ("expenseTypeId") REFERENCES "ExpenseType"("id") ON DELETE SET NULL ON UPDATE CASCADE;
