import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { supabase } from '@/lib/supabase';

function clearAuthParamsFromUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

async function resolveSessionFromUrl() {
  if (Platform.OS !== 'web' || typeof window === 'undefined') {
    return supabase.auth.getSession();
  }

  const params = new URLSearchParams(window.location.search);
  const code = params.get('code');

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw error;
    return { data: { session: data.session }, error: null };
  }

  return supabase.auth.getSession();
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const [message, setMessage] = useState('Verifying your email...');
  const [handled, setHandled] = useState(false);

  useEffect(() => {
    if (loading || handled) return;

    if (session) {
      setHandled(true);
      clearAuthParamsFromUrl();
      router.replace('/(tabs)/dashboard');
      return;
    }

    let cancelled = false;

    const verify = async () => {
      try {
        const { data: { session: freshSession } } = await resolveSessionFromUrl();
        if (cancelled) return;

        setHandled(true);
        clearAuthParamsFromUrl();

        if (freshSession) {
          setMessage('Email verified! Redirecting...');
          router.replace('/(tabs)/dashboard');
          return;
        }

        setMessage('Email verified. Please sign in.');
        router.replace('/(auth)/login');
      } catch {
        if (cancelled) return;
        setHandled(true);
        setMessage('Verification failed. Please sign in.');
        router.replace('/(auth)/login');
      }
    };

    verify();
    return () => {
      cancelled = true;
    };
  }, [session, loading, handled, router]);

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 16,
  },
  message: {
    fontSize: 16,
    textAlign: 'center',
  },
});
