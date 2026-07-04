-- AlterTable Student
CREATE SEQUENCE "Student_studentNumber_seq";
ALTER TABLE "Student" ADD COLUMN "studentNumber" INTEGER NOT NULL DEFAULT nextval('"Student_studentNumber_seq"');
ALTER SEQUENCE "Student_studentNumber_seq" OWNED BY "Student"."studentNumber";
CREATE UNIQUE INDEX "Student_studentNumber_key" ON "Student"("studentNumber");

ALTER TABLE "Student" ADD COLUMN "nextPaymentDue" TIMESTAMP(3);

-- AlterTable Class
CREATE SEQUENCE "Class_classNumber_seq";
ALTER TABLE "Class" ADD COLUMN "classNumber" INTEGER NOT NULL DEFAULT nextval('"Class_classNumber_seq"');
ALTER SEQUENCE "Class_classNumber_seq" OWNED BY "Class"."classNumber";
CREATE UNIQUE INDEX "Class_classNumber_key" ON "Class"("classNumber");

ALTER TABLE "Class" ADD COLUMN "scheduleDays" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
