import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';

type Theme = 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  colors: typeof lightColors;
}

const lightColors = {
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceSecondary: '#F1F5F9',
  text: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  primary: '#059669',
  primaryLight: '#D1FAE5',
  accent: '#F59E0B',
  accentLight: '#FEF3C7',
  border: '#E2E8F0',
  error: '#EF4444',
  success: '#10B981',
  card: '#FFFFFF',
  header: '#FFFFFF',
  tabBar: '#FFFFFF',
  tabBarActive: '#059669',
  tabBarInactive: '#94A3B8',
  divider: '#E2E8F0',
  prayerCard: '#F0FDF4',
  attendedCard: '#D1FAE5',
  missedCard: '#FEF2F2',
  islamicGreen: '#059669',
  islamicGold: '#D4A574',
  moon: '#64748B',
};

const darkColors = {
  background: '#0F172A',
  surface: '#1E293B',
  surfaceSecondary: '#334155',
  text: '#F1F5F9',
  textSecondary: '#94A3B8',
  textMuted: '#64748B',
  primary: '#10B981',
  primaryLight: '#064E3B',
  accent: '#FBBF24',
  accentLight: '#451A03',
  border: '#334155',
  error: '#EF4444',
  success: '#10B981',
  card: '#1E293B',
  header: '#1E293B',
  tabBar: '#1E293B',
  tabBarActive: '#10B981',
  tabBarInactive: '#64748B',
  divider: '#334155',
  prayerCard: '#064E3B',
  attendedCard: '#065F46',
  missedCard: '#7F1D1D',
  islamicGreen: '#10B981',
  islamicGold: '#D4A574',
  moon: '#CBD5E1',
};

const ThemeContext = createContext<ThemeContextType>({
  theme: 'light',
  toggleTheme: () => {},
  colors: lightColors,
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme();
  const [theme, setTheme] = useState<Theme>(systemScheme === 'dark' ? 'dark' : 'light');

  useEffect(() => {
    if (systemScheme) {
      setTheme(systemScheme === 'dark' ? 'dark' : 'light');
    }
  }, [systemScheme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  const colors = theme === 'light' ? lightColors : darkColors;

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
