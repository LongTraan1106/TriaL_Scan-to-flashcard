import React from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import StarIcon from '../assets/icons/star.svg';
import StarFillIcon from '../assets/icons/start_fill.svg';
import TrashIcon from '../assets/icons/trash_can.svg';
import { documentService } from '../services/documentService';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

const PAGE_PADDING = clamp(SCREEN_WIDTH * 0.06, 22, 30);
const IS_COMPACT_HEIGHT = SCREEN_HEIGHT < 720;
const HEADER_HEIGHT = clamp(SCREEN_HEIGHT * 0.085, 84, 112);
const SEARCH_WIDTH = Math.min(SCREEN_WIDTH - PAGE_PADDING * 2.1, 548);
const SEGMENT_WIDTH = Math.min(SCREEN_WIDTH - PAGE_PADDING * 3.2, 430);
const DOCUMENT_CARD_RADIUS = 12;
const SEARCH_HEIGHT = clamp(SCREEN_HEIGHT * 0.062, 48, 54);
const SEGMENT_HEIGHT = clamp(SCREEN_HEIGHT * 0.056, 42, 48);
const DOCUMENT_MIN_HEIGHT = clamp(SCREEN_HEIGHT * 0.09, 72, 84);
const ACTION_BUTTON_SIZE = clamp(SCREEN_WIDTH * 0.082, 30, 34);
const ACTION_ICON_SIZE = clamp(ACTION_BUTTON_SIZE * 0.58, 18, 20);

type TabType = 'all' | 'favourite';

interface Document {
  id: number;
  title: string;
  tags?: string[];
  isFavourite: boolean;
}

