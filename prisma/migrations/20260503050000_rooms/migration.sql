-- Create Room table
CREATE TABLE "Room" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "isHidden" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Room_pkey" PRIMARY KEY ("id")
);

-- Add roomId to Class
ALTER TABLE "Class" ADD COLUMN "roomId" TEXT;

-- Migrate existing room string values: one Room row per distinct name
INSERT INTO "Room" ("id", "name")
SELECT gen_random_uuid()::text, room
FROM "Class"
WHERE room IS NOT NULL
GROUP BY room;

-- Link each Class to its Room by matching on name
UPDATE "Class" c
SET "roomId" = r."id"
FROM "Room" r
WHERE r."name" = c."room";

-- Add foreign key
ALTER TABLE "Class" ADD CONSTRAINT "Class_roomId_fkey"
  FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Drop old room string column
ALTER TABLE "Class" DROP COLUMN "room";
