import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { firebase, type CloudUser } from '../game/firebase';

export interface UserContextValue {
  user: CloudUser | null;
  /** 'live' when real Firebase keys are configured, 'mock' otherwise. */
  mode: 'live' | 'mock';
  busy: boolean;
  error: string | null;
  loginAnonymously: () => Promise<CloudUser | null>;
  linkWithGoogle: () => Promise<CloudUser | null>;
  logout: () => Promise<void>;
}

const UserContext = createContext<UserContextValue | null>(null);

export function UserProvider({ children, onUserChange }: { children: ReactNode; onUserChange?: (user: CloudUser | null) => void }) {
  const [user, setUser] = useState<CloudUser | null>(() => firebase.currentUser());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => firebase.onAuthStateChanged((u) => { setUser(u); onUserChange?.(u); }), [onUserChange]);

  const wrap = useCallback(async <T,>(fn: () => Promise<T>): Promise<T | null> => {
    setBusy(true); setError(null);
    try { return await fn(); }
    catch (e) { const msg = e instanceof Error ? e.message : String(e); setError(msg); console.warn('[auth]', msg); return null; }
    finally { setBusy(false); }
  }, []);

  const value = useMemo<UserContextValue>(() => ({
    user, mode: firebase.mode, busy, error,
    loginAnonymously: () => wrap(() => firebase.loginAnonymously()),
    linkWithGoogle: () => wrap(() => firebase.linkWithGoogle()),
    logout: async () => { await wrap(() => firebase.logout()); },
  }), [user, busy, error, wrap]);

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser(): UserContextValue {
  const ctx = useContext(UserContext);
  if (!ctx) throw new Error('useUser must be used inside <UserProvider>');
  return ctx;
}
