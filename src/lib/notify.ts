/** Notificações do navegador — a raspagem roda em segundo plano. */

export function podeNotificar(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

/** Pede permissão (1x) — chame quando o usuário inicia uma raspagem. */
export function pedirPermissaoNotificacao(): void {
  if (!podeNotificar()) return;
  try { if (Notification.permission === 'default') void Notification.requestPermission(); } catch { /* ignora */ }
}

/** Mostra uma notificação (se permitida). Foca a aba ao clicar. */
export function notificar(titulo: string, corpo: string): void {
  if (!podeNotificar()) return;
  try {
    if (Notification.permission !== 'granted') return;
    const n = new Notification(titulo, { body: corpo, icon: '/icon-512.png', badge: '/favicon.svg' });
    n.onclick = () => { window.focus(); n.close(); };
  } catch { /* ignora */ }
}
