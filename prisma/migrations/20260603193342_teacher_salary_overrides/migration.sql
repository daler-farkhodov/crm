-- CreateEnum
CREATE TYPE "SalaryType" AS ENUM ('PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "ClassRole" AS ENUM ('TEACHER', 'ASSISTANT');

-- AlterTable
ALTER TABLE "ClassTeacher" ADD COLUMN     "fixedAmount" DOUBLE PRECISION,
ADD COLUMN     "role" "ClassRole" NOT NULL DEFAULT 'TEACHER',
ADD COLUMN     "salaryType" "SalaryType" NOT NULL DEFAULT 'PERCENTAGE',
ALTER COLUMN "percentage" SET DEFAULT 0;

-- CreateTable
CREATE TABLE "ClassTeacherOverride" (
    "id" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "originalTeacherId" TEXT NOT NULL,
    "substituteTeacherId" TEXT,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ClassTeacherOverride_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "ClassTeacherOverride" ADD CONSTRAINT "ClassTeacherOverride_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherOverride" ADD CONSTRAINT "ClassTeacherOverride_originalTeacherId_fkey" FOREIGN KEY ("originalTeacherId") REFERENCES "Teacher"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ClassTeacherOverride" ADD CONSTRAINT "ClassTeacherOverride_substituteTeacherId_fkey" FOREIGN KEY ("substituteTeacherId") REFERENCES "Teacher"("id") ON DELETE SET NULL ON UPDATE CASCADE;
