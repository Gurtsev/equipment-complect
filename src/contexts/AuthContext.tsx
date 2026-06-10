import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import type { EquipmentDepartment } from '../models/Equipment';

export type UserRole = 'admin' | 'operator' | 'viewer';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  userName: string;
  userDepartment: EquipmentDepartment | null;
  loading: boolean;
  isRecovery: boolean;
  recoveryError: string | null;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<string | null>;
}

const AuthContext = createContext<AuthState | null>(null);

async function fetchOrCreateProfile(
  user: User,
): Promise<{ name: string; role: UserRole; department: EquipmentDepartment | null } | null> {
  const { data } = await supabase
    .from('profiles')
    .select('name, role, department')
    .eq('id', user.id)
    .single();

  if (data) return data;

  // Пользователь пришёл через SSO из Nexus — профиля нет, создаём viewer.
  // Inventory-admin потом повысит роль вручную.
  const name =
    (user.user_metadata?.name as string | undefined) ??
    user.email?.split('@')[0] ??
    'Пользователь';

  const { data: created } = await supabase
    .from('profiles')
    .insert({ id: user.id, name, role: 'viewer', email: user.email })
    .select('name, role, department')
    .single();

  return created ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<UserRole | null>(null);
  const [userName, setUserName] = useState('');
  const [userDepartment, setUserDepartment] = useState<EquipmentDepartment | null>(null);
  const [loading, setLoading] = useState(true);
  const [isRecovery, setIsRecovery] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  function applyProfile(
    profile: { name: string; role: UserRole; department: EquipmentDepartment | null } | null,
  ) {
    setRole(profile?.role ?? null);
    setUserName(profile?.name ?? '');
    setUserDepartment(profile?.department ?? null);
  }

  // Обрабатываем error-фрагменты (просроченные ссылки восстановления пароля).
  // supabase-js с detectSessionInUrl: true парсит валидные токены сам,
  // но ошибки (error=...) в fragment он не обрабатывает.
  useEffect(() => {
    const hash = window.location.hash;
    if (!hash.includes('error=')) return;
    const params = new URLSearchParams(hash.slice(1));
    const code = params.get('error_code');
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setRecoveryError(
      code === 'otp_expired' ? 'Ссылка устарела. Запросите новую.' : 'Ссылка недействительна.',
    );
    setLoading(false);
  }, []);

  // fetchOrCreateProfile вызывается вне onAuthStateChange — избегаем дедлока
  // с внутренним мьютексом supabase-js клиента.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    fetchOrCreateProfile(user)
      .catch(() => null)
      .then(profile => {
        if (!cancelled) applyProfile(profile);
      });
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 10000);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // INITIAL_SESSION срабатывает синхронно при подписке, часто с session: null —
      // detectSessionInUrl ещё не успел разобрать токены SSO из хеша. Если довериться
      // этому событию, App.tsx увидит !user и сразу редиректнёт на Nexus, не дождавшись
      // реальной сессии — бесконечный цикл редиректов. Дожидаемся getSession() ниже.
      if (event === 'INITIAL_SESSION') return;
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timer);
        setIsRecovery(true);
        setUser(session?.user ?? null);
        setLoading(false);
        return;
      }
      clearTimeout(timer);
      if (session?.user) {
        setUser(session.user);
        setLoading(false);
      } else {
        setUser(null);
        applyProfile(null);
        setIsRecovery(false);
        setLoading(false);
      }
    });

    // Восстановить сессию при старте.
    (async () => {
      // detectSessionInUrl требует access_token+expires_in+refresh_token+token_type
      // в хеше и молча проваливается, если Nexus передаёт только access_token+refresh_token.
      // Поэтому разбираем хеш сами и поднимаем сессию через setSession().
      const hashParams = new URLSearchParams(window.location.hash.slice(1));
      const at = hashParams.get('access_token');
      const rt = hashParams.get('refresh_token');
      if (at && rt) {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
        await supabase.auth.setSession({ access_token: at, refresh_token: rt });
      }

      // persistSession: true хранит сессию в localStorage — подхватываем при обычной загрузке.
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
      }
      clearTimeout(timer);
      setLoading(false);
    })();

    return () => {
      clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    // Сразу уходим на логаут Nexus, не дожидаясь signOut(): иначе onAuthStateChange
    // успевает обновить user=null до навигации, App.tsx видит !user и редиректит
    // на /login раньше, чем мы — на /?logout=1 (а сессия Nexus в этот момент ещё жива,
    // /login тут же переавторизует обратно — выход не происходит).
    const pending = supabase.auth.signOut();
    window.location.href = 'https://nexus.knzteam.ru/?logout=1';
    await pending;
  };

  const updatePassword = async (password: string): Promise<string | null> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (!error) setIsRecovery(false);
    return error?.message ?? null;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        role,
        userName,
        userDepartment,
        loading,
        isRecovery,
        recoveryError,
        signOut,
        updatePassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
