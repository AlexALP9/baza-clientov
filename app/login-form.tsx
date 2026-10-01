'use client';
import { useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
export default function LoginForm({ onLogin }: { onLogin: () => Promise<void> }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: React.FormEvent) {
    event.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ code }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || 'Не удалось войти');
      setCode(''); await onLogin();
    } catch (e) { setError(e instanceof Error ? e.message : 'Не удалось войти. Проверьте соединение.'); }
    finally { setBusy(false); }
  }
  return <main className="login-screen"><section className="login-card"><div className="brand"><span className="brandmark">к</span>контакт<span className="brand-dot">.</span></div><ShieldCheck className="login-icon" size={28}/><h1>Вход в вашу базу</h1><p>Введите код доступа, полученный от владельца приложения.</p><form onSubmit={submit}><label htmlFor="access-code">Код доступа</label><input id="access-code" name="code" type="password" autoFocus autoComplete="current-password" required maxLength={256} value={code} onChange={e=>setCode(e.target.value)} aria-describedby={error?'login-error':undefined} aria-invalid={!!error}/>{error&&<p className="login-error" id="login-error" role="alert">{error}</p>}<button className="primary" disabled={busy||!code} type="submit">{busy?<><Loader2 className="spin" size={18}/>Входим…</>:'Войти'}</button></form></section></main>;
}
