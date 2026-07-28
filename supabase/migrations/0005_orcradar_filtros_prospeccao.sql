-- ORCradar — filtros de prospecção por região (raspagem mais estratégica).
-- Ficam na região pra valerem também na raspagem AGENDADA (cron).
-- Aplicada no projeto "ERP" (tcgwkazgelkonnuyebls).
ALTER TABLE public.radar_regioes
  ADD COLUMN IF NOT EXISTS nota_minima      NUMERIC(2,1) DEFAULT 0,     -- 0 = qualquer nota
  ADD COLUMN IF NOT EXISTS min_avaliacoes   INTEGER      DEFAULT 0,     -- 0 = qualquer
  ADD COLUMN IF NOT EXISTS so_sem_site      BOOLEAN      DEFAULT FALSE, -- só quem não tem site
  ADD COLUMN IF NOT EXISTS exigir_telefone  BOOLEAN      DEFAULT FALSE; -- descarta sem telefone
