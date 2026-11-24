-- The original creator remains immutable. NULL keeps existing procedures assigned
-- to their creator without rewriting their content, revision or workflow dates.
ALTER TABLE procedures ADD COLUMN responsible_user_id UUID REFERENCES app_users(id);
CREATE INDEX procedures_responsible_user_idx
  ON procedures ((COALESCE(responsible_user_id, created_by_user_id)));

ALTER TABLE user_notifications DROP CONSTRAINT user_notifications_event_type_check;
ALTER TABLE user_notifications ADD CONSTRAINT user_notifications_event_type_check
  CHECK (event_type IN (
    'procedure_submitted_for_review', 'procedure_evaluation_started',
    'procedure_returned_for_corrections', 'procedure_favorable_concept_issued',
    'procedure_unfavorable_concept_issued', 'procedure_formally_approved',
    'procedure_returned_by_administration', 'procedure_responsibility_reassigned'
  ));
