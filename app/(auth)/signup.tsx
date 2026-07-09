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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Link, useRouter } from 'expo-router';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { showAlert } from '@/lib/alert';
import { AppTextInput } from '@/components/AppTextInput';
import { Mail, Lock, User, UserPlus } from 'lucide-react-native';

const appLogo = require('@/assets/images/icon.png');

export default function SignupScreen() {
  const { colors } = useTheme();
  const { signUp } = useAuth();
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [infoMessage, setInfoMessage] = useState('');

  const handleSignup = async () => {
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setErrorMessage('Please fill in all fields.');
      setInfoMessage('');
      return;
    }

    if (password.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      setInfoMessage('');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      setInfoMessage('');
      return;
    }

    setErrorMessage('');
    setInfoMessage('');
    setStatusMessage('');
    setLoading(true);
    const { error, message } = await signUp(email.trim(), password, name.trim());

    if (error) {
      setLoading(false);
      setErrorMessage(error);
      showAlert('Signup Failed', error, 'error');
      return;
    }

    if (message) {
      setInfoMessage(message);
      showAlert('Account Created', message, 'success');
    }

    if (message === 'Welcome! Your account is ready.') {
      setLoading(false);
      router.replace('/(tabs)/dashboard');
      return;
    }

    setLoading(false);
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
            <Image source={appLogo} style={styles.logoImage} resizeMode="contain" />
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>Start tracking your daily prayers</Text>
          </View>

          <AppTextInput
            label="Full Name"
            icon={User}
            value={name}
            onChangeText={setName}
            placeholder="Your name"
            autoCapitalize="words"
            autoComplete="name"
          />

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
            placeholder="At least 6 characters"
            secureTextEntry
            autoComplete="new-password"
          />

          <AppTextInput
            label="Confirm Password"
            icon={Lock}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            placeholder="Re-enter your password"
            secureTextEntry
            autoComplete="new-password"
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

          {infoMessage ? (
            <View style={styles.infoBox}>
              <Text style={styles.infoText}>{infoMessage}</Text>
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSignup}
            disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <UserPlus size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Create Account</Text>
              </>
            )}
          </TouchableOpacity>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Already have an account?</Text>
            <Link href="/(auth)/login" asChild>
              <TouchableOpacity>
                <Text style={styles.linkText}>Sign In</Text>
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
      paddingBottom: 32,
    },
    logoContainer: {
      alignItems: 'center',
      marginBottom: 28,
    },
    logoImage: {
      width: 72,
      height: 52,
      marginBottom: 16,
      transform: [{ scaleX: 1.18 }, { scaleY: 0.9 }],
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
