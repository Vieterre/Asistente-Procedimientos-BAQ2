ALTER TABLE user_notifications
  DROP CONSTRAINT user_notifications_event_type_check;

ALTER TABLE user_notifications
  ADD CONSTRAINT user_notifications_event_type_check CHECK (event_type IN (
    'procedure_submitted_for_review',
    'procedure_evaluation_started',
    'procedure_returned_for_corrections',
    'procedure_favorable_concept_issued',
    'procedure_unfavorable_concept_issued'
  ));
