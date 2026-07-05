import React, { useState, useEffect, useRef } from 'react';
import { View, TextInput, StyleSheet, Pressable, Text, Platform, Modal, ScrollView, Alert, Share, Animated, Keyboard, Dimensions, PanResponder } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, Maximize2, Minimize2, Edit2, CheckCircle2, MoreHorizontal, Trash2, RefreshCcw, AlertTriangle, Star, Archive, Share2, FileText } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RichEditor, RichToolbar, actions } from 'react-native-pell-rich-editor';
import { criarTexto, atualizarTexto, getTextoPorId, deletarTexto, atualizarTags, getTagsDoTexto, alternarLixeira } from '../../database/db';
import { useTheme } from '../../context/ThemeContext';
import { StatusBar } from 'expo-status-bar';

const STATUS_OPCOES = ['Rascunho', 'Em andamento', 'Concluído'];
const CLASSES_OPCOES = ['Anotação', 'Poema', 'História', 'Conto', 'Outro'];
const SCREEN_HEIGHT = Dimensions.get('window').height;

export default function EditorScreen() {
  const { theme, isDark } = useTheme();
  const styles = getStyles(theme);
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const richText = useRef<RichEditor>(null);

  const [currentId, setCurrentId] = useState<number | null>(id === 'novo' ? null : Number(id));
  const [titulo, setTitulo] = useState('');
  const [conteudo, setConteudo] = useState('');
  const [classe, setClasse] = useState('Anotação');
  const [statusDoc, setStatusDoc] = useState('Rascunho');
  const [isFavorito, setIsFavorito] = useState(false);
  const [isArquivado, setIsArquivado] = useState(false);
  const [isExcluido, setIsExcluido] = useState(false);
  const [tagsInput, setTagsInput] = useState('');
  const [statusSalvamento, setStatusSalvamento] = useState('Rascunho');
  
  // Estado de Carregamento (Otimizado)
  const [carregandoDados, setCarregandoDados] = useState(true);
  const [editorPronto, setEditorPronto] = useState(false);

  const [isEditing, setIsEditing] = useState(id === 'novo');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [menuVisivel, setMenuVisivel] = useState(false);
  const [modalExclusaoVisivel, setModalExclusaoVisivel] = useState(false);

  // Animações BML
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const animacaoHeaderY = useRef(new Animated.Value(0)).current;
  const keyboardTranslateY = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(SCREEN_HEIGHT)).current;
  const overlayOpacity = useRef(new Animated.Value(0)).current;
  const dialogScale = useRef(new Animated.Value(0.9)).current;
  const dialogOpacity = useRef(new Animated.Value(0)).current;
  
  // 👇 Animação de Shimmer (Pulsação) para o Skeleton
  const pulseAnim = useRef(new Animated.Value(0.3)).current;

  const dadosSalvarRef = useRef({ titulo, conteudo, classe, statusDoc, isFavorito, isArquivado, tagsInput, currentId, carregandoDados, isExcluido });

  useEffect(() => { dadosSalvarRef.current = { titulo, conteudo, classe, statusDoc, isFavorito, isArquivado, tagsInput, currentId, carregandoDados, isExcluido }; }, [titulo, conteudo, classe, statusDoc, isFavorito, isArquivado, tagsInput, currentId, carregandoDados, isExcluido]);

  const textoLimpo = (conteudo || '').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').trim();

  // 👇 Ativação da Animação do Shimmer (Skeleton)
  useEffect(() => {
    if (!editorPronto) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 0.7, duration: 800, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 0.3, duration: 800, useNativeDriver: true })
        ])
      ).start();
    }
  }, [editorPronto]);

  const executarPersistenciaInviolavel = async () => {
    const dados = dadosSalvarRef.current;
    if (dados.carregandoDados || dados.isExcluido) return;
    if (!dados.titulo.trim() && !dados.conteudo.trim() && !dados.currentId) return;
    try {
      let textoId = dados.currentId;
      if (dados.currentId) await atualizarTexto(dados.currentId, dados.titulo, dados.conteudo, dados.classe, dados.statusDoc, dados.isFavorito ? 1 : 0, dados.isArquivado ? 1 : 0);
      else {
        const novoId = await criarTexto(dados.titulo, dados.conteudo, dados.classe);
        setCurrentId(novoId); textoId = novoId; router.setParams({ id: novoId.toString() });
      }
      if (textoId) await atualizarTags(textoId, dados.tagsInput);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    async function carregar() {
      if (currentId) {
        const texto: any = await getTextoPorId(currentId);
        if (texto) {
          setTitulo(texto.titulo || ''); setConteudo(texto.conteudo || ''); setClasse(texto.classe || 'Anotação');
          setStatusDoc(texto.status || 'Rascunho'); setIsFavorito(texto.favorito === 1); setIsArquivado(texto.arquivado === 1); setIsExcluido(texto.excluido === 1);
          const tagsDoc = await getTagsDoTexto(currentId); setTagsInput(tagsDoc);
        }
      }
      setCarregandoDados(false);
    }
    carregar();
    return () => { executarPersistenciaInviolavel(); };
  }, []);

  useEffect(() => {
    if (carregandoDados || isExcluido) return;
    if (!titulo.trim() && !conteudo.trim() && !currentId) return;
    setStatusSalvamento('A guardar...');
    const timer = setTimeout(async () => { await executarPersistenciaInviolavel(); setStatusSalvamento('Guardado'); setTimeout(() => setStatusSalvamento(dadosSalvarRef.current.statusDoc), 1200); }, 1500);
    return () => clearTimeout(timer);
  }, [titulo, conteudo, classe, statusDoc, isFavorito, isArquivado, tagsInput]);

  useEffect(() => { Animated.spring(animacaoHeaderY, { toValue: isFullscreen ? -120 : 0, tension: 80, friction: 12, useNativeDriver: true }).start(); }, [isFullscreen]);

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const subShow = Keyboard.addListener(showEvent, (e) => { Animated.timing(keyboardTranslateY, { toValue: -e.endCoordinates.height, duration: 250, useNativeDriver: true }).start(); });
    const subHide = Keyboard.addListener(hideEvent, () => { Animated.timing(keyboardTranslateY, { toValue: 0, duration: 250, useNativeDriver: true }).start(); });
    return () => { subShow.remove(); subHide.remove(); };
  }, []);

  const abrirMenu = () => {
    setMenuVisivel(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    Animated.parallel([
      Animated.spring(panY, { toValue: 0, damping: 24, stiffness: 220, mass: 1, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 1, duration: 350, useNativeDriver: true })
    ]).start();
  };

  const fecharMenu = () => {
    Keyboard.dismiss();
    Animated.parallel([
      Animated.timing(panY, { toValue: SCREEN_HEIGHT, duration: 350, useNativeDriver: true }),
      Animated.timing(overlayOpacity, { toValue: 0, duration: 350, useNativeDriver: true })
    ]).start(() => setMenuVisivel(false));
  };

  const abrirDialogExclusao = () => {
    fecharMenu();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setTimeout(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy), 150);
    setTimeout(() => {
      setModalExclusaoVisivel(true);
      Animated.parallel([
        Animated.spring(dialogScale, { toValue: 1, damping: 20, stiffness: 250, useNativeDriver: true }),
        Animated.timing(dialogOpacity, { toValue: 1, duration: 250, useNativeDriver: true })
      ]).start();
    }, 350);
  };

  const fecharDialogExclusao = () => {
    Animated.parallel([
      Animated.timing(dialogScale, { toValue: 0.9, duration: 200, useNativeDriver: true }),
      Animated.timing(dialogOpacity, { toValue: 0, duration: 200, useNativeDriver: true })
    ]).start(() => setModalExclusaoVisivel(false));
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 5,
      onPanResponderMove: (_, gestureState) => { if (gestureState.dy > 0) panY.setValue(gestureState.dy); },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SCREEN_HEIGHT * 0.2 || gestureState.vy > 1.2) fecharMenu();
        else Animated.spring(panY, { toValue: 0, damping: 24, stiffness: 220, mass: 1, useNativeDriver: true }).start();
      }
    })
  ).current;

  const tratarMudancaConteudoRichText = (html: string) => { setConteudo(html); };
  const scriptListasInteligentes = `(function() { document.getElementById('editor').addEventListener('keydown', function(e) { if (e.key === 'Enter') { var selection = window.getSelection(); if (!selection.rangeCount) return; var range = selection.getRangeAt(0); var container = range.startContainer; var textoLinha = container.textContent || ''; var matchNumero = textoLinha.match(/^(\\d+)\\.\\s/); var matchLetra = textoLinha.match(/^([a-z])\\.\\s/); if (matchNumero) { var proximoNumero = parseInt(matchNumero[1]) + 1; setTimeout(function() { document.execCommand('insertHTML', false, proximoNumero + '.&nbsp;'); }, 10); } else if (matchLetra) { var proximaLetra = String.fromCharCode(matchLetra[1].charCodeAt(0) + 1); setTimeout(function() { document.execCommand('insertHTML', false, proximaLetra + '.&nbsp;'); }, 10); } } }); })();`;
  
  const confirmarExclusao = async () => { 
    if (currentId) { 
      if (isExcluido) await deletarTexto(currentId); 
      else await alternarLixeira(currentId, 1); 
      fecharDialogExclusao(); 
      router.back(); 
    } 
  };
  const restaurarTexto = async () => { if (currentId) { await alternarLixeira(currentId, 0); setIsExcluido(false); fecharMenu(); } };
  const gerarPDF = async () => { fecharMenu(); const htmlTemplate = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no" /><style> body { font-family: -apple-system, sans-serif; padding: 40px; color: #1C1C1E; background: #FFFFFF; } h1 { font-size: 32px; font-weight: 800; } .content { font-size: 18px; line-height: 1.6; } </style></head><body> <h1>${titulo || 'Sem título'}</h1> <div class="content">${conteudo}</div> </body></html>`; try { const { uri } = await Print.printToFileAsync({ html: htmlTemplate }); if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { dialogTitle: 'Partilhar Documento' }); } catch (error) {} };

  return (
    <View style={styles.container}>
      <StatusBar hidden={isFullscreen} style={isDark ? 'light' : 'dark'} animated />

      <Animated.View style={[styles.animatedHeader, { transform: [{ translateY: animacaoHeaderY }] }]}>
        <View style={styles.header}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); executarPersistenciaInviolavel(); router.back(); }} style={styles.iconButton}>
            <ChevronLeft size={28} color={theme.text} strokeWidth={2.5} />
          </Pressable>
          <View style={styles.statusContainer}>
            <Text style={[styles.statusText, statusSalvamento === 'A guardar...' && { color: theme.primary }, isExcluido && { color: theme.dangerText }]}>
              {isExcluido ? 'Na Lixeira' : statusSalvamento !== 'A guardar...' && statusSalvamento !== 'Guardado' ? statusDoc : statusSalvamento}
            </Text>
          </View>
          <View style={styles.headerRightActions}>
            {!isEditing && !isExcluido && <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsFullscreen(true); }} style={styles.iconButton}><Maximize2 size={22} color={theme.text} /></Pressable>}
            {!isEditing && !isExcluido && <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setIsEditing(true); }} style={styles.iconButton}><Edit2 size={22} color={theme.text} /></Pressable>}
            {isEditing && !isExcluido && <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsEditing(false); richText.current?.dismissKeyboard(); executarPersistenciaInviolavel(); }} style={styles.iconButton}><CheckCircle2 size={26} color={theme.primary} /></Pressable>}
            <Pressable onPress={abrirMenu} style={styles.iconButton}><MoreHorizontal size={26} color={theme.text} /></Pressable>
          </View>
        </View>
      </Animated.View>

      {isFullscreen && (
        <View style={styles.fullscreenHeader}>
          <Pressable onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsFullscreen(false); }} style={styles.exitFullscreenBtn}>
            <Minimize2 size={20} color={theme.text} />
            <Text style={[styles.exitFullscreenText, { color: theme.text }]}>Sair</Text>
          </Pressable>
        </View>
      )}

      {isExcluido && (
        <View style={[styles.trashBanner, { backgroundColor: theme.dangerBg }]}>
          <Trash2 size={20} color={theme.dangerText} />
          <Text style={[styles.trashBannerText, { color: theme.dangerText }]}>Este texto está na lixeira.</Text>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={[styles.editorContainer, { paddingBottom: isEditing ? 160 : 40 }, isExcluido && { opacity: 0.5 }]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <TextInput style={styles.titleInput} placeholder="Título..." placeholderTextColor={theme.textHint} value={titulo} onChangeText={setTitulo} maxLength={150} multiline onBlur={executarPersistenciaInviolavel} editable={isEditing && !isExcluido} />
        
        {/* 👇 SKELETON UI BDL 2.0 (Desaparece apenas quando a WebView renderiza na totalidade) */}
        {(!editorPronto && !carregandoDados) && (
          <Animated.View style={[styles.skeletonContainer, { opacity: pulseAnim }]}>
            <View style={[styles.skeletonLine, { width: '100%' }]} />
            <View style={[styles.skeletonLine, { width: '90%' }]} />
            <View style={[styles.skeletonLine, { width: '95%' }]} />
            <View style={[styles.skeletonLine, { width: '70%' }]} />
          </Animated.View>
        )}

        {/* O Editor apenas é exibido no ecrã quando totalmente injetado */}
        {!carregandoDados && (
          <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
            <RichEditor
              ref={richText} initialContentHTML={conteudo}
              editorInitializedCallback={() => { 
                // Dá à WebView tempo extra para calcular as fontes e remover o branco morto
                setTimeout(() => { 
                  if (conteudo) richText.current?.setContentHTML(conteudo); 
                  richText.current?.injectJavascript(scriptListasInteligentes); 
                  setEditorPronto(true);
                  Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start(); 
                }, 400); 
              }}
              onChange={tratarMudancaConteudoRichText} onBlur={executarPersistenciaInviolavel} disabled={!isEditing || isExcluido} placeholder={isEditing ? "Comece a escrever sua obra..." : ""}
              containerStyle={{ backgroundColor: 'transparent' }}
              // @ts-ignore
              webViewProps={{ backgroundColor: 'transparent', androidLayerType: 'software' }}
              editorStyle={{ backgroundColor: theme.bg, color: theme.text, placeholderColor: theme.textHint, contentCSSText: `font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; font-size: 17px; line-height: 1.5; padding-bottom: 400px;` }}
              useContainer={false} scrollEnabled={false} style={{ flex: 1, minHeight: 400, backgroundColor: theme.bg }}
            />
          </Animated.View>
        )}
      </ScrollView>

      {isEditing && !isExcluido && !carregandoDados && (
        <Animated.View style={[styles.floatingBarWrapper, { transform: [{ translateY: keyboardTranslateY }] }]}>
          <View style={styles.richBarContainer}>
            <RichToolbar
              editor={richText}
              actions={[actions.setBold, actions.setItalic, actions.setUnderline, actions.setStrikethrough, actions.heading1, actions.heading2, actions.insertBulletsList, actions.insertOrderedList, actions.alignLeft, actions.alignCenter]}
              iconMap={{
                [actions.heading1]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '800', fontSize: 18 }}>H1</Text>,
                [actions.heading2]: ({ tintColor }: any) => <Text style={{ color: tintColor, fontWeight: '700', fontSize: 16 }}>H2</Text>,
              }}
              style={styles.richBar} iconTint={theme.textMuted} selectedIconTint={theme.chipActiveText} selectedButtonStyle={styles.activeToolbarButton}
            />
          </View>
        </Animated.View>
      )}

      {/* Modal BDL 3.0 Bottom Sheet */}
      <Modal visible={menuVisivel} transparent animationType="none" onRequestClose={fecharMenu}>
        <Animated.View style={[styles.modalOverlay, { opacity: overlayOpacity }]}>
          <Pressable style={styles.modalBackground} onPress={fecharMenu} />
        </Animated.View>
        <Animated.View style={[styles.modalContent, { transform: [{ translateY: panY }] }]}>
          <View {...panResponder.panHandlers} style={styles.panHeader}>
            <View style={styles.modalHandle} />
          </View>
          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={styles.quickActionsWrapper}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActions}>
                {isExcluido ? (
                  <>
                    <Pressable style={styles.actionBtn} onPress={restaurarTexto}><View style={[styles.actionIcon, { backgroundColor: theme.tagFavBg }]}><RefreshCcw size={28} color={theme.tagFavText} /></View><Text style={styles.actionText}>Restaurar</Text></Pressable>
                    <Pressable style={styles.actionBtn} onPress={abrirDialogExclusao}><View style={[styles.actionIcon, { backgroundColor: theme.dangerBg }]}><AlertTriangle size={28} color={theme.dangerText} /></View><Text style={[styles.actionText, { color: theme.dangerText }]} numberOfLines={1}>Excluir</Text></Pressable>
                  </>
                ) : (
                  <>
                    <Pressable style={styles.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsFavorito(!isFavorito); }}><View style={[styles.actionIcon, isFavorito && { backgroundColor: theme.tagFavBg }]}><Star size={28} color={isFavorito ? theme.tagFavText : theme.text} fill={isFavorito ? theme.tagFavText : "transparent"} /></View><Text style={styles.actionText} numberOfLines={1}>Favoritar</Text></Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium); setIsArquivado(!isArquivado); }}><View style={[styles.actionIcon, isArquivado && { backgroundColor: theme.tagBg }]}><Archive size={28} color={isArquivado ? theme.tagText : theme.text} /></View><Text style={styles.actionText} numberOfLines={1}>Arquivar</Text></Pressable>
                    <Pressable style={styles.actionBtn} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); fecharMenu(); Share.share({ message: `${titulo}\n\n${textoLimpo}` }); }}><View style={[styles.actionIcon, { backgroundColor: theme.statusAndamentoBg }]}><Share2 size={28} color={theme.statusAndamentoText} /></View><Text style={[styles.actionText, { color: theme.statusAndamentoText }]} numberOfLines={1}>Enviar</Text></Pressable>
                    <Pressable style={styles.actionBtn} onPress={gerarPDF}><View style={[styles.actionIcon, { backgroundColor: theme.statusConcluidoBg }]}><FileText size={28} color={theme.statusConcluidoText} /></View><Text style={[styles.actionText, { color: theme.statusConcluidoText }]} numberOfLines={1}>Gerar PDF</Text></Pressable>
                    <Pressable style={styles.actionBtn} onPress={abrirDialogExclusao}><View style={[styles.actionIcon, { backgroundColor: theme.dangerBg }]}><Trash2 size={28} color={theme.dangerText} /></View><Text style={[styles.actionText, { color: theme.dangerText }]} numberOfLines={1}>Apagar</Text></Pressable>
                  </>
                )}
              </ScrollView>
            </View>

            {!isExcluido && (
              <>
                <Text style={styles.sectionTitle}>Status</Text>
                <View style={styles.chipGroup}>{STATUS_OPCOES.map((item) => (<Pressable key={item} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setStatusDoc(item); }} style={[styles.chip, statusDoc === item && styles.chipActive]}><Text style={[styles.chipText, statusDoc === item && styles.chipTextActive]}>{item}</Text></Pressable>))}</View>
                <Text style={styles.sectionTitle}>Classe</Text>
                <View style={styles.chipGroup}>{CLASSES_OPCOES.map((item) => (<Pressable key={item} onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); setClasse(item); }} style={[styles.chip, classe === item && styles.chipActive]}><Text style={[styles.chipText, classe === item && styles.chipTextActive]}>{item}</Text></Pressable>))}</View>
                <Text style={styles.sectionTitle}>Tags</Text>
                <TextInput style={styles.tagsInputUI} placeholder="Ex: terror, romance..." placeholderTextColor={theme.textHint} value={tagsInput} onChangeText={setTagsInput} autoCapitalize="none" />
              </>
            )}
          </ScrollView>
        </Animated.View>
      </Modal>

      {/* BML: Dialog de Exclusão (Scale X/Y + Fade) */}
      <Modal visible={modalExclusaoVisivel} transparent animationType="none" onRequestClose={fecharDialogExclusao}>
        <Animated.View style={[styles.alertOverlay, { opacity: dialogOpacity }]}>
          <Animated.View style={[styles.alertBox, { transform: [{ scale: dialogScale }] }]}>
            <View style={styles.alertIconContainer}><AlertTriangle size={36} color={theme.dangerText} /></View>
            <Text style={styles.alertTitle}>{isExcluido ? "Apagar definitivamente?" : "Mover para Lixeira?"}</Text>
            <Text style={styles.alertMessage}>{isExcluido ? "Essa ação não pode ser desfeita." : "O texto sairá da sua biblioteca."}</Text>
            <View style={styles.alertButtons}>
              <Pressable style={styles.alertCancelBtn} onPress={fecharDialogExclusao}><Text style={styles.alertCancelText}>Cancelar</Text></Pressable>
              <Pressable style={styles.alertDeleteBtn} onPress={confirmarExclusao}><Text style={styles.alertDeleteText}>{isExcluido ? "Excluir" : "Mover"}</Text></Pressable>
            </View>
          </Animated.View>
        </Animated.View>
      </Modal>
    </View>
  );
}

