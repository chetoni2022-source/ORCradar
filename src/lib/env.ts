import { z } from 'zod';

/**
 * Validação das variáveis de ambiente do ORCradar.
 *
 * Diferente de lançar erro fatal (que deixaria a tela branca), aqui guardamos
 * o erro em `envError` e deixamos o app renderizar uma tela amigável pedindo
 * pra preencher o `.env`. Mais gentil pra uma ferramenta interna de mexer.
 */
const envSchema = z.object({
  VITE_SUPABASE_URL: z.string().url('VITE_SUPABASE_URL precisa ser uma URL válida'),
  VITE_SUPABASE_ANON_KEY: z.string().min(20, 'VITE_SUPABASE_ANON_KEY está muito curta'),
  VITE_APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
});

const parsed = envSchema.safeParse(import.meta.env);

export const env = parsed.success
  ? parsed.data
  : { VITE_SUPABASE_URL: '', VITE_SUPABASE_ANON_KEY: '', VITE_APP_ENV: 'development' as const };

export const envError = parsed.success
  ? null
  : parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join(' · ');

/** Host do projeto Supabase — usado pra preconnect (carregamento mais rápido). */
export const supabaseProjectHost = (() => {
  try {
    return env.VITE_SUPABASE_URL ? new URL(env.VITE_SUPABASE_URL).host : null;
  } catch {
    return null;
  }
})();

if (typeof document !== 'undefined' && supabaseProjectHost) {
  const origin = `https://${supabaseProjectHost}`;
  if (!document.querySelector(`link[rel="preconnect"][href="${origin}"]`)) {
    const preconnect = document.createElement('link');
    preconnect.rel = 'preconnect';
    preconnect.href = origin;
    document.head.appendChild(preconnect);
  }
}
