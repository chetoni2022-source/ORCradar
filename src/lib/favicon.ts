/**
 * Anima o favicon como um radar girando enquanto a raspagem roda.
 * Favicon não anima sozinho (SVG/GIF não rodam como ícone), então desenhamos
 * cada quadro num canvas e trocamos o href do <link rel="icon"> num intervalo.
 */
let timer: number | null = null;
let angle = 0;
let originalHref: string | null = null;
let originalType: string | null = null;
let link: HTMLLinkElement | null = null;

function ensureLink(): HTMLLinkElement {
  let l = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
  if (!l) {
    l = document.createElement('link');
    l.rel = 'icon';
    document.head.appendChild(l);
  }
  return l;
}

function drawFrame(a: number): string {
  const size = 64;
  const c = document.createElement('canvas');
  c.width = size; c.height = size;
  const ctx = c.getContext('2d');
  if (!ctx) return '';
  const cx = size / 2, cy = size / 2, r = size / 2 - 3;

  ctx.clearRect(0, 0, size, size);
  // fundo escuro arredondado
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = '#06231A'; ctx.fill();
  // anéis concêntricos
  ctx.strokeStyle = 'rgba(0,196,106,0.45)'; ctx.lineWidth = 2;
  for (const rr of [r - 1, r * 0.66, r * 0.34]) { ctx.beginPath(); ctx.arc(cx, cy, rr, 0, Math.PI * 2); ctx.stroke(); }
  // varredura (wedge + linha)
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, r - 1, -0.6, 0); ctx.closePath();
  ctx.fillStyle = 'rgba(0,196,106,0.55)'; ctx.fill();
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(r - 1, 0); ctx.strokeStyle = '#00E676'; ctx.lineWidth = 3; ctx.stroke();
  ctx.restore();
  // núcleo
  ctx.beginPath(); ctx.arc(cx, cy, 4.5, 0, Math.PI * 2); ctx.fillStyle = '#00E676'; ctx.fill();
  return c.toDataURL('image/png');
}

export function startFaviconRadar(): void {
  if (typeof document === 'undefined' || timer != null) return;
  link = ensureLink();
  originalHref = link.getAttribute('href');
  originalType = link.getAttribute('type');
  link.type = 'image/png';
  timer = window.setInterval(() => {
    angle += Math.PI / 8;
    const frame = drawFrame(angle);
    if (frame && link) link.href = frame;
  }, 120);
}

export function stopFaviconRadar(): void {
  if (timer != null) { window.clearInterval(timer); timer = null; }
  if (link) {
    if (originalType) link.type = originalType; else link.removeAttribute('type');
    link.href = originalHref || '/favicon.svg';
  }
}
