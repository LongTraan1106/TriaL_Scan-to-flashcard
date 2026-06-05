import React from 'react';
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import FlashcardIcon from '../assets/icons/flashcard.svg';
import StarIcon from '../assets/icons/star.svg';
import StarFillIcon from '../assets/icons/start_fill.svg';
import TrashIcon from '../assets/icons/trash_can.svg';
import { CustomAlertModal, AlertButton } from '../components/CustomAlertModal';
import { documentService, FlashcardListItem } from '../services/documentService';
import {
  flashcardProgressService,
  FlashcardSetProgress,
} from '../utils/flashcardProgressService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const PAGE_PADDING = clamp(SCREEN_WIDTH * 0.06, 22, 30);
const IS_COMPACT_HEIGHT = SCREEN_HEIGHT < 720;
const HEADER_HEIGHT = clamp(SCREEN_HEIGHT * 0.085, 84, 112);
const SEARCH_WIDTH = Math.min(SCREEN_WIDTH - PAGE_PADDING * 2.1, 548);
const SEGMENT_WIDTH = Math.min(SCREEN_WIDTH - PAGE_PADDING * 3.2, 430);
const SEARCH_HEIGHT = clamp(SCREEN_HEIGHT * 0.062, 48, 54);
const SEGMENT_HEIGHT = clamp(SCREEN_HEIGHT * 0.056, 42, 48);
const SET_CARD_MIN_HEIGHT = clamp(SCREEN_HEIGHT * 0.09, 72, 84);
const SET_CARD_RADIUS = 12;
const SET_ICON_BOX = clamp(SCREEN_WIDTH * 0.115, 40, 48);
const SET_ICON_SIZE = clamp(SET_ICON_BOX * 0.5, 20, 24);
const ACTION_BUTTON_SIZE = clamp(SCREEN_WIDTH * 0.082, 30, 34);
const ACTION_ICON_SIZE = clamp(ACTION_BUTTON_SIZE * 0.58, 18, 20);

type FlashcardSection = 'all' | 'favourite';

