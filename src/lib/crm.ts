import { supabase } from './supabase';

async function atualizar(id: string, patch: Record<string, unknown>): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('crm_leads').update(patch).eq('id', id);
  if (error) throw new Error(error.message);
}

/** Aprova o lead → entra no funil do CRM (etapa "a_contatar"). */
export const aprovarLead = (id: string) => atualizar(id, { aprovado: true, etapa: 'a_contatar' });

/** Descarta o lead (etapa "perdido"). Continua no banco, mas fora da triagem. */
export const descartarLead = (id: string) => atualizar(id, { aprovado: false, etapa: 'perdido' });

/** Volta o lead pra triagem. */
export const reabrirLead = (id: string) => atualizar(id, { aprovado: false, etapa: 'novo' });

/** Salva a mensagem de WhatsApp gerada/editada e o tom usado. */
export const salvarMensagem = (id: string, mensagem: string, tom: string) =>
  atualizar(id, { mensagem_whatsapp: mensagem, tom_mensagem: tom, ultimo_contato_at: new Date().toISOString() });
