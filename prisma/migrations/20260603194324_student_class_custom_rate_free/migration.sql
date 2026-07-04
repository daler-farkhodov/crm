-- AlterTable
ALTER TABLE "StudentClass" ADD COLUMN     "customRate" DOUBLE PRECISION,
ADD COLUMN     "isFree" BOOLEAN NOT NULL DEFAULT false;
