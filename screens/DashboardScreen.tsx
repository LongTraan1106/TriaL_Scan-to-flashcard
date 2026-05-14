import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  FlatList,
  Image,
  ImageSourcePropType,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';

function DashboardScreen() {
  const navigation = useNavigation<any>();
  
  // Dữ liệu history
  const historyData = [
    { id: '1', title: 'Machine learning', timestamp: 'Today' },
    { id: '2', title: 'React Native Basics', timestamp: 'Yesterday' },
    { id: '3', title: 'JavaScript Advanced', timestamp: '2 days ago' },
  ];

  const handleNavigateToDocuments = () => {
    navigation.navigate('Documents');
  };

  const handleNavigateToFlashcard = () => {
    navigation.navigate('Flashcard');
  };

  return (
    <View style={styles.container}>
      {/* Header Section */}
      <HeaderSection />

      {/* Main Content */}
      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Divider */}
        {/* <View style={styles.divider} /> */}

        {/* Feature Cards Section */}
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

        {/* Divider */}
        <View style={styles.divider} />

        {/* History Section */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>HISTORY</Text>
          <FlatList
            data={historyData}
            renderItem={({ item }) => (
              <HistoryItem title={item.title} timestamp={item.timestamp} />
            )}
            keyExtractor={item => item.id}
            scrollEnabled={false}
          />
        </View>

        {/* Extra space for bottom nav */}
        <View style={styles.bottomSpace} />
      </ScrollView>
    </View>
  );
}

// ===== HEADER SECTION =====
function HeaderSection() {
  return (
    <View style={styles.headerSection}>
      <View style={styles.headerContent}>
        {/* Avatar Circle */}
        <View style={styles.avatarCircle}>
          <Image
            source={require('../assets/fig.png')}
            style={{ width: 75, height: 75 }}
            />
        </View>

        {/* Text Content */}
        <View style={styles.textContent}>
          <Text style={styles.greetingText}>HELLO ! USER</Text>
          <Text style={styles.subText}>What you want to scan today</Text>
        </View>
      </View>
    </View>
  );
}

// ===== FEATURE CARD =====
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

// ===== HISTORY ITEM =====
interface HistoryItemProps {
  title: string;
  timestamp: string;
}

function HistoryItem({ title, timestamp }: HistoryItemProps) {
  return (
    <TouchableOpacity style={styles.historyItem}>
      <View style={styles.historyItemContent}>
        <Text style={styles.historyItemTitle}>{title}</Text>
        <Text style={styles.historyItemTime}>{timestamp}</Text>
      </View>
      <Text style={styles.historyItemArrow}>›</Text>
    </TouchableOpacity>
  );
}



// ===== STYLES =====
const styles = StyleSheet.create({
  container: {
    flex: 1,
    marginTop: 0,
    backgroundColor: '#E3EED4',
  },

  // Header Styles
  headerSection: {
    backgroundColor: '#83A385',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    marginBottom: 20,
    marginTop:60,
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

  // Scroll Content
  scrollContent: {
    flex: 1,
  },

  // Divider
  divider: {
    height: 8,
    marginLeft: 15,
    marginRight: 15,
    borderRadius: 20,
    backgroundColor: '#6B826B',
    marginVertical: 12,
  },

  // Feature Cards
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
  cardIcon: {
    fontSize: 50,
    marginBottom: 10,
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

  // History Section
  historySection: {
    paddingHorizontal: 20,
  },
  historyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#344E39',
    marginBottom: 15,
    textAlign: 'center',
  },
  historyItem: {
    flexDirection: 'row',
    backgroundColor: '#AEC3B0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 10,
    justifyContent: 'space-between',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.1,
    elevation: 3,
    shadowRadius: 4,
    shadowOffset: { width: 10, height: 2 },
  },
  historyItemContent: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1B3A2D',
    marginBottom: 4,
  },
  historyItemTime: {
    fontSize: 12,
    color: '#2D5341',
  },
  historyItemArrow: {
    fontSize: 20,
    color: '#2D5341',
    fontWeight: 'bold',
  },

  // Bottom Space
  bottomSpace: {
    height: 20,
  },
});

export default DashboardScreen;
