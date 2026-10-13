DO $$
BEGIN
  IF EXISTS (
    SELECT 1
      FROM procedures
     GROUP BY lower(regexp_replace(btrim(name), '\s+', ' ', 'g'))
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'No se puede aplicar 009_procedure_names: existen nombres de procedimientos duplicados.';
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS procedures_name_normalized_unique
  ON procedures (lower(regexp_replace(btrim(name), '\s+', ' ', 'g')));
