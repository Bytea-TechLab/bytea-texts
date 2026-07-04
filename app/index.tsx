import React, { useState, useCallback } from "react";
import { View, Text, StyleSheet, ScrollView, TextInput, Pressable, ActivityIndicator, Platform } from "react-native";
import Animated, { FadeInDown, useSharedValue, useAnimatedStyle, withSpring } from "react-native-reanimated";
import { BlurView } from "expo-blur";
import { Search, XCircle, Plus, Settings, Trash2, Archive, Star } from "lucide-react-native";
import { Link, useFocusEffect, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import { buscarTodosTextos } from "../database/db";
import { useTheme } from "../context/ThemeContext";

const FILTROS = ["Todos", "Poemas", "Histórias", "Contos", "Arquivados", "Lixeira"];

interface CardTextoProps { texto: any; theme: any; filtroAtivo: string; onPress: () => void; }

function CardTexto({ texto, theme, filtroAtivo, onPress }: CardTextoProps) {
  const styles = getStyles(theme);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const handlePressIn = () => scale.value = withSpring(0.97, { damping: 20, stiffness: 300 });
  const handlePressOut = () => scale.value = withSpring(1, { damping: 20, stiffness: 300 });

  // 👇 Sincronização Absoluta com a Vida Real (Converte SQLite UTC -> Fuso Local)
  let dataFormatada = "";
  if (texto.atualizado_em) {
    try {
      let dateString = texto.atualizado_em.toString();
      // Transforma "YYYY-MM-DD HH:MM:SS" no padrão ISO injetando o 'Z' (Universal Time)
      if (dateString.includes(' ') && !dateString.includes('Z')) {
        dateString = dateString.replace(' ', 'T') + 'Z';
      }
      
      const dataObj = new Date(dateString);
      
      // Valida se o objeto Date é real
      if (!isNaN(dataObj.getTime())) {
        // As funções de extracção do JS resgatam automaticamente o dia perante o nosso fuso (-3)
        const dia = String(dataObj.getDate()).padStart(2, '0');
        const mes = String(dataObj.getMonth() + 1).padStart(2, '0');
        const ano = dataObj.getFullYear();
        dataFormatada = `${dia}/${mes}/${ano}`;
      } else {
        dataFormatada = texto.atualizado_em; 
      }
    } catch (e) {
      dataFormatada = texto.atualizado_em;
    }
  }

  const resumo = (texto.conteudo || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, ' ').trim();

  // Limite BDL de Etiquetas no Card
  const tagsArray = texto.tags_array ? texto.tags_array.split(",").map((t: string) => t.trim()).filter((t: string) => t.length > 0) : [];
  const tagsExibidas = tagsArray.slice(0, 2);
  const tagsOcultas = tagsArray.length - 2;

  return (
    <Pressable onPressIn={handlePressIn} onPressOut={handlePressOut} onPress={onPress}>
      <Animated.View style={[styles.card, animatedStyle, filtroAtivo === "Lixeira" && { opacity: 0.6 }]}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle} numberOfLines={1}>{texto.titulo || "Sem título"}</Text>
          <View style={[styles.statusBadge, texto.status === "Concluído" && { backgroundColor: theme.statusConcluidoBg }, texto.status === "Em andamento" && { backgroundColor: theme.statusAndamentoBg }]}>
            <Text style={[styles.statusText, texto.status === "Concluído" && { color: theme.statusConcluidoText }, texto.status === "Em andamento" && { color: theme.statusAndamentoText }, (!texto.status || texto.status === "Rascunho") && { color: theme.statusRascunhoText }]}>
              {texto.status || "Rascunho"}
            </Text>
          </View>
        </View>

        {resumo.length > 0 && <Text style={styles.cardPreview} numberOfLines={2}>{resumo}</Text>}

        <View style={styles.cardFooter}>
          <View style={styles.tagsContainer}>
            <Text style={[styles.tag, { backgroundColor: theme.tagClassBg, color: theme.tagClassText }]}>#{texto.classe}</Text>
            {texto.favorito === 1 && (
              <View style={[styles.tag, { backgroundColor: theme.tagFavBg, flexDirection: 'row', alignItems: 'center', gap: 4 }]}>
                <Star size={10} color={theme.tagFavText} fill={theme.tagFavText} />
                <Text style={{ fontSize: 11, fontWeight: "700", color: theme.tagFavText }}>Favorito</Text>
              </View>
            )}
            {tagsExibidas.map((tag: string) => (
              <Text key={tag} style={styles.tag}>#{tag}</Text>
            ))}
            {tagsOcultas > 0 && (
              <Text style={styles.tag}>+{tagsOcultas}</Text>
            )}
          </View>
          <Text style={styles.date}>{dataFormatada}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default function HomeScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const router = useRouter();

  const [textos, setTextos] = useState<any[]>([]);
  const [filtroAtivo, setFiltroAtivo] = useState("Todos");
  const [busca, setBusca] = useState("");
  const [carregando, setCarregando] = useState(true);

  const fabScale = useSharedValue(1);
  const fabAnimatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: fabScale.value }] }));

  useFocusEffect(
    useCallback(() => {
      let isMounted = true;
      async function carregar() {
        try {
          const dados = await buscarTodosTextos();
          if (isMounted) setTextos(dados || []);
        } catch (e) { console.warn(e); } 
        finally { if (isMounted) setCarregando(false); }
      }
      carregar();
      return () => { isMounted = false; };
    }, [])
  );

  const textosFiltrados = textos.filter((t) => {
    if (filtroAtivo === 'Lixeira') return t.excluido === 1;
    if (t.excluido === 1) return false;
    if (filtroAtivo === 'Arquivados' && t.arquivado !== 1) return false;
    if (filtroAtivo !== 'Arquivados' && t.arquivado === 1) return false;
    if (filtroAtivo !== 'Todos' && filtroAtivo !== 'Arquivados') {
      const mapaFiltros: any = { 'Poemas': 'Poema', 'Histórias': 'História', 'Contos': 'Conto' };
      const classeCorreta = mapaFiltros[filtroAtivo] || filtroAtivo;
      if (t.classe !== classeCorreta) return false;
    }
    const termo = busca.toLowerCase();
    return (busca === '' || (t.titulo && t.titulo.toLowerCase().includes(termo)) || (t.conteudo && t.conteudo.toLowerCase().includes(termo)) || (t.tags_array && t.tags_array.toLowerCase().includes(termo)));
  });

  return (
    <View style={styles.container}>
      <BlurView intensity={theme.isDark ? 30 : 65} tint={theme.blurTint} style={styles.glassHeader}>
        <View style={styles.headerTop}>
          <Text style={styles.title}>Biblioteca</Text>
          <Link href="/config" asChild>
            <Pressable style={styles.settingsButton} onPress={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}>
              <Settings size={22} color={theme.text} />
            </Pressable>
          </Link>
        </View>

        <View style={styles.searchContainer}>
          <Search size={20} color={theme.textMuted} style={{ marginRight: 8 }} />
          <TextInput placeholder="Pesquisar textos..." style={styles.searchInput} placeholderTextColor={theme.textHint} value={busca} onChangeText={setBusca} />
          {busca.length > 0 && (
            <Pressable style={{ padding: 8 }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setBusca(""); }}>
              <XCircle size={20} color={theme.textMuted} />
            </Pressable>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filtersWrapper} contentContainerStyle={{ paddingHorizontal: 16, gap: 8 }}>
          {FILTROS.map((item) => (
            <Pressable key={item} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setFiltroAtivo(item); }} style={[styles.filterChip, filtroAtivo === item && (item === "Lixeira" ? { backgroundColor: theme.dangerBg, borderColor: theme.dangerBg } : styles.filterChipActive)]}>
              <Text style={[styles.filterText, filtroAtivo === item && (item === "Lixeira" ? { color: theme.dangerText } : styles.filterTextActive)]}>{item}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </BlurView>

      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>{busca !== "" ? `Resultados` : filtroAtivo === "Lixeira" ? "Lixeira" : filtroAtivo === "Arquivados" ? "Arquivados" : "Recentes"}</Text>
      </View>

      {carregando ? (
        <ActivityIndicator size="large" color={theme.primary} style={{ marginTop: 64 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          {textosFiltrados.length === 0 ? (
            <Animated.View entering={FadeInDown.duration(400)} style={styles.emptyContainer}>
              {filtroAtivo === "Lixeira" ? <Trash2 size={48} color={theme.border} style={{ marginBottom: 16 }} strokeWidth={1.5} /> : 
               filtroAtivo === "Arquivados" ? <Archive size={48} color={theme.border} style={{ marginBottom: 16 }} strokeWidth={1.5} /> : 
               <Search size={48} color={theme.border} style={{ marginBottom: 16 }} strokeWidth={1.5} />}
              <Text style={styles.emptyText}>{busca !== "" ? "Nenhum resultado." : "Nenhum texto por aqui."}</Text>
            </Animated.View>
          ) : (
            textosFiltrados.map((texto, index) => (
              <Animated.View key={texto.id} entering={FadeInDown.springify().delay(index * 40).damping(20).stiffness(200)}>
                <CardTexto texto={texto} theme={theme} filtroAtivo={filtroAtivo} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); router.push(`/editor/${texto.id}`); }} />
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}

      {filtroAtivo !== "Lixeira" && (
        <Pressable style={styles.fabPosition} onPressIn={() => { fabScale.value = withSpring(0.97, { damping: 20, stiffness: 300 }); }} onPressOut={() => { fabScale.value = withSpring(1, { damping: 20, stiffness: 300 }); }} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); router.push("/editor/novo"); }}>
          <Animated.View style={[styles.fabShadow, fabAnimatedStyle]}>
            <View style={styles.fabContent}>
              <Plus size={32} color="#FFF" strokeWidth={2.5} />
            </View>
          </Animated.View>
        </Pressable>
      )}
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  glassHeader: { paddingTop: Platform.OS === 'ios' ? 56 : 40, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: theme.border, zIndex: 50 },
  headerTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 16, marginBottom: 12 },
  title: { fontSize: 32, fontWeight: "800", color: theme.text, letterSpacing: -1 },
  settingsButton: { width: 44, height: 44, borderRadius: 22, backgroundColor: theme.surface, justifyContent: "center", alignItems: "center", borderWidth: 1, borderColor: theme.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.04, shadowRadius: 8, elevation: 2 },
  searchContainer: { flexDirection: "row", alignItems: "center", backgroundColor: theme.surface, borderRadius: 16, marginHorizontal: 16, paddingHorizontal: 16, height: 52, borderWidth: 1, borderColor: theme.border, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.02, shadowRadius: 8, elevation: 1, marginBottom: 12 },
  searchInput: { flex: 1, fontSize: 16, color: theme.text, padding: 0, height: '100%' },
  filtersWrapper: { maxHeight: 40 },
  filterChip: { backgroundColor: theme.surface, paddingHorizontal: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.border, height: 40, justifyContent: "center" },
  filterChipActive: { backgroundColor: theme.chipActiveBg, borderColor: theme.chipActiveBg },
  filterText: { fontSize: 13, fontWeight: "600", color: theme.textMuted },
  filterTextActive: { color: theme.chipActiveText, fontWeight: "700" },
  sectionHeader: { paddingHorizontal: 16, marginTop: 16, marginBottom: 12 },
  sectionTitle: { fontSize: 22, fontWeight: '800', color: theme.text, letterSpacing: -0.5 },
  scrollContent: { paddingBottom: 120, paddingTop: 4 },
  emptyContainer: { alignItems: "center", justifyContent: "center", paddingTop: 104 },
  emptyText: { fontSize: 16, color: theme.textMuted, fontWeight: "500" },
  
  card: { backgroundColor: theme.surface, borderRadius: 20, padding: 16, marginHorizontal: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.border, shadowColor: theme.isDark ? "#000" : "#9CA3AF", shadowOffset: { width: 0, height: 4 }, shadowOpacity: theme.isDark ? 0.3 : 0.04, shadowRadius: 12, elevation: 2 },
  cardHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: "700", color: theme.text, flex: 1, letterSpacing: -0.3 },
  statusBadge: { backgroundColor: theme.statusRascunhoBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: "700", color: theme.statusRascunhoText },
  cardPreview: { fontSize: 15, color: theme.textMuted, lineHeight: 22, marginBottom: 12 },
  cardFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end" },
  date: { fontSize: 12, fontWeight: "600", color: theme.textHint },
  tagsContainer: { flexDirection: "row", flexWrap: "wrap", gap: 8, flex: 1, marginRight: 8 },
  tag: { fontSize: 12, fontWeight: "700", color: theme.tagText, backgroundColor: theme.tagBg, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: "hidden" },
  fabPosition: { position: "absolute", bottom: 32, right: 16, zIndex: 99 },
  fabShadow: { shadowColor: theme.primary, shadowOffset: { width: 0, height: 8 }, shadowOpacity: theme.isDark ? 0.5 : 0.3, shadowRadius: 16, elevation: 8 },
  fabContent: { width: 56, height: 56, borderRadius: 28, backgroundColor: theme.primary, justifyContent: "center", alignItems: "center" },
});