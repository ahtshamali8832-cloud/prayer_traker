import { Platform } from 'react-native';
import * as Linking from 'expo-linking';

/** URL Supabase opens after email confirmation (must be allowlisted in Supabase Auth settings). */
export function getAuthRedirectUrl(): string {
  const configured = process.env.EXPO_PUBLIC_APP_URL?.replace(/\/$/, '');

  if (configured) {
    return `${configured}/auth/callback`;
  }

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }

  return Linking.createURL('/auth/callback');
}
