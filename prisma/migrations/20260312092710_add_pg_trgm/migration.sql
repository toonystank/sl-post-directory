CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "PostOffice_name_trgm_idx" ON "PostOffice" USING GIN ("name" gin_trgm_ops);