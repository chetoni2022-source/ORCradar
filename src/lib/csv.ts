import type { LeadMapa } from './leads';

/** Escapa um campo pro formato CSV (aspas, ponto-e-vírgula, quebra de linha). */
function campo(v: unknown): string {
  const s = v == null ? '' : String(v);
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const COLUNAS: { k: keyof LeadMapa; label: string }[] = [
  { k: 'nome_empresa', label: 'Empresa' },
  { k: 'segmento', label: 'Segmento' },
  { k: 'nota_media', label: 'Nota' },
  { k: 'num_avaliacoes', label: 'Avaliacoes' },
  { k: 'score', label: 'Score' },
  { k: 'telefone', label: 'Telefone' },
  { k: 'whatsapp', label: 'WhatsApp' },
  { k: 'endereco', label: 'Endereco' },
  { k: 'cidade', label: 'Cidade' },
  { k: 'regiao', label: 'Regiao' },
  { k: 'site_url', label: 'Site' },
  { k: 'instagram', label: 'Instagram' },
  { k: 'link_maps', label: 'Google Maps' },
  { k: 'etapa', label: 'Etapa' },
  { k: 'enviado_crm', label: 'No CRM' },
];

/** Monta o CSV (separador ';' — abre redondo no Excel pt-BR). */
export function leadsParaCsv(leads: LeadMapa[]): string {
  const head = COLUNAS.map((c) => c.label).join(';');
  const linhas = leads.map((l) => COLUNAS.map((c) => campo(l[c.k])).join(';'));
  return [head, ...linhas].join('\r\n');
}

/** Dispara o download de um CSV (com BOM pra acentos no Excel). */
export function baixarCsv(nomeArquivo: string, conteudo: string): void {
  const blob = new Blob(['﻿' + conteudo], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nomeArquivo;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
