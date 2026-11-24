ALTER TABLE "BlogPost"
  ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'GUIDE',
  ADD COLUMN IF NOT EXISTS "coverImage" TEXT,
  ADD COLUMN IF NOT EXISTS "coverCaption" TEXT,
  ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "sourceUrl" TEXT;

CREATE INDEX IF NOT EXISTS "BlogPost_published_category_date_idx"
  ON "BlogPost"("published", "category", "date");
