-- Ledger.referenceId is polymorphic: it holds an Invoice.id for
-- PAYMENT/ADJUSTMENT rows (referenceType "Invoice") but also holds an
-- Attendance.id for attendance-driven DEBIT rows (attendance.ts) and a
-- StudentClass.id for early-drop/transfer CREDIT rows (students.ts). The
-- original FK to "Invoice" only ever matched the first case, so every write
-- of a non-invoice reference (i.e. every attendance PRESENT debit, every
-- early-drop refund) violated the constraint and rolled back the whole
-- transaction. Drop it — there is no single table referenceId can validly
-- reference.
ALTER TABLE "Ledger" DROP CONSTRAINT IF EXISTS "Ledger_referenceId_fkey";