function FlashcardScreen() {
  const navigation = useNavigation<any>();
  const insets = useSafeAreaInsets();
  const windowDimensions = useWindowDimensions();
  const [activeSection, setActiveSection] =
    React.useState<FlashcardSection>('all');
  const [sets, setSets] = React.useState<FlashcardListItem[]>([]);
  const [progressBySet, setProgressBySet] = React.useState<Record<number, FlashcardSetProgress>>({});
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [updatingFavoriteId, setUpdatingFavoriteId] = React.useState<number | null>(null);
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

  const loadFlashcards = React.useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await documentService.getFlashcardSets(undefined, forceRefresh);
      setSets(data);
      const progressMap = await flashcardProgressService.getProgressMap(data);
      setProgressBySet(progressMap);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cannot load flashcards';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadFlashcards();
    const unsubscribeData = documentService.subscribeToDataChanges(domain => {
      if (domain === 'flashcards') {
        loadFlashcards();
      }
    });
    const unsubscribeProgress = flashcardProgressService.subscribe((setId, progress) => {
      setProgressBySet(current => ({
        ...current,
        [setId]: progress,
      }));
    });
    return () => {
      unsubscribeData();
      unsubscribeProgress();
    };
  }, [loadFlashcards]);

  const [searchText, setSearchText] = React.useState('');

  const visibleSets = React.useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return sets.filter(set => {
      const matchesSection = activeSection === 'all' || set.is_favorite;
      if (!matchesSection) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        set.title.toLowerCase().includes(query) ||
        (set.source_file_name || '').toLowerCase().includes(query) ||
        (set.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    });
  }, [activeSection, searchText, sets]);

  const emptyMessage = React.useMemo(() => {
    if (searchText.trim()) {
      return 'No flashcard sets match your search.';
    }

    if (activeSection === 'favourite') {
      return 'No favourite flashcard sets yet.';
    }

    return 'No flashcard sets yet.';
  }, [activeSection, searchText]);

  const handleOpenSet = (set: FlashcardListItem) => {
    navigation.navigate('FlashcardDetail', {
      flashcardId: set.id,
      title: set.title,
      initialIndex: 0,
    });
  };

  const showError = (message: string) => {
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
  };

  const handleToggleFavorite = async (set: FlashcardListItem) => {
    try {
      const nextStatus = !set.is_favorite;
      setUpdatingFavoriteId(set.id);
      await documentService.toggleFlashcardFavorite(set.id, nextStatus);
      setSets(current =>
        current.map(item =>
          item.id === set.id ? { ...item, is_favorite: nextStatus } : item
        )
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Cannot update favourite';
      showError(message);
    } finally {
      setUpdatingFavoriteId(null);
    }
  };

  const handleDeleteSet = (set: FlashcardListItem) => {
    setAlertConfig({
      title: 'Delete Flashcard Set',
      message: `Delete "${set.title}" and all of its flashcard data?`,
      icon: '!',
      buttons: [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => setAlertModalVisible(false),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setAlertModalVisible(false);
            try {
              setDeletingId(set.id);
              await documentService.deleteFlashcardSet(set.id);
              await flashcardProgressService.clearProgress(set.id);
              setSets(current => current.filter(item => item.id !== set.id));
              setProgressBySet(current => {
                const next = { ...current };
                delete next[set.id];
                return next;
              });
            } catch (err) {
              const message = err instanceof Error ? err.message : 'Cannot delete flashcard set';
              showError(message);
            } finally {
              setDeletingId(null);
            }
          },
        },
      ],
    });
    setAlertModalVisible(true);
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View
        style={[
          styles.headerSection,
          { marginHorizontal: clamp(windowDimensions.width * 0.06, 22, 30) },
        ]}
      >
        <Text style={styles.headerTitle}>FLASHCARD</Text>
      </View>

      <View style={styles.searchContainer}>
        <SearchIcon />
        <TextInput
          style={styles.searchInput}
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search"
          placeholderTextColor="#8D9A8E"
          autoCapitalize="none"
          underlineColorAndroid="transparent"
          selectionColor="#5F8A68"
        />
      </View>

      <View style={styles.segmentContainer}>
        <SegmentButton
          label="All Sets"
          active={activeSection === 'all'}
          onPress={() => setActiveSection('all')}
        />
        <SegmentButton
          label="Favourite"
          active={activeSection === 'favourite'}
          onPress={() => setActiveSection('favourite')}
        />
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={[
          styles.contentContainer,
          { paddingBottom: 100 + insets.bottom },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#6F9A78" />
            <Text style={styles.stateText}>Loading flashcards...</Text>
          </View>
        ) : error ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadFlashcards(true)}>
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : visibleSets.length === 0 ? (
          <View style={styles.centerState}>
            <Text style={styles.stateText}>{emptyMessage}</Text>
          </View>
        ) : (
          <View style={styles.setsContainer}>
            {visibleSets.map(set => (
              <FlashcardSetItem
                key={set.id}
                set={set}
                progress={progressBySet[set.id]}
                deleting={deletingId === set.id}
                updatingFavorite={updatingFavoriteId === set.id}
                onPress={() => handleOpenSet(set)}
                onToggleFavorite={() => handleToggleFavorite(set)}
                onDelete={() => handleDeleteSet(set)}
              />
            ))}
          </View>
        )}
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

function SearchIcon() {
  return (
    <View style={styles.searchIcon}>
      <View style={styles.searchIconCircle} />
      <View style={styles.searchIconHandle} />
    </View>
  );
}

function SegmentButton({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.segmentButton, active && styles.segmentButtonActive]}
      activeOpacity={0.82}
      onPress={onPress}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

