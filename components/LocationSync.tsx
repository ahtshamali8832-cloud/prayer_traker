import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useAuth } from '@/lib/authContext';
import { maybeSyncLocationInBackground } from '@/lib/location';

/** Checks GPS on app open and when returning to foreground; updates city if user traveled. */
export function LocationSync() {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id) return;

    const checkTravel = () => maybeSyncLocationInBackground(user.id);
    checkTravel();

    const appStateSub = AppState.addEventListener('change', (state) => {
      if (state === 'active') checkTravel();
    });

    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const onVisible = () => {
        if (document.visibilityState === 'visible') checkTravel();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        appStateSub.remove();
        document.removeEventListener('visibilitychange', onVisible);
      };
    }

    return () => appStateSub.remove();
  }, [user?.id]);

  return null;
}
