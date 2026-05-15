/**
 * Group Screen
 * Main screen để xem groups và mở luồng tạo/tìm kiếm groups
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Svg, { Circle, Line } from 'react-native-svg';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { Group } from '../types/group';
import BackIcon from '../assets/icons/group_screen/back_icon.svg';
import AddIcon from '../assets/icons/group_screen/add_icon.svg';
import AvatarOneIcon from '../assets/icons/group_screen/avatar_1.svg';
import AvatarTwoIcon from '../assets/icons/group_screen/avatar_2.svg';
import AvatarThreeIcon from '../assets/icons/group_screen/avatar_3.svg';
import AvatarFourIcon from '../assets/icons/group_screen/avatar_4.svg';
import AvatarFiveIcon from '../assets/icons/group_screen/avatar_5.svg';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SCREEN_HEIGHT = Dimensions.get('window').height;
const HORIZONTAL_PADDING = Math.max(20, Math.min(34, SCREEN_WIDTH * 0.06));
const SEARCH_MARGIN = Math.max(22, Math.min(42, SCREEN_WIDTH * 0.07));
const CREATE_BUTTON_WIDTH = Math.min(248, SCREEN_WIDTH - SEARCH_MARGIN * 3);
const RESULT_MARGIN = Math.max(28, Math.min(50, SCREEN_WIDTH * 0.07));
const FILTER_WIDTH = Math.max(104, Math.min(154, SCREEN_WIDTH * 0.22));
const MODAL_WIDTH = Math.min(SCREEN_WIDTH - 48, 420);
const MEMBER_AVATAR_SIZE = Math.max(34, Math.min(42, SCREEN_WIDTH * 0.105));
type SearchFilter = 'joined' | 'public';
type AvatarKey = 'avatar_1' | 'avatar_2' | 'avatar_3' | 'avatar_4' | 'avatar_5';
type SearchGroup = Group & {
  joined: boolean;
  owner_name?: string;
  capacity?: number;
};

const GROUP_AVATAR_ICONS: Record<
  AvatarKey,
  React.ComponentType<{ width: number; height: number }>
> = {
  avatar_1: AvatarOneIcon,
  avatar_2: AvatarTwoIcon,
  avatar_3: AvatarThreeIcon,
  avatar_4: AvatarFourIcon,
  avatar_5: AvatarFiveIcon,
};

function getGroupAvatarIcon(avatarKey?: string | null) {
  return GROUP_AVATAR_ICONS[(avatarKey as AvatarKey) || 'avatar_1'] || AvatarOneIcon;
}

function SearchIcon() {
  return (
    <View style={styles.searchIcon}>
      <View style={styles.searchIconCircle} />
      <View style={styles.searchIconHandle} />
    </View>
  );
}

function CloseIcon() {
  return (
    <Svg width={31} height={31} viewBox="0 0 31 31" fill="none">
      <Line x1="4" y1="4" x2="27" y2="27" stroke="#2C4936" strokeWidth="3.2" strokeLinecap="round" />
      <Line x1="27" y1="4" x2="4" y2="27" stroke="#2C4936" strokeWidth="3.2" strokeLinecap="round" />
    </Svg>
  );
}

function MoreMemberIcon() {
  return (
    <View style={styles.memberMoreCircle}>
      <Svg width={32} height={32} viewBox="0 0 32 32" fill="none">
        <Circle cx="9" cy="16" r="1.8" fill="#9AAE9D" />
        <Circle cx="16" cy="16" r="1.8" fill="#9AAE9D" />
        <Circle cx="23" cy="16" r="1.8" fill="#9AAE9D" />
      </Svg>
    </View>
  );
}

function GroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user } = useAuth();
  const {
    groups,
    searchResults: publicSearchResults,
    isFetchingGroups,
    isSearchingGroups,
    isJoiningGroup,
    error,
    getGroups,
    searchPublicGroups,
    joinGroup,
    clearSearchResults,
    clearError,
  } = useGroup();

  const [searchText, setSearchText] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [searchFilter, setSearchFilter] = useState<SearchFilter>('joined');
  const [previewGroup, setPreviewGroup] = useState<SearchGroup | null>(null);

  const isTeacher = user?.role === 'teacher';

  useFocusEffect(
    React.useCallback(() => {
      getGroups();
    }, [getGroups])
  );

  useEffect(() => {
    if (error) {
      Alert.alert('Error', error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (!isSearchActive || searchFilter !== 'public') {
      return;
    }

    const query = searchText.trim();
    if (!query) {
      clearSearchResults();
      return;
    }

    const timer = setTimeout(() => {
      searchPublicGroups(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [
    clearSearchResults,
    isSearchActive,
    searchFilter,
    searchPublicGroups,
    searchText,
  ]);

  const filteredGroups = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    if (!query) {
      return groups;
    }

    return groups.filter((group) => {
      const description = group.description || '';
      return (
        group.name.toLowerCase().includes(query) ||
        description.toLowerCase().includes(query)
      );
    });
  }, [groups, searchText]);

  const searchResults = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const scopedGroups: SearchGroup[] =
      searchFilter === 'joined'
        ? groups.map((group) => ({
            ...group,
            joined: true,
            capacity: group.max_members || 25,
          }))
        : publicSearchResults.map((group) => ({
            ...group,
            joined: false,
            capacity: group.max_members || 25,
          }));

    return scopedGroups.filter((group) => {
      const matchesQuery =
        !query ||
        group.name.toLowerCase().includes(query) ||
        (group.owner_name || '').toLowerCase().includes(query);

      return matchesQuery;
    });
  }, [groups, publicSearchResults, searchFilter, searchText]);

  const handleGroupPress = (group: Group) => {
    navigation.navigate('GroupDetail', { group });
  };

  const handleSearchResultPress = (group: SearchGroup) => {
    if (group.joined) {
      navigation.navigate('GroupDetail', { group });
      return;
    }

    setPreviewGroup(group);
  };

  const handleCloseSearch = () => {
    setIsSearchActive(false);
    setSearchText('');
    setSearchFilter('joined');
    setPreviewGroup(null);
    clearSearchResults();
  };

  const handleJoinPreviewGroup = async () => {
    if (!previewGroup) {
      return;
    }

    try {
      await joinGroup(previewGroup.id);
      await getGroups();
      setPreviewGroup(null);
      setSearchFilter('joined');
      clearSearchResults();
    } catch (joinError) {
      Alert.alert(
        'Error',
        joinError instanceof Error ? joinError.message : 'Failed to join group'
      );
    }
  };

  const handleCreateGroup = () => {
    if (!isTeacher) {
      Alert.alert('Permission Denied', 'Only teachers can create groups');
      return;
    }
    navigation.navigate('CreateGroup');
  };

  const renderGroupCard = ({ item }: { item: Group }) => {
    const AvatarIcon = getGroupAvatarIcon(item.avatar_key);

    return (
      <TouchableOpacity
        style={styles.groupCard}
        onPress={() => handleGroupPress(item)}
        activeOpacity={0.78}
      >
        <View style={styles.avatarBox}>
          <AvatarIcon width={36} height={40} />
        </View>

        <View style={styles.groupContent}>
          <Text style={styles.groupName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.memberCount}>{item.member_count} Member</Text>
        </View>

        <View style={styles.chevron}>
          <BackIcon width={9} height={17} />
        </View>
      </TouchableOpacity>
    );
  };

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyTitle}>
        {searchText.trim() ? 'No groups found' : 'No groups yet'}
      </Text>
      <Text style={styles.emptyText}>
        {searchText.trim()
          ? 'Try another group name or description.'
          : isTeacher
            ? 'Create your first study group to start organizing members.'
            : 'Join a public group to see it here.'}
      </Text>
    </View>
  );

  const publicGroupPreviewModal = (
    <Modal
      visible={!!previewGroup}
      transparent
      animationType="fade"
      onRequestClose={() => setPreviewGroup(null)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.previewModal}>
          <TouchableOpacity
            style={styles.modalCloseButton}
            onPress={() => setPreviewGroup(null)}
            activeOpacity={0.75}
          >
            <CloseIcon />
          </TouchableOpacity>

          <Text style={styles.modalGroupName}>{previewGroup?.name}</Text>
          <Text style={styles.ownerLine}>
            <Text style={styles.ownerStrong}>Owner: </Text>
            {previewGroup?.owner_name || 'Unknown'}
          </Text>

          <Text style={styles.modalMemberTitle}>Member</Text>
            <Text style={styles.modalMemberCount}>
            {previewGroup?.member_count}/{previewGroup?.capacity || 25}
          </Text>

          <View style={styles.memberPreviewGrid}>
            {MEMBER_COLORS.map((color) => (
              <View
                key={color}
                style={[
                  styles.memberCircle,
                  { backgroundColor: color },
                ]}
              >
                <AvatarTwoIcon
                  width={MEMBER_AVATAR_SIZE * 0.56}
                  height={MEMBER_AVATAR_SIZE * 0.66}
                />
              </View>
            ))}
            <MoreMemberIcon />
          </View>

          <TouchableOpacity
            style={[styles.joinButton, isJoiningGroup && styles.buttonDisabled]}
            onPress={handleJoinPreviewGroup}
            disabled={isJoiningGroup}
            activeOpacity={0.82}
          >
            {isJoiningGroup ? (
              <ActivityIndicator color="#2C4936" size="small" />
            ) : (
              <Text style={styles.joinButtonText}>Join</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );

  if (isSearchActive) {
    return (
      <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={handleCloseSearch}
            activeOpacity={0.75}
          >
            <BackIcon width={11} height={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Groups</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchModeInput}>
          <TextInput
            style={styles.searchModeTextInput}
            placeholder="Search groups"
            placeholderTextColor="#8D9A8E"
            value={searchText}
            onChangeText={setSearchText}
            autoFocus
            selectionColor="#5F8A68"
          />
          <SearchIcon />
        </View>

        <View style={styles.filterRow}>
          <FilterButton
            label="Joined"
            active={searchFilter === 'joined'}
            onPress={() => setSearchFilter('joined')}
          />
          <FilterButton
            label="Public"
            active={searchFilter === 'public'}
            onPress={() => setSearchFilter('public')}
          />
        </View>

        <Text style={styles.resultTitle}>Result</Text>
        {isSearchingGroups && searchFilter === 'public' ? (
          <View style={styles.searchLoading}>
            <ActivityIndicator color="#6F9A78" size="large" />
          </View>
        ) : (
          <FlatList
            data={searchResults}
            renderItem={({ item }) => (
              <SearchResultCard
                group={item}
                onPress={() => handleSearchResultPress(item)}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={styles.searchResultList}
            ListEmptyComponent={
              <Text style={styles.searchEmptyText}>No groups found</Text>
            }
            showsVerticalScrollIndicator={false}
          />
        )}

        {publicGroupPreviewModal}
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top + 14 }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <BackIcon width={11} height={20} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Groups</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.searchContainer}>
          <SearchIcon />
          <TextInput
            style={styles.searchInput}
            placeholder="Search groups"
            placeholderTextColor="#8D9A8E"
            value={searchText}
            onChangeText={setSearchText}
            onFocus={() => setIsSearchActive(true)}
            selectionColor="#5F8A68"
          />
        </View>

        {isTeacher && (
          <TouchableOpacity
            style={styles.createButton}
            onPress={handleCreateGroup}
            activeOpacity={0.82}
          >
            <AddIcon width={19} height={19} />
            <Text style={styles.createButtonText}>Create Group</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>My groups</Text>

        {isFetchingGroups ? (
          <View style={styles.listLoading}>
            <ActivityIndicator color="#6F9A78" size="large" />
          </View>
        ) : (
          <FlatList
            data={filteredGroups}
            renderItem={renderGroupCard}
            keyExtractor={(item) => item.id.toString()}
            contentContainerStyle={[
              styles.listContent,
              filteredGroups.length === 0 && styles.emptyListContent,
            ]}
            ListEmptyComponent={renderEmpty}
            showsVerticalScrollIndicator={false}
          />
        )}

    </View>
  );
}

const MEMBER_COLORS = [
  '#CBDAA9',
  '#E4EADC',
  '#87D97C',
  '#C7C5EB',
  '#334724',
  '#B8BC4C',
  '#B8C895',
];

function FilterButton({
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
      style={[styles.filterButton, active && styles.filterButtonActive]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <Text style={styles.filterText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SearchResultCard({
  group,
  onPress,
}: {
  group: SearchGroup;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={styles.searchResultCard}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={styles.searchResultContent}>
        <Text style={styles.searchResultName}>{group.name}</Text>
        <Text style={styles.searchResultMember}>{group.member_count} Member</Text>
      </View>
      <View style={styles.searchResultChevron}>
        <BackIcon width={10} height={18} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF4E5',
  },
  header: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    marginBottom: 18,
  },
  backButton: {
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#2C4936',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 34,
  },
  searchContainer: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SEARCH_MARGIN,
    paddingHorizontal: 17,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  searchInput: {
    flex: 1,
    marginLeft: 16,
    fontSize: 16,
    lineHeight: 22,
    color: '#2C4936',
  },
  searchIcon: {
    width: 26,
    height: 26,
  },
  searchIconCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: '#2C4936',
  },
  searchIconHandle: {
    position: 'absolute',
    width: 12,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#2C4936',
    right: 1,
    bottom: 4,
    transform: [{ rotate: '45deg' }],
  },
  createButton: {
    alignSelf: 'center',
    height: 50,
    minWidth: CREATE_BUTTON_WIDTH,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    marginTop: 24,
    marginBottom: 38,
    paddingHorizontal: 22,
    borderRadius: 15,
    backgroundColor: '#88AB88',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  sectionTitle: {
    marginHorizontal: HORIZONTAL_PADDING,
    marginBottom: 20,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#2C4936',
  },
  listContent: {
    paddingHorizontal: HORIZONTAL_PADDING,
    paddingBottom: 24,
  },
  emptyListContent: {
    flexGrow: 1,
  },
  groupCard: {
    minHeight: 90,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.12,
    shadowRadius: 7,
    elevation: 4,
  },
  avatarBox: {
    width: 62,
    height: 62,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#AFC5A9',
    marginRight: 16,
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  groupContent: {
    flex: 1,
    minWidth: 0,
  },
  groupName: {
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
    color: '#2C4936',
  },
  memberCount: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: '#2C4936',
  },
  chevron: {
    width: 24,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 22,
    paddingBottom: 90,
  },
  emptyTitle: {
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#2C4936',
    textAlign: 'center',
  },
  emptyText: {
    marginTop: 8,
    fontSize: 15,
    lineHeight: 22,
    fontWeight: '600',
    color: '#6B776D',
    textAlign: 'center',
  },
  listLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#EDF4E5',
    zIndex: 10,
  },
  searchModeInput: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: SEARCH_MARGIN,
    paddingLeft: 20,
    paddingRight: 17,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  searchModeTextInput: {
    flex: 1,
    marginRight: 14,
    fontSize: 16,
    lineHeight: 22,
    color: '#2C4936',
  },
  filterRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
    marginTop: 12,
  },
  filterButton: {
    width: FILTER_WIDTH,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17,
    backgroundColor: '#B8CDB9',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.14,
    shadowRadius: 5,
    elevation: 3,
  },
  filterButtonActive: {
    backgroundColor: '#D6FFD8',
  },
  filterText: {
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '500',
    color: '#2C4936',
  },
  resultTitle: {
    marginTop: 48,
    marginHorizontal: RESULT_MARGIN,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '500',
    color: '#2C4936',
  },
  searchResultList: {
    paddingHorizontal: RESULT_MARGIN,
    paddingTop: 12,
    paddingBottom: 28,
  },
  searchLoading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchEmptyText: {
    marginTop: 26,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#6B776D',
    textAlign: 'center',
  },
  searchResultCard: {
    minHeight: 104,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 22,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 7,
    elevation: 4,
  },
  searchResultContent: {
    flex: 1,
  },
  searchResultName: {
    fontSize: 23,
    lineHeight: 29,
    fontWeight: '800',
    color: '#2C4936',
  },
  searchResultMember: {
    marginTop: 4,
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '500',
    color: '#2C4936',
  },
  searchResultChevron: {
    width: 28,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
    transform: [{ rotate: '180deg' }],
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(42, 58, 39, 0.42)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 28,
  },
  previewModal: {
    width: MODAL_WIDTH,
    maxHeight: SCREEN_HEIGHT - 96,
    borderRadius: 15,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    paddingTop: Math.max(34, Math.min(46, SCREEN_HEIGHT * 0.048)),
    paddingHorizontal: 22,
    paddingBottom: Math.max(26, Math.min(34, SCREEN_HEIGHT * 0.04)),
  },
  modalCloseButton: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalGroupName: {
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#2C4936',
    textAlign: 'center',
  },
  ownerLine: {
    marginTop: 12,
    fontSize: 19,
    lineHeight: 25,
    fontWeight: '400',
    color: '#2C4936',
    textAlign: 'center',
  },
  ownerStrong: {
    fontWeight: '800',
  },
  modalMemberTitle: {
    marginTop: 26,
    fontSize: 20,
    lineHeight: 26,
    fontWeight: '800',
    color: '#2C4936',
  },
  modalMemberCount: {
    marginTop: 4,
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '400',
    color: '#2C4936',
  },
  memberPreviewGrid: {
    width: Math.min(190, MODAL_WIDTH - 96),
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 11,
    marginTop: 24,
  },
  memberCircle: {
    width: MEMBER_AVATAR_SIZE,
    height: MEMBER_AVATAR_SIZE,
    borderRadius: MEMBER_AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  memberMoreCircle: {
    width: MEMBER_AVATAR_SIZE,
    height: MEMBER_AVATAR_SIZE,
    borderRadius: MEMBER_AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2.5,
    borderColor: '#A9BEAC',
  },
  joinButton: {
    width: Math.max(138, Math.min(190, MODAL_WIDTH * 0.38)),
    height: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: '#B5CDB8',
    marginTop: 42,
  },
  joinButtonText: {
    fontSize: 21,
    lineHeight: 27,
    fontWeight: '800',
    color: '#2C4936',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});

export default GroupScreen;
