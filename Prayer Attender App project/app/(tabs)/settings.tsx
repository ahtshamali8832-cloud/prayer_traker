import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '@/lib/themeContext';
import { useAuth } from '@/lib/authContext';
import { showAlert, showConfirmAlert } from '@/lib/alert';
import { AppTextInput } from '@/components/AppTextInput';
import { supabase } from '@/lib/supabase';
import { getPrayerTimes, CALCULATION_METHODS } from '@/lib/prayerTimes';
import { loadUserPrayerSettings, syncLocationOnLogin, onLocationUpdated, notifyPrayerSettingsUpdated } from '@/lib/location';
import {
  Moon,
  Sun,
  MapPin,
  Volume2,
  VolumeX,
  Bell,
  Calculator,
  Building,
  Globe,
  Save,
  RotateCcw,
  CheckCircle2,
  Info,
  ChevronRight,
  LogOut,
  User,
} from 'lucide-react-native';

interface PrayerSettings {
  id: string;
  latitude: number;
  longitude: number;
  timezone: string;
  calculation_method: string;
  city: string;
  country: string;
  sound_enabled: boolean;
}

export default function SettingsScreen() {
  const { colors, theme, toggleTheme } = useTheme();
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [settings, setSettings] = useState<PrayerSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMethodPicker, setShowMethodPicker] = useState(false);

  // Form state
  const [latitude, setLatitude] = useState('24.8607');
  const [longitude, setLongitude] = useState('67.0011');
  const [city, setCity] = useState('');
  const [country, setCountry] = useState('');
  const [timezone, setTimezone] = useState('');
  const [calculationMethod, setCalculationMethod] = useState('Karachi');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [darkMode, setDarkMode] = useState(theme === 'dark');
  const [detectingLocation, setDetectingLocation] = useState(false);

  useEffect(() => {
    if (user) loadSettings();
  }, [user]);

  useEffect(() => {
    const unsubscribe = onLocationUpdated(() => {
      if (user) loadSettings();
    });
    return unsubscribe;
  }, [user]);

  useEffect(() => {
    setDarkMode(theme === 'dark');
  }, [theme]);

  const loadSettings = async () => {
    if (!user) return;
    try {
      const data = await loadUserPrayerSettings(user.id);

      if (data) {
        setSettings(data);
        setLatitude(data.latitude.toString());
        setLongitude(data.longitude.toString());
        setCity(data.city);
        setCountry(data.country);
        setTimezone(data.timezone || '');
        setCalculationMethod(data.calculation_method);
        setSoundEnabled(data.sound_enabled);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    }
  };

  const saveSettings = async () => {
    if (!user) return;
    try {
      setSaving(true);
      const lat = parseFloat(latitude);
      const lng = parseFloat(longitude);

      if (isNaN(lat) || isNaN(lng)) {
        showAlert('Invalid Coordinates', 'Please enter valid latitude and longitude values.', 'warning');
        return;
      }

      const updateData = {
        latitude: lat,
        longitude: lng,
        city,
        country,
        timezone: timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
        calculation_method: calculationMethod,
        sound_enabled: soundEnabled,
      };

      if (settings?.id) {
        await supabase
          .from('prayer_settings')
          .update(updateData)
          .eq('id', settings.id);
      } else {
        await supabase.from('prayer_settings').insert({ ...updateData, user_id: user.id });
      }

      setSaved(true);
      notifyPrayerSettingsUpdated();
      showAlert('Settings Saved', 'Your prayer preferences were updated.', 'success');
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert('Error', 'Failed to save settings.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDetectLocation = async () => {
    if (!user) return;
    try {
      setDetectingLocation(true);
      const result = await syncLocationOnLogin(user.id);
      if (result.ok && result.location) {
        setLatitude(result.location.latitude.toString());
        setLongitude(result.location.longitude.toString());
        setCity(result.location.city);
        setCountry(result.location.country);
        setTimezone(result.location.timezone);
        setCalculationMethod(result.location.calculationMethod);
        showAlert(
          'Location Updated',
          `Prayer times will use ${result.location.city}, ${result.location.country}.`,
          'success'
        );
        await loadSettings();
      } else {
        showAlert('Location', result.error || 'Could not detect your location.', 'warning');
      }
    } finally {
      setDetectingLocation(false);
    }
  };

  const resetToDefault = () => {
    setLatitude('24.8607');
    setLongitude('67.0011');
    setCity('Karachi');
    setCountry('Pakistan');
    setCalculationMethod('Karachi');
    setSoundEnabled(true);
  };

  const handleDarkModeToggle = (value: boolean) => {
    setDarkMode(value);
    if (value !== (theme === 'dark')) {
      toggleTheme();
    }
  };

  const handleLogout = () => {
    showConfirmAlert(
      'Sign Out',
      'Are you sure you want to sign out?',
      async () => {
        await signOut();
        showAlert('Signed Out', 'You have been logged out successfully.', 'success');
        router.replace('/(auth)/login');
      },
      { confirmText: 'Sign Out', icon: 'warning' }
    );
  };

  const styles = makeStyles(colors);

  const renderMethodPicker = () => {
    if (!showMethodPicker) return null;
    return (
      <View style={styles.pickerOverlay}>
        <View style={styles.pickerContainer}>
          <Text style={styles.pickerTitle}>Select Calculation Method</Text>
          <ScrollView style={styles.pickerList}>
            {CALCULATION_METHODS.map((method) => (
              <TouchableOpacity
                key={method.value}
                style={[
                  styles.pickerItem,
                  calculationMethod === method.value && styles.pickerItemActive,
                ]}
                onPress={() => {
                  setCalculationMethod(method.value);
                  setShowMethodPicker(false);
                }}>
                <Text
                  style={[
                    styles.pickerItemText,
                    calculationMethod === method.value && styles.pickerItemTextActive,
                  ]}>
                  {method.label}
                </Text>
                {calculationMethod === method.value && (
                  <CheckCircle2 size={18} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity
            style={styles.pickerCancel}
            onPress={() => setShowMethodPicker(false)}>
            <Text style={styles.pickerCancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Configure your prayer preferences</Text>
        </View>

        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
                  <User size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Signed in as</Text>
                  <Text style={styles.settingHint}>{user?.email}</Text>
                </View>
              </View>
            </View>
            <View style={styles.inputDivider} />
            <TouchableOpacity style={styles.settingRow} onPress={handleLogout}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: '#FEF2F2' }]}>
                  <LogOut size={20} color={colors.error} />
                </View>
                <Text style={[styles.settingLabel, { color: colors.error }]}>Sign Out</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Appearance Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.accentLight }]}>
                  {darkMode ? (
                    <Moon size={20} color={colors.accent} />
                  ) : (
                    <Sun size={20} color={colors.accent} />
                  )}
                </View>
                <View>
                  <Text style={styles.settingLabel}>Dark Mode</Text>
                  <Text style={styles.settingHint}>
                    {darkMode ? 'Dark theme active' : 'Light theme active'}
                  </Text>
                </View>
              </View>
              <Switch
                value={darkMode}
                onValueChange={handleDarkModeToggle}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={darkMode ? colors.primary : '#FFFFFF'}
              />
            </View>
          </View>
        </View>

        {/* Notifications Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <View style={styles.settingCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingLeft}>
                <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
                  <Bell size={20} color={colors.primary} />
                </View>
                <View>
                  <Text style={styles.settingLabel}>Azan Sound</Text>
                  <Text style={styles.settingHint}>
                    Play "Allahu Akbar" at prayer time
                  </Text>
                </View>
              </View>
              <Switch
                value={soundEnabled}
                onValueChange={setSoundEnabled}
                trackColor={{ false: colors.border, true: colors.primary }}
                thumbColor={soundEnabled ? colors.primary : '#FFFFFF'}
              />
            </View>
          </View>
        </View>

        {/* Location Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Location</Text>
          <TouchableOpacity
            style={[styles.detectButton, detectingLocation && styles.buttonDisabled]}
            onPress={handleDetectLocation}
            disabled={detectingLocation}>
            <MapPin size={18} color="#FFFFFF" />
            <Text style={styles.detectButtonText}>
              {detectingLocation ? 'Detecting location...' : 'Use My Current Location'}
            </Text>
          </TouchableOpacity>
          <AppTextInput
            label="City"
            icon={MapPin}
            value={city}
            onChangeText={setCity}
            placeholder="Enter city name"
          />
          <AppTextInput
            label="Country"
            icon={Globe}
            value={country}
            onChangeText={setCountry}
            placeholder="Enter country name"
          />
          <View style={styles.coordinatesRow}>
            <AppTextInput
              label="Latitude"
              icon={Building}
              value={latitude}
              onChangeText={setLatitude}
              keyboardType="numeric"
              placeholder="0.00"
              containerStyle={styles.coordField}
            />
            <AppTextInput
              label="Longitude"
              icon={Building}
              value={longitude}
              onChangeText={setLongitude}
              keyboardType="numeric"
              placeholder="0.00"
              containerStyle={styles.coordField}
            />
          </View>
        </View>

        {/* Calculation Method Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Calculation Method</Text>
          <TouchableOpacity
            style={styles.methodButton}
            onPress={() => setShowMethodPicker(true)}>
            <View style={styles.methodButtonLeft}>
              <View style={[styles.settingIcon, { backgroundColor: colors.primaryLight }]}>
                <Calculator size={20} color={colors.primary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Prayer Calculation</Text>
                <Text style={styles.methodValue}>
                  {CALCULATION_METHODS.find((m) => m.value === calculationMethod)?.label || calculationMethod}
                </Text>
              </View>
            </View>
            <ChevronRight size={20} color={colors.textMuted} />
          </TouchableOpacity>
        </View>

        {/* Info Card */}
        <View style={styles.section}>
          <View style={styles.infoCard}>
            <Info size={18} color={colors.textMuted} />
            <Text style={styles.infoText}>
              Prayer times are calculated automatically based on your location and selected method. 
              Adjust the coordinates for precise timing.
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[
              styles.saveButton,
              saved && styles.saveButtonSuccess,
            ]}
            onPress={saveSettings}
            disabled={saving}>
            {saved ? (
              <CheckCircle2 size={20} color={colors.success} />
            ) : (
              <Save size={20} color={colors.primary} />
            )}
            <Text style={styles.saveButtonText}>
              {saved ? 'Saved!' : saving ? 'Saving...' : 'Save Settings'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={resetToDefault}>
            <RotateCcw size={18} color={colors.error} />
            <Text style={styles.resetButtonText}>Reset to Default</Text>
          </TouchableOpacity>
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {renderMethodPicker()}
    </View>
  );
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    scrollView: {
      flex: 1,
    },
    header: {
      paddingTop: 16,
      paddingHorizontal: 16,
      paddingBottom: 16,
    },
    headerTitle: {
      fontSize: 28,
      fontWeight: '700',
      color: colors.text,
      letterSpacing: -0.5,
    },
    headerSubtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      marginTop: 4,
    },
    section: {
      paddingHorizontal: 16,
      marginBottom: 20,
    },
    sectionTitle: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textMuted,
      textTransform: 'uppercase',
      letterSpacing: 1,
      marginBottom: 8,
    },
    settingCard: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    settingRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
    },
    settingLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    settingIcon: {
      width: 40,
      height: 40,
      borderRadius: 20,
      justifyContent: 'center',
      alignItems: 'center',
    },
    settingLabel: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    settingHint: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    inputGroup: {
      padding: 14,
    },
    inputLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 6,
    },
    inputLabel: {
      fontSize: 13,
      fontWeight: '600',
      color: colors.textMuted,
    },
    input: {
      fontSize: 16,
      color: colors.text,
      padding: 0,
      fontWeight: '500',
    },
    inputDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginLeft: 14,
    },
    coordinatesRow: {
      flexDirection: 'row',
      gap: 10,
    },
    coordField: {
      flex: 1,
      marginBottom: 0,
    },
    detectButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      backgroundColor: colors.primary,
      borderRadius: 14,
      marginBottom: 14,
    },
    detectButtonText: {
      fontSize: 15,
      fontWeight: '700',
      color: '#FFFFFF',
    },
    buttonDisabled: {
      opacity: 0.7,
    },
    methodButton: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 16,
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
    },
    methodButtonLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
      flex: 1,
    },
    methodValue: {
      fontSize: 13,
      color: colors.textMuted,
      marginTop: 2,
    },
    infoCard: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: 10,
      padding: 14,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
    },
    infoText: {
      flex: 1,
      fontSize: 13,
      color: colors.textSecondary,
      lineHeight: 18,
    },
    actionButtons: {
      paddingHorizontal: 16,
      gap: 10,
      marginTop: 8,
    },
    saveButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      padding: 16,
      backgroundColor: colors.primaryLight,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.primary,
    },
    saveButtonSuccess: {
      borderColor: colors.success,
      backgroundColor: '#F0FDF4',
    },
    saveButtonText: {
      fontSize: 16,
      fontWeight: '700',
      color: colors.primary,
    },
    resetButton: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 8,
      padding: 14,
      borderRadius: 14,
    },
    resetButtonText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.error,
    },
    pickerOverlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    pickerContainer: {
      backgroundColor: colors.card,
      borderRadius: 20,
      width: '100%',
      maxHeight: 400,
      padding: 20,
      borderWidth: 1,
      borderColor: colors.border,
    },
    pickerTitle: {
      fontSize: 18,
      fontWeight: '700',
      color: colors.text,
      marginBottom: 16,
      textAlign: 'center',
    },
    pickerList: {
      maxHeight: 280,
    },
    pickerItem: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 12,
      borderRadius: 10,
      marginBottom: 4,
    },
    pickerItemActive: {
      backgroundColor: colors.primaryLight,
    },
    pickerItemText: {
      fontSize: 15,
      color: colors.text,
      fontWeight: '500',
    },
    pickerItemTextActive: {
      color: colors.primary,
      fontWeight: '700',
    },
    pickerCancel: {
      marginTop: 12,
      padding: 14,
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 10,
      alignItems: 'center',
    },
    pickerCancelText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
  });
}
