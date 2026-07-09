import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/** URL Supabase opens after email confirmation (must be allowlisted in Supabase Auth settings). */
export function getAuthRedirectUrl(): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');

  // Lightweight static page — loads in seconds on mobile (full Expo bundle is very heavy).
  if (Platform.OS === 'web') {
    const origin = configured ?? (typeof window !== 'undefined' ? window.location.origin : '');
    if (origin) return `${origin}/auth-callback.html`;
  }

  if (configured) {
    return `${configured}/auth-callback.html`;
  }

  return Linking.createURL('/auth/callback');
}
