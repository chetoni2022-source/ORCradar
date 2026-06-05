export type Tom = 'amigavel' | 'formal' | 'persuasivo';

export const TONS: { id: Tom; label: string }[] = [
  { id: 'amigavel', label: 'Amigável' },
  { id: 'formal', label: 'Formal' },
  { id: 'persuasivo', label: 'Persuasivo' },
];

/**
 * Templates de 1º contato do ORCradar.
 *
 * Regras pedidas pelo dono:
 *  - Sempre me apresento como "Kauã, da ORCtech".
 *  - Mensagens CURTAS (2 blocos curtos) e personalizadas com os dados do lead.
 *  - SEM traços ("-", "—", "–") e SEM emoji (era a fonte do "�" no WhatsApp).
 *
 * Placeholders: {empresa} {nota} {avaliacoes} {cidade} {segmento}
 */
const TEMPLATES: Record<Tom, string> = {
  amigavel:
    'Oi, tudo bem? Aqui é o Kauã, da ORCtech. Achei a {empresa} no Google ({nota} com {avaliacoes} avaliações) e gostei do trabalho de vocês em {cidade}.\n\n' +
    'A gente tem um sistema que monta o orçamento pela foto do carro (a IA faz a maior parte) e já manda um PDF profissional no WhatsApp do cliente. Você consegue me dizer com quem eu falo sobre isso aí na oficina?',
  formal:
    'Olá, tudo bem? Aqui é o Kauã, da ORCtech. Encontrei a {empresa} no Google ({nota} com {avaliacoes} avaliações) e fiquei com uma ótima impressão do trabalho de vocês.\n\n' +
    'Nós ajudamos oficinas a montar orçamentos profissionais em poucos minutos, com apoio de IA, e a enviar tudo pronto no WhatsApp do cliente. Eu gostaria de apresentar pro responsável: você poderia me indicar com quem falar ou um bom horário?',
  persuasivo:
    'Oi, tudo bem? Aqui é o Kauã, da ORCtech. A {empresa} tem {nota} no Google com {avaliacoes} avaliações, então o serviço de vocês já é referência em {cidade}.\n\n' +
    'O que costuma travar é o orçamento: às vezes demora ou não sai tão profissional. A gente resolve com foto do carro, a IA monta e sai um PDF bonito pra mandar no WhatsApp na hora. Vale uns 2 minutos pra eu mostrar pro responsável. Com quem eu falo sobre isso?',
};

export type MsgLead = {
  nome_empresa: string;
  segmento: string | null;
  nota_media: number | null;
  num_avaliacoes: number;
  cidade: string | null;
};

/**
 * Limpa a mensagem GERADA: tira o "�", remove qualquer traço (pedido do dono)
 * e normaliza espaços. Não roda na hora do envio pra não mexer no que o dono
 * editou à mão (lá só corrigimos encoding — ver sanitizarEncoding).
 */
function limparMensagem(s: string): string {
  return s
    .replace(/�/g, '') // o caractere "�" (replacement char)
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '') // surrogate alto solto
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '') // surrogate baixo solto
    .replace(/[-‐-―−]/g, ' ') // qualquer hífen/traço vira espaço
    .replace(/[ \t]{2,}/g, ' ') // colapsa espaços
    .replace(/ +\n/g, '\n')
    .replace(/\n +/g, '\n')
    .trim();
}

/** Cidade só com o nome (corta sufixos tipo " - SP" que viram traço). */
function limparCidade(cidade: string | null): string {
  if (!cidade) return 'sua região';
  const limpa = cidade.split(/[-,]/)[0].trim();
  return limpa || 'sua região';
}

/** Nome da empresa enxuto (sem traços, sem cauda de marca depois de "|"). */
function limparEmpresa(nome: string): string {
  const base = nome.split('|')[0].replace(/[-‐-―−]/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return base || 'sua oficina';
}

export function gerarMensagem(lead: MsgLead, tom: Tom): string {
  const msg = (TEMPLATES[tom] ?? TEMPLATES.amigavel)
    .replaceAll('{empresa}', limparEmpresa(lead.nome_empresa))
    .replaceAll('{segmento}', lead.segmento ?? 'oficina')
    .replaceAll('{nota}', lead.nota_media != null ? String(lead.nota_media) : 'ótima nota')
    .replaceAll('{avaliacoes}', String(lead.num_avaliacoes ?? 0))
    .replaceAll('{cidade}', limparCidade(lead.cidade));
  return limparMensagem(msg);
}

/** Conserta encoding na hora do envio (tira "�" e surrogates soltos). */
function sanitizarEncoding(s: string): string {
  return s
    .replace(/�/g, '')
    .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
    .replace(/(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '');
}

/** Link wa.me com a mensagem pré-preenchida (sem o bug do "�"). */
export function whatsappLink(telefone: string | null | undefined, mensagem: string): string | null {
  if (!telefone) return null;
  let d = String(telefone).replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d; // assume Brasil se vier sem DDI
  return `https://wa.me/${d}?text=${encodeURIComponent(sanitizarEncoding(mensagem))}`;
}
