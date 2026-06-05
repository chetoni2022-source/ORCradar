import { supabase } from './supabase';

/** Agendamento de raspagem automática (ex.: toda segunda 08h, raspar Zona Sul). */
export type Agendamento = {
  id: string;
  regiao_id: string;
  ativo: boolean;
  frequencia: 'diaria' | 'semanal';
  dia_semana: number | null; // 0=domingo (só p/ semanal)
  hora: number;
  max_leads: number;
  ultimo_run_at: string | null;
  proximo_run_at: string | null;
  created_at: string;
};

export type NovoAgendamento = {
  regiao_id: string;
  frequencia: 'diaria' | 'semanal';
  dia_semana: number | null;
  hora: number;
  max_leads: number;
};

export const DIAS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];

// Brasil é UTC-3 fixo (sem horário de verão). MESMA lógica da função radar-cron.
const TZ_OFFSET_H = -3;
/** Próximo horário de execução (ISO em UTC) a partir de freq/dia/hora locais. */
export function calcProximoRun(freq: 'diaria' | 'semanal', diaSemana: number | null, hora: number): string {
  const now = new Date();
  const br = new Date(now.getTime() + TZ_OFFSET_H * 3600_000);
  const toUtc = (d: Date) => new Date(d.getTime() - TZ_OFFSET_H * 3600_000);
  let cand = new Date(Date.UTC(br.getUTCFullYear(), br.getUTCMonth(), br.getUTCDate(), hora, 0, 0));
  if (freq === 'semanal') {
    const alvo = diaSemana ?? 1;
    const add = (alvo - cand.getUTCDay() + 7) % 7;
    cand = new Date(cand.getTime() + add * 86_400_000);
    let utc = toUtc(cand);
    if (utc <= now) utc = toUtc(new Date(cand.getTime() + 7 * 86_400_000));
    return utc.toISOString();
  }
  let utc = toUtc(cand);
  if (utc <= now) utc = toUtc(new Date(cand.getTime() + 86_400_000));
  return utc.toISOString();
}

/** Texto amigável de quando o agendamento roda. */
export function descreveAgendamento(a: Pick<Agendamento, 'frequencia' | 'dia_semana' | 'hora'>): string {
  const h = `${String(a.hora).padStart(2, '0')}h`;
  if (a.frequencia === 'diaria') return `Todo dia às ${h}`;
  return `Toda ${DIAS[a.dia_semana ?? 1].toLowerCase()} às ${h}`;
}

export async function listAgendamentos(): Promise<Agendamento[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('radar_agendamentos').select('*').order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Agendamento[];
}

export async function criarAgendamento(a: NovoAgendamento): Promise<Agendamento> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const proximo_run_at = calcProximoRun(a.frequencia, a.dia_semana, a.hora);
  const { data, error } = await supabase
    .from('radar_agendamentos')
    .insert({ ...a, ativo: true, proximo_run_at })
    .select().single();
  if (error) throw new Error(error.message);
  return data as Agendamento;
}

export async function alternarAgendamento(id: string, ativo: boolean): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('radar_agendamentos').update({ ativo }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function excluirAgendamento(id: string): Promise<void> {
  if (!supabase) throw new Error('Supabase não configurado.');
  const { error } = await supabase.from('radar_agendamentos').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
