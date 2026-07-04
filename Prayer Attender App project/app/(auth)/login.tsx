import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { showAlert } from '@/lib/alert';
import { supabase } from '@/lib/supabase';
import { syncLocationOnLogin } from '@/lib/location';
import { AppTextInput } from '@/components/AppTextInput';
import { Mail, Lock, LogIn, Moon } from 'lucide-react-native';

export default function LoginScreen() {
  const { colors } = useTheme();
  const { signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setErrorMessage('Please enter email and password.');
      return;
    }

    setErrorMessage('');
    setStatusMessage('');
    setLoading(true);
    const { error } = await signIn(email.trim(), password);

    if (error) {
      setLoading(false);
      setErrorMessage(error);
      showAlert('Login Failed', error, 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setStatusMessage('Detecting your location...');
      const result = await syncLocationOnLogin(user.id);
      if (result.ok && result.location) {
        setStatusMessage(`${result.location.city}, ${result.location.country}`);
        setLoading(false);
        showAlert(
          'Welcome back',
          `Signed in from ${result.location.city}, ${result.location.country}.`,
          'success'
        );
        router.replace('/(tabs)/dashboard');
        return;
      }
    }

    setLoading(false);
    showAlert('Welcome back', 'Signed in successfully.', 'success');
    router.replace('/(tabs)/dashboard');
  };

  const styles = makeStyles(colors);

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          <View style={styles.logoContainer}>
            <View style={styles.logoCircle}>
              <Moon size={36} color={colors.primary} />
            </View>
            <Text style={styles.title}>Prayer Tracker</Text>
            <Text style={styles.subtitle}>Sign in to track your prayers</Text>
          </View>

          <AppTextInput
            label="Email"
            icon={Mail}
            value={email}
            onChangeText={setEmail}
            placeholder="your@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />

          <AppTextInput
            label="Password"
            icon={Lock}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoComplete="password"
          />

          {statusMessage ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{statusMessage}</Text>
            </View>
          ) : null}

          {errorMessage ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{errorMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <LogIn size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Sign In</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Don't have an account?</Text>
            <Link href="/(auth)/signup" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign Up</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function makeStyles(colors: ReturnType<typeof useTheme>['colors']) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    flex: {
      flex: 1,
    },
    scrollContent: {
      flexGrow: 1,
      justifyContent: 'center',
      padding: 24,
      paddingTop: 40,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 28,
    },
    logoCircle: {
      width: 72,
      height: 72,
      borderRadius: 36,
      backgroundColor: colors.primaryLight,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    subtitle: {
      fontSize: 15,
      color: colors.textSecondary,
      marginTop: 6,
    },
    errorBox: {
      backgroundColor: '#FEE2E2',
      borderColor: '#FCA5A5',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    errorText: {
      color: '#B91C1C',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    infoBox: {
      backgroundColor: '#DBEAFE',
      borderColor: '#93C5FD',
      borderWidth: 1,
      borderRadius: 12,
      padding: 12,
      marginBottom: 16,
    },
    infoText: {
      color: '#1D4ED8',
      fontSize: 14,
      fontWeight: '600',
      textAlign: 'center',
    },
    primaryButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      padding: 16,
      borderRadius: 14,
      marginTop: 6,
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    footer: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 6,
      marginTop: 24,
    },
    footerText: {
      fontSize: 15,
      color: colors.textSecondary,
    },
    linkText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.primary,
    },
  });
}
