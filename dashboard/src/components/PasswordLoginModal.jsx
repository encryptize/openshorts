import React, { useState } from 'react';
import { Lock, Loader2 } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import Modal from './ui/Modal';

// Self-host shared-password sign-in. A single password gates the whole instance;
// every device that knows it shares one session and the same clip library.
// `queued` says the visitor pressed "get clips" before signing in and the
// request is parked: the work resumes by itself once they are back.
export default function PasswordLoginModal({ onClose, queued = false }) {
  const { loginWithPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    if (!password) return;
    setBusy(true);
    setError('');
    try {
      await loginWithPassword(password);
      onClose();
    } catch (err) {
      setError(err.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} eyebrow="ACCESS" title="Enter password" size="sm">
      <p className="text-muted text-sm mb-6 lowercase">This OpenShorts instance is protected by a shared password.</p>

      {queued && (
        <div className="flex items-start gap-2 border border-rule2 rounded-input bg-paper2 px-3 py-2 mb-5">
          <Loader2 size={16} className="animate-spin text-brass shrink-0 mt-0.5" />
          <p className="text-sm text-muted">Your clip request is saved — it'll start as soon as you sign in.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm text-muted mb-1.5">Password</label>
          <div className="relative">
            <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoFocus
              autoComplete="current-password"
              className="input pl-9"
              placeholder="Shared password"
            />
          </div>
        </div>

        {error && <p className="text-danger text-sm">{error}</p>}

        <button type="submit" disabled={busy || !password} className="btn-primary w-full py-2.5 text-sm">
          {busy ? <Loader2 size={16} className="animate-spin mx-auto" /> : 'Sign in'}
        </button>
      </form>
    </Modal>
  );
}