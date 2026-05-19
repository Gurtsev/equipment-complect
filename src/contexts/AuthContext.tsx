import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

const RT_KEY = 'eq_rt_v1';

function saveRefreshToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(RT_KEY, token);
    } else {
      localStorage.removeItem(RT_KEY);
    }
  } catch {
    // ignore
  }
}

function loadRefreshToken(): string | null {
  try {
    return localStorage.getItem(RT_KEY);
  } catch {
    return null;
  }
}

export type UserRole = 'admin' | 'operator' | 'viewer';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  userName: string;
  loading: boolean;
  isRecovery: boolean;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  forgotPassword: (email: string) => Promise<string | null>;
  updatePassword: (password: string) => Promise<string | null>;
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
  const [isRecovery, setIsRecovery] = useState(false);

  function applyProfile(profile: { name: string; role: UserRole } | null) {
    setRole(profile?.role ?? null);
    setUserName(profile?.name ?? '');
  }

  // fetchProfile вызывается вне onAuthStateChange, чтобы избежать дедлока
  // с внутренним локом Supabase, который держится во время вызова колбека
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchProfile(user.id)
      .catch(() => null)
      .then(profile => { if (!cancelled) applyProfile(profile); });
    return () => { cancelled = true; };
  }, [user?.id]);

  useEffect(() => {
    let settingSession = false;
    const storedRT = loadRefreshToken();
    if (storedRT) settingSession = true;

    const timer = setTimeout(() => setLoading(false), 10000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'PASSWORD_RECOVERY') {
          clearTimeout(timer);
          setIsRecovery(true);
          setUser(session?.user ?? null);
          setLoading(false);
          return;
        }
        if (!session && settingSession) return;
        clearTimeout(timer);
        if (session?.user) {
          saveRefreshToken(session.refresh_token);
          setUser(session.user);
          setLoading(false);
        } else {
          saveRefreshToken(null);
          setUser(null);
          applyProfile(null);
          setIsRecovery(false);
          setLoading(false);
        }
      },
    );

    if (storedRT) {
      supabase.auth.refreshSession({ refresh_token: storedRT })
        .then(() => { settingSession = false; })
        .catch(() => {
          settingSession = false;
          saveRefreshToken(null);
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
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (data.session?.refresh_token) {
      saveRefreshToken(data.session.refresh_token);
    }
    return error?.message ?? null;
  };

  const signUp = async (email: string, password: string, name: string): Promise<string | null> => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    return error?.message ?? null;
  };

  const signOut = async () => {
    saveRefreshToken(null);
    await supabase.auth.signOut();
  };

  const forgotPassword = async (email: string): Promise<string | null> => {
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return error?.message ?? null;
  };

  const updatePassword = async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setIsRecovery(false);
    return error?.message ?? null;
  };

  return (
    <AuthContext.Provider value={{ user, role, userName, loading, isRecovery, signIn, signUp, signOut, forgotPassword, updatePassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
