import type { ScoreCor } from '../types/database';

export type ScoreParcela = { label: string; pontos: number; max: number };
export type ScoreResult = { score: number; cor: ScoreCor; parcelas: ScoreParcela[] };

export type ScoreInput = {
  num_avaliacoes: number;
  nota_media: number | null;
  telefone: string | null;
  whatsapp?: string | null;
  tem_site: boolean;
  tem_fotos: boolean;
};

/**
 * Score de potencial do lead (0–100), transparente e explicável.
 * Premia negócios estabelecidos (muitas avaliações), bem avaliados,
 * contatáveis e com presença — bons alvos pra prospecção.
 *
 * A MESMA fórmula vive na edge function `radar-scrape` (em Deno) — manter
 * as duas em sincronia.
 */
export function calcularScore(l: ScoreInput): ScoreResult {
  const n = Number(l.num_avaliacoes ?? 0);
  let pAval = 0;
  if (n >= 200) pAval = 40; else if (n >= 80) pAval = 32; else if (n >= 30) pAval = 24; else if (n >= 10) pAval = 14; else if (n >= 3) pAval = 6;

  const nota = Number(l.nota_media ?? 0);
  let pNota = 0;
  if (nota >= 4.6) pNota = 30; else if (nota >= 4.2) pNota = 24; else if (nota >= 3.8) pNota = 16; else if (nota >= 3.0) pNota = 8; else if (nota > 0) pNota = 2;

  const temTel = !!(l.telefone || l.whatsapp);
  const pTel = temTel ? 20 : 0;
  const pSite = l.tem_site ? 5 : 0;
  const pFotos = l.tem_fotos ? 5 : 0;

  const parcelas: ScoreParcela[] = [
    { label: n > 0 ? `${n} avaliações` : 'sem avaliações', pontos: pAval, max: 40 },
    { label: nota > 0 ? `nota ${nota}` : 'sem nota', pontos: pNota, max: 30 },
    { label: temTel ? 'tem telefone' : 'sem telefone', pontos: pTel, max: 20 },
    { label: l.tem_site ? 'tem site' : 'sem site', pontos: pSite, max: 5 },
    { label: l.tem_fotos ? 'tem fotos' : 'sem fotos', pontos: pFotos, max: 5 },
  ];
  const score = pAval + pNota + pTel + pSite + pFotos;
  const cor: ScoreCor = score >= 70 ? 'verde' : score >= 45 ? 'amarelo' : 'vermelho';
  return { score, cor, parcelas };
}

export const COR_HEX: Record<ScoreCor, string> = { verde: '#00C46A', amarelo: '#F59E0B', vermelho: '#EF4444' };
export const COR_LABEL: Record<ScoreCor, string> = { verde: 'Quente', amarelo: 'Morno', vermelho: 'Frio' };
