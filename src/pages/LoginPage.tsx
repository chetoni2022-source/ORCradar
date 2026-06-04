import { useState, type FormEvent } from 'react';
import { Loader2, Mail, Lock, LogIn, AlertCircle } from 'lucide-react';
import { Logo } from '../components/Logo';
import { RadarMark } from '../components/RadarMark';
import { signIn } from '../lib/auth';

function traduzErro(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials')) return 'E-mail ou senha incorretos.';
  if (m.includes('email not confirmed')) return 'E-mail ainda não confirmado.';
  if (m.includes('rate limit') || m.includes('too many')) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  if (m.includes('failed to fetch') || m.includes('network')) return 'Falha de rede ao falar com o Supabase.';
  return msg;
}

export function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    const res = await signIn(email, password);
    if (res.error) {
      setError(traduzErro(res.error));
      setLoading(false);
    }
    // Em caso de sucesso, o App reage ao onAuthStateChange e troca a tela.
  }

  return (
    <div className="login-wrap">
      <div className="brand-blobs" aria-hidden />
      <div className="login-card card card-lg col" style={{ gap: 20, position: 'relative', zIndex: 1 }}>
        <div className="col" style={{ alignItems: 'center', gap: 12, textAlign: 'center' }}>
          <RadarMark size={64} />
          <Logo size={30} />
          <div className="t-caption t-muted">Ferramenta interna de prospecção — acesso restrito ao dono.</div>
        </div>

        <form onSubmit={handleSubmit} className="col" style={{ gap: 14 }}>
          <div className="field">
            <label className="field-label" htmlFor="email">E-mail</label>
            <div className="input-icon-wrap">
              <Mail size={16} className="input-icon" />
              <input
                id="email"
                className="input"
                type="email"
                autoComplete="email"
                placeholder="voce@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
          </div>

          <div className="field">
            <label className="field-label" htmlFor="password">Senha</label>
            <div className="input-icon-wrap">
              <Lock size={16} className="input-icon" />
              <input
                id="password"
                className="input"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          {error && (
            <div className="row" style={{ gap: 8, color: 'var(--error)', fontSize: 13 }}>
              <AlertCircle size={15} /> <span>{error}</span>
            </div>
          )}

          <button className="btn btn-primary btn-block btn-lg" type="submit" disabled={loading}>
            {loading ? <Loader2 size={18} className="spin" /> : <LogIn size={18} />}
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <div className="t-caption t-faint" style={{ textAlign: 'center' }}>
          Use a sua conta do ORCtech. O acesso aos dados é validado pelo RLS.
        </div>
      </div>
    </div>
  );
}