const getStyles = (theme: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.bg },
  animatedHeader: { width: '100%', backgroundColor: theme.bg, zIndex: 10, position: 'absolute', top: 0, left: 0, right: 0 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: Platform.OS === 'ios' ? 56 : 42, paddingBottom: 16, borderBottomWidth: 1, borderBottomColor: theme.border },
  headerRightActions: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  fullscreenHeader: { position: 'absolute', top: Platform.OS === 'ios' ? 54 : 34, right: 24, zIndex: 100 },
  exitFullscreenBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: theme.bg, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 4 },
  exitFullscreenText: { fontSize: 14, fontWeight: '700' },
  iconButton: { padding: 8 },
  statusContainer: { backgroundColor: theme.surface, paddingHorizontal: 14, paddingVertical: 6, borderRadius: 16 },
  statusText: { fontSize: 13, fontWeight: '800', color: theme.textMuted },
  editorContainer: { flexGrow: 1, paddingHorizontal: 20, paddingTop: Platform.OS === 'ios' ? 120 : 100 },
  titleInput: { fontSize: 28, fontWeight: '800', color: theme.text, marginBottom: 12, paddingVertical: 8, lineHeight: 36, letterSpacing: -0.6 },
  
  // 👇 Estilos do Skeleton UI
  skeletonContainer: { position: 'absolute', top: Platform.OS === 'ios' ? 180 : 160, left: 20, right: 20, gap: 14 },
  skeletonLine: { height: 18, backgroundColor: theme.surface, borderRadius: 8 },

  floatingBarWrapper: { position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 100 },
  richBarContainer: { backgroundColor: theme.surface, borderTopWidth: 1, borderColor: theme.border, paddingTop: 12, paddingBottom: Platform.OS === 'ios' ? 32 : 16, paddingHorizontal: 12, shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: theme.isDark ? 0.3 : 0.05, shadowRadius: 16, elevation: 10 },
  richBar: { height: 48, backgroundColor: 'transparent' },
  activeToolbarButton: { backgroundColor: theme.primary, borderRadius: 14, marginHorizontal: 4 },
  trashBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, paddingHorizontal: 24, borderBottomWidth: 1, borderBottomColor: theme.border, marginTop: 96 },
  trashBannerText: { flex: 1, fontSize: 15, fontWeight: '700', lineHeight: 22 },
  
  modalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: theme.modalOverlay },
  modalBackground: { flex: 1 },
  modalContent: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: theme.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingBottom: 40, maxHeight: '85%' },
  panHeader: { width: '100%', alignItems: 'center', paddingTop: 16, paddingBottom: 24, backgroundColor: 'transparent' },
  modalHandle: { width: 44, height: 5, backgroundColor: theme.border, borderRadius: 3 },
  
  quickActionsWrapper: { marginBottom: 32 },
  quickActions: { flexDirection: 'row', paddingHorizontal: 24, gap: 16 },
  actionBtn: { alignItems: 'center', gap: 10, width: 80 },
  actionIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' },
  actionText: { fontSize: 13, fontWeight: '600', color: theme.text, textAlign: 'center' },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: theme.text, marginBottom: 16, paddingHorizontal: 24, letterSpacing: -0.2 },
  chipGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32, paddingHorizontal: 24 },
  chip: { backgroundColor: theme.bg, paddingVertical: 10, paddingHorizontal: 20, borderRadius: 20 },
  chipActive: { backgroundColor: theme.primary },
  chipText: { fontSize: 14, fontWeight: '600', color: theme.textMuted },
  chipTextActive: { color: theme.chipActiveText, fontWeight: '700' },
  tagsInputUI: { backgroundColor: theme.bg, borderRadius: 18, height: 56, paddingHorizontal: 20, fontSize: 16, color: theme.text, marginBottom: 24, marginHorizontal: 24 },
  
  alertOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.modalOverlay, padding: 24 },
  alertBox: { width: '100%', backgroundColor: theme.surface, borderRadius: 28, padding: 32, alignItems: 'center', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.15, shadowRadius: 24, elevation: 8 },
  alertIconContainer: { width: 72, height: 72, borderRadius: 36, backgroundColor: theme.dangerBg, justifyContent: 'center', alignItems: 'center', marginBottom: 20 },
  alertTitle: { fontSize: 22, fontWeight: '800', color: theme.text, marginBottom: 12, letterSpacing: -0.3 },
  alertMessage: { fontSize: 16, color: theme.textMuted, textAlign: 'center', lineHeight: 24, marginBottom: 32 },
  alertButtons: { flexDirection: 'row', width: '100%', gap: 16 },
  alertCancelBtn: { flex: 1, height: 56, borderRadius: 18, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center' },
  alertCancelText: { fontSize: 16, fontWeight: '700', color: theme.text },
  alertDeleteBtn: { flex: 1, height: 56, borderRadius: 18, backgroundColor: theme.danger, alignItems: 'center', justifyContent: 'center' },
  alertDeleteText: { fontSize: 16, fontWeight: '800', color: '#FFF' },
});