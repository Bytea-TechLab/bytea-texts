import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 🎨 BYTEA DESIGN SYSTEM v1.0 - MODO CLARO
const lightTheme = {
  isDark: false,
  primary: '#3D7BFF',
  secondary: '#756BFF',
  success: '#32D583',
  warning: '#F79009',
  danger: '#F04438',
  bg: '#F8FAFC',
  surface: '#FFFFFF',
  text: '#111827',
  textMuted: '#6B7280',
  textHint: '#9CA3AF',
  border: '#E2E8F0',
  dangerBg: '#FEF3F2',
  dangerText: '#F04438',
  chipActiveBg: '#3D7BFF',
  chipActiveText: '#FFFFFF',
  modalOverlay: 'rgba(17, 24, 39, 0.4)',
  tagFavBg: '#FEF0C7',
  tagFavText: '#F79009',
  tagBg: '#F1F5F9',
  tagText: '#6B7280',
  statusConcluidoBg: '#D1FADF',
  statusConcluidoText: '#12B76A',
  statusAndamentoBg: '#E0EAFF',
  statusAndamentoText: '#3D7BFF',
  statusRascunhoBg: '#F1F5F9',
  statusRascunhoText: '#6B7280',
  tagClassBg: '#EBE9FE',
  tagClassText: '#756BFF',
  searchBg: '#F1F5F9',
  blurTint: 'light' as const,
};

// 🎨 BYTEA DESIGN SYSTEM v1.0 - MODO ESCURO
const darkTheme = {
  isDark: true,
  primary: '#3D7BFF',
  secondary: '#756BFF',
  success: '#32D583',
  warning: '#F79009',
  danger: '#F04438',
  bg: '#0D1117',
  surface: '#111827',
  text: '#F8FAFC',
  textMuted: '#9CA3AF',
  textHint: '#4B5563',
  border: '#1F2937',
  dangerBg: 'rgba(240, 68, 56, 0.15)',
  dangerText: '#FDA29B',
  chipActiveBg: '#3D7BFF',
  chipActiveText: '#FFFFFF',
  modalOverlay: 'rgba(0, 0, 0, 0.75)',
  tagFavBg: 'rgba(247, 144, 9, 0.15)',
  tagFavText: '#FEC84B',
  tagBg: '#1F2937',
  tagText: '#D1D5DB',
  statusConcluidoBg: 'rgba(50, 213, 131, 0.15)',
  statusConcluidoText: '#6CE9A6',
  statusAndamentoBg: 'rgba(61, 123, 255, 0.15)',
  statusAndamentoText: '#84ADFF',
  statusRascunhoBg: '#1F2937',
  statusRascunhoText: '#9CA3AF',
  tagClassBg: 'rgba(117, 107, 255, 0.15)',
  tagClassText: '#A49CFF',
  searchBg: '#1F2937',
  blurTint: 'dark' as const,
};

export const ThemeContext = createContext<any>(null);

export const ThemeProvider = ({ children }: any) => {
  const systemColorScheme = useColorScheme();
  const [isDark, setIsDark] = useState(systemColorScheme === 'dark');
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isThemeLoaded, setIsThemeLoaded] = useState(false);

  useEffect(() => {
    const loadPreferences = async () => {
      try {
        const savedTheme = await AsyncStorage.getItem('@bytea_isDark');
        if (savedTheme !== null) setIsDark(savedTheme === 'true');
        const savedBiometric = await AsyncStorage.getItem('@bytea_biometric');
        if (savedBiometric !== null) setIsBiometricEnabled(savedBiometric === 'true');
      } catch (error) { console.error(error); } 
      finally { setIsThemeLoaded(true); }
    };
    loadPreferences();
  }, []);

  const toggleTheme = async () => {
    const newValue = !isDark;
    setIsDark(newValue);
    await AsyncStorage.setItem('@bytea_isDark', String(newValue));
  };

  const toggleBiometric = async () => {
    const newValue = !isBiometricEnabled;
    setIsBiometricEnabled(newValue);
    await AsyncStorage.setItem('@bytea_biometric', String(newValue));
  };

  const theme = isDark ? darkTheme : lightTheme;

  if (!isThemeLoaded) {
    return <View style={{ flex: 1, backgroundColor: systemColorScheme === 'dark' ? '#0D1117' : '#F8FAFC' }} />;
  }

  return (
    <ThemeContext.Provider value={{ theme, isDark, toggleTheme, isBiometricEnabled, toggleBiometric }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);