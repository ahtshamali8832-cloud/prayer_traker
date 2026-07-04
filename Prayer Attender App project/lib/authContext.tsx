import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

function formatAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes('email rate limit exceeded') || lower.includes('rate limit')) {
    return 'Too many auth emails were sent. Wait about 1 hour, or add a test user in Supabase Dashboard → Authentication → Users.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please confirm your email first, then try signing in again.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Wrong email or password. If you just signed up, confirm your email or wait for the rate limit to reset.';
  }

  return message;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name?: string) => Promise<{ error: string | null; message?: string }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSession(session);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) return { error: formatAuthError(error.message) };
      if (data.session) setSession(data.session);
      return { error: null };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in. Check your connection.';
      return { error: message };
    }
  };

  const signUp = async (email: string, password: string, name?: string) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: name?.trim()
          ? { data: { full_name: name.trim() } }
          : undefined,
      });
      if (error) return { error: formatAuthError(error.message) };
      if (data.session) {
        setSession(data.session);
        return { error: null, message: 'Welcome! Your account is ready.' };
      }
      return {
        error: null,
        message: 'Account created. Check your email to confirm your address, then sign in.',
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign up. Check your connection.';
      return { error: message };
    }
  };

  const signOut = async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        loading,
        signIn,
        signUp,
        signOut,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
