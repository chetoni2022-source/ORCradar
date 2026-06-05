import { useEffect, useState } from 'react';
import { KeyRound, Sun, Moon, ShieldCheck, Database, CheckCircle2, Loader2 } from 'lucide-react';
import { getApifyToken, setApifyToken } from '../lib/scrape';
import { checkSupabaseConnection, type ConnectionStatus } from '../lib/supabase';
import type { Theme } from '../App';

type Props = { theme: Theme; onToggleTheme: () => void; email: string | null };

export function ConfigPage({ theme, onToggleTheme, email }: Props) {
  const [tokenInput, setTokenInput] = useState(getApifyToken());
  const [tokenSaved, setTokenSaved] = useState(!!getApifyToken());
  const [conn, setConn] = useState<ConnectionStatus | null>(null);

  useEffect(() => {
    let alive = true;
    checkSupabaseConnection().then((s) => { if (alive) setConn(s); });
    return () => { alive = false; };
  }, []);

  function salvarToken() { setApifyToken(tokenInput); setTokenSaved(!!tokenInput.trim()); }

  return (
    <div className="screen"><div className="screen-inner">
      <div className="screen-head"><div><h1 className="t-h1">Configurações</h1><p>{email}</p></div></div>

      <div className="col" style={{ gap: 16, maxWidth: 560 }}>
        {/* Token Apify */}
        <div className="card col" style={{ gap: 12 }}>
          <div className="between">
            <div className="row" style={{ gap: 10 }}>
              <span className="icon-badge"><KeyRound size={18} /></span>
              <div><div className="t-h3" style={{ fontSize: 15 }}>Token do Apify</div><div className="t-caption t-muted">Necessário pra raspar os leads.</div></div>
            </div>
            <span className={`badge ${tokenSaved ? 'badge-success' : 'badge-warning'}`}>{tokenSaved ? 'configurado' : 'necessário'}</span>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <input className="input" type="password" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} placeholder="apify_api_..." autoComplete="off" />
            <button className="btn btn-primary btn-sm" style={{ flexShrink: 0 }} onClick={salvarToken}>Salvar</button>
          </div>
          <div className="t-caption t-faint">Fica só no seu navegador, enviado direto pra função de raspagem. Nunca é gravado no banco.</div>
        </div>

        {/* Aparência */}
        <div className="card between">
          <div className="row" style={{ gap: 10 }}>
            <span className="icon-badge">{theme === 'dark' ? <Moon size={18} /> : <Sun size={18} />}</span>
            <div><div className="t-h3" style={{ fontSize: 15 }}>Aparência</div><div className="t-caption t-muted">Tema {theme === 'dark' ? 'escuro' : 'claro'}.</div></div>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onToggleTheme}>{theme === 'dark' ? <><Sun size={15} /> Claro</> : <><Moon size={15} /> Escuro</>}</button>
        </div>

        {/* Sobre */}
        <div className="card col" style={{ gap: 12 }}>
          <div className="row" style={{ gap: 10 }}>
            <span className="icon-badge"><ShieldCheck size={18} /></span>
            <div><div className="t-h3" style={{ fontSize: 15 }}>Sobre</div><div className="t-caption t-muted">ORCradar · Fase 1</div></div>
          </div>
          <div className="divider" />
          <div className="between">
            <span className="row t-caption t-muted" style={{ gap: 8 }}><Database size={14} /> Banco (Supabase)</span>
            {conn === null ? <span className="row t-caption t-faint" style={{ gap: 6 }}><Loader2 size={13} className="spin" /> checando</span>
              : conn.ok ? <span className="badge badge-success"><span className="dot" /> online</span>
              : <span className="badge badge-error"><span className="dot" /> offline</span>}
          </div>
          <div className="between">
            <span className="t-caption t-muted">Tabelas que o ORCradar usa</span>
            <span className="mono-code" style={{ fontSize: 12 }}>crm_leads · radar_regioes</span>
          </div>
          <div className="row t-caption t-faint" style={{ gap: 6 }}><CheckCircle2 size={13} color="#00A058" /> Só toca nas tabelas de prospecção — nunca no produto ORCtech.</div>
        </div>
      </div>
    </div></div>
  );
}
