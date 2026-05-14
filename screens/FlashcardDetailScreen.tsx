import React from 'react';
import {
  Animated,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type CardStatus = 'known' | 'unknown' | null;

interface FlashcardItem {
  id: string;
  question: string;
  answer: string;
  isFavourite: boolean;
  status: CardStatus;
}

interface ActionButtonProps {
  label: string;
  height: number;
  wideWidth: number;
  middleWidth: number;
  labelSize: number;
  isFavourite?: boolean;
  disabled?: boolean;
  onPress: () => void;
}

const SAMPLE_CARDS: FlashcardItem[] = [
  {
    id: 'card-1',
    question: 'What is React Native used for?',
    answer: 'Building native mobile apps with React components.',
    isFavourite: false,
    status: null,
  },
  {
    id: 'card-2',
    question: 'What does JSX stand for?',
    answer: 'JavaScript XML, a syntax extension for writing UI markup.',
    isFavourite: true,
    status: null,
  },
  {
    id: 'card-3',
    question: 'What is a component?',
    answer: 'A reusable piece of UI with its own logic and rendering.',
    isFavourite: false,
    status: null,
  },
  {
    id: 'card-4',
    question: 'What does state represent?',
    answer: 'Data that can change over time and trigger UI updates.',
    isFavourite: false,
    status: null,
  },
  {
    id: 'card-5',
    question: 'Why use navigation?',
    answer: 'To move between screens and organize app flows.',
    isFavourite: false,
    status: null,
  },
];

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

function FlashcardDetailScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const initialIndex = Math.min(
    Number(route.params?.initialIndex) || 0,
    SAMPLE_CARDS.length,
  );
  const [cards, setCards] = React.useState<FlashcardItem[]>(SAMPLE_CARDS);
  const [currentIndex, setCurrentIndex] = React.useState(initialIndex);
  const [isBackSide, setIsBackSide] = React.useState(false);
  const flipAnim = React.useRef(new Animated.Value(0)).current;
  const pan = React.useRef(new Animated.ValueXY()).current;

  const currentCard = cards[currentIndex];
  const visibleCards = cards.slice(currentIndex, currentIndex + 3);
  const progress = currentIndex / cards.length;
  const progressPercent = Math.round(progress * 100);

  const horizontalPadding = clamp(width * 0.05, 16, 28);
  const contentWidth = width - horizontalPadding * 2;
  const headerTop = Math.max(insets.top + 10, clamp(height * 0.035, 24, 48));
  const backButtonSize = clamp(width * 0.105, 38, 54);
  const progressTop = clamp(height * 0.024, 14, 28);
  const progressHeight = clamp(height * 0.012, 8, 12);
  const deckTop = clamp(height * 0.02, 10, 22);
  const actionTop = clamp(height * 0.022, 12, 24);
  const actionHeight = clamp(height * 0.065, 46, 68);
  const stackOffsetX = clamp(contentWidth * 0.028, 8, 16);
  const stackOffsetY = clamp(height * 0.012, 8, 14);
  const cardRightOffset = clamp(contentWidth * 0.055, 16, 32);
  const availableCardHeight =
    height -
    headerTop -
    backButtonSize -
    progressTop -
    progressHeight -
    deckTop -
    stackOffsetY * 2 -
    actionTop -
    actionHeight -
    insets.bottom -
    28;
  const cardHeight = clamp(
    availableCardHeight,
    Math.min(220, height * 0.34),
    Math.min(480, height * 0.5),
  );
  const deckHeight = cardHeight + stackOffsetY * 2;
  const actionGap = clamp(contentWidth * 0.045, 10, 22);
  const favouriteButtonWidth = clamp(contentWidth * 0.16, 48, 68);
  const wideButtonWidth = Math.max(
    68,
    (contentWidth - favouriteButtonWidth - actionGap * 2) / 2,
  );
  const titleFontSize = clamp(width * 0.064, 22, 30);
  const cardFontSize = clamp(width * 0.048, 16, 22);
  const cardLineHeight = Math.round(cardFontSize * 1.35);
  const cardRadius = clamp(width * 0.035, 14, 22);
  const cardPaddingHorizontal = clamp(width * 0.052, 16, 26);
  const cardPaddingVertical = clamp(height * 0.028, 18, 30);
  const actionLabelSize = clamp(actionHeight * 0.54, 26, 40);
  const progressTextFontSize = clamp(width * 0.038, 13, 16);

  React.useEffect(() => {
    flipAnim.setValue(0);
    setIsBackSide(false);
    pan.setValue({ x: 0, y: 0 });
  }, [currentIndex, flipAnim, pan]);

  const completeCurrentCard = React.useCallback(
    (status: Exclude<CardStatus, null>, direction: 'left' | 'right') => {
      if (!currentCard) {
        return;
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
        setCurrentIndex(index => Math.min(index + 1, cards.length));
        pan.setValue({ x: 0, y: 0 });
      });
    },
    [cards.length, currentCard, pan, width],
  );

  const panResponder = React.useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) =>
          Math.abs(gesture.dx) > 8 || Math.abs(gesture.dy) > 8,
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
    [completeCurrentCard, pan, width],
  );

  const handleFlipCard = () => {
    Animated.timing(flipAnim, {
      toValue: isBackSide ? 0 : 1,
      duration: 360,
      useNativeDriver: true,
    }).start();
    setIsBackSide(value => !value);
  };

  const handleToggleFavourite = () => {
    if (!currentCard) {
      return;
    }

    setCards(prevCards =>
      prevCards.map(card =>
        card.id === currentCard.id
          ? { ...card, isFavourite: !card.isFavourite }
          : card,
      ),
    );
  };

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['180deg', '360deg'],
  });
  const swipeRotate = pan.x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-12deg', '0deg', '12deg'],
  });

  return (
    <View style={[styles.container, { paddingHorizontal: horizontalPadding }]}>
      <View style={[styles.header, { marginTop: headerTop }]}>
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
          onPress={() => navigation.goBack()}
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
        <Text style={[styles.title, { fontSize: titleFontSize }]}>
          {route.params?.title || 'Something'}
        </Text>
        <View style={{ width: backButtonSize }} />
      </View>

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
        {visibleCards.length === 0 ? (
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
              const stackStyle =
                stackIndex === 0
                  ? styles.stackCard0
                  : stackIndex === 1
                  ? styles.stackCard1
                  : styles.stackCard2;
              const dynamicStackStyle =
                stackIndex === 0
                  ? { right: cardRightOffset }
                  : stackIndex === 1
                  ? {
                      top: stackOffsetY,
                      left: stackOffsetX,
                      right: cardRightOffset / 2,
                    }
                  : {
                      top: stackOffsetY * 2,
                      left: stackOffsetX * 2,
                      right: 0,
                    };
              const cardStyle = [
                styles.flashcard,
                stackStyle,
                {
                  height: cardHeight,
                  borderRadius: cardRadius,
                },
                dynamicStackStyle,
              ];

              if (!isTopCard) {
                return (
                  <View key={card.id} pointerEvents="none" style={cardStyle} />
                );
              }

              return (
                <Animated.View
                  key={card.id}
                  style={[
                    cardStyle,
                    {
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
                          transform: [{ rotateY: frontRotate }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.faceLabel,
                          { top: cardPaddingVertical, fontSize: clamp(width * 0.028, 10, 13) },
                        ]}
                      >
                        QUESTION
                      </Text>
                      <Text
                        style={[
                          styles.cardText,
                          {
                            fontSize: cardFontSize,
                            lineHeight: cardLineHeight,
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
                          transform: [{ rotateY: backRotate }],
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.faceLabel,
                          { top: cardPaddingVertical, fontSize: clamp(width * 0.028, 10, 13) },
                        ]}
                      >
                        ANSWER
                      </Text>
                      <Text
                        style={[
                          styles.cardText,
                          {
                            fontSize: cardFontSize,
                            lineHeight: cardLineHeight,
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
          styles.actions,
          {
            marginTop: actionTop,
            columnGap: actionGap,
            paddingBottom: Math.max(insets.bottom, 12),
          },
        ]}
      >
        <ActionButton
          label="x"
          height={actionHeight}
          wideWidth={wideButtonWidth}
          middleWidth={favouriteButtonWidth}
          labelSize={actionLabelSize}
          onPress={() => completeCurrentCard('unknown', 'left')}
          disabled={!currentCard}
        />
        <ActionButton
          label={currentCard?.isFavourite ? '*' : '☆'}
          height={actionHeight}
          wideWidth={wideButtonWidth}
          middleWidth={favouriteButtonWidth}
          labelSize={actionLabelSize}
          isFavourite={currentCard?.isFavourite}
          onPress={handleToggleFavourite}
          disabled={!currentCard}
        />
        <ActionButton
          label="✓"
          height={actionHeight}
          wideWidth={wideButtonWidth}
          middleWidth={favouriteButtonWidth}
          labelSize={actionLabelSize}
          onPress={() => completeCurrentCard('known', 'right')}
          disabled={!currentCard}
        />
      </View>
    </View>
  );
}

function ActionButton({
  label,
  height,
  wideWidth,
  middleWidth,
  labelSize,
  isFavourite,
  disabled,
  onPress,
}: ActionButtonProps) {
  const isFavouriteButton = label === '☆' || label === '*';

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        {
          height,
          width: isFavouriteButton ? middleWidth : wideWidth,
          borderRadius: height * 0.16,
        },
        isFavourite && styles.actionButtonFavourite,
        disabled && styles.actionButtonDisabled,
      ]}
      activeOpacity={0.85}
      disabled={disabled}
      onPress={onPress}
    >
      <Text
        style={[
          styles.actionLabel,
          { fontSize: labelSize, lineHeight: labelSize + 6 },
        ]}
      >
        {label}
      </Text>
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
    flex: 1,
    textAlign: 'center',
    fontWeight: '800',
    color: '#000000',
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
    marginLeft: 15,
    fontSize: 20,
    color: '#4D5A4D',
  },
  deck: {},
  flashcard: {
    position: 'absolute',
    left: 0,
  },
  stackCard0: {
    backgroundColor: '#83A385',
    zIndex: 3,
  },
  stackCard1: {
    backgroundColor: '#8C9F82',
    zIndex: 2,
  },
  stackCard2: {
    backgroundColor: '#344E39',
    zIndex: 1,
  },
  cardPressArea: {
    flex: 1,
  },
  cardFace: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backfaceVisibility: 'hidden',
  },
  cardFront: {
    backgroundColor: '#83A385',
  },
  cardBack: {
    backgroundColor: '#AEC3B0',
  },
  faceLabel: {
    position: 'absolute',
    top: 32,
    fontSize: 14,
    fontWeight: '800',
    color: '#2D5341',
  },
  cardText: {
    fontWeight: '700',
    color: '#173528',
    textAlign: 'center',
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
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  actionButton: {
    backgroundColor: '#C1D2C3',
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonFavourite: {
    backgroundColor: '#D5E3C6',
  },
  actionButtonDisabled: {
    opacity: 0.45,
  },
  actionLabel: {
    color: '#344E39',
    fontWeight: '300',
  },
});

export default FlashcardDetailScreen;
