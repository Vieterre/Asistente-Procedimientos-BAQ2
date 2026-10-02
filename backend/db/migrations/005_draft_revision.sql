ALTER TABLE procedures ADD COLUMN revision INTEGER NOT NULL DEFAULT 1;

INSERT INTO processes (code, name) VALUES
  ('PD', 'Gestion del Desarrollo Economico'),
  ('GT', 'Gestion del Turismo'),
  ('DE', 'Direccionamiento Estrategico y Planeacion'),
  ('GC', 'Gestion de la Comunicacion'),
  ('TIC', 'Gestion de las Tecnologias e Informacion'),
  ('GF', 'Gestion de Recursos Financieros'),
  ('GCT', 'Gestion de la Contratacion'),
  ('GI', 'Gestion de la Infraestructura Fisica'),
  ('GD', 'Gestion Documental'),
  ('GH', 'Gestion Humana y SST'),
  ('GJ', 'Gestion Juridica'),
  ('EI', 'Evaluacion Independiente'),
  ('GDI', 'Gestion Disciplinaria')
ON CONFLICT (code) DO NOTHING;
