import React, { useState } from 'react';
import {
  Alert,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, {
  Circle,
  Line,
  Path,
  Rect,
  Polyline,
} from 'react-native-svg';
import BackIcon from '../assets/icons/group_screen/back_icon.svg';

type TabKey = 'documents' | 'flashcards' | 'manage';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_PADDING = Math.max(18, Math.min(26, SCREEN_WIDTH * 0.05));
const CARD_RADIUS = 12;

const TABS: TabKey[] = ['documents', 'flashcards', 'manage'];

function DocumentIcon({ color = '#2C4936', size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Rect x="9" y="7" width="22" height="26" rx="5" stroke={color} strokeWidth="2.2" />
      <Line x1="15" y1="16" x2="25" y2="16" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="15" y1="22" x2="24" y2="22" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function FlashcardIcon({ color = '#606664', size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 42 42" fill="none">
      <Path d="M12 10L27 7C30 6.5 32 8.2 32.5 11L35 26" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M9 14L26 11C29 10.5 31 12.2 31.5 15L34 30" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Path d="M12 16H29C31.2 16 33 17.8 33 20V31L25 38H12C9.8 38 8 36.2 8 34V20C8 17.8 9.8 16 12 16Z" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
      <Path d="M25 38V32C25 30.9 25.9 30 27 30H33" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
    </Svg>
  );
}

function MoreIcon({ color = '#2C4936', size = 34 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Circle cx="12" cy="20" r="2.6" stroke={color} strokeWidth="2.2" />
      <Circle cx="20" cy="20" r="2.6" stroke={color} strokeWidth="2.2" />
      <Circle cx="28" cy="20" r="2.6" stroke={color} strokeWidth="2.2" />
    </Svg>
  );
}

function ChevronIcon({ color = '#0E3D2C', size = 28 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 28 28" fill="none">
      <Polyline
        points="10,5 19,14 10,23"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function MembersIcon({ color = '#111111', size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Circle cx="24" cy="17" r="9" stroke={color} strokeWidth="2.4" />
      <Path d="M9 43C9 34.7 15.7 30 24 30C32.3 30 39 34.7 39 43V45H9V43Z" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
      <Path d="M38 14C43 14.2 46 17.3 46 22C46 26.7 43 29.8 38 30" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M41 34C46.7 35.4 50 39.2 50 45" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <Path d="M43 36H49V42" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

function InviteIcon({ color = '#111111', size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Circle cx="23" cy="17" r="9" stroke={color} strokeWidth="2.4" />
      <Path d="M8 43C8 34.7 14.7 30 23 30C31.3 30 38 34.7 38 43V45H8V43Z" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
      <Line x1="42" y1="20" x2="42" y2="32" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      <Line x1="36" y1="26" x2="48" y2="26" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </Svg>
  );
}

function LeaveIcon({ color = '#E00000', size = 48 }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 56 56" fill="none">
      <Path d="M27 12H13C10.8 12 9 13.8 9 16V40C9 42.2 10.8 44 13 44H27" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
      <Path d="M32 20L41 28L32 36" stroke={color} strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="20" y1="28" x2="41" y2="28" stroke={color} strokeWidth="2.8" strokeLinecap="round" />
    </Svg>
  );
}

function GroupDetailScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const group = route.params?.group;
  const [activeTab, setActiveTab] = useState<TabKey>('documents');

  const groupName = group?.name || 'Class 1';
  const memberCount = group?.member_count || 24;

  const renderTabIcon = (tab: TabKey, selected: boolean) => {
    const color = tab === 'flashcards' && !selected ? '#606664' : '#2C4936';
    if (tab === 'documents') {
      return <DocumentIcon color={color} size={26} />;
    }
    if (tab === 'flashcards') {
      return <FlashcardIcon color={color} size={28} />;
    }
    return <MoreIcon color={color} size={28} />;
  };

  const renderContent = () => {
    if (activeTab === 'manage') {
      return (
        <View style={styles.manageSection}>
          <Text style={styles.manageTitle}>Manage Group</Text>
          <View style={styles.manageCard}>
            <ManageRow icon={<MembersIcon size={38} />} label="Member" />
            <View style={styles.divider} />
            <ManageRow icon={<InviteIcon size={38} />} label="Invite members" />
            <View style={styles.manageSpacer} />
            <View style={styles.divider} />
            <ManageRow
              icon={<LeaveIcon size={38} />}
              label="Leave group"
              danger
              onPress={() => Alert.alert('Leave group', 'This is UI preview only.')}
            />
          </View>
        </View>
      );
    }

    const isFlashcards = activeTab === 'flashcards';
    return (
      <View style={styles.listSection}>
        <Text style={styles.sectionTitle}>
          {isFlashcards ? 'Flashcard Sets' : 'Shared Documents'}
        </Text>
        <TouchableOpacity style={styles.sharedCard} activeOpacity={0.8}>
          <View style={styles.sharedIconBox}>
            {isFlashcards ? (
              <FlashcardIcon color="#606664" size={34} />
            ) : (
              <DocumentIcon color="#2C4936" size={32} />
            )}
          </View>
          <View style={styles.sharedContent}>
            <View style={styles.titleLine}>
              <Text style={styles.sharedTitle} numberOfLines={2}>
                Transformer Attention mechanism Explained
              </Text>
              {isFlashcards && <Text style={styles.cardCount}>20 Cards</Text>}
            </View>
            <Text style={styles.sharedMeta} numberOfLines={1}>
              Shared by Duong - 12 hour ago
            </Text>
          </View>
          <ChevronIcon size={23} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 24 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerCard}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <BackIcon width={10} height={18} />
          </TouchableOpacity>
          <Text style={styles.groupName} numberOfLines={1}>
            {groupName}
          </Text>
          <Text style={styles.memberText}>{memberCount} Members</Text>
        </View>

        <View style={styles.tabShell}>
          {TABS.map((tab) => {
            const selected = activeTab === tab;
            return (
              <TouchableOpacity
                key={tab}
                style={[styles.tabButton, selected && styles.tabButtonActive]}
                onPress={() => setActiveTab(tab)}
                activeOpacity={0.8}
              >
                {renderTabIcon(tab, selected)}
              </TouchableOpacity>
            );
          })}
        </View>

        {renderContent()}
      </ScrollView>
    </View>
  );
}

function ManageRow({
  icon,
  label,
  danger,
  onPress,
}: {
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.manageRow}
      onPress={onPress}
      activeOpacity={0.78}
    >
      <View style={styles.manageIcon}>{icon}</View>
      <Text style={[styles.manageLabel, danger && styles.dangerText]}>{label}</Text>
      <ChevronIcon color="#769080" size={22} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F7ED',
  },
  content: {
    flexGrow: 1,
    paddingHorizontal: PAGE_PADDING,
  },
  headerCard: {
    minHeight: 92,
    borderRadius: CARD_RADIUS,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#536C5B',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 4,
  },
  backButton: {
    position: 'absolute',
    left: 20,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  groupName: {
    maxWidth: '70%',
    fontSize: 21,
    lineHeight: 26,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  memberText: {
    marginTop: 2,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: '#FFFFFF',
  },
  tabShell: {
    height: 68,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingHorizontal: Math.max(8, Math.min(14, SCREEN_WIDTH * 0.022)),
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 7,
    elevation: 4,
  },
  tabButton: {
    width: '28%',
    height: 44,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#121212',
    backgroundColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  tabButtonActive: {
    backgroundColor: '#E5F1E2',
  },
  listSection: {
    marginTop: 32,
  },
  sectionTitle: {
    marginBottom: 28,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#2C4936',
  },
  sharedCard: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#C5DBC2',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  sharedIconBox: {
    width: 64,
    height: 64,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E2EDE0',
    marginRight: 14,
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 5,
    elevation: 3,
  },
  sharedContent: {
    flex: 1,
    minWidth: 0,
  },
  titleLine: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
  },
  sharedTitle: {
    flexShrink: 1,
    maxWidth: '100%',
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '800',
    color: '#2C4936',
  },
  cardCount: {
    marginLeft: 12,
    marginBottom: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#2C4936',
  },
  sharedMeta: {
    marginTop: 7,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#2C4936',
  },
  manageSection: {
    marginTop: 32,
  },
  manageTitle: {
    marginBottom: 22,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: '#2C4936',
    textAlign: 'center',
  },
  manageCard: {
    minHeight: 420,
    paddingHorizontal: Math.max(24, Math.min(38, SCREEN_WIDTH * 0.09)),
    paddingTop: 22,
    paddingBottom: 26,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 3,
  },
  manageRow: {
    height: 62,
    flexDirection: 'row',
    alignItems: 'center',
  },
  manageIcon: {
    width: 52,
    alignItems: 'flex-start',
  },
  manageLabel: {
    flex: 1,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '500',
    color: '#2C4936',
  },
  dangerText: {
    color: '#E00000',
  },
  divider: {
    height: 1,
    backgroundColor: '#A9ADA9',
  },
  manageSpacer: {
    flex: 1,
    minHeight: 196,
  },
});

export default GroupDetailScreen;
