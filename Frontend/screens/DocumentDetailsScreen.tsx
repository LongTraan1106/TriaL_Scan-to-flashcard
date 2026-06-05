import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import SparkleIcon from '../assets/icons/AI.svg';
import TargetIcon from '../assets/icons/target.svg';
import FlashcardIcon from '../assets/icons/flash_card.svg';
import TrashIcon from '../assets/icons/trash_can.svg';
import StarIcon from '../assets/icons/star.svg';
import StarFillIcon from '../assets/icons/start_fill.svg';
import { CustomAlertModal, AlertButton } from '../components/CustomAlertModal';
import { documentService, FlashcardListItem, OCRData, SummaryData } from '../services/documentService';

const { width, height } = Dimensions.get('window');
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const PAGE_PADDING = clamp(width * 0.04, 12, 18);
const CARD_RADIUS = clamp(width * 0.035, 12, 16);
const CARD_PADDING = clamp(width * 0.04, 14, 18);
const HERO_MIN_HEIGHT = clamp(height * 0.2, 156, 190);
const HERO_ICON_SIZE = clamp(width * 0.118, 42, 52);
const HERO_MORE_SIZE = clamp(width * 0.105, 38, 46);
const HERO_TITLE_SIZE = clamp(width * 0.064, 22, 28);
const HERO_TITLE_LINE = clamp(HERO_TITLE_SIZE * 1.18, 27, 34);
const CHIP_HEIGHT = clamp(height * 0.044, 34, 39);
const CHIP_FONT = clamp(width * 0.03, 11, 13);
const CHIP_ICON = clamp(width * 0.048, 17, 20);
const CARD_TITLE_SIZE = clamp(width * 0.047, 17, 20);
const BODY_FONT = clamp(width * 0.039, 14, 16);
const BODY_LINE = clamp(BODY_FONT * 1.55, 21, 25);
const SMALL_FONT = clamp(width * 0.034, 12, 14);
const ACTION_HEIGHT = clamp(height * 0.058, 46, 54);
const TAKEAWAY_ART_SIZE = clamp(width * 0.21, 70, 88);
const TAKEAWAY_BADGE_SIZE = clamp(width * 0.115, 40, 50);

