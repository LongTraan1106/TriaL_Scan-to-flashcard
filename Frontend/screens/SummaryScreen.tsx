import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Line, Path } from 'react-native-svg';
import SparkleIcon from '../assets/icons/AI.svg';
import TargetIcon from '../assets/icons/target.svg';
import FlashcardIcon from '../assets/icons/flash_card.svg';
import SaveIcon from '../assets/icons/save.svg';
import { CustomAlertModal, AlertButton } from '../components/CustomAlertModal';
import {
  documentService,
  DocumentResponse,
  OCRData,
  SummaryData,
} from '../services/documentService';

const { width, height } = Dimensions.get('window');
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const GREEN = '#587956';
const BG = '#F2F8EC';
const PAGE_PADDING = clamp(width * 0.04, 12, 18);
const CARD_RADIUS = clamp(width * 0.035, 12, 16);
const CARD_PADDING = clamp(width * 0.04, 14, 18);
const CARD_TITLE_SIZE = clamp(width * 0.047, 17, 20);
const BODY_FONT = clamp(width * 0.039, 14, 16);
const BODY_LINE = clamp(BODY_FONT * 1.55, 21, 25);
const SMALL_FONT = clamp(width * 0.034, 12, 14);
const ACTION_HEIGHT = clamp(height * 0.058, 46, 54);
const ICON_SIZE = clamp(width * 0.066, 23, 29);

type PendingAction = 'saveDocument' | 'createFlashcard' | null;

