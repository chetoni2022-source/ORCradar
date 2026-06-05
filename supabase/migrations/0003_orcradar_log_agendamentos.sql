-- =============================================================================
-- ORCradar — Saúde do projeto: log/monitoramento da raspagem + agendamentos
-- Aplicada no projeto "ERP" (tcgwkazgelkonnuyebls). Tudo owner-only (RLS).
-- Também (via execute_sql, fora deste arquivo): CREATE EXTENSION pg_cron, pg_net;
-- segredo 'radar_cron_secret' no Vault; e o job cron 'radar-cron-tick' (*/15).
-- =============================================================================

-- 1) Log de cada raspagem (monitoramento + base do rate limit) -----------------
CREATE TABLE IF NOT EXISTS public.radar_scrape_log (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  source       TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','cron')),
  regiao_id    UUID REFERENCES public.radar_regioes(id) ON DELETE SET NULL,
  max_pedido   INTEGER,
  total        INTEGER,
  inseridos    INTEGER,
  duplicados   INTEGER,
  erro         TEXT,
  duracao_ms   INTEGER,
  caller       UUID
);
CREATE INDEX IF NOT EXISTS idx_radar_scrape_log_ran_at ON public.radar_scrape_log(ran_at DESC);

ALTER TABLE public.radar_scrape_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "radar_scrape_log_owner_all" ON public.radar_scrape_log;
CREATE POLICY "radar_scrape_log_owner_all" ON public.radar_scrape_log
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- 2) Agendamentos de raspagem (ex.: toda segunda 08h, raspar Zona Sul) ---------
CREATE TABLE IF NOT EXISTS public.radar_agendamentos (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  regiao_id      UUID NOT NULL REFERENCES public.radar_regioes(id) ON DELETE CASCADE,
  ativo          BOOLEAN NOT NULL DEFAULT true,
  frequencia     TEXT NOT NULL DEFAULT 'semanal' CHECK (frequencia IN ('diaria','semanal')),
  dia_semana     INTEGER CHECK (dia_semana BETWEEN 0 AND 6), -- 0=domingo (só p/ semanal)
  hora           INTEGER NOT NULL DEFAULT 8 CHECK (hora BETWEEN 0 AND 23),
  max_leads      INTEGER NOT NULL DEFAULT 50 CHECK (max_leads BETWEEN 1 AND 120),
  ultimo_run_at  TIMESTAMPTZ,
  proximo_run_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_radar_agend_due ON public.radar_agendamentos(ativo, proximo_run_at);

ALTER TABLE public.radar_agendamentos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "radar_agendamentos_owner_all" ON public.radar_agendamentos;
CREATE POLICY "radar_agendamentos_owner_all" ON public.radar_agendamentos
  FOR ALL USING (public.is_platform_owner()) WITH CHECK (public.is_platform_owner());

-- 3) Segredo do cron exposto só pro service_role (a função radar-cron lê) -------
CREATE OR REPLACE FUNCTION public.radar_get_cron_secret()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, vault
AS $$ SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'radar_cron_secret' LIMIT 1; $$;
REVOKE ALL ON FUNCTION public.radar_get_cron_secret() FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.radar_get_cron_secret() TO service_role;