function BackIcon({ color = '#ffffff' }: { color?: string }) {
  return (
    <Svg width={30} height={30} viewBox="0 0 30 30" fill="none">
      <Path d="M18.5 7L10.5 15L18.5 23" stroke={color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
      <Line x1={11.5} y1={15} x2={24} y2={15} stroke={color} strokeWidth={3} strokeLinecap="round" />
    </Svg>
  );
}

function CheckCircleIcon() {
  return (
    <Svg width={CHIP_ICON} height={CHIP_ICON} viewBox="0 0 22 22" fill="none">
      <Circle cx={11} cy={11} r={9} stroke="#587956" strokeWidth={2.4} />
      <Path d="M6.5 11L9.5 14L15.8 7.7" stroke="#587956" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CalendarIcon() {
  return (
    <Svg width={CHIP_ICON + 1} height={CHIP_ICON + 1} viewBox="0 0 24 24" fill="none">
      <Rect x={4} y={5} width={16} height={15} rx={2} stroke="#587956" strokeWidth={2} />
      <Line x1={4} y1={10} x2={20} y2={10} stroke="#587956" strokeWidth={2} />
      <Line x1={8} y1={3.5} x2={8} y2={7} stroke="#587956" strokeWidth={2} strokeLinecap="round" />
      <Line x1={16} y1={3.5} x2={16} y2={7} stroke="#587956" strokeWidth={2} strokeLinecap="round" />
    </Svg>
  );
}

function PaperCheckArt() {
  return (
    <View style={styles.paperArt}>
      <Svg width={TAKEAWAY_ART_SIZE} height={TAKEAWAY_ART_SIZE} viewBox="0 0 86 86" fill="none">
        <Path d="M17 6H58L75 23V78C75 81.3 72.3 84 69 84H17C13.7 84 11 81.3 11 78V12C11 8.7 13.7 6 17 6Z" fill="#EDF3E6" stroke="#C8D6C4" strokeWidth={2} />
        <Path d="M58 6V23H75" fill="#C8D6C4" />
        <Line x1={25} y1={36} x2={61} y2={36} stroke="#CBD7C8" strokeWidth={5} strokeLinecap="round" />
        <Line x1={25} y1={48} x2={61} y2={48} stroke="#CBD7C8" strokeWidth={5} strokeLinecap="round" />
        <Line x1={25} y1={60} x2={54} y2={60} stroke="#CBD7C8" strokeWidth={5} strokeLinecap="round" />
      </Svg>
      <View style={styles.paperCheckBadge}>
        <Svg width={TAKEAWAY_BADGE_SIZE * 0.6} height={TAKEAWAY_BADGE_SIZE * 0.6} viewBox="0 0 32 32" fill="none">
          <Path d="M8 16.5L13.2 21.7L24 10.8" stroke="#FFFFFF" strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </View>
    </View>
  );
}

function DocumentDetailsScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const scrollViewRef = useRef<ScrollView>(null);

  const { documentId }: { documentId: number } = route.params || {};

  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [keyTakeaways, setKeyTakeaways] = useState<string[]>([]);
  const [ocrData, setOcrData] = useState<OCRData | null>(null);
  const [sourceFileName, setSourceFileName] = useState<string | null>(null);
  const [flashcardSet, setFlashcardSet] = useState<FlashcardListItem | null>(null);
  const [isFlashcardProcessing, setIsFlashcardProcessing] = useState(false);
  const [documentTitle, setDocumentTitle] = useState('');
  const [isFavorite, setIsFavorite] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  useEffect(() => {
    loadDocumentDetails();
  }, [documentId]);

  useFocusEffect(
    React.useCallback(() => {
      loadDocumentDetails();
    }, [documentId])
  );

  const loadDocumentDetails = async () => {
    if (!documentId) {
      setError('Invalid document ID');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const doc = await documentService.getDocumentDetail(documentId);
      setSummaryData(doc.summary_data);
      setKeyTakeaways(doc.key_takeaways || doc.summary_data?.key_takeaways || []);
      setOcrData(doc.ocr_data || null);
      setSourceFileName(doc.source_file_name || null);
      setDocumentTitle(doc.title);
      setIsFavorite(doc.is_favorite);
      setUpdatedAt(doc.updated_at || doc.created_at);

      const flashcardSets = await documentService.getFlashcardSets(documentId);
      setFlashcardSet(flashcardSets[0] || null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Cannot load document');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    navigation.goBack();
  };

  const handleToggleFavorite = async () => {
    try {
      await documentService.toggleFavorite(documentId, !isFavorite);
      setIsFavorite(!isFavorite);
      setAlertConfig({
        title: 'Success',
        message: !isFavorite
          ? `Added "${documentTitle}" to favourites`
          : `Removed "${documentTitle}" from favourites`,
        icon: 'OK',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
    } catch (err) {
      setAlertConfig({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Cannot update favourite',
        icon: '!',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
    }
  };

  const handleCreateFlashcard = async () => {
    if (flashcardSet) {
      navigation.navigate('FlashcardDetail', {
        flashcardId: flashcardSet.id,
        title: flashcardSet.title,
      });
      return;
    }

    if (!ocrData || !ocrData.ocr_results?.length) {
      setAlertConfig({
        title: 'No OCR Data',
        message: 'This document does not have OCR data for flashcard generation.',
        icon: '!',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
      return;
    }

    setIsFlashcardProcessing(true);
    setAlertConfig({
      title: 'Creating Flashcards',
      message: 'Creating flashcards from this document OCR data...',
      icon: '...',
      buttons: [],
    });
    setAlertModalVisible(true);

    try {
      const processed = await documentService.processFlashcards(ocrData);
      setAlertModalVisible(false);
      navigation.navigate('FlashcardDetail', {
        title: `Flashcards - ${documentTitle}`,
        draftFlashcardData: processed.flashcard_data,
        draftTotalCards: processed.total_cards,
        saveOptions: {
          documentId,
          sourceFileName,
          tags: ['Flashcard'],
        },
        sourceFlow: 'documentDetails',
      });
    } catch (err) {
      setAlertConfig({
        title: 'Error',
        message: err instanceof Error ? err.message : 'Cannot create flashcards',
        icon: '!',
        buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
      });
      setAlertModalVisible(true);
    } finally {
      setIsFlashcardProcessing(false);
    }
  };

  const handleDeleteDocument = () => {
    setAlertConfig({
      title: 'Delete Document',
      message: `Are you sure you want to delete "${documentTitle}"?`,
      icon: '!',
      buttons: [
        { text: 'Cancel', onPress: () => setAlertModalVisible(false), style: 'cancel' },
        {
          text: 'Delete',
          onPress: async () => {
            setAlertModalVisible(false);
            try {
              await documentService.deleteDocument(documentId);
              setAlertConfig({
                title: 'Deleted',
                message: `"${documentTitle}" has been removed from your library.`,
                icon: 'OK',
                buttons: [
                  {
                    text: 'OK',
                    onPress: () => {
                      setAlertModalVisible(false);
                      navigation.navigate('Documents');
                    },
                    style: 'default',
                  },
                ],
              });
              setAlertModalVisible(true);
            } catch (err) {
              setAlertConfig({
                title: 'Error',
                message: err instanceof Error ? err.message : 'Cannot delete document',
                icon: '!',
                buttons: [{ text: 'OK', onPress: () => setAlertModalVisible(false), style: 'default' }],
              });
              setAlertModalVisible(true);
            }
          },
          style: 'destructive',
        },
      ],
    });
    setAlertModalVisible(true);
  };

  const pagesArray = summaryData?.pages
    ? Object.entries(summaryData.pages).map(([key, value]) => ({
        pageKey: key,
        content: value,
      }))
    : [];

  const formattedUpdatedAt = updatedAt
    ? new Date(updatedAt).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      })
    : 'Today';

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.centerState}>
          <ActivityIndicator size="large" color="#587956" />
          <Text style={styles.stateText}>Loading document...</Text>
        </View>
      </View>
    );
  }

  if (error || !summaryData) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error || 'No document data available'}</Text>
          {error ? (
            <TouchableOpacity style={styles.retryButton} onPress={loadDocumentDetails}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          ) : null}
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
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <TouchableOpacity style={styles.heroIconButton} onPress={handleBack} activeOpacity={0.82}>
              <BackIcon />
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.heroIconButtonSmall}
              onPress={handleToggleFavorite}
              activeOpacity={0.82}
            >
              {isFavorite ? (
                <StarFillIcon width={CHIP_ICON + 8} height={CHIP_ICON + 8} />
              ) : (
                <StarIcon width={CHIP_ICON + 8} height={CHIP_ICON + 8} />
              )}
            </TouchableOpacity>
          </View>

          <Text style={styles.heroTitle} numberOfLines={3}>
            {documentTitle}
          </Text>

          <View style={styles.chipRow}>
            <View style={styles.chip}>
              <Text style={styles.chipText} numberOfLines={1}>
                {summaryData.num_pages || pagesArray.length || 1} pages
              </Text>
            </View>
            <View style={styles.chip}>
              <CheckCircleIcon />
              <Text style={styles.chipText} numberOfLines={1}>
                {isFavorite ? 'Saved' : 'Summarized'}
              </Text>
            </View>
            <View style={styles.chip}>
              <CalendarIcon />
              <Text style={styles.chipText} numberOfLines={1}>
                Updated {formattedUpdatedAt}
              </Text>
            </View>
          </View>
        </View>

        <View style={styles.summaryCard}>
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <SparkleIcon width={clamp(width * 0.07, 24, 30)} height={clamp(width * 0.07, 24, 30)} />
              <Text style={styles.cardTitle}>AI Summary</Text>
            </View>
            <View style={styles.pagePill}>
              <Text style={styles.pagePillText}>Page {pagesArray.length ? 1 : 0}</Text>
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
          <View style={styles.takeawayContent}>
            <View style={styles.cardTitleRow}>
              <TargetIcon width={clamp(width * 0.066, 23, 28)} height={clamp(width * 0.066, 23, 28)} />
              <Text style={styles.cardTitle}>Key takeaways</Text>
            </View>

            <View style={styles.takeawayList}>
              {keyTakeaways.length ? (
                keyTakeaways.map((item, index) => (
                  <View key={`${item}-${index}`} style={styles.takeawayItem}>
                    <View style={styles.takeawayBullet} />
                    <Text style={styles.takeawayText}>{item}</Text>
                  </View>
                ))
              ) : (
                <Text style={styles.emptyText}>No key takeaways generated for this document yet.</Text>
              )}
            </View>
          </View>
          <PaperCheckArt />
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity style={styles.previousButton} onPress={handleBack} activeOpacity={0.85}>
            <BackIcon color="#587956" />
            <Text style={styles.previousButtonText}>Previous</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.flashcardButton, isFlashcardProcessing && styles.buttonDisabled]}
            onPress={handleCreateFlashcard}
            disabled={isFlashcardProcessing}
            activeOpacity={0.85}
          >
            {isFlashcardProcessing ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <FlashcardIcon width={clamp(width * 0.06, 22, 26)} height={clamp(width * 0.06, 22, 26)} />
                <Text style={styles.flashcardButtonText}>
                  {flashcardSet ? 'View Flashcards' : 'Create Flashcards'}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.deleteButton} onPress={handleDeleteDocument} activeOpacity={0.85}>
          {/* <TrashIcon width={clamp(width * 0.052, 19, 23)} height={clamp(width * 0.058, 22, 25)} /> */}
          <Text style={styles.deleteButtonText}>Delete Document</Text>
        </TouchableOpacity>
      </ScrollView>

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

const GREEN = '#587956';
const BG = '#F2F8EC';

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
    paddingTop: clamp(height * 0.018, 10, 16),
    paddingBottom: clamp(height * 0.018, 12, 18),
  },
  centerState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  stateText: {
    marginTop: 12,
    color: GREEN,
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    color: '#D82424',
    fontSize: 15,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 14,
  },
  retryButton: {
    backgroundColor: GREEN,
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  heroCard: {
    backgroundColor: '#789A7B',
    borderRadius: CARD_RADIUS,
    minHeight: HERO_MIN_HEIGHT,
    padding: CARD_PADDING,
    marginBottom: clamp(height * 0.018, 12, 16),
    shadowColor: '#2D3F2D',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroIconButton: {
    width: HERO_ICON_SIZE,
    height: HERO_ICON_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroIconButtonSmall: {
    width: HERO_MORE_SIZE,
    height: HERO_MORE_SIZE,
    borderRadius: HERO_MORE_SIZE / 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    color: '#FFFFFF',
    fontSize: HERO_TITLE_SIZE,
    lineHeight: HERO_TITLE_LINE,
    fontWeight: '800',
    marginTop: clamp(height * 0.012, 8, 12),
    marginHorizontal: clamp(width * 0.08, 20, 40),
    letterSpacing: 0,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'nowrap',
    justifyContent: 'center',
    alignItems: 'center',
    gap: clamp(width * 0.018, 6, 8),
    marginTop: clamp(height * 0.018, 14, 20),
  },
  chip: {
    minHeight: CHIP_HEIGHT,
    paddingHorizontal: clamp(width * 0.02, 7, 10),
    borderRadius: clamp(CHIP_HEIGHT * 0.28, 9, 12),
    backgroundColor: 'rgba(240,247,235,0.82)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: clamp(width * 0.012, 4, 6),
    flexShrink: 1,
    minWidth: 0,
  },
  chipText: {
    color: '#1F1F1F',
    fontSize: CHIP_FONT,
    fontWeight: '600',
    flexShrink: 1,
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
    fontWeight: '400',
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
  takeawayCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: CARD_RADIUS,
    padding: CARD_PADDING,
    marginBottom: clamp(height * 0.024, 18, 24),
    minHeight: clamp(height * 0.17, 140, 180),
    flexDirection: 'row',
    alignItems: 'center',
    gap: clamp(width * 0.025, 8, 12),
    shadowColor: '#192018',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  takeawayContent: {
    flex: 1,
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
  paperArt: {
    width: TAKEAWAY_ART_SIZE + 10,
    height: TAKEAWAY_ART_SIZE + 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  paperCheckBadge: {
    position: 'absolute',
    right: 4,
    bottom: 6,
    width: TAKEAWAY_BADGE_SIZE,
    height: TAKEAWAY_BADGE_SIZE,
    borderRadius: TAKEAWAY_BADGE_SIZE / 2,
    backgroundColor: GREEN,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 4,
  },
  emptyText: {
    color: '#777777',
    fontSize: SMALL_FONT,
    lineHeight: clamp(SMALL_FONT * 1.45, 18, 21),
  },
  actionsRow: {
    flexDirection: 'row',
    gap: clamp(width * 0.03, 10, 14),
    marginBottom: clamp(height * 0.016, 12, 16),
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
  buttonDisabled: {
    opacity: 0.65,
  },
  divider: {
    height: 1,
    backgroundColor: '#D7DED1',
    marginBottom: 14,
  },
  deleteButton: {
    minHeight: ACTION_HEIGHT,
    borderRadius: 12,
    borderWidth: 1.2,
    borderColor: '#E71E24',
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: clamp(width * 0.028, 9, 13),
  },
  deleteButtonText: {
    color: '#D82424',
    fontSize: clamp(width * 0.04, 14, 16),
    fontWeight: '800',
  },
});

export default DocumentDetailsScreen;
