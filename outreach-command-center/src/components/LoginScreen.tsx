import { useState } from 'react';
import { login } from '../lib/apiClient';

interface LoginScreenProps {
  onSuccess: (password: string) => void;
}

export function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const ok = await login(password);
      if (ok) {
        onSuccess(password);
      } else {
        setError('Incorrect password');
      }
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative grid min-h-screen place-items-center overflow-hidden bg-surface-950 px-4">
      {/* Ambient brand glow */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full opacity-30 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #F97316, transparent)' }}
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-48 right-0 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: 'radial-gradient(closest-side, #3B82F6, transparent)' }}
        aria-hidden
      />

      <div className="relative w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-india to-orange-600 text-2xl text-white shadow-lg shadow-orange-900/30">
            ⚡
          </span>
          <h1 className="text-xl font-semibold text-slate-100">PowerhouseTech</h1>
          <p className="text-sm text-slate-400">Outreach Command Center</p>
        </div>

        <form onSubmit={submit} className="card p-6">
          <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-slate-400">
            Password
          </label>
          <input
            type="password"
            autoFocus
            className="input"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError(null);
            }}
            placeholder="Enter access password"
            autoComplete="current-password"
          />
          {error && <p className="mt-2 text-sm text-rose-400">{error}</p>}

          <button type="submit" className="btn-primary mt-4 w-full" disabled={submitting || !password}>
            {submitting ? 'Signing in…' : 'Sign in'}
          </button>

          <p className="mt-4 text-center text-xs text-slate-500">
            Internal access only. Contact{' '}
            <span className="text-slate-400">shreyas@powerhousetech.in</span>.
          </p>
        </form>
      </div>
    </div>
  );
}

export default LoginScreen;
