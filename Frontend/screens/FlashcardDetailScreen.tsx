import React from 'react';
import {
  Animated,
  ActivityIndicator,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CustomAlertModal, AlertButton } from '../components/CustomAlertModal';
import { documentService, FlashcardBlock, FlashcardSet } from '../services/documentService';
import { flashcardProgressService } from '../utils/flashcardProgressService';
import LookupIcon from '../assets/icons/lookup.svg';
import TickIcon from '../assets/icons/tick.svg';
import XIcon from '../assets/icons/x.svg';

type CardStatus = 'known' | 'unknown' | null;

interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  explain: string;
  status: CardStatus;
}

interface ActionButtonProps {
  type: 'unknown' | 'lookup' | 'known';
  label?: string;
  height: number;
  width: number;
  labelSize: number;
  disabled?: boolean;
  onPress: () => void;
}

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

const CARD_COLOR_QUEUE = [
  {
    question: '#F5F8EC',
    answer: '#E8F0DB',
    pill: '#E3EBD7',
    text: '#173528',
  },
  {
    question: '#EAF2E5',
    answer: '#D8E7D2',
    pill: '#D6E2CE',
    text: '#1F3B2B',
  },
  {
    question: '#DFEBD8',
    answer: '#C9DDC3',
    pill: '#C9DABF',
    text: '#233D2F',
  },
];

const flattenFlashcards = (set: Pick<FlashcardSet, 'id' | 'flashcard_data'>): FlashcardItem[] => {
  const cards: FlashcardItem[] = [];

  set.flashcard_data.forEach((block, blockIndex) => {
    block.flashcards?.forEach((card, cardIndex) => {
      cards.push({
        id: `${set.id}-${block.page}-${block.group_idx}-${block.box_idx}-${blockIndex}-${cardIndex}`,
        question: card.question,
        answer: card.answer,
        explain: card.explain || '',
        status: null,
      });
    });
  });

  return cards;
};

const countValidFlashcards = (flashcardData: FlashcardBlock[] = []) =>
  flashcardData.reduce(
    (total, block) =>
      total +
      (block.flashcards || []).filter(
        card => card.question?.trim() && card.answer?.trim(),
      ).length,
    0,
  );

const cleanLookupSubject = (question = '') => {
  const normalized = question
    .replace(/[?!.]+$/g, '')
    .replace(/^what\s+is\s+/i, '')
    .replace(/^what\s+are\s+/i, '')
    .replace(/^explain\s+/i, '')
    .replace(/^define\s+/i, '')
    .trim();

  if (!normalized) {
    return 'this card';
  }

  return normalized.length > 38 ? `${normalized.slice(0, 35).trim()}...` : normalized;
};

const getLookupKeywords = (card?: FlashcardItem) => {
  if (!card) {
    return [];
  }

  const source = `${card.question} ${card.answer}`;
  const words = source
    .replace(/[^a-zA-Z0-9\s-]/g, ' ')
    .split(/\s+/)
    .map(word => word.trim())
    .filter(word => word.length > 4);
  const uniqueWords = Array.from(new Set(words));
  return uniqueWords.slice(0, 3);
};

function FlashcardDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const initialFlashcardId = Number(route.params?.flashcardId) || 0;
  const draftFlashcardData = route.params?.draftFlashcardData as FlashcardBlock[] | undefined;
  const saveOptions = route.params?.saveOptions || {};
  const isDraftFlow = Array.isArray(draftFlashcardData);
  const allowLeaveRef = React.useRef(false);
  const isHandlingLeaveRef = React.useRef(false);
  const [savedFlashcardId, setSavedFlashcardId] = React.useState(initialFlashcardId);
  const [flashcardData, setFlashcardData] = React.useState<FlashcardBlock[]>(draftFlashcardData || []);
  const [isSaved, setIsSaved] = React.useState(!isDraftFlow);
  const [isSaving, setIsSaving] = React.useState(false);
  const [setTitle, setSetTitle] = React.useState(route.params?.title || 'Flashcards');
  const [cards, setCards] = React.useState<FlashcardItem[]>([]);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [isBackSide, setIsBackSide] = React.useState(false);
  const [lookupVisible, setLookupVisible] = React.useState(false);
  const [gestureCardId, setGestureCardId] = React.useState<string | null>(null);
  const [alertModalVisible, setAlertModalVisible] = React.useState(false);
  const [alertConfig, setAlertConfig] = React.useState<{
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
  const flipAnim = React.useRef(new Animated.Value(0)).current;
  const pan = React.useRef(new Animated.ValueXY()).current;
  const isAnimatingSwipeRef = React.useRef(false);
  const isAnimatingFlipRef = React.useRef(false);

  const currentCard = cards[currentIndex];
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);
  const cardNumber = cards.length > 0 ? Math.min(currentIndex + 1, cards.length) : 0;
  const progress = cards.length > 0 ? cardNumber / cards.length : 0;
  const progressPercent = Math.round(progress * 100);
  const lookupKeywords = getLookupKeywords(currentCard);

  const horizontalPadding = clamp(width * 0.06, 18, 30);
  const contentWidth = width - horizontalPadding * 2;
  const headerTop = Math.max(insets.top + 8, clamp(height * 0.026, 18, 34));
  const backButtonSize = clamp(width * 0.095, 36, 48);
  const progressTop = clamp(height * 0.016, 10, 18);
  const progressHeight = clamp(height * 0.009, 6, 9);
  const draftSaveHeight = isDraftFlow ? 54 : 0;
  const deckTop = clamp(height * 0.016, 9, 18);
  const actionTop = clamp(height * 0.014, 8, 16);
  const actionHeight = clamp(height * 0.082, 62, 82);
  const stackOffsetX = clamp(contentWidth * 0.035, 10, 18);
  const stackOffsetY = clamp(height * 0.014, 8, 13);
  const cardSideInset = clamp(contentWidth * 0.035, 12, 22);
  const availableCardHeight =
    height -
    headerTop -
    backButtonSize -
    draftSaveHeight -
    progressTop -
    progressHeight -
    deckTop -
    stackOffsetY * 2 -
    actionTop -
    actionHeight -
    insets.bottom -
    70;
  const cardHeight = clamp(
    availableCardHeight,
    Math.min(250, height * 0.32),
    Math.min(430, height * 0.44),
  );
  const deckHeight = cardHeight + stackOffsetY * 2 + 8;
  const actionGap = clamp(contentWidth * 0.035, 9, 16);
  const actionButtonWidth = Math.max(76, (contentWidth - actionGap * 2) / 3);
  const titleFontSize = clamp(width * 0.058, 21, 28);
  const cardFontSize = clamp(width * 0.043, 15, 20);
  const cardLineHeight = Math.round(cardFontSize * 1.35);
  const cardRadius = clamp(width * 0.038, 14, 24);
  const cardPaddingHorizontal = clamp(width * 0.048, 16, 24);
  const cardPaddingVertical = clamp(height * 0.022, 15, 24);
  const progressTextFontSize = clamp(width * 0.038, 13, 16);
  const stackLiftX = pan.x.interpolate({
    inputRange: [-width * 0.24, 0, width * 0.24],
    outputRange: [-stackOffsetX, 0, -stackOffsetX],
    extrapolate: 'clamp',
  });
  const stackLiftY = pan.x.interpolate({
    inputRange: [-width * 0.24, 0, width * 0.24],
    outputRange: [-stackOffsetY, 0, -stackOffsetY],
    extrapolate: 'clamp',
  });
  const stackLiftScale = pan.x.interpolate({
    inputRange: [-width * 0.24, 0, width * 0.24],
    outputRange: [1, 0.965, 1],
    extrapolate: 'clamp',
  });
  const stackThirdLiftX = pan.x.interpolate({
    inputRange: [-width * 0.24, 0, width * 0.24],
    outputRange: [-stackOffsetX, 0, -stackOffsetX],
    extrapolate: 'clamp',
  });
  const stackThirdLiftY = pan.x.interpolate({
    inputRange: [-width * 0.24, 0, width * 0.24],
    outputRange: [-stackOffsetY, 0, -stackOffsetY],
    extrapolate: 'clamp',
  });
  const stackThirdLiftScale = pan.x.interpolate({
    inputRange: [-width * 0.24, 0, width * 0.24],
    outputRange: [0.965, 0.93, 0.965],
    extrapolate: 'clamp',
  });

  React.useEffect(() => {
    const loadFlashcardDetail = async () => {
      if (isDraftFlow) {
        if (!draftFlashcardData || countValidFlashcards(draftFlashcardData) <= 0) {
          setError('No valid flashcards to preview');
          setIsLoading(false);
          return;
        }

        const draftSet = {
          id: 0,
          flashcard_data: draftFlashcardData,
        };
        const nextCards = flattenFlashcards(draftSet);
        setCards(nextCards);
        setGestureCardId(null);
        setFlashcardData(draftFlashcardData);
        setCurrentIndex(0);
        setSetTitle(route.params?.title || 'Flashcards');
        setIsLoading(false);
        return;
      }

      if (!savedFlashcardId) {
        setError('Invalid flashcard set');
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);
      try {
        const detail = await documentService.getFlashcardDetail(savedFlashcardId);
        const rawCards = flattenFlashcards(detail);
        const progress = await flashcardProgressService.getProgress(
          savedFlashcardId,
          rawCards.length,
        );
        const nextCards = rawCards.map(card => ({
          ...card,
          status: progress.statuses[card.id] || null,
        }));
        const safeInitialIndex = Math.min(
          Number(route.params?.initialIndex) || 0,
          nextCards.length,
        );
        setCards(nextCards);
        setGestureCardId(null);
        setFlashcardData(detail.flashcard_data);
        setCurrentIndex(safeInitialIndex);
        setSetTitle(detail.title);
        setIsSaved(true);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Cannot load flashcard set';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadFlashcardDetail();
  }, [draftFlashcardData, isDraftFlow, route.params?.initialIndex, route.params?.title, savedFlashcardId]);

  React.useEffect(() => {
    flipAnim.setValue(0);
    setIsBackSide(false);
    pan.setValue({ x: 0, y: 0 });
    setGestureCardId(null);
  }, [currentIndex, flipAnim, pan]);

  const completeCurrentCard = React.useCallback(
    (status: Exclude<CardStatus, null>, direction: 'left' | 'right') => {
      if (!currentCard || isAnimatingSwipeRef.current) {
        return;
      }

      isAnimatingSwipeRef.current = true;
      setGestureCardId(currentCard.id);
      if (!isDraftFlow && savedFlashcardId) {
        flashcardProgressService
          .markCard(savedFlashcardId, currentCard.id, status, cards.length)
          .catch(error => {
            console.error('[Flashcard Progress] Cannot save card status:', error);
          });
      }
      setCards(prevCards =>
        prevCards.map(card =>
          card.id === currentCard.id ? { ...card, status } : card,
        ),
      );

      Animated.timing(pan, {
        toValue: { x: direction === 'right' ? width : -width, y: 22 },
        duration: 220,
        useNativeDriver: true,
      }).start(() => {
        setGestureCardId(null);
        setCurrentIndex(index => Math.min(index + 1, cards.length));
        isAnimatingSwipeRef.current = false;
      });
    },
    [cards.length, currentCard, isDraftFlow, pan, savedFlashcardId, width],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
        onPanResponderGrant: () => {
          if (currentCard) {
            setGestureCardId(currentCard.id);
          }
        },
        onPanResponderMove: Animated.event([null, { dx: pan.x, dy: pan.y }], {
          useNativeDriver: false,
        }),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dx > width * 0.24) {
            completeCurrentCard('known', 'right');
            return;
          }

          if (gesture.dx < -width * 0.24) {
            completeCurrentCard('unknown', 'left');
            return;
          }

          Animated.spring(pan, {
            toValue: { x: 0, y: 0 },
            friction: 6,
            tension: 60,
            useNativeDriver: true,
          }).start();
        },
      }),
    [completeCurrentCard, currentCard, pan, width],
  );

  const handleFlipCard = () => {
    if (!currentCard || isAnimatingSwipeRef.current || isAnimatingFlipRef.current) {
      return;
    }

    isAnimatingFlipRef.current = true;
    Animated.timing(flipAnim, {
      toValue: isBackSide ? 0 : 1,
      duration: 320,
      useNativeDriver: true,
    }).start(() => {
      isAnimatingFlipRef.current = false;
    });
    setIsBackSide(value => !value);
  };

  const navigateToFlashcardScreen = React.useCallback(() => {
    allowLeaveRef.current = true;
    navigation.navigate('TabNavigator', { screen: 'Flashcard' });
  }, [navigation]);

  const saveDraftFlashcardSet = React.useCallback(async () => {
    if (isSaved && savedFlashcardId) {
      return savedFlashcardId;
    }

    if (countValidFlashcards(flashcardData) <= 0) {
      throw new Error('Cannot save an empty flashcard set');
    }

    setIsSaving(true);
    try {
      const savedSet = await documentService.saveFlashcardSet(
        setTitle,
        flashcardData,
        {
          documentId: saveOptions.documentId,
          sourceFileName: saveOptions.sourceFileName,
          tags: saveOptions.tags || ['Flashcard'],
        },
      );
      setSavedFlashcardId(savedSet.id);
      setSetTitle(savedSet.title);
      setIsSaved(true);
      return savedSet.id;
    } finally {
      setIsSaving(false);
    }
  }, [flashcardData, isSaved, saveOptions.documentId, saveOptions.sourceFileName, saveOptions.tags, savedFlashcardId, setTitle]);

  const promptDoneWithUnsavedDraft = React.useCallback(() => {
    setAlertConfig({
      title: 'Unsaved Flashcard Set',
      message: 'Do you want to save this flashcard set before finishing?',
      icon: '!',
      buttons: [
        {
          text: 'No',
          style: 'destructive',
          onPress: () => {
            setAlertModalVisible(false);
            allowLeaveRef.current = true;
            navigation.goBack();
          },
        },
        {
          text: 'Yes',
          onPress: async () => {
            try {
              await saveDraftFlashcardSet();
              setAlertModalVisible(false);
              navigateToFlashcardScreen();
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Cannot save flashcard set';
              setAlertConfig({
                title: 'Error',
                message,
                icon: '!',
                buttons: [
                  {
                    text: 'OK',
                    onPress: () => setAlertModalVisible(false),
                    style: 'default',
                  },
                ],
              });
            }
          },
        },
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setAlertModalVisible(false),
        },
      ],
    });
    setAlertModalVisible(true);
  }, [navigateToFlashcardScreen, navigation, saveDraftFlashcardSet]);

  const promptBackWithUnsavedDraft = React.useCallback(
    (continueBack?: () => void) => {
      setAlertConfig({
        title: 'Unsaved Flashcard Set',
        message: 'If you go back, this flashcard set will not be saved.',
        icon: '!',
        buttons: [
          {
            text: 'Stay',
            style: 'cancel',
            onPress: () => setAlertModalVisible(false),
          },
          {
            text: 'Go Back',
            style: 'destructive',
            onPress: () => {
              setAlertModalVisible(false);
              allowLeaveRef.current = true;
              if (continueBack) {
                continueBack();
              } else {
                navigation.goBack();
              }
            },
          },
        ],
      });
      setAlertModalVisible(true);
    },
    [navigation],
  );
  React.useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event: any) => {
      if (!isDraftFlow || isSaved || allowLeaveRef.current) {
        return;
      }

      event.preventDefault();
      if (isHandlingLeaveRef.current) {
        return;
      }

      isHandlingLeaveRef.current = true;
      promptBackWithUnsavedDraft(() => navigation.dispatch(event.data.action));
      setTimeout(() => {
        isHandlingLeaveRef.current = false;
      }, 500);
    });

    return unsubscribe;
  }, [isDraftFlow, isSaved, navigation, promptBackWithUnsavedDraft]);

  const handleBackPress = () => {
    if (isDraftFlow && !isSaved) {
      promptBackWithUnsavedDraft();
      return;
    }

    navigation.goBack();
  };

  const handleDonePress = () => {
    if (isDraftFlow && !isSaved) {
      promptDoneWithUnsavedDraft();
      return;
    }

    navigateToFlashcardScreen();
  };

  const handleSavePress = async () => {
    try {
      await saveDraftFlashcardSet();
      setAlertConfig({
        title: 'Saved',
        message: 'Flashcard set has been saved.',
        icon: 'OK',
        buttons: [
          {
            text: 'OK',
            onPress: () => setAlertModalVisible(false),
            style: 'default',
          },
        ],
      });
      setAlertModalVisible(true);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cannot save flashcard set';
      setAlertConfig({
        title: 'Error',
        message,
        icon: '!',
        buttons: [
          {
            text: 'OK',
            onPress: () => setAlertModalVisible(false),
            style: 'default',
          },
        ],
      });
      setAlertModalVisible(true);
    }
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.48, 0.5, 1],
    outputRange: [1, 1, 0, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0, 0.5, 0.52, 1],
    outputRange: [0, 0, 1, 1],
  });
  const swipeRotate = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.header, { marginTop: headerTop }]}>
        <View style={[styles.headerSide, { width: backButtonSize + 28 }]}>
          <TouchableOpacity
            style={[
              styles.backButton,
              {
                width: backButtonSize,
                height: backButtonSize,
                borderRadius: backButtonSize * 0.28,
              },
            ]}
            activeOpacity={0.8}
            onPress={handleBackPress}
          >
            <Text
              style={[
                styles.backIcon,
                {
                  fontSize: backButtonSize * 0.68,
                  lineHeight: backButtonSize * 0.68,
                },
              ]}
            >
              {'<'}
            </Text>
          </TouchableOpacity>
        </View>
        <View style={styles.titleBlock}>
          <Text
            style={[styles.title, { fontSize: titleFontSize }]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {setTitle}
          </Text>
          <Text style={styles.cardCounter}>
            {cards.length > 0 ? `Card ${cardNumber} of ${cards.length}` : setTitle}
          </Text>
        </View>
        <TouchableOpacity
          style={[styles.doneButton, { width: backButtonSize + 28 }]}
          activeOpacity={0.8}
          onPress={handleDonePress}
          disabled={isSaving}
        >
          <Text style={styles.doneText}>{isSaving ? 'Saving' : 'Done'}</Text>
        </TouchableOpacity>
      </View>

      {isDraftFlow ? (
        <TouchableOpacity
          style={[
            styles.saveSetButton,
            (isSaved || isSaving || isLoading || !!error) && styles.saveSetButtonDisabled,
          ]}
          activeOpacity={0.85}
          onPress={handleSavePress}
          disabled={isSaved || isSaving || isLoading || !!error}
        >
          <Text style={styles.saveSetText}>
            {isSaved ? 'Flashcard set saved' : isSaving ? 'Saving flashcard set...' : 'Save flashcard set'}
          </Text>
        </TouchableOpacity>
      ) : null}

      <View style={[styles.progressRow, { marginTop: progressTop }]}>
        <View
          style={[
            styles.progressTrack,
            { height: progressHeight, borderRadius: progressHeight / 2 },
          ]}
        >
          <View style={[styles.progressFill, { flex: progress }]} />
          <View style={{ flex: 1 - progress }} />
        </View>
        <Text
          style={[
            styles.progressText,
            { fontSize: progressTextFontSize, width: progressTextFontSize * 3 },
          ]}
        >
          {progressPercent}%
        </Text>
      </View>

      <View style={[styles.deck, { height: deckHeight, marginTop: deckTop }]}>
        {isLoading ? (
          <View
            style={[
              styles.finishedCard,
              { height: cardHeight, borderRadius: cardRadius },
            ]}
          >
            <ActivityIndicator size="large" color="#344E39" />
            <Text style={styles.finishedText}>Loading cards...</Text>
          </View>
        ) : error ? (
          <View
            style={[
              styles.finishedCard,
              { height: cardHeight, borderRadius: cardRadius },
            ]}
          >
            <Text style={styles.finishedTitle}>Error</Text>
            <Text style={styles.finishedText}>{error}</Text>
          </View>
        ) : visibleCards.length === 0 ? (
          <View
            style={[
              styles.finishedCard,
              { height: cardHeight, borderRadius: cardRadius },
            ]}
          >
            <Text style={styles.finishedTitle}>Completed</Text>
            <Text style={styles.finishedText}>You reviewed all cards.</Text>
          </View>
        ) : (
          visibleCards
            .map((card, stackIndex) => {
              const isTopCard = stackIndex === 0;
              const cardTheme = CARD_COLOR_QUEUE[(currentIndex + stackIndex) % CARD_COLOR_QUEUE.length];
              const cardBaseInset = cardSideInset / 2;
              const isGestureCard = gestureCardId === card.id;
              const isTopGestureActive = gestureCardId === currentCard?.id;
              const stackOneTransform = isTopGestureActive
                ? [
                    { translateX: stackLiftX },
                    { translateY: stackLiftY },
                    { scale: stackLiftScale },
                  ]
                : [{ scale: 0.965 }];
              const stackTwoTransform = isTopGestureActive
                ? [
                    { translateX: stackThirdLiftX },
                    { translateY: stackThirdLiftY },
                    { scale: stackThirdLiftScale },
                  ]
                : [{ scale: 0.93 }];
              const dynamicStackStyle =
                stackIndex === 0
                  ? {
                      top: 0,
                      left: cardBaseInset,
                      right: cardBaseInset,
                      zIndex: 3,
                    }
                  : stackIndex === 1
                  ? {
                      top: stackOffsetY,
                      left: cardBaseInset + stackOffsetX,
                      right: cardBaseInset - stackOffsetX,
                      zIndex: 2,
                      transform: stackOneTransform,
                    }
                  : {
                      top: stackOffsetY * 2,
                      left: cardBaseInset + stackOffsetX * 2,
                      right: cardBaseInset - stackOffsetX * 2,
                      zIndex: 1,
                      transform: stackTwoTransform,
                    };
              const cardStyle = [
                styles.flashcard,
                styles.stackCard,
                {
                  height: cardHeight,
                  borderRadius: cardRadius,
                  backgroundColor: cardTheme.question,
                },
                dynamicStackStyle,
              ];

              if (!isTopCard) {
                return (
                  <Animated.View key={card.id} pointerEvents="none" style={cardStyle}>
                    <View
                      style={[
                        styles.previewCardFace,
                        {
                          borderRadius: cardRadius,
                          backgroundColor: cardTheme.question,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.previewFacePill,
                          {
                            top: cardPaddingVertical,
                            fontSize: clamp(width * 0.03, 11, 13),
                            backgroundColor: cardTheme.pill,
                            color: cardTheme.text,
                          },
                        ]}
                      >
                        ?  Question
                      </Text>
                      <Text
                        style={[
                          styles.previewCardText,
                          {
                            fontSize: cardFontSize,
                            lineHeight: cardLineHeight,
                            color: cardTheme.text,
                          },
                        ]}
                        numberOfLines={4}
                      >
                        {card.question}
                      </Text>
                    </View>
                  </Animated.View>
                );
              }

              return (
                <Animated.View
                  key={card.id}
                  style={[
                    cardStyle,
                    isGestureCard && {
                      transform: [
                        { translateX: pan.x },
                        { translateY: pan.y },
                        { rotate: swipeRotate },
                      ],
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <Pressable style={styles.cardPressArea} onPress={handleFlipCard}>
                    <Animated.View
                      style={[
                        styles.cardFace,
                        styles.cardFront,
                        {
                          borderRadius: cardRadius,
                          paddingHorizontal: cardPaddingHorizontal,
                          paddingVertical: cardPaddingVertical,
                          backgroundColor: cardTheme.question,
                          opacity: frontOpacity,
                          transform: [{ perspective: 1000 }, { rotateY: frontRotate }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.facePill,
                          {
                            top: cardPaddingVertical,
                            fontSize: clamp(width * 0.034, 12, 15),
                            backgroundColor: cardTheme.pill,
                            color: cardTheme.text,
                          },
                        ]}
                      >
                        ?  Question
                      </Text>
                      <Text
                        style={[
                          styles.cardText,
                          {
                            fontSize: cardFontSize,
                            lineHeight: cardLineHeight,
                            color: cardTheme.text,
                          },
                        ]}
                      >
                        {card.question}
                      </Text>
                    </Animated.View>
                    <Animated.View
                      style={[
                        styles.cardFace,
                        styles.cardBack,
                        {
                          borderRadius: cardRadius,
                          paddingHorizontal: cardPaddingHorizontal,
                          paddingVertical: cardPaddingVertical,
                          backgroundColor: cardTheme.answer,
                          opacity: backOpacity,
                          transform: [{ perspective: 1000 }, { rotateY: backRotate }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.facePill,
                          {
                            top: cardPaddingVertical,
                            fontSize: clamp(width * 0.034, 12, 15),
                            backgroundColor: cardTheme.pill,
                            color: cardTheme.text,
                          },
                        ]}
                      >
                        Answer
                      </Text>
                      <Text
                        style={[
                          styles.cardText,
                          {
                            fontSize: cardFontSize,
                            lineHeight: cardLineHeight,
                            color: cardTheme.text,
                          },
                        ]}
                      >
                        {card.answer}
                      </Text>
                    </Animated.View>
                  </Pressable>
                </Animated.View>
              );
            })
            .reverse()
        )}
      </View>

      <View
        style={[
          styles.actionSection,
          { marginTop: actionTop, paddingBottom: Math.max(insets.bottom, 12) },
        ]}
      >
        <Text style={styles.actionHint}>Choose an action after reviewing the card</Text>
        <View
          style={[
          styles.actions,
          {
            columnGap: actionGap,
          },
          ]}
        >
        <ActionButton
          type="unknown"
          height={actionHeight}
          width={actionButtonWidth}
          labelSize={clamp(actionHeight * 0.2, 15, 20)}
          onPress={() => completeCurrentCard('unknown', 'left')}
          disabled={!currentCard}
        />
        <ActionButton
          type="lookup"
          label="Look up"
          height={actionHeight}
          width={actionButtonWidth}
          labelSize={clamp(actionHeight * 0.2, 15, 20)}
          onPress={() => setLookupVisible(true)}
          disabled={!currentCard}
        />
        <ActionButton
          type="known"
          height={actionHeight}
          width={actionButtonWidth}
          labelSize={clamp(actionHeight * 0.2, 15, 20)}
          onPress={() => completeCurrentCard('known', 'right')}
          disabled={!currentCard}
        />
        </View>
      </View>

      <Modal
        visible={lookupVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLookupVisible(false)}
      >
        <View style={styles.lookupOverlay}>
          <View style={[styles.lookupModal, { width: clamp(width * 0.84, 286, 360) }]}>
            <TouchableOpacity
              style={styles.lookupCloseIcon}
              activeOpacity={0.75}
              onPress={() => setLookupVisible(false)}
            >
              <XIcon width={18} height={18} />
            </TouchableOpacity>
            <View style={styles.lookupIconBox}>
              <LookupIcon width={24} height={24} />
            </View>
            <Text style={styles.lookupTitle}>Look up</Text>
            <Text style={styles.lookupSubtitle}>
              About {cleanLookupSubject(currentCard?.question)}
            </Text>
            <ScrollView
              style={styles.lookupScroll}
              contentContainerStyle={styles.lookupScrollContent}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.lookupBody}>
                {currentCard?.explain || 'No explanation available for this card yet. Please regenerate this flashcard set to create lookup explanations.'}
              </Text>
              {lookupKeywords.length > 0 ? (
                <View style={styles.lookupKeywords}>
                  {lookupKeywords.map(keyword => (
                    <View key={keyword} style={styles.lookupKeywordPill}>
                      <Text style={styles.lookupKeywordText}>{keyword}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </ScrollView>
            <View style={styles.lookupDivider} />
            <View style={styles.lookupActions}>
              <TouchableOpacity
                style={styles.lookupSecondaryButton}
                activeOpacity={0.8}
                onPress={() => setLookupVisible(false)}
              >
                <Text style={styles.lookupSecondaryText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.lookupPrimaryButton}
                activeOpacity={0.85}
                onPress={() => setLookupVisible(false)}
              >
                <Text style={styles.lookupPrimaryText}>Got it</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

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

function ActionButton({
  type,
  label,
  height,
  width,
  labelSize,
  disabled,
  onPress,
}: ActionButtonProps) {
  const iconSize = type === 'lookup' ? height * 0.46 : height * 0.46;

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        type === 'lookup' && styles.actionButtonLookup,
        {
          height,
          width,
          borderRadius: height * 0.16,
        },
        disabled && styles.actionButtonDisabled,
      ]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      {type === 'lookup' ? (
        <View style={[styles.actionLookupIcon, { width: iconSize, height: iconSize, borderRadius: iconSize / 2 }]}>
          <LookupIcon width={iconSize * 0.52} height={iconSize * 0.52} />
        </View>
      ) : type === 'known' ? (
        <TickIcon width={iconSize * 1.18} height={iconSize * 0.8} />
      ) : (
        <XIcon width={iconSize} height={iconSize} />
      )}
      {label ? (
        <Text
          style={[
            styles.actionLabel,
            { fontSize: labelSize, lineHeight: labelSize + 4 },
          ]}
          numberOfLines={2}
          adjustsFontSizeToFit
        >
          {label}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3EED4',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerSide: {
    alignItems: 'flex-start',
    justifyContent: 'center',
  },
  backButton: {
    borderWidth: 3,
    borderColor: '#344E39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  backIcon: {
    color: '#344E39',
    fontWeight: '300',
  },
  title: {
    textAlign: 'center',
    fontWeight: '800',
    color: '#173528',
  },
  titleBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  cardCounter: {
    marginTop: 3,
    fontSize: 15,
    color: '#52634F',
    fontWeight: '500',
  },
  doneButton: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingVertical: 8,
  },
  doneText: {
    color: '#344E39',
    fontSize: 16,
    fontWeight: '800',
  },
  saveSetButton: {
    marginTop: 12,
    backgroundColor: '#6B9071',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveSetButtonDisabled: {
    opacity: 0.55,
  },
  saveSetText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  progressRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  progressTrack: {
    flex: 1,
    height: 17,
    borderRadius: 12,
    backgroundColor: '#BFD1BD',
    flexDirection: 'row',
    overflow: 'hidden',
  },
  progressFill: {
    borderRadius: 12,
    backgroundColor: '#344E39',
  },
  progressText: {
    width: 56,
    marginLeft: 12,
    fontSize: 20,
    color: '#4D5A4D',
  },
  deck: {},
  flashcard: {
    position: 'absolute',
  },
  stackCard: {
    backgroundColor: '#F2F7E9',
    shadowColor: '#314331',
    shadowOpacity: 0.14,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 9 },
    elevation: 6,
  },
  cardPressArea: {
    flex: 1,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.82)',
  },
  cardFront: {},
  cardBack: {},
  previewCardFace: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  facePill: {
    position: 'absolute',
    overflow: 'hidden',
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: '#E4ECD8',
    fontWeight: '600',
    color: '#304A36',
  },
  previewFacePill: {
    position: 'absolute',
    overflow: 'hidden',
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 11,
    backgroundColor: '#E4ECD8',
    fontWeight: '600',
    color: '#304A36',
    opacity: 0.72,
  },
  cardText: {
    fontWeight: '800',
    color: '#173528',
    textAlign: 'center',
  },
  previewCardText: {
    width: '78%',
    fontWeight: '800',
    color: '#173528',
    textAlign: 'center',
    opacity: 0.34,
  },
  finishedCard: {
    backgroundColor: '#AEC3B0',
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedTitle: {
    fontSize: 30,
    fontWeight: '800',
    color: '#173528',
    marginBottom: 10,
  },
  finishedText: {
    fontSize: 16,
    color: '#344E39',
  },
  actionSection: {
    alignItems: 'center',
  },
  actionHint: {
    marginBottom: 12,
    color: '#52634F',
    fontSize: 14,
    fontWeight: '500',
    textAlign: 'center',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#F0F5E8',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D4DDCA',
    shadowColor: '#314331',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  actionButtonLookup: {
    backgroundColor: '#DDE9D9',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionLookupIcon: {
    marginBottom: 4,
    backgroundColor: '#557A4F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionLabel: {
    marginTop: 5,
    color: '#344E39',
    fontWeight: '500',
    textAlign: 'center',
  },
  lookupOverlay: {
    flex: 1,
    backgroundColor: 'rgba(20, 26, 20, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  lookupModal: {
    maxHeight: '72%',
    borderRadius: 22,
    backgroundColor: '#F6FAEE',
    paddingTop: 28,
    paddingHorizontal: 20,
    paddingBottom: 20,
    shadowColor: '#111911',
    shadowOpacity: 0.2,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: 14 },
    elevation: 14,
  },
  lookupCloseIcon: {
    position: 'absolute',
    right: 18,
    top: 16,
    width: 30,
    height: 30,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 2,
  },
  lookupIconBox: {
    width: 54,
    height: 54,
    borderRadius: 14,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#557A4F',
    marginBottom: 12,
  },
  lookupTitle: {
    color: '#173528',
    fontSize: 28,
    fontWeight: '800',
    textAlign: 'center',
  },
  lookupSubtitle: {
    marginTop: 6,
    color: '#63705F',
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
  },
  lookupScroll: {
    marginTop: 16,
  },
  lookupScrollContent: {
    paddingBottom: 8,
  },
  lookupBody: {
    color: '#213C2D',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
  },
  lookupKeywords: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 16,
    gap: 7,
  },
  lookupKeywordPill: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: '#E2EAD7',
  },
  lookupKeywordText: {
    color: '#263B2D',
    fontSize: 12,
    fontWeight: '500',
  },
  lookupDivider: {
    marginTop: 14,
    marginBottom: 14,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#D1DCC7',
  },
  lookupActions: {
    flexDirection: 'row',
    columnGap: 12,
  },
  lookupSecondaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#5D725D',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupPrimaryButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    backgroundColor: '#344E39',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lookupSecondaryText: {
    color: '#304A36',
    fontSize: 16,
    fontWeight: '600',
  },
  lookupPrimaryText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
});

export default FlashcardDetailScreen;