function FlashcardSetItem({
  set,
  progress,
  deleting,
  updatingFavorite,
  onPress,
  onToggleFavorite,
  onDelete,
}: {
  set: FlashcardListItem;
  progress?: FlashcardSetProgress;
  deleting: boolean;
  updatingFavorite: boolean;
  onPress: () => void;
  onToggleFavorite: () => void;
  onDelete: () => void;
}) {
  const knownCount = progress?.knownCount || 0;
  const totalCards = set.total_cards || progress?.totalCards || 0;
  const progressPercent = totalCards > 0
    ? Math.round((knownCount / totalCards) * 100)
    : 0;
  const studiedCount = progress?.studiedCount || 0;

  return (
    <TouchableOpacity
      style={styles.setCard}
      activeOpacity={0.78}
      onPress={onPress}
    >
      <View style={styles.setIconWrap}>
        <FlashcardIcon width={SET_ICON_SIZE} height={SET_ICON_SIZE} />
      </View>

      <View style={styles.setInfo}>
        <Text style={styles.setTitle} numberOfLines={2}>
          {set.title}
        </Text>
        <View style={styles.setMetaRow}>
          <Text
            style={[styles.setMeta, styles.setMetaPrimary]}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            Known {knownCount}/{totalCards}
          </Text>
          <Text
            style={styles.setMeta}
            numberOfLines={1}
            ellipsizeMode="tail"
          >
            {studiedCount ? `${progressPercent}% mastered` : 'Not studied'}
          </Text>
        </View>
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, updatingFavorite && styles.actionDisabled]}
          onPress={(event: any) => {
            event.stopPropagation?.();
            onToggleFavorite();
          }}
          disabled={updatingFavorite}
          activeOpacity={0.75}
        >
          {set.is_favorite ? (
            <StarFillIcon width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} />
          ) : (
            <StarIcon width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, deleting && styles.actionDisabled]}
          onPress={(event: any) => {
            event.stopPropagation?.();
            onDelete();
          }}
          disabled={deleting}
          activeOpacity={0.75}
        >
          {deleting ? (
            <ActivityIndicator size="small" color="#2C4936" />
          ) : (
            <TrashIcon width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} />
          )}
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3EED4',
  },
  headerSection: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    // marginTop: IS_COMPACT_HEIGHT ? 22 : 28,
    marginHorizontal: PAGE_PADDING,
    borderRadius: 15,
    backgroundColor: '#88A88A',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.11,
    shadowRadius: 5,
    elevation: 3,
  },
  headerTitle: {
    fontSize: clamp(SCREEN_WIDTH * 0.058, 22, 28),
    lineHeight: clamp(SCREEN_WIDTH * 0.071, 28, 34),
    fontWeight: '800',
    color: '#FFFFFF',
  },
  searchContainer: {
    alignSelf: 'center',
    width: SEARCH_WIDTH,
    height: SEARCH_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: IS_COMPACT_HEIGHT ? 10 : 12,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: 15,
    borderWidth: 0,
    backgroundColor: 'rgba(255,255,255,0.78)',
    shadowOpacity: 0,
    elevation: 0,
  },
  searchIcon: {
    width: 24,
    height: 24,
    marginRight: 14,
  },
  searchIconCircle: {
    width: 17,
    height: 17,
    borderRadius: 8.5,
    borderWidth: 2.4,
    borderColor: '#2C4936',
  },
  searchIconHandle: {
    position: 'absolute',
    width: 11,
    height: 2.4,
    borderRadius: 2,
    backgroundColor: '#2C4936',
    right: 2,
    bottom: 4,
    transform: [{ rotate: '45deg' }],
  },
  searchInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: clamp(SCREEN_WIDTH * 0.041, 15, 17),
    lineHeight: clamp(SCREEN_WIDTH * 0.052, 20, 23),
    fontWeight: '500',
    color: '#2C4936',
  },
  segmentContainer: {
    alignSelf: 'center',
    width: SEGMENT_WIDTH,
    height: SEGMENT_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: IS_COMPACT_HEIGHT ? 14 : 18,
    padding: 3,
    borderRadius: 12,
    backgroundColor: '#AEC4B2',
    shadowOpacity: 0,
    elevation: 0,
  },
  segmentButton: {
    flex: 1,
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
  },
  segmentButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.82)',
  },
  segmentText: {
    fontSize: clamp(SCREEN_WIDTH * 0.038, 14, 16),
    lineHeight: clamp(SCREEN_WIDTH * 0.05, 19, 21),
    fontWeight: '500',
    color: '#173729',
  },
  segmentTextActive: {
    fontWeight: '700',
  },
  content: {
    flex: 1,
    marginTop: IS_COMPACT_HEIGHT ? 16 : 20,
  },
  contentContainer: {
    flexGrow: 1,
    paddingHorizontal: PAGE_PADDING,
  },
  setsContainer: {
    rowGap: 10,
  },
  setCard: {
    minHeight: SET_CARD_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: SET_CARD_RADIUS,
    backgroundColor: '#AEC3B0',
    shadowOpacity: 0,
    elevation: 0,
  },
  setIconWrap: {
    width: SET_ICON_BOX,
    height: SET_ICON_BOX,
    flexShrink: 0,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#C5D8C0',
    marginRight: 10,
  },
  setInfo: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  setTitle: {
    fontSize: clamp(SCREEN_WIDTH * 0.039, 14, 16),
    lineHeight: clamp(SCREEN_WIDTH * 0.052, 19, 22),
    fontWeight: '800',
    color: '#1B3A2D',
  },
  setMetaRow: {
    marginTop: 5,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: 8,
    rowGap: 2,
  },
  setMeta: {
    maxWidth: '100%',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
    color: '#344E39',
  },
  setMetaPrimary: {
    flexShrink: 1,
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: 6,
  },
  actionButton: {
    width: ACTION_BUTTON_SIZE,
    height: ACTION_BUTTON_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
  actionDisabled: {
    opacity: 0.55,
  },
  centerState: {
    minHeight: SCREEN_HEIGHT * 0.34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
  },
  stateText: {
    marginTop: 10,
    color: '#344E39',
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    textAlign: 'center',
  },
  retryButton: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#88A88A',
  },
  retryText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});

export default FlashcardScreen;
