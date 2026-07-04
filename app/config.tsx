import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, Switch, Alert, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { ChevronLeft, Moon, Fingerprint, CloudUpload, CloudDownload, ChevronRight, ShieldCheck, Terminal } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as DocumentPicker from 'expo-document-picker';
import * as LocalAuthentication from 'expo-local-authentication';
import { useTheme } from '../context/ThemeContext';
import { exportarDadosJSON, importarDadosJSON } from '../database/db';

export default function ConfigScreen() {
  const router = useRouter();
  const { theme, isDark, toggleTheme, isBiometricEnabled, toggleBiometric } = useTheme();
  const styles = getStyles(theme);

  const [processando, setProcessando] = useState(false);

  const handleToggleTheme = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    toggleTheme();
  };

  const handleToggleBiometric = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (!isBiometricEnabled) {
      const hasHardware = await LocalAuthentication.hasHardwareAsync();
      const isEnrolled = await LocalAuthentication.isEnrolledAsync();

      if (!hasHardware || !isEnrolled) {
        Alert.alert("Aviso", "O seu dispositivo não possui biometria configurada.");
        return;
      }
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: 'Confirme sua identidade para proteger o aplicativo',
        cancelLabel: 'Cancelar',
        fallbackLabel: 'Usar Senha',
      });
      if (result.success) toggleBiometric();
    } else {
      toggleBiometric();
    }
  };

  const handleExportarBackup = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setProcessando(true);
    try {
      const dadosJson = await exportarDadosJSON();
      const dataFormatada = new Date().toISOString().split('T')[0];
      const fileUri = `${FileSystem.documentDirectory}bytea_backup_${dataFormatada}.json`;
      
      await FileSystem.writeAsStringAsync(fileUri, dadosJson, { encoding: 'utf8' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Guardar Cópia de Segurança' });
      else Alert.alert("Erro", "A partilha de ficheiros não está disponível.");
    } catch (error) { Alert.alert("Erro", "Não foi possível gerar a cópia de segurança."); } 
    finally { setProcessando(false); }
  };

  const handleImportarBackup = async () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    Alert.alert(
      "Substituir Biblioteca?",
      "Esta ação irá apagar os textos atuais e restaurar os dados do ficheiro selecionado.",
      [
        { text: "Cancelar", style: "cancel" },
        { text: "Restaurar", style: "destructive", onPress: async () => {
            setProcessando(true);
            try {
              const result = await DocumentPicker.getDocumentAsync({ type: 'application/json', copyToCacheDirectory: true });
              if (!result.canceled && result.assets && result.assets[0]) {
                const uri = result.assets[0].uri;
                const conteudoFicheiro = await FileSystem.readAsStringAsync(uri, { encoding: 'utf8' });
                await importarDadosJSON(conteudoFicheiro);
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                Alert.alert("Sucesso", "Biblioteca restaurada com sucesso!");
              }
            } catch (error) { Alert.alert("Erro", "Ficheiro inválido ou corrompido."); } 
            finally { setProcessando(false); }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.back(); }} style={styles.iconButton}>
          <ChevronLeft size={28} color={theme.text} strokeWidth={2.5} />
        </Pressable>
        <Text style={styles.title}>Configurações</Text>
        <View style={{ width: 44 }} />
      </View>

      {processando && (
        <View style={styles.loaderOverlay}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      )}

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        
        <Text style={styles.sectionTitle}>Visual & Segurança</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={handleToggleTheme}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.bg }]}><Moon size={20} color={theme.text} /></View>
              <Text style={styles.rowText}>Tema Escuro</Text>
            </View>
            <Switch value={isDark} onValueChange={handleToggleTheme} trackColor={{ true: theme.primary, false: theme.border }} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={handleToggleBiometric}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.bg }]}><Fingerprint size={20} color={theme.text} /></View>
              <Text style={styles.rowText}>Bloqueio Biométrico</Text>
            </View>
            <Switch value={isBiometricEnabled} onValueChange={handleToggleBiometric} trackColor={{ true: theme.primary, false: theme.border }} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Sincronização</Text>
        <View style={styles.card}>
          <Pressable style={styles.row} onPress={handleExportarBackup}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.bg }]}><CloudUpload size={20} color={theme.text} /></View>
              <Text style={styles.rowText}>Salvar Cópia (Drive)</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.row} onPress={handleImportarBackup}>
            <View style={styles.rowLeft}>
              <View style={[styles.iconBox, { backgroundColor: theme.bg }]}><CloudDownload size={20} color={theme.text} /></View>
              <Text style={styles.rowText}>Restaurar Biblioteca</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Sobre o Aplicativo</Text>
        <View style={[styles.card, { paddingBottom: 24 }]}>
          <View style={styles.aboutHeader}>
            {/* 👇 IMPLEMENTAÇÃO OFICIAL DO LOGO DA BYTEA */}
            <View style={styles.logoWrapper}>
              <Image 
                source={require('../assets/images/bytea-logo.png')} 
                style={styles.logoImage} 
                resizeMode="cover"
              />
            </View>

            <Text style={styles.appName}>Bytea Texts</Text>
            <Text style={styles.appVersion}>Versão 2.5.0 (Build 412)</Text>
          </View>
          
          <View style={styles.divider} />
          
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Desenvolvedor</Text>
            <Text style={styles.infoValue}>Bytea Tech Lab</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Design System</Text>
            <Text style={styles.infoValue}>BDL v2.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Tecnologias Utilizadas</Text>
            {/* 👇 CORREÇÃO DO TEXTO SOBREPOSTO: flexShrink garante a quebra de linha */}
            <Text style={styles.infoValue}>React Native, Expo, SQLite</Text>
          </View>
          
          <View style={styles.divider} />
          
          <Pressable style={styles.linkRow} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
            <View style={styles.rowLeft}>
              <Terminal size={20} color={theme.textMuted} />
              <Text style={styles.linkText}>Ver código fonte (GitHub)</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>
          <Pressable style={styles.linkRow} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
            <View style={styles.rowLeft}>
              <ShieldCheck size={20} color={theme.textMuted} />
              <Text style={styles.linkText}>Licenças de Código Aberto</Text>
            </View>
            <ChevronRight size={20} color={theme.textMuted} />
          </Pressable>

          <Text style={styles.copyright}>© 2026 Bytea Tech Lab. Todos os direitos reservados.</Text>
        </View>

      </ScrollView>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 64, paddingBottom: 16 },
  iconButton: { padding: 8, width: 48, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  content: { padding: 16, paddingBottom: 64 },
  sectionTitle: { fontSize: 13, fontWeight: '700', color: theme.textMuted, marginBottom: 12, marginLeft: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
  card: { backgroundColor: theme.surface, borderRadius: 24, marginBottom: 24, paddingVertical: 8, borderWidth: 1, borderColor: theme.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1 },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, minHeight: 64 },
  rowLeft: { flexDirection: 'row', alignItems: 'center', gap: 16 },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  rowText: { fontSize: 16, color: theme.text, fontWeight: '600' },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 4, marginHorizontal: 16 },
  
  aboutHeader: { alignItems: 'center', paddingVertical: 32 },
  // 👇 ESTILOS DO LOGO NATIVO
  logoWrapper: { width: 72, height: 72, borderRadius: 24, marginBottom: 16, shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.25, shadowRadius: 16, elevation: 8, backgroundColor: theme.surface },
  logoImage: { width: '100%', height: '100%', borderRadius: 24 },
  
  appName: { fontSize: 28, fontWeight: '800', color: theme.text, letterSpacing: -0.5, marginBottom: 4 },
  appVersion: { fontSize: 16, color: theme.textMuted, fontWeight: '500' },
  
  // 👇 ESTILOS CORRIGIDOS PARA EVITAR COLISÃO DE TEXTO
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 12, paddingHorizontal: 16, gap: 24 },
  infoLabel: { fontSize: 16, color: theme.textMuted, fontWeight: '500', marginTop: 2 },
  infoValue: { fontSize: 16, color: theme.text, fontWeight: '700', flexShrink: 1, textAlign: 'right' },
  
  linkRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 16, paddingHorizontal: 16 },
  linkText: { fontSize: 16, color: theme.textMuted, fontWeight: '600' },
  copyright: { fontSize: 13, color: theme.textHint, textAlign: 'center', marginTop: 32, fontWeight: '500' },
  
  loaderOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.modalOverlay, justifyContent: 'center', alignItems: 'center', zIndex: 999 }
});