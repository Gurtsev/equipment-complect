import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

const SESSION_KEY = 'eq_auth_v1';

function saveTokens(session: { access_token: string; refresh_token: string } | null) {
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({ a: session.access_token, r: session.refresh_token }));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function loadTokens(): { access_token: string; refresh_token: string } | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Record<string, string>;
    if (p?.a && p?.r) return { access_token: p.a, refresh_token: p.r };
  } catch {
    // corrupted
  }
  return null;
}

export type UserRole = 'admin' | 'operator' | 'viewer';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  userName: string;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchProfile(userId: string): Promise<{ name: string; role: UserRole } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', userId)
    .single();
  return data ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState('');
  const [loading, setLoading] = useState(true);

  function applyProfile(profile: { name: string; role: UserRole } | null) {
    setRole(profile?.role ?? null);
    setUserName(profile?.name ?? '');
  }

  useEffect(() => {
    let settingSession = false;
    const stored = loadTokens();
    if (stored) settingSession = true;

    const timer = setTimeout(() => setLoading(false), 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (!session && settingSession) return;
        clearTimeout(timer);
        if (session?.user) {
          saveTokens({ access_token: session.access_token, refresh_token: session.refresh_token });
          setUser(session.user);
          applyProfile(await fetchProfile(session.user.id).catch(() => null));
        } else {
          saveTokens(null);
          setUser(null);
          applyProfile(null);
        }
        setLoading(false);
      },
    );

    if (stored) {
      supabase.auth.setSession(stored)
        .then(() => { settingSession = false; })
        .catch(() => {
          settingSession = false;
          saveTokens(null);
          setUser(null);
          applyProfile(null);
          setLoading(false);
        });
    }

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string): Promise<string | null> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return error?.message ?? null;
  };

  const signOut = async () => {
    saveTokens(null);
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ user, role, userName, loading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
