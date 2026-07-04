import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Stack } from 'expo-router'; 
import { StatusBar } from 'expo-status-bar';
import { Lock } from 'lucide-react-native';
import * as LocalAuthentication from 'expo-local-authentication';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { initDB } from '../database/db';

function AppContent() {
  const { isDark, theme, isBiometricEnabled } = useTheme();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const verificarAcesso = async () => {
      if (!isBiometricEnabled) {
        setIsAuthenticated(true);
        return;
      }
      solicitarBiometria();
    };
    verificarAcesso();
  }, [isBiometricEnabled]);

  const solicitarBiometria = async () => {
    setHasError(false);
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: 'Desbloquear Bytea Texts',
      cancelLabel: 'Cancelar',
      fallbackLabel: 'Usar Senha',
      disableDeviceFallback: false,
    });

    if (result.success) setIsAuthenticated(true);
    else setHasError(true);
  };

  if (!isAuthenticated && isBiometricEnabled) {
    return (
      <View style={[styles.lockContainer, { backgroundColor: theme.bg }]}>
        <StatusBar style={isDark ? "light" : "dark"} />
        <View style={styles.lockContent}>
          <View style={[styles.iconWrapper, { backgroundColor: theme.chipActiveBg + '15' }]}>
            <Lock size={48} color={theme.primary} strokeWidth={2} />
          </View>
          <Text style={[styles.lockTitle, { color: theme.text }]}>Bytea Security</Text>
          <Text style={[styles.lockMessage, { color: theme.textMuted }]}>
            A sua biblioteca está protegida. Use a biometria para aceder.
          </Text>
          
          {hasError && (
            <Pressable onPress={solicitarBiometria} style={[styles.retryBtn, { backgroundColor: theme.primary }]}>
              <Text style={styles.retryText}>Tentar Novamente</Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack 
        screenOptions={{ 
          headerShown: false, 
          animation: 'slide_from_right',
          contentStyle: { backgroundColor: theme.bg }
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="editor/[id]" />
        <Stack.Screen name="config" />
      </Stack>
    </View>
  );
}

export default function RootLayout() {
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    async function prepare() {
      await initDB();
      setDbReady(true);
    }
    prepare();
  }, []);

  if (!dbReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3D7BFF" />
      </View>
    );
  }

  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0D1117' },
  lockContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  lockContent: { alignItems: 'center', paddingHorizontal: 40 },
  iconWrapper: { width: 96, height: 96, borderRadius: 48, justifyContent: 'center', alignItems: 'center', marginBottom: 32 },
  lockTitle: { fontSize: 28, fontWeight: '800', marginBottom: 12, letterSpacing: -0.5 },
  lockMessage: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 40 },
  retryBtn: { paddingHorizontal: 32, height: 56, justifyContent: 'center', alignItems: 'center', borderRadius: 18, width: '100%' },
  retryText: { color: '#FFF', fontSize: 16, fontWeight: '700' }
});