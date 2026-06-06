-- ORCradar — horário de funcionamento do lead (dias + abre/fecha), vindo do Google.
-- Texto multi-linha: "Segunda: 08:00-18:00\nTerça: ...". Aplicada no projeto ERP.
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS horario_funcionamento TEXT;
