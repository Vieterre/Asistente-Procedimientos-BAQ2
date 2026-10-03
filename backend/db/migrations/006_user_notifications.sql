CREATE TABLE user_notifications (
  id UUID PRIMARY KEY,
  recipient_user_id UUID NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
  procedure_id UUID NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('procedure_submitted_for_review', 'procedure_evaluation_started')),
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at TIMESTAMPTZ
);

CREATE INDEX user_notifications_recipient_created_idx
  ON user_notifications (recipient_user_id, created_at DESC);
CREATE INDEX user_notifications_unread_idx
  ON user_notifications (recipient_user_id, created_at DESC)
  WHERE read_at IS NULL;
CREATE INDEX audit_events_analytics_idx
  ON audit_events (created_at DESC, event_type)
  WHERE entity_type = 'procedure';

UPDATE processes AS p SET name = catalog.name
  FROM (VALUES
    ('PD', 'Gestión del Desarrollo Económico'),
    ('GT', 'Gestión del Turismo'),
    ('DE', 'Direccionamiento Estratégico y Planeación'),
    ('GC', 'Gestión de la Comunicación'),
    ('TIC', 'Gestión de las Tecnologías e Información'),
    ('GF', 'Gestión de Recursos Financieros'),
    ('GCT', 'Gestión de la Contratación'),
    ('GI', 'Gestión de la Infraestructura Física'),
    ('GD', 'Gestión Documental'),
    ('GH', 'Gestión Humana y SST'),
    ('GJ', 'Gestión Jurídica'),
    ('EI', 'Evaluación Independiente'),
    ('GDI', 'Gestión Disciplinaria')
  ) AS catalog(code, name)
 WHERE p.code = catalog.code;
