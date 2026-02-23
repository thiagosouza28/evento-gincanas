import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const PROFILE_TIMEOUT_MS = 5000;
const PROFILE_FAILURE_COOLDOWN_MS = 20000;
const profileFailureAt = new Map<string, number>();
const profileCache = new Map<string, Profile | null>();

function inProfileCooldown(userId: string) {
  const last = profileFailureAt.get(userId);
  if (!last) return false;
  return Date.now() - last < PROFILE_FAILURE_COOLDOWN_MS;
}

interface Profile {
  id: string;
  user_id: string;
  nome: string | null;
  avatar_url: string | null;
  role?: string | null;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  updateProfile: (data: Partial<Profile>) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const lastProfileUserIdRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    if (inProfileCooldown(userId)) {
      return profileCache.get(userId) ?? null;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), PROFILE_TIMEOUT_MS);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, user_id, nome, avatar_url, role')
        .eq('user_id', userId)
        .maybeSingle()
        .abortSignal(controller.signal);

      if (error) {
        profileFailureAt.set(userId, Date.now());
        console.error('Erro ao buscar perfil:', error);
        return profileCache.get(userId) ?? null;
      }

      profileFailureAt.delete(userId);
      profileCache.set(userId, data || null);
      return data;
    } catch (error) {
      profileFailureAt.set(userId, Date.now());
      console.error('Erro ao buscar perfil:', error);
      return profileCache.get(userId) ?? null;
    } finally {
      clearTimeout(timer);
    }
  };

  useEffect(() => {
    let active = true;

    const safeSetLoading = (value: boolean) => {
      if (!active) return;
      setLoading(value);
    };

    const safeSetProfileFromUser = async (nextUser: User | null) => {
      if (!active) return;
      if (!nextUser) {
        setProfile(null);
        lastProfileUserIdRef.current = null;
        return;
      }

      if (lastProfileUserIdRef.current === nextUser.id && profileCache.has(nextUser.id)) {
        setProfile(profileCache.get(nextUser.id) ?? null);
        return;
      }

      const nextProfile = await fetchProfile(nextUser.id);
      if (!active) return;
      setProfile(nextProfile);
      lastProfileUserIdRef.current = nextUser.id;
    };

    const watchdog = setTimeout(() => {
      safeSetLoading(false);
    }, 8000);

    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, nextSession) => {
        if (!active) return;
        setSession(nextSession);
        setUser(nextSession?.user || null);

        // Defer profile fetch with setTimeout to avoid deadlock
        setTimeout(() => {
          safeSetProfileFromUser(nextSession?.user || null);
        }, 0);

        safeSetLoading(false);
      }
    );

    // THEN check for existing session
    const loadInitialSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.error('Erro ao recuperar sessão:', error);
          if (!active) return;
          setSession(null);
          setUser(null);
          setProfile(null);
          return;
        }

        if (!active) return;
        const nextSession = data.session;
        setSession(nextSession);
        setUser(nextSession?.user || null);
        await safeSetProfileFromUser(nextSession?.user || null);
      } catch (error) {
        console.error('Falha ao inicializar autenticação:', error);
        if (!active) return;
        setSession(null);
        setUser(null);
        setProfile(null);
      } finally {
        safeSetLoading(false);
      }
    };

    void loadInitialSession();

    return () => {
      active = false;
      clearTimeout(watchdog);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    return { error: error as Error | null };
  };

  const signUp = async (email: string, password: string, nome: string) => {
    const redirectUrl = `${window.location.origin}/`;
    
    try {
      // Use custom signup edge function to send email from custom domain
      const response = await fetch(`${SUPABASE_URL}/functions/v1/custom-signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_PUBLISHABLE_KEY,
          Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          email,
          password,
          nome,
          redirectUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        return { error: new Error(result.error || 'Erro ao criar conta') };
      }

      if (result.warning) {
        console.warn('Signup warning:', result.warning);
      }

      return { error: null };
    } catch (error) {
      console.error('Error in signUp:', error);
      return { error: error as Error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
  };

  const updateProfile = async (data: Partial<Profile>) => {
    if (!user) {
      return { error: new Error('Usuário não autenticado') };
    }

    const { error } = await supabase
      .from('profiles')
      .update({ ...data, updated_at: new Date().toISOString() })
      .eq('user_id', user.id);

    if (!error) {
      setProfile((prev) => prev ? { ...prev, ...data } : null);
    }

    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        updateProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
