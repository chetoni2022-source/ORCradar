-- =============================================================================
-- ORCradar — Fase 0 — tabelas de prospecção
-- Aplicada no projeto Supabase "ERP" (ref tcgwkazgelkonnuyebls), o MESMO do ORCtech.
-- =============================================================================
-- Decisões confirmadas com o dono antes de aplicar:
--  1) Regra de superadmin no RLS = is_platform_owner()  (mesma regra que a
--     crm_leads já usava; libera quem está em platform_admins com is_owner OU
--     can_access_crm — hoje só chetoni2022@gmail.com).
--  2) crm_leads JÁ EXISTIA e é usada pelo CRM do SuperAdmin do ORCtech, então
--     foi ESTENDIDA de forma não destrutiva (ADD COLUMN IF NOT EXISTS), sem
--     alterar colunas/defaults existentes (etapa, origem, ultimo_contato_at).
-- Escopo: o ORCradar só toca crm_leads e radar_regioes. Nenhuma tabela do
-- produto ORCtech (quotes, customers, products, services, tenants...) foi tocada.
-- =============================================================================

-- 1) Colunas do ORCradar que faltavam na crm_leads ---------------------------
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS instagram          TEXT,
  ADD COLUMN IF NOT EXISTS cidade             TEXT,
  ADD COLUMN IF NOT EXISTS tem_site           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS num_avaliacoes     INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nota_media         NUMERIC(2,1),
  ADD COLUMN IF NOT EXISTS tem_fotos          BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS score              INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS score_cor          TEXT    DEFAULT 'vermelho',
  ADD COLUMN IF NOT EXISTS mensagem_whatsapp  TEXT,
  ADD COLUMN IF NOT EXISTS tom_mensagem       TEXT,
  ADD COLUMN IF NOT EXISTS regiao             TEXT,
  ADD COLUMN IF NOT EXISTS latitude           NUMERIC,
  ADD COLUMN IF NOT EXISTS longitude          NUMERIC,
  ADD COLUMN IF NOT EXISTS tentativas_contato INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS aprovado           BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS duplicado          BOOLEAN DEFAULT FALSE;

-- Índices da Fase 0 (crm_leads)
CREATE INDEX IF NOT EXISTS idx_crm_leads_etapa    ON public.crm_leads(etapa);
CREATE INDEX IF NOT EXISTS idx_crm_leads_regiao   ON public.crm_leads(regiao);
CREATE INDEX IF NOT EXISTS idx_crm_leads_score    ON public.crm_leads(score DESC);
CREATE INDEX IF NOT EXISTS idx_crm_leads_telefone ON public.crm_leads(telefone);

-- 2) radar_regioes (nova — exclusiva do ORCradar) ----------------------------
CREATE TABLE IF NOT EXISTS public.radar_regioes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT,
  centro_lat        NUMERIC NOT NULL,
  centro_lng        NUMERIC NOT NULL,
  raio_km           NUMERIC NOT NULL,
  segmento          TEXT,
  leads_encontrados INTEGER DEFAULT 0,
  leads_aprovados   INTEGER DEFAULT 0,
  leads_fechados    INTEGER DEFAULT 0,
  data_prospeccao   TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE public.radar_regioes IS
  'ORCradar — regiões (raio no mapa) prospectadas. Só super_admin (is_platform_owner) acessa.';

-- 3) RLS da radar_regioes — mesma regra da crm_leads -------------------------
ALTER TABLE public.radar_regioes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "radar_regioes_owner_all" ON public.radar_regioes;
CREATE POLICY "radar_regioes_owner_all" ON public.radar_regioes
  FOR ALL
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());