function DocumentsScreen() {
  const navigation = useNavigation<any>();
  const [activeTab, setActiveTab] = React.useState<TabType>('all');
  const [documents, setDocuments] = React.useState<Document[]>([]);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [searchText, setSearchText] = React.useState('');

  const loadDocuments = React.useCallback(async (forceRefresh: boolean = false) => {
    setIsLoading(true);
    setError(null);
    try {
      const docs = await documentService.getDocuments(forceRefresh);
      const transformedDocs: Document[] = docs.map(doc => ({
        id: doc.id,
        title: doc.title,
        tags: doc.tags || [],
        isFavourite: doc.is_favorite,
      }));

      transformedDocs.sort((a, b) => b.id - a.id);
      setDocuments(transformedDocs);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Cannot load documents';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  React.useEffect(() => {
    loadDocuments();
    return documentService.subscribeToDataChanges(domain => {
      if (domain === 'documents') {
        loadDocuments();
      }
    });
  }, [loadDocuments]);

  const filteredDocuments = React.useMemo(() => {
    const query = searchText.trim().toLowerCase();

    return documents.filter(doc => {
      const matchesTab = activeTab === 'all' || doc.isFavourite;
      if (!matchesTab) {
        return false;
      }

      if (!query) {
        return true;
      }

      return (
        doc.title.toLowerCase().includes(query) ||
        (doc.tags || []).some(tag => tag.toLowerCase().includes(query))
      );
    });
  }, [activeTab, documents, searchText]);

  const emptyMessage = React.useMemo(() => {
    if (searchText.trim()) {
      return 'No documents match your search.';
    }

    if (activeTab === 'favourite') {
      return 'No favourite documents yet.';
    }

    return 'No documents yet. Start by scanning or importing one.';
  }, [activeTab, searchText]);

  const handleDeleteDocument = async (id: number) => {
    Alert.alert('Delete document', 'Are you sure you want to delete this document?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        onPress: async () => {
          try {
            await documentService.deleteDocument(id);
            setDocuments(docs => docs.filter(doc => doc.id !== id));
            Alert.alert('Success', 'Document deleted.');
          } catch (deleteError) {
            const errorMsg =
              deleteError instanceof Error ? deleteError.message : 'Cannot delete document';
            Alert.alert('Error', errorMsg);
          }
        },
        style: 'destructive',
      },
    ]);
  };

  const handleToggleFavourite = async (id: number) => {
    try {
      const doc = documents.find(item => item.id === id);
      if (!doc) {
        return;
      }

      const nextStatus = !doc.isFavourite;
      await documentService.toggleFavorite(id, nextStatus);

      setDocuments(docs =>
        docs.map(item =>
          item.id === id ? { ...item, isFavourite: nextStatus } : item
        )
      );
    } catch (toggleError) {
      const errorMsg =
        toggleError instanceof Error ? toggleError.message : 'Cannot update favourite';
      Alert.alert('Error', errorMsg);
    }
  };

  const handleOpenDocument = (documentId: number) => {
    navigation.navigate('DocumentDetails', { documentId });
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerSection}>
        <Text style={styles.headerTitle}>DOCUMENTS</Text>
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
          label="All Docs"
          active={activeTab === 'all'}
          onPress={() => setActiveTab('all')}
        />
        <SegmentButton
          label="Favourite"
          active={activeTab === 'favourite'}
          onPress={() => setActiveTab('favourite')}
        />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollContentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {isLoading && (
          <View style={styles.centerContent}>
            <ActivityIndicator size="large" color="#6F9A78" />
            <Text style={styles.loadingText}>Loading documents...</Text>
          </View>
        )}

        {error && !isLoading && (
          <View style={styles.centerContent}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={() => loadDocuments(true)}>
              <Text style={styles.retryButtonText}>Retry</Text>
            </TouchableOpacity>
          </View>
        )}

        {!isLoading && !error && filteredDocuments.length === 0 && (
          <View style={styles.centerContent}>
            <Text style={styles.emptyText}>{emptyMessage}</Text>
          </View>
        )}

        {!isLoading && !error && filteredDocuments.length > 0 && (
          <View style={styles.documentsContainer}>
            {filteredDocuments.map(doc => (
              <DocumentItem
                key={doc.id}
                document={doc}
                onPress={() => handleOpenDocument(doc.id)}
                onDelete={() => handleDeleteDocument(doc.id)}
                onToggleFavourite={() => handleToggleFavourite(doc.id)}
              />
            ))}
          </View>
        )}

        <View style={styles.bottomSpace} />
      </ScrollView>
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
      onPress={onPress}
      activeOpacity={0.82}
    >
      <Text style={[styles.segmentText, active && styles.segmentTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
}

interface DocumentItemProps {
  document: Document;
  onPress: () => void;
  onDelete: () => void;
  onToggleFavourite: () => void;
}

function DocumentItem({
  document,
  onPress,
  onDelete,
  onToggleFavourite,
}: DocumentItemProps) {
  return (
    <TouchableOpacity
      style={styles.documentItem}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.documentContent}>
        <Text style={styles.documentTitle} numberOfLines={2}>
          {document.title}
        </Text>
        {(document.tags || []).length > 0 && (
          <View style={styles.tagsContainer}>
            {(document.tags || []).map((tag, index) => (
              <View key={`${tag}-${index}`} style={styles.tag}>
                <Text style={styles.tagText}>{tag}</Text>
              </View>
            ))}
          </View>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={event => {
            event.stopPropagation();
            onToggleFavourite();
          }}
          activeOpacity={0.75}
        >
          {document.isFavourite ? (
            <StarFillIcon width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} />
          ) : (
            <StarIcon width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} />
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={event => {
            event.stopPropagation();
            onDelete();
          }}
          activeOpacity={0.75}
        >
          <TrashIcon width={ACTION_ICON_SIZE} height={ACTION_ICON_SIZE} />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3EED4',
    justifyContent: 'flex-start',
  },
  headerSection: {
    height: HEADER_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: IS_COMPACT_HEIGHT ? 30 : 55,
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
  scrollContent: {
    flex: 1,
    marginTop: IS_COMPACT_HEIGHT ? 16 : 20,
  },
  scrollContentContainer: {
    minHeight: SCREEN_HEIGHT * 0.54,
  },
  documentsContainer: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 8,
  },
  documentItem: {
    minHeight: DOCUMENT_MIN_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: DOCUMENT_CARD_RADIUS,
    backgroundColor: '#AEC3B0',
    shadowOpacity: 0,
    elevation: 0,
  },
  documentContent: {
    flex: 1,
    minWidth: 0,
    paddingRight: 10,
  },
  documentTitle: {
    fontSize: clamp(SCREEN_WIDTH * 0.039, 14, 16),
    lineHeight: clamp(SCREEN_WIDTH * 0.052, 19, 22),
    fontWeight: '800',
    color: '#1B3A2D',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    minHeight: 21,
    justifyContent: 'center',
    borderRadius: 12,
    backgroundColor: '#6B826B',
    paddingHorizontal: 9,
  },
  tagText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  actionsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
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
  centerContent: {
    minHeight: SCREEN_HEIGHT * 0.34,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#5D6F5F',
  },
  errorText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '700',
    color: '#A23A34',
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#6B776D',
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
  retryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  bottomSpace: {
    height: 24,
  },
});

export default DocumentsScreen;
