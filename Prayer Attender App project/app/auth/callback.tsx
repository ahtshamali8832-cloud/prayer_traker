import { useEffect, useState } from 'react';
import { View, Text, ActivityIndicator, StyleSheet, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@/lib/authContext';
import { useTheme } from '@/lib/themeContext';
import { supabase } from '@/lib/supabase';

function clearAuthHashFromUrl() {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
}

export default function AuthCallbackScreen() {
  const router = useRouter();
  const { session, loading } = useAuth();
  const { colors } = useTheme();
  const [message, setMessage] = useState('Verifying your email...');

  useEffect(() => {
    if (loading) return;

    if (session) {
      clearAuthHashFromUrl();
      setMessage('Email verified! Redirecting...');
      router.replace('/(tabs)/dashboard');
      return;
    }

    let cancelled = false;

    const verifyFromUrl = async () => {
      const { data: { session: freshSession } } = await supabase.auth.getSession();

      if (cancelled) return;

      if (freshSession) {
        clearAuthHashFromUrl();
        setMessage('Email verified! Redirecting...');
        router.replace('/(tabs)/dashboard');
        return;
      }

      setMessage('Email verified. Please sign in with your account.');
      clearAuthHashFromUrl();
      router.replace('/(auth)/login');
    };

    const timer = setTimeout(verifyFromUrl, 800);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [session, loading, router]);

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
