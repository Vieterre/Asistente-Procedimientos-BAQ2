CREATE UNIQUE INDEX IF NOT EXISTS procedures_code_unique
  ON procedures (code)
  WHERE code IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'procedures_code_format_check'
  ) THEN
    ALTER TABLE procedures
      ADD CONSTRAINT procedures_code_format_check
      CHECK (code IS NULL OR code ~ '^[A-Z]{2,3}-P-[0-9]{3}$');
  END IF;
END $$;
