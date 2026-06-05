import React from 'react';
import {
  ActivityIndicator,
  FlatList,
  Image,
  ImageSourcePropType,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import {
  documentService,
  DocumentListItem,
  FlashcardListItem,
} from '../services/documentService';

type HistoryDocument = DocumentListItem & {
  hasSummary: boolean;
  hasFlashcard: boolean;
};

function DashboardScreen() {
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const [historyData, setHistoryData] = React.useState<HistoryDocument[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = React.useState(false);
  const [historyError, setHistoryError] = React.useState<string | null>(null);

  const loadDashboardData = React.useCallback(async (forceRefresh: boolean = false) => {
    setIsLoadingHistory(true);
    setHistoryError(null);
    try {
      const [documents, flashcardSets] = await Promise.all([
        documentService.getDocuments(forceRefresh),
        documentService.getFlashcardSets(undefined, forceRefresh),
      ]);

      const flashcardDocumentIds = new Set(
        flashcardSets
          .map((set: FlashcardListItem) => set.document_id)
          .filter((id): id is number => typeof id === 'number')
      );

      const recentDocuments = documents.slice(0, 3).map(document => ({
        ...document,
        hasSummary: document.tags?.includes('Summary') ?? true,
        hasFlashcard: flashcardDocumentIds.has(document.id),
      }));

      setHistoryData(recentDocuments);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Cannot load recent history';
      setHistoryError(message);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  React.useEffect(() => {
    loadDashboardData();
    return documentService.subscribeToDataChanges(domain => {
      if (domain === 'documents' || domain === 'flashcards') {
        loadDashboardData();
      }
    });
  }, [loadDashboardData]);

  const handleNavigateToDocuments = () => {
    navigation.navigate('Documents');
  };

  const handleNavigateToFlashcard = () => {
    navigation.navigate('Flashcard');
  };

  const handleOpenHistoryDocument = (documentId: number) => {
    navigation.navigate('DocumentDetails', { documentId });
  };

  return (
    <View style={styles.container}>
      <HeaderSection
        username={user?.username || 'User'}
        avatarUrl={user?.avatar_url || null}
        documentCount={user?.documents_count || 0}
        flashcardCount={user?.flashcards_count || 0}
      />

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cardsContainer}>
          <FeatureCard
            title="DOCUMENTS"
            image={require('../assets/document.png')}
            backgroundColor="#AEC3B0"
            onPress={handleNavigateToDocuments}
          />
          <FeatureCard
            title="FLASHCARD"
            image={require('../assets/flashcard.png')}
            backgroundColor="#AEC3B0"
            onPress={handleNavigateToFlashcard}
          />
        </View>

        <View style={styles.divider} />

        <View style={styles.historySection}>
          <View style={styles.historyHeaderRow}>
            <Text style={styles.historyTitle}>HISTORY</Text>
            <TouchableOpacity onPress={handleNavigateToDocuments}>
              <Text style={styles.viewAllText}>View all</Text>
            </TouchableOpacity>
          </View>

          {isLoadingHistory ? (
            <View style={styles.historyState}>
              <ActivityIndicator size="small" color="#6B9071" />
              <Text style={styles.historyStateText}>Loading recent documents...</Text>
            </View>
          ) : historyError ? (
            <View style={styles.historyState}>
              <Text style={styles.historyStateText}>{historyError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={() => loadDashboardData(true)}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : historyData.length === 0 ? (
            <View style={styles.historyState}>
              <Text style={styles.historyStateText}>No saved documents yet.</Text>
            </View>
          ) : (
            <FlatList
              data={historyData}
              renderItem={({ item }) => (
                <HistoryItem
                  document={item}
                  onPress={() => handleOpenHistoryDocument(item.id)}
                />
              )}
              keyExtractor={item => String(item.id)}
              scrollEnabled={false}
            />
          )}
        </View>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

interface HeaderSectionProps {
  username: string;
  avatarUrl?: string | null;
  documentCount: number;
  flashcardCount: number;
}

function HeaderSection({
  username,
  avatarUrl,
  documentCount,
  flashcardCount,
}: HeaderSectionProps) {
  return (
    <View style={styles.headerSection}>
      <View style={styles.headerContent}>
        <View style={styles.avatarCircle}>
          <Image
            source={avatarUrl ? { uri: avatarUrl } : require('../assets/fig.png')}
            style={styles.avatarImage}
          />
        </View>

        <View style={styles.textContent}>
          <Text style={styles.greetingText} numberOfLines={2}>
            Welcome, {username.toUpperCase()}
          </Text>
          <Text style={styles.subText}>What do you want to scan today?</Text>
          <View style={styles.userStatsRow}>
            {/* <Text style={styles.userStat}>{documentCount} documents</Text>
            <Text style={styles.userStat}>{flashcardCount} sets</Text> */}
          </View>
        </View>
      </View>
    </View>
  );
}

interface FeatureCardProps {
  title: string;
  image: ImageSourcePropType;
  backgroundColor: string;
  onPress?: () => void;
}

function FeatureCard({
  title,
  image,
  backgroundColor,
  onPress,
}: FeatureCardProps) {
  return (
    <TouchableOpacity
      style={[styles.featureCard, { backgroundColor }]}
      activeOpacity={0.8}
      onPress={onPress}
    >
      <Image source={image} style={styles.cardImage} />
      <Text style={styles.cardTitle}>{title}</Text>
    </TouchableOpacity>
  );
}

interface HistoryItemProps {
  document: HistoryDocument;
  onPress: () => void;
}

function HistoryItem({ document, onPress }: HistoryItemProps) {
  const labels = [
    document.hasSummary ? 'Summary' : null,
    document.hasFlashcard ? 'Flashcard' : null,
  ].filter(Boolean);

  return (
    <TouchableOpacity
      style={styles.historyItem}
      activeOpacity={0.85}
      onPress={onPress}
    >
      <View style={styles.historyItemContent}>
        <Text style={styles.historyItemTitle} numberOfLines={1}>
          {document.title}
        </Text>
        <View style={styles.labelRow}>
          {labels.map(label => (
            <View key={label} style={styles.historyLabel}>
              <Text style={styles.historyLabelText}>{label}</Text>
            </View>
          ))}
        </View>
      </View>
      <Text style={styles.historyItemArrow}>{'>'}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3EED4',
  },
  headerSection: {
    backgroundColor: '#A9BFA2',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 20,
    marginTop: 60,
    marginLeft: 15,
    marginRight: 15,
    borderRadius: 10,
    elevation: 10,
    shadowRadius: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#B2C598',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#2D5341',
    marginRight: 20,
    marginTop: 10,
    marginBottom: 10,
  },
  avatarImage: {
    width: 75,
    height: 75,
    borderRadius: 37.5,
  },
  textContent: {
    flex: 1,
  },
  greetingText: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#344E39',
    marginBottom: 5,
  },
  subText: {
    fontSize: 14,
    color: '#2D5341',
  },
  userStatsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 10,
  },
  userStat: {
    color: '#FFFFFF',
    backgroundColor: '#6B826B',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  scrollContent: {
    flex: 1,
  },
  divider: {
    height: 8,
    marginLeft: 15,
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: '#6B826B',
    marginVertical: 12,
  },
  cardsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 15,
  },
  featureCard: {
    marginVertical: 10,
    flex: 1,
    aspectRatio: 1,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  cardImage: {
    width: 80,
    height: 80,
    opacity: 0.65,
    marginBottom: 10,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D5341',
    textAlign: 'center',
  },
  historySection: {
    paddingHorizontal: 20,
  },
  historyHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#344E39',
    // textAlign: "center"
  },
  viewAllText: {
    color: '#344E39',
    fontSize: 13,
    fontWeight: '700',
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#AEC3B0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    elevation: 3,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  historyItemContent: {
    flex: 1,
    paddingRight: 12,
  },
  historyItemTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1B3A2D',
    marginBottom: 14,
  },
  labelRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  historyLabel: {
    backgroundColor: '#6B826B',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  historyLabelText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  historyItemArrow: {
    fontSize: 20,
    color: '#2D5341',
    fontWeight: 'bold',
  },
  historyState: {
    minHeight: 120,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  historyStateText: {
    color: '#344E39',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 8,
  },
  retryButton: {
    backgroundColor: '#6B9071',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    marginTop: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  bottomSpace: {
    height: 20,
  },
});

export default DashboardScreen;
