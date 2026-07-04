-- Classes per billing month (for per-class credit on serious absence: price / classesPerMonth)
ALTER TABLE "Class" ADD COLUMN "classesPerMonth" INTEGER NOT NULL DEFAULT 12;
