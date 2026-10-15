WITH latest_evaluation AS (
  SELECT DISTINCT ON (procedure_id) procedure_id, status, updated_at
    FROM evaluations
   ORDER BY procedure_id, created_at DESC, id DESC
)
UPDATE procedures p
   SET status = 'pendiente_visto_bueno_administrativo',
       technical_reviewed_at = COALESCE(p.technical_reviewed_at, latest_evaluation.updated_at),
       updated_at = now()
  FROM latest_evaluation
 WHERE p.id = latest_evaluation.procedure_id
   AND p.status = 'concepto_favorable'
   AND latest_evaluation.status = 'concepto_favorable';
