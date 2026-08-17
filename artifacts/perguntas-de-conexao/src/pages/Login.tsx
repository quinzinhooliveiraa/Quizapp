import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Feather, Mail } from 'lucide-react';

const apiBase = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '');
const apiUrl = (path: string) => `${apiBase}${path}`;

type Stage = 'email' | 'code' | 'picker';
type SessionSummary = { id: string; buyerName: string; packageName: string; createdAt: string };

function safeSet(key: string, value: string) {
  try { window.localStorage?.setItem(key, value); } catch { /* noop */ }
}

export default function Login() {
  const [, navigate] = useLocation();
  const [stage, setStage] = useState<Stage>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function requestCode() {
    setError('');
    setNotice('');
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError('Digite um email válido.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/request-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed }),
      });
      if (response.status === 429) {
        setError('Aguarde um instante antes de pedir outro código.');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError('Não foi possível enviar o código agora. Tente novamente.');
        setLoading(false);
        return;
      }
      setEmail(trimmed);
      setStage('code');
      setNotice('Se houver acesso vinculado a esse email, você receberá um código em instantes.');
    } catch {
      setError('Sem conexão. Tente novamente.');
    }
    setLoading(false);
  }

  async function verifyCode() {
    setError('');
    const trimmedCode = code.trim();
    if (trimmedCode.length !== 6 || !/^\d{6}$/.test(trimmedCode)) {
      setError('O código tem 6 dígitos.');
      return;
    }
    setLoading(true);
    try {
      const response = await fetch(apiUrl('/api/auth/verify-code'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code: trimmedCode }),
      });
      if (response.status === 401) {
        setError('Código inválido ou expirado.');
        setLoading(false);
        return;
      }
      if (response.status === 404) {
        setError('Nenhum acesso encontrado para este email.');
        setLoading(false);
        return;
      }
      if (response.status === 429) {
        setError('Muitas tentativas. Peça um novo código.');
        setLoading(false);
        return;
      }
      if (!response.ok) {
        setError('Algo deu errado. Tente novamente.');
        setLoading(false);
        return;
      }
      const data = await response.json() as { sessions: SessionSummary[] };
      if (!data.sessions?.length) {
        setError('Nenhum acesso encontrado para este email.');
        setLoading(false);
        return;
      }
      if (data.sessions.length === 1) {
        completeLogin(data.sessions[0]);
        return;
      }
      setSessions(data.sessions);
      setStage('picker');
    } catch {
      setError('Sem conexão. Tente novamente.');
    }
    setLoading(false);
  }

  function completeLogin(session: SessionSummary) {
    safeSet('conexao-session', session.id);
    safeSet('conexao-name', session.buyerName);
    safeSet('conexao-role', 'owner');
    safeSet('conexao-onboarding-complete', 'true');
    navigate('/app', { replace: true });
  }

  return (
    <div className="login-shell">
      <main className="login-frame">
        <Link href="/" className="login-back" aria-label="Voltar">
          <span>← início</span>
        </Link>

        <div className="login-symbol"><Feather size={20} /></div>
        <p className="login-kicker">acessar meu baralho</p>

        {stage === 'email' && <>
          <h1>Entre com seu <em>email.</em></h1>
          <p className="login-copy">Vamos mandar um código de 6 dígitos pra você entrar sem senha.</p>
          <div className="login-field">
            <Mail size={16} className="login-field-icon" />
            <input
              type="email"
              autoComplete="email"
              inputMode="email"
              placeholder="seu@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && requestCode()}
              className="login-input"
              data-testid="input-login-email"
              autoFocus
            />
          </div>
          {error && <p className="login-error" data-testid="text-login-error">{error}</p>}
          <button onClick={requestCode} disabled={loading} className="login-primary" data-testid="button-request-code">
            {loading ? 'Enviando…' : <>Enviar código <ArrowRight size={16} /></>}
          </button>
          <p className="login-alt">Ainda não tem baralho? <Link href="/#pacotes">Ver pacotes</Link></p>
        </>}

        {stage === 'code' && <>
          <h1>Confira seu <em>email.</em></h1>
          <p className="login-copy">Enviamos um código de 6 dígitos para <strong>{email}</strong>. Ele expira em 15 minutos.</p>
          {notice && <p className="login-notice">{notice}</p>}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={6}
            placeholder="000000"
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={e => e.key === 'Enter' && verifyCode()}
            className="login-code-input"
            data-testid="input-login-code"
            autoFocus
          />
          {error && <p className="login-error" data-testid="text-login-error">{error}</p>}
          <button onClick={verifyCode} disabled={loading || code.length !== 6} className="login-primary" data-testid="button-verify-code">
            {loading ? 'Verificando…' : <>Entrar <ArrowRight size={16} /></>}
          </button>
          <button type="button" onClick={() => { setStage('email'); setCode(''); setError(''); setNotice(''); }} className="login-secondary" data-testid="button-change-email">
            Trocar email
          </button>
        </>}

        {stage === 'picker' && <>
          <h1>Qual baralho <em>abrir?</em></h1>
          <p className="login-copy">Encontramos mais de um acesso vinculado a este email.</p>
          <div className="login-picker">
            {sessions.map(session => (
              <button
                key={session.id}
                onClick={() => completeLogin(session)}
                className="login-picker-item"
                data-testid={`button-select-session-${session.id}`}
              >
                <span className="login-picker-name">{session.buyerName}</span>
                <span className="login-picker-meta">{session.packageName} · {new Date(session.createdAt).toLocaleDateString('pt-BR')}</span>
              </button>
            ))}
          </div>
        </>}
      </main>
    </div>
  );
}