-- =============================================================================
-- ORCradar — Setup do agendamento (rodado via execute_sql, fora das migrations).
-- Documentado aqui pra reproduzir/auditar. Projeto "ERP" (tcgwkazgelkonnuyebls).
-- =============================================================================

-- 1) Extensões do agendador.
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2) Segredo do cron no Vault (gerado uma vez; lido pelo job e pela função).
DO $$
DECLARE v_secret text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'radar_cron_secret') THEN
    v_secret := replace(gen_random_uuid()::text,'-','') || replace(gen_random_uuid()::text,'-','');
    PERFORM vault.create_secret(v_secret, 'radar_cron_secret', 'ORCradar: auth do cron de raspagem agendada');
  END IF;
END $$;

-- 3) RPC que devolve o segredo só pro service_role (a função radar-cron lê). (Ver 0003.)

-- 4) Job: a cada 15 min chama a Edge Function radar-cron com o segredo no header.
SELECT cron.schedule(
  'radar-cron-tick',
  '*/15 * * * *',
  $$
    SELECT net.http_post(
      url := 'https://tcgwkazgelkonnuyebls.supabase.co/functions/v1/radar-cron',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-cron-secret', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'radar_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 120000
    );
  $$
);

-- IMPORTANTE: pra a raspagem AGENDADA rodar, defina o secret APIFY_TOKEN da
-- Edge Function radar-cron no painel do Supabase (Edge Functions > Secrets).
-- A raspagem manual continua funcionando com o token salvo no navegador.
