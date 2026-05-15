import React, { useState } from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import { SignOutConfirmationModal } from '../components/SignOutConfirmationModal';
import BellIcon from '../assets/icons/profile_screen/bell.svg';
import DocsIcon from '../assets/icons/profile_screen/docs.svg';
import FlashcardIcon from '../assets/icons/profile_screen/flashcard.svg';
import GroupIcon from '../assets/icons/profile_screen/group_icon.svg';
import StreakIcon from '../assets/icons/profile_screen/streak_icon.svg';
import AvatarIcon from '../assets/icons/group_screen/avatar_2.svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const PAGE_PADDING = Math.max(16, Math.min(24, SCREEN_WIDTH * 0.04));
const CARD_RADIUS = 10;
const PROFILE_AVATAR_SIZE = Math.max(92, Math.min(126, SCREEN_WIDTH * 0.24));
const STREAK_ICON_SIZE = Math.max(46, Math.min(66, SCREEN_WIDTH * 0.105));
const GROUP_OVERVIEW_ICON_SIZE = Math.max(44, Math.min(60, SCREEN_WIDTH * 0.095));

function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [showSignOutModal, setShowSignOutModal] = useState(false);

  const username = user?.username || 'ABCD';
  const email = user?.email || 'abcd@gmail.com';
  const displayRole = user?.role
    ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
    : 'Teacher';

  const handleConfirmSignOut = async () => {
    try {
      setSigningOut(true);
      await logout();
    } catch (error) {
      console.error('Sign out error:', error);
      setSigningOut(false);
      setShowSignOutModal(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileCard}>
          <TouchableOpacity style={styles.bellButton} activeOpacity={0.75}>
            <BellIcon width={18} height={22} />
          </TouchableOpacity>

          <View style={styles.avatarFrame}>
            <AvatarIcon width={PROFILE_AVATAR_SIZE * 0.54} height={PROFILE_AVATAR_SIZE * 0.64} />
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.nameText} numberOfLines={1}>
              {username}
              <Text style={styles.nameSuffix}>(name)</Text>
            </Text>
            <Text style={styles.infoText} numberOfLines={1}>
              <Text style={styles.infoStrong}>Role: </Text>
              {displayRole}
            </Text>
            <Text style={styles.infoText} numberOfLines={1}>
              <Text style={styles.infoStrong}>Email: </Text>
              {email}
            </Text>
            <TouchableOpacity style={styles.editButton} activeOpacity={0.75}>
              <Text style={styles.editButtonText}>Edit profile</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.statsPanel}>
          <StatItem
            icon={<DocsIcon width={36} height={36} />}
            label="Docs"
            value={user?.documents_count ?? 23}
          />
          <View style={styles.statDivider} />
          <StatItem
            icon={<FlashcardIcon width={42} height={42} />}
            label="Flashcards"
            value={user?.flashcards_count ?? 14}
          />
          <View style={styles.statDivider} />
          <StatItem
            icon={<GroupIcon width={44} height={44} />}
            label="Groups"
            value={user?.groups_count ?? 4}
          />
        </View>

        <Text style={styles.overviewTitle}>Overview</Text>

        <View style={styles.overviewRow}>
          <View style={styles.streakCard}>
            <View>
              <Text style={styles.cardTitle}>Current Streak</Text>
              <Text style={styles.streakValue}>{user?.current_streak ?? 36}</Text>
              <Text style={styles.streakLabel}>Days in  a row</Text>
            </View>
            <StreakIcon width={STREAK_ICON_SIZE} height={STREAK_ICON_SIZE} />
          </View>

          <TouchableOpacity
            style={styles.myGroupCard}
            onPress={() => navigation.navigate('Groups')}
            activeOpacity={0.78}
          >
            <Text style={styles.myGroupTitle}>My Group</Text>
            <GroupIcon width={GROUP_OVERVIEW_ICON_SIZE} height={GROUP_OVERVIEW_ICON_SIZE} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.signOutButton, signingOut && styles.buttonDisabled]}
          onPress={() => setShowSignOutModal(true)}
          disabled={signingOut}
          activeOpacity={0.8}
        >
          {signingOut ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.signOutText}>Sign Out</Text>
          )}
        </TouchableOpacity>
      </ScrollView>

      <SignOutConfirmationModal
        visible={showSignOutModal}
        onConfirm={handleConfirmSignOut}
        onCancel={() => setShowSignOutModal(false)}
        isLoading={signingOut}
      />
    </View>
  );
}

function StatItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statItem}>
      <View style={styles.statIcon}>{icon}</View>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E3EED4',
  },
  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingBottom: 20,
  },
  profileCard: {
    minHeight: 160,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: CARD_RADIUS,
    backgroundColor: '#A9BFA2',
    paddingHorizontal: Math.max(16, Math.min(28, SCREEN_WIDTH * 0.045)),
    paddingVertical: 16,
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  bellButton: {
    position: 'absolute',
    top: 18,
    right: 20,
    width: 30,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarFrame: {
    width: PROFILE_AVATAR_SIZE,
    aspectRatio: 1,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#BED2A9',
    borderWidth: 3,
    borderColor: '#203E2F',
    marginRight: Math.max(16, Math.min(28, SCREEN_WIDTH * 0.05)),
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
    paddingRight: 18,
  },
  nameText: {
    fontSize: Math.max(20, Math.min(27, SCREEN_WIDTH * 0.047)),
    lineHeight: Math.max(25, Math.min(33, SCREEN_WIDTH * 0.058)),
    fontWeight: '800',
    color: '#2C4936',
  },
  nameSuffix: {
    fontSize: 12,
    fontWeight: '500',
  },
  infoText: {
    marginTop: 5,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#2C4936',
  },
  infoStrong: {
    fontWeight: '800',
  },
  editButton: {
    width: Math.max(112, Math.min(146, SCREEN_WIDTH * 0.23)),
    height: 38,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 19,
    borderWidth: 2,
    borderColor: '#111111',
    marginTop: 12,
  },
  editButtonText: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#2C4936',
  },
  statsPanel: {
    minHeight: 112,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 22,
    borderRadius: 14,
    backgroundColor: '#C8DEC9',
    paddingHorizontal: Math.max(12, Math.min(26, SCREEN_WIDTH * 0.045)),
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 4,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statIcon: {
    height: 42,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statLabel: {
    marginTop: 1,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '500',
    color: '#2C4936',
  },
  statValue: {
    marginTop: 2,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    color: '#2C4936',
  },
  statDivider: {
    width: 1,
    height: 70,
    backgroundColor: 'rgba(44, 73, 54, 0.45)',
  },
  overviewTitle: {
    marginTop: 30,
    marginBottom: 22,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#2C4936',
  },
  overviewRow: {
    flexDirection: 'row',
    gap: 10,
  },
  streakCard: {
    flex: 1.18,
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 10,
    backgroundColor: '#ABC4AC',
    paddingLeft: Math.max(14, Math.min(22, SCREEN_WIDTH * 0.035)),
    paddingRight: Math.max(10, Math.min(16, SCREEN_WIDTH * 0.025)),
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  cardTitle: {
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '800',
    color: '#2C4936',
  },
  streakValue: {
    marginTop: 5,
    fontSize: Math.max(32, Math.min(42, SCREEN_WIDTH * 0.065)),
    lineHeight: Math.max(38, Math.min(48, SCREEN_WIDTH * 0.075)),
    fontWeight: '800',
    color: '#2C4936',
  },
  streakLabel: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: '#2C4936',
  },
  myGroupCard: {
    flex: 1,
    minHeight: 104,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 10,
    backgroundColor: '#ABC4AC',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.13,
    shadowRadius: 6,
    elevation: 4,
  },
  myGroupTitle: {
    marginBottom: 8,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '800',
    color: '#2C4936',
  },
  signOutButton: {
    alignSelf: 'center',
    width: Math.max(168, Math.min(230, SCREEN_WIDTH * 0.32)),
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 10,
    backgroundColor: '#9EB59B',
    marginTop: 48,
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 6,
    elevation: 4,
  },
  signOutText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});

export default ProfileScreen;
