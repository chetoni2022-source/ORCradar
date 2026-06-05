export type Tom = 'amigavel' | 'formal' | 'persuasivo';

export const TONS: { id: Tom; label: string }[] = [
  { id: 'amigavel', label: 'Amigável' },
  { id: 'formal', label: 'Formal' },
  { id: 'persuasivo', label: 'Persuasivo' },
];

// Templates de primeiro contato (placeholders trocados com os dados do lead).
// Refinados por um painel de copywriters — ver workflow orcradar-whatsapp-copy.
const TEMPLATES: Record<Tom, string> = {
  amigavel:
    'Oi! Tudo bem na {nome}? 👋 Vi vocês aqui no Google em {cidade}: {nota} com {avaliacoes} avaliações é serviço bom de verdade, parabéns.\n\n' +
    'Trabalho com uma ferramenta que monta orçamento rápido e bonito pra mandar no zap em poucos cliques (tem até uma IA que monta a maior parte pra você).\n\n' +
    'Posso te mostrar em 2 min como ficaria pra {nome}?',
  formal:
    'Olá, falo com a {nome}? Notei a reputação de vocês no Google aí em {cidade} ({nota}, {avaliacoes} avaliações) e o trabalho impressiona.\n\n' +
    'Tenho um sistema que gera orçamentos profissionais em poucos minutos e organiza a gestão da oficina, com apoio de IA, ajudando a transmitir mais confiança e fechar mais serviços.\n\n' +
    'Poderia te apresentar em uma demonstração rápida de 2 minutos?\n— Equipe ORCtech',
  persuasivo:
    'Oi! {nota} no Google com {avaliacoes} avaliações é coisa de oficina referência em {cidade} 👏 E fiquei curioso: o orçamento que vocês mandam pro cliente passa essa mesma imagem de qualidade?\n\n' +
    'Oficinas como a {nome} estão fechando mais serviço só por mandar orçamento pronto e profissional em minutos (a IA monta junto com você).\n\n' +
    'Te mostro em 2 min como funciona na prática?',
};

export type MsgLead = {
  nome_empresa: string;
  segmento: string | null;
  nota_media: number | null;
  num_avaliacoes: number;
  cidade: string | null;
};

export function gerarMensagem(lead: MsgLead, tom: Tom): string {
  return (TEMPLATES[tom] ?? TEMPLATES.amigavel)
    .replaceAll('{nome}', lead.nome_empresa)
    .replaceAll('{segmento}', lead.segmento ?? 'oficina')
    .replaceAll('{nota}', lead.nota_media != null ? String(lead.nota_media) : 'ótima nota')
    .replaceAll('{avaliacoes}', String(lead.num_avaliacoes ?? 0))
    .replaceAll('{cidade}', lead.cidade ?? 'sua região');
}

/** Link wa.me com a mensagem pré-preenchida. */
export function whatsappLink(telefone: string | null | undefined, mensagem: string): string | null {
  if (!telefone) return null;
  let d = String(telefone).replace(/\D/g, '');
  if (!d) return null;
  if (d.length <= 11) d = '55' + d; // assume Brasil se vier sem DDI
  return `https://wa.me/${d}?text=${encodeURIComponent(mensagem)}`;
}
