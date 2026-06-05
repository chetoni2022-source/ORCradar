/**
 * Tipos do ORCradar — recorte das tabelas de prospecção (Fase 0).
 *
 * Reflete o formato-alvo do ORCradar para `crm_leads` e `radar_regioes`.
 * O ORCradar só deve ler/gravar nestas duas tabelas — nunca nas tabelas do
 * produto ORCtech (orçamentos, clientes, serviços, etc.).
 */

export type EtapaLead =
  | 'triagem'      // lead cru, em revisão no ORCradar (fora do funil do CRM)
  | 'a_contatar'   // aprovado e enviado pro CRM da ORCtech
  | 'contatado'
  | 'visitado'
  | 'proposta_enviada'
  | 'testando'
  | 'fechado'
  | 'perdido';

export type ScoreCor = 'verde' | 'amarelo' | 'vermelho';

export type TomMensagem = 'formal' | 'amigavel' | 'persuasivo';

/** Lead de prospecção (empresa/oficina raspada de uma região). */
export interface CrmLead {
  id: string;
  nome_empresa: string;
  segmento: string | null;
  telefone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  site_url: string | null;
  place_id: string | null;
  endereco: string | null;
  cidade: string | null;
  link_maps: string | null;
  tem_site: boolean;
  num_avaliacoes: number;
  nota_media: number | null;
  tem_fotos: boolean;
  score: number;
  score_cor: ScoreCor;
  mensagem_whatsapp: string | null;
  tom_mensagem: TomMensagem | null;
  etapa: EtapaLead;
  regiao: string | null;
  latitude: number | null;
  longitude: number | null;
  observacoes: string | null;
  proximo_passo: string | null;
  data_proximo_passo: string | null;
  /** No banco a coluna é `ultimo_contato_at` (reaproveitada do ORCtech). */
  ultimo_contato_at: string | null;
  tentativas_contato: number;
  origem: string;
  aprovado: boolean;
  duplicado: boolean;
  /** ORCradar — Fase 5: lead já promovido pro funil do CRM da ORCtech. */
  enviado_crm: boolean;
  enviado_crm_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Região prospectada (raio desenhado sobre o mapa). */
export interface RadarRegiao {
  id: string;
  nome: string | null;
  centro_lat: number;
  centro_lng: number;
  raio_km: number;
  segmento: string | null;
  leads_encontrados: number;
  leads_aprovados: number;
  leads_fechados: number;
  data_prospeccao: string;
}