function BackIcon({ color = GREEN }: { color?: string }) {
  return (
    <Svg width={26} height={26} viewBox="0 0 30 30" fill="none">
      <Path d="M18.5 7L10.5 15L18.5 23" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={11.5} y1={15} x2={24} y2={15} stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function SummaryScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollViewRef = useRef<ScrollView>(null);

  const {
    summaryData,
    ocrData,
  }: { summaryData: SummaryData; ocrData?: OCRData } = route.params || {};

  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    icon: string;
    buttons: AlertButton[];
  }>({
    title: '',
    message: '',
    icon: '!',
    buttons: [],
  });
  const [documentTitle, setDocumentTitle] = useState('');
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>(summaryData?.key_takeaways || []);
  const [showTitleInput, setShowTitleInput] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [savedDocument, setSavedDocument] = useState<DocumentResponse['data'] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isCreatingFlashcards, setIsCreatingFlashcards] = useState(false);
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false);
  const [isGeneratingTakeaways, setIsGeneratingTakeaways] = useState(false);

  const isBusy = isSaving || isCreatingFlashcards || isGeneratingTitle;

  useEffect(() => {
    let isMounted = true;

    const loadTakeaways = async () => {
      if (!summaryData || summaryData.key_takeaways?.length || keyTakeaways.length) {
        return;
      }

      setIsGeneratingTakeaways(true);
      try {
        const generated = await documentService.processTakeaways(summaryData, ocrData || null);
        if (isMounted) {
          setKeyTakeaways(generated);
        }
      } finally {
        if (isMounted) {
          setIsGeneratingTakeaways(false);
        }
      }
    };

    loadTakeaways();

    return () => {
      isMounted = false;
    };
  }, [summaryData, ocrData, keyTakeaways.length]);

  const handleBack = () => {
    navigation.goBack();
  };

  const getDefaultTitle = () => {
    if (documentTitle.trim()) {
      return documentTitle.trim();
    }

    if (ocrData?.file_name) {
      return ocrData.file_name.replace(/\.[^/.]+$/, '');
    }

    return `Summary ${new Date().toLocaleDateString()}`;
  };

  const requestTitleForAction = async (action: Exclude<PendingAction, null>) => {
    setPendingAction(action);
    if (!documentTitle.trim()) {
      setShowTitleInput(true);
      setIsGeneratingTitle(true);
      try {
        const generatedTitle = await documentService.generateDocumentTitle(summaryData);
        setDocumentTitle(generatedTitle || getDefaultTitle());
      } catch (error) {
        setDocumentTitle(getDefaultTitle());
      } finally {
        setIsGeneratingTitle(false);
      }
      return;
    }
    setShowTitleInput(true);
  };

  const ensureDocumentSaved = async (title: string): Promise<DocumentResponse['data']> => {
    if (savedDocument) {
      return savedDocument;
    }

    const takeaways = keyTakeaways.length
      ? keyTakeaways
      : await documentService.processTakeaways(summaryData, ocrData || null);

    if (!keyTakeaways.length && takeaways.length) {
      setKeyTakeaways(takeaways);
    }

    const savedDoc = await documentService.saveDocument(
      title,
      {
        ...summaryData,
        key_takeaways: takeaways,
      },
      ocrData || null,
      ['Summary']
    );
    setSavedDocument(savedDoc);
    return savedDoc;
  };

  const showSavedDocumentAlert = (savedDoc: DocumentResponse['data']) => {
    setAlertConfig({
      title: 'Saved',
      message: `"${savedDoc.title}" has been saved.`,
      icon: 'OK',
      buttons: [
        {
          text: 'View Documents',
          onPress: () => {
            setAlertModalVisible(false);
            navigation.navigate('TabNavigator', { screen: 'Documents' });
          },
          style: 'default',
        },
        {
          text: 'Stay Here',
          onPress: () => setAlertModalVisible(false),
          style: 'default',
        },
      ],
    });
    setAlertModalVisible(true);
  };

  const handleSaveDocument = async () => {
    const title = documentTitle.trim();
    if (!title) {
      requestTitleForAction('saveDocument');
      return;
    }

    setIsSaving(true);
    try {
      const savedDoc = await ensureDocumentSaved(title);
      setShowTitleInput(false);
      setPendingAction(null);
      showSavedDocumentAlert(savedDoc);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cannot save document';
      setAlertConfig({
        title: 'Save Failed',
        message,
        icon: '!',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateFlashcard = async () => {
    const title = documentTitle.trim();
    if (!title) {
      requestTitleForAction('createFlashcard');
      return;
    }

    if (!ocrData || !ocrData.ocr_results?.length) {
      setAlertConfig({
        title: 'Cannot Create Flashcards',
        message: 'OCR data is missing. Please scan or summarize this document again.',
        icon: '!',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
      return;
    }

    setIsCreatingFlashcards(true);
    setIsSaving(true);
    try {
      const savedDoc = await ensureDocumentSaved(title);
      setShowTitleInput(false);
      setPendingAction(null);

      const processed = await documentService.processFlashcards(ocrData);
      navigation.navigate('FlashcardDetail', {
        title: `Flashcards - ${savedDoc.title}`,
        draftFlashcardData: processed.flashcard_data,
        draftTotalCards: processed.total_cards,
        saveOptions: {
          documentId: savedDoc.id,
          sourceFileName: savedDoc.source_file_name || ocrData.file_name,
          tags: ['Flashcard'],
        },
        sourceFlow: 'summary',
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cannot create flashcards';
      setAlertConfig({
        title: 'Error',
        message,
        icon: '!',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
    } finally {
      setIsSaving(false);
      setIsCreatingFlashcards(false);
    }
  };

  const handleConfirmTitle = () => {
    if (pendingAction === 'createFlashcard') {
      handleCreateFlashcard();
      return;
    }

    handleSaveDocument();
  };

  const pagesArray = summaryData?.pages
    ? Object.entries(summaryData.pages).map(([key, value]) => ({
        pageKey: key,
        content: value,
      }))
    : [];

  if (!summaryData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>No summary data available</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <ScrollView
        ref={scrollViewRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <SparkleIcon width={ICON_SIZE} height={ICON_SIZE} />
              <Text style={styles.cardTitle}>AI Summary</Text>
            </View>
            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>
                {summaryData.num_pages || pagesArray.length || 1} pages
              </Text>
            </View>
          </View>

          {pagesArray.length ? (
            <>
              <Text style={styles.summaryText}>{pagesArray[0].content}</Text>
              {pagesArray.length > 1 ? (
                <View style={styles.extraPages}>
                  {pagesArray.slice(1).map((page, index) => (
                    <View key={page.pageKey} style={styles.extraPageBlock}>
                      <Text style={styles.extraPageTitle}>Page {index + 2}</Text>
                      <Text style={styles.extraPageText}>{page.content}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
              <View style={styles.dashedRule} />
            </>
          ) : (
            <Text style={styles.emptyText}>No summary content</Text>
          )}
        </View>

        <View style={styles.takeawayCard}>
          <View style={styles.cardTitleRow}>
            <TargetIcon width={ICON_SIZE} height={ICON_SIZE} />
            <Text style={styles.cardTitle}>Key takeaways</Text>
          </View>

          <View style={styles.takeawayList}>
            {isGeneratingTakeaways ? (
              <View style={styles.inlineLoading}>
                <ActivityIndicator size="small" color={GREEN} />
                <Text style={styles.inlineLoadingText}>Generating key takeaways...</Text>
              </View>
            ) : keyTakeaways.length ? (
              keyTakeaways.map((item, index) => (
                <View key={`${item}-${index}`} style={styles.takeawayItem}>
                  <View style={styles.takeawayBullet} />
                  <Text style={styles.takeawayText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={styles.emptyText}>No key takeaways generated yet.</Text>
            )}
          </View>
        </View>
      </ScrollView>

      <View style={styles.actionsWrap}>
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.previousButton}
            onPress={handleBack}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            <BackIcon />
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.flashcardButton, isBusy && styles.buttonDisabled]}
            onPress={handleCreateFlashcard}
            disabled={isBusy}
            activeOpacity={0.85}
          >
            {isCreatingFlashcards ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <FlashcardIcon width={clamp(width * 0.06, 22, 26)} height={clamp(width * 0.06, 22, 26)} />
                <Text style={styles.flashcardButtonText}>Create Flashcards</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.saveButton, isBusy && styles.buttonDisabled]}
          onPress={handleSaveDocument}
          disabled={isBusy}
          activeOpacity={0.85}
        >
          {isSaving && !isCreatingFlashcards ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <SaveIcon width={clamp(width * 0.055, 20, 24)} height={clamp(width * 0.055, 20, 24)} />
              <Text style={styles.saveButtonText}>
                {savedDocument ? 'Document Saved' : 'Save Document'}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {showTitleInput && (
        <View style={styles.titleInputOverlay}>
          <View style={styles.titleInputContainer}>
            <Text style={styles.titleInputLabel}>
              {pendingAction === 'createFlashcard'
                ? 'Save this document before creating flashcards'
                : 'Save document'}
            </Text>
            {isGeneratingTitle ? (
              <View style={styles.generatingTitleBox}>
                <ActivityIndicator size="small" color="#6B9071" />
                <Text style={styles.generatingTitleText}>Generating document title...</Text>
              </View>
            ) : (
              <TextInput
                style={styles.titleInput}
                placeholder="Document title"
                placeholderTextColor="#999"
                value={documentTitle}
                onChangeText={setDocumentTitle}
                autoFocus
              />
            )}
            <View style={styles.titleInputActions}>
              <TouchableOpacity
                style={[styles.titleInputButton, styles.cancelButton]}
                onPress={() => {
                  setShowTitleInput(false);
                  setPendingAction(null);
                }}
                disabled={isSaving || isCreatingFlashcards}
              >
                <Text style={styles.titleInputButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.titleInputButton, styles.confirmButton, isBusy && styles.buttonDisabled]}
                onPress={handleConfirmTitle}
                disabled={!documentTitle.trim() || isBusy}
              >
                {isBusy ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.titleInputButtonText}>
                    {pendingAction === 'createFlashcard' ? 'Save and Create' : 'Save'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      <CustomAlertModal
        visible={alertModalVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon}
        buttons={alertConfig.buttons}
        onDismiss={() => setAlertModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BG,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: clamp(height * 0.018, 12, 18),
    paddingBottom: clamp(height * 0.02, 16, 22),
  },
  summaryCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: clamp(height * 0.014, 10, 14),
    shadowColor: '#192018',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 7,
    elevation: 4,
  },
  takeawayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: clamp(height * 0.018, 12, 18),
    shadowColor: '#192018',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: clamp(width * 0.025, 8, 12),
    marginBottom: clamp(height * 0.014, 10, 14),
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: clamp(width * 0.025, 8, 11),
    flexShrink: 1,
  },
  cardTitle: {
    color: '#202020',
    fontSize: CARD_TITLE_SIZE,
    fontWeight: '800',
  },
  pagePill: {
    backgroundColor: '#E8F1E1',
    borderRadius: 9,
    paddingHorizontal: clamp(width * 0.028, 9, 12),
    paddingVertical: clamp(height * 0.009, 7, 9),
  },
  pagePillText: {
    color: GREEN,
    fontSize: SMALL_FONT,
    fontWeight: '700',
  },
  summaryText: {
    color: '#2A2A2A',
    fontSize: BODY_FONT,
    lineHeight: BODY_LINE,
  },
  extraPages: {
    marginTop: clamp(height * 0.012, 10, 14),
    gap: clamp(height * 0.012, 10, 14),
  },
  extraPageBlock: {
    paddingTop: clamp(height * 0.012, 10, 14),
    borderTopWidth: 1,
    borderTopColor: '#E7E7E7',
  },
  extraPageTitle: {
    color: GREEN,
    fontSize: SMALL_FONT,
    fontWeight: '800',
    marginBottom: 8,
  },
  extraPageText: {
    color: '#383838',
    fontSize: clamp(width * 0.036, 13, 15),
    lineHeight: clamp(width * 0.055, 20, 23),
  },
  dashedRule: {
    marginTop: clamp(height * 0.018, 14, 20),
    borderBottomWidth: 1,
    borderStyle: 'dashed',
    borderColor: '#CFCFCF',
  },
  takeawayList: {
    marginTop: clamp(height * 0.014, 10, 14),
    gap: clamp(height * 0.01, 8, 12),
  },
  takeawayItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: clamp(width * 0.025, 9, 12),
  },
  takeawayBullet: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GREEN,
    marginTop: 8,
  },
  takeawayText: {
    flex: 1,
    color: '#303030',
    fontSize: clamp(width * 0.035, 13, 15),
    lineHeight: clamp(width * 0.052, 19, 22),
  },
  emptyText: {
    color: '#777777',
    fontSize: SMALL_FONT,
    lineHeight: clamp(SMALL_FONT * 1.45, 18, 21),
  },
  inlineLoading: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  inlineLoadingText: {
    color: GREEN,
    fontSize: SMALL_FONT,
    fontWeight: '700',
  },
  actionsWrap: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: clamp(height * 0.012, 10, 14),
    backgroundColor: BG,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: clamp(width * 0.03, 10, 14),
    marginBottom: clamp(height * 0.012, 10, 12),
  },
  previousButton: {
    flex: 1,
    minHeight: ACTION_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: GREEN,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: clamp(width * 0.02, 7, 10),
  },
  previousButtonText: {
    color: GREEN,
    fontSize: clamp(width * 0.04, 14, 16),
    fontWeight: '800',
  },
  flashcardButton: {
    flex: 1.12,
    minHeight: ACTION_HEIGHT,
    borderRadius: 12,
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: clamp(width * 0.02, 7, 10),
    shadowColor: '#2D3F2D',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 5,
    elevation: 4,
  },
  flashcardButtonText: {
    color: '#FFFFFF',
    fontSize: clamp(width * 0.04, 14, 16),
    fontWeight: '800',
  },
  saveButton: {
    minHeight: ACTION_HEIGHT,
    borderRadius: 12,
    backgroundColor: '#789A7B',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: clamp(width * 0.025, 8, 12),
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontSize: clamp(width * 0.04, 14, 16),
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '600',
  },
  titleInputOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  titleInputContainer: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    width: width * 0.84,
    maxWidth: 360,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
  },
  titleInputLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
    textAlign: 'center',
  },
  titleInput: {
    borderWidth: 1,
    borderColor: '#AEC3B0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#333',
    marginBottom: 16,
  },
  generatingTitleBox: {
    minHeight: 44,
    borderWidth: 1,
    borderColor: '#AEC3B0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  generatingTitleText: {
    fontSize: 13,
    color: '#344E39',
    fontWeight: '600',
  },
  titleInputActions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
  },
  titleInputButton: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    minHeight: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#AEC3B0',
  },
  confirmButton: {
    backgroundColor: '#6B9071',
  },
  titleInputButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
  },
});

export default SummaryScreen;
