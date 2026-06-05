-- =============================================================================
-- ORCradar — Fase 5 — handoff pro CRM da ORCtech + instagram/site + dedup
-- Aplicada no projeto Supabase "ERP" (ref tcgwkazgelkonnuyebls), o MESMO do ORCtech.
-- =============================================================================
-- Escopo: o ORCradar só toca crm_leads e radar_regioes. Tudo aqui é ADITIVO /
-- não destrutivo. A RLS de crm_leads já é owner-only (is_platform_owner()), então
-- as colunas novas herdam a policy FOR ALL existente (nada a fazer de RLS).
--
-- Modelo de etapas do ORCradar (a coluna etapa NÃO tem mais CHECK — Fase 0):
--   'triagem'     → lead cru, raspado, ainda em revisão no ORCradar.
--                   NÃO existe em crm_stages → fica fora do funil "vivo" do CRM.
--   'a_contatar'  → lead aprovado e ENVIADO pro CRM da ORCtech (entra no funil).
--   'perdido'     → descartado.
-- =============================================================================

-- 1) Colunas novas que o ORCradar precisa --------------------------------------
ALTER TABLE public.crm_leads
  ADD COLUMN IF NOT EXISTS site_url        TEXT,                    -- URL do site (clicável)
  ADD COLUMN IF NOT EXISTS place_id        TEXT,                    -- id do Google Places (dedup forte)
  ADD COLUMN IF NOT EXISTS enviado_crm     BOOLEAN DEFAULT FALSE,   -- já promovido pro funil do CRM
  ADD COLUMN IF NOT EXISTS enviado_crm_at  TIMESTAMPTZ;

-- Dedup por place_id (quando existir) — evita raspar a mesma oficina de novo.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_crm_leads_place_id
  ON public.crm_leads (place_id) WHERE place_id IS NOT NULL;

-- 2) Tira os leads crus do ORCradar do funil "vivo" do CRM ---------------------
-- Seguro: só mexe nos leads do ORCradar ainda não revisados/enviados.
UPDATE public.crm_leads
   SET etapa = 'triagem'
 WHERE origem = 'orcradar'
   AND COALESCE(aprovado, FALSE) = FALSE
   AND COALESCE(enviado_crm, FALSE) = FALSE
   AND etapa = 'a_contatar';

-- 3) Normaliza o segmento dos leads do ORCradar pro "key" que o CRM entende -----
-- (o CRM usa segmento como key: 'oficina', 'funilaria'... — texto livre vira "Outro").
UPDATE public.crm_leads
   SET segmento = 'oficina'
 WHERE origem = 'orcradar' AND segmento IS NOT NULL
   AND lower(segmento) LIKE '%oficina%';
