import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useGroup } from '../contexts/GroupContext';
import { UserSearchResult } from '../types/group';
import BackIcon from '../assets/icons/group_screen/back_icon.svg';
import AvatarOneIcon from '../assets/icons/group_screen/avatar_1.svg';
import AvatarTwoIcon from '../assets/icons/group_screen/avatar_2.svg';
import AvatarThreeIcon from '../assets/icons/group_screen/avatar_3.svg';
import AvatarFourIcon from '../assets/icons/group_screen/avatar_4.svg';
import AvatarFiveIcon from '../assets/icons/group_screen/avatar_5.svg';
import PublicIcon from '../assets/icons/group_screen/public_icon.svg';
import PrivateIcon from '../assets/icons/group_screen/private_icon.svg';

type AvatarKey = 'avatar_1' | 'avatar_2' | 'avatar_3' | 'avatar_4' | 'avatar_5';

const AVATAR_OPTIONS: Array<{
  id: AvatarKey;
  Icon: React.ComponentType<{ width: number; height: number }>;
}> = [
  { id: 'avatar_1', Icon: AvatarOneIcon },
  { id: 'avatar_2', Icon: AvatarTwoIcon },
  { id: 'avatar_3', Icon: AvatarThreeIcon },
  { id: 'avatar_4', Icon: AvatarFourIcon },
  { id: 'avatar_5', Icon: AvatarFiveIcon },
];

const SCREEN_WIDTH = Dimensions.get('window').width;
const SHEET_PADDING = Math.max(16, Math.min(24, SCREEN_WIDTH * 0.052));
function SearchIcon() {
  return (
    <View style={styles.searchIcon}>
      <View style={styles.searchIconCircle} />
      <View style={styles.searchIconHandle} />
    </View>
  );
}

function CreateGroupScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const {
    createGroup,
    addMembers,
    searchUsers,
    userSearchResults,
    isCreatingGroup,
    isAddingMembers,
    isSearchingUsers,
    clearUserSearchResults,
    clearError,
  } = useGroup();

  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [selectedAvatar, setSelectedAvatar] = useState<AvatarKey>(AVATAR_OPTIONS[0].id);
  const [memberQuery, setMemberQuery] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<UserSearchResult[]>([]);
  const selectedUserIds = useMemo(
    () => new Set(selectedUsers.map((item) => item.id)),
    [selectedUsers]
  );
  const isSubmitting = isCreatingGroup || isAddingMembers;
  const SelectedAvatarIcon =
    AVATAR_OPTIONS.find((option) => option.id === selectedAvatar)?.Icon ||
    AvatarOneIcon;

  useEffect(() => {
    const query = memberQuery.trim();
    if (!query) {
      clearUserSearchResults();
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(query);
    }, 500);

    return () => clearTimeout(timer);
  }, [clearUserSearchResults, memberQuery, searchUsers]);

  const handleToggleUser = (targetUser: UserSearchResult) => {
    setSelectedUsers((prev) => {
      if (prev.some((item) => item.id === targetUser.id)) {
        return prev.filter((item) => item.id !== targetUser.id);
      }

      return [...prev, targetUser];
    });
  };

  const handleCreate = async () => {
    const name = groupName.trim();
    const detail = description.trim();

    if (!name) {
      Alert.alert('Error', 'Please enter group name');
      return;
    }

    if (name.length > 100) {
      Alert.alert('Error', 'Group name cannot exceed 100 characters');
      return;
    }

    if (detail.length > 500) {
      Alert.alert('Error', 'Description cannot exceed 500 characters');
      return;
    }

    try {
      const group = await createGroup({
        name,
        description: detail || undefined,
        is_public: isPublic,
        avatar_key: selectedAvatar as AvatarKey,
        max_members: 25,
      });

      if (selectedUsers.length > 0) {
        await addMembers(group.id, selectedUsers.map((item) => item.id));
      }

      clearUserSearchResults();
      navigation.goBack();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to create group'
      );
      clearError();
    }
  };

  const renderAvatarOption = ({ id, Icon }: (typeof AVATAR_OPTIONS)[number]) => {
    const selected = selectedAvatar === id;
    return (
      <TouchableOpacity
        key={id}
        style={[styles.avatarOption, selected && styles.avatarOptionSelected]}
        onPress={() => setSelectedAvatar(id)}
        activeOpacity={0.8}
      >
        <Icon width={selected ? 34 : 28} height={selected ? 34 : 28} />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.root}>
      <KeyboardAwareScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + 18 },
        ]}
        enableOnAndroid
        extraScrollHeight={24}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View
          style={[
            styles.hero,
            { minHeight: insets.top + 112, paddingTop: insets.top + 14 },
          ]}
        >
          <TouchableOpacity
            style={[styles.backButton, { top: insets.top + 18 }]}
            onPress={() => navigation.goBack()}
            activeOpacity={0.75}
          >
            <BackIcon width={11} height={20} />
          </TouchableOpacity>
          <Text style={styles.title}>Create Group</Text>
          <Text style={styles.subtitle}>Set up a study group</Text>
        </View>

        <View style={styles.sheet}>
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Choose a group avatar</Text>
            <View style={styles.avatarRow}>
              <View style={styles.mainAvatar}>
                <SelectedAvatarIcon width={62} height={44} />
              </View>
              <View style={styles.avatarChoices}>
                {AVATAR_OPTIONS.map(renderAvatarOption)}
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Group name</Text>
            <TextInput
              style={styles.input}
              placeholder="Enter group name"
              placeholderTextColor="#9EA6A0"
              value={groupName}
              onChangeText={setGroupName}
              editable={!isSubmitting}
              maxLength={100}
              selectionColor="#5F8A68"
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>
              Description <Text style={styles.optionalText}>(optional)</Text>
            </Text>
            <View style={styles.textAreaWrap}>
              <TextInput
                style={styles.textArea}
                placeholder="What is this group for?"
                placeholderTextColor="#9EA6A0"
                value={description}
                onChangeText={setDescription}
                editable={!isSubmitting}
                maxLength={150}
                multiline
                textAlignVertical="top"
                selectionColor="#5F8A68"
              />
              <Text style={styles.countText}>{description.length}/150</Text>
            </View>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Group type</Text>
            <View style={styles.segment}>
              <TouchableOpacity
                style={[styles.segmentItem, isPublic && styles.segmentItemActive]}
                onPress={() => setIsPublic(true)}
                activeOpacity={0.85}
              >
                <PublicIcon width={18} height={18} />
                <Text style={styles.segmentText}>Public</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.segmentItem, !isPublic && styles.segmentItemActive]}
                onPress={() => setIsPublic(false)}
                activeOpacity={0.85}
              >
                <PrivateIcon width={15} height={18} />
                <Text style={styles.segmentText}>Private</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.helperText}>
              Public groups can be discovered. Private groups are invite-only.
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Add members</Text>
            <View style={styles.memberSearch}>
              <SearchIcon />
              <TextInput
                style={styles.memberInput}
                placeholder="Search by name or email"
                placeholderTextColor="#9EA6A0"
                value={memberQuery}
                onChangeText={setMemberQuery}
                editable={!isSubmitting}
                selectionColor="#5F8A68"
              />
              {isSearchingUsers && <ActivityIndicator color="#5F8A68" size="small" />}
            </View>

            {memberQuery.trim().length > 0 && userSearchResults.length > 0 && (
              <View style={styles.searchResults}>
                {userSearchResults.slice(0, 4).map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.searchResultItem}
                    onPress={() => handleToggleUser(item)}
                    activeOpacity={0.75}
                    disabled={isSubmitting}
                  >
                    <View style={styles.searchResultAvatar}>
                      <Text style={styles.searchResultAvatarText}>
                        {item.username.slice(0, 1).toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.searchResultInfo}>
                      <Text style={styles.searchResultName}>{item.username}</Text>
                      <Text style={styles.searchResultEmail} numberOfLines={1}>
                        {item.email}
                      </Text>
                    </View>
                    <Text style={styles.searchResultAction}>
                      {selectedUserIds.has(item.id) ? 'Remove' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <View style={styles.chipRow}>
              {selectedUsers.slice(0, 3).map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.memberChip}
                  onPress={() => handleToggleUser(item)}
                  activeOpacity={0.8}
                >
                  <View style={styles.chipAvatar}>
                    <Text style={styles.chipAvatarText}>
                      {item.username.slice(0, 1).toUpperCase()}
                    </Text>
                  </View>
                  <Text style={styles.chipText} numberOfLines={1}>
                    {item.username}
                  </Text>
                  <Text style={styles.chipRemove}>x</Text>
                </TouchableOpacity>
              ))}
              {selectedUsers.length > 3 && (
                <View style={styles.memberChipCompact}>
                  <Text style={styles.chipText}>+{selectedUsers.length - 3}</Text>
                </View>
              )}
            </View>
          </View>

          <TouchableOpacity
            style={[styles.createButton, isSubmitting && styles.buttonDisabled]}
            onPress={handleCreate}
            disabled={isSubmitting}
            activeOpacity={0.85}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={styles.createButtonText}>Create Group</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isSubmitting}
            activeOpacity={0.75}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAwareScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#EDF4E5',
  },
  scroll: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
  },
  hero: {
    alignItems: 'center',
    paddingHorizontal: 22,
    backgroundColor: '#496D55',
  },
  backButton: {
    position: 'absolute',
    left: 24,
    width: 34,
    height: 34,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  title: {
    marginTop: 4,
    fontSize: 25,
    lineHeight: 31,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#F2F5ED',
    textAlign: 'center',
  },
  sheet: {
    flex: 1,
    marginTop: -16,
    paddingHorizontal: SHEET_PADDING,
    paddingTop: 20,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    backgroundColor: '#F8FAF1',
  },
  card: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.09,
    shadowRadius: 7,
    elevation: 3,
  },
  sectionTitle: {
    marginBottom: 10,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '800',
    color: '#274631',
  },
  optionalText: {
    fontWeight: '600',
  },
  avatarRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mainAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#E0E9D8',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 10,
  },
  avatarChoices: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  avatarOption: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: '#E9F0E4',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  avatarOptionSelected: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: '#F8FAF1',
    borderColor: '#5F8A68',
  },
  input: {
    height: 46,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCD4CA',
    paddingHorizontal: 12,
    fontSize: 15,
    color: '#274631',
    backgroundColor: '#FFFFFF',
  },
  textAreaWrap: {
    minHeight: 82,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCD4CA',
    backgroundColor: '#FFFFFF',
  },
  textArea: {
    minHeight: 58,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 4,
    fontSize: 15,
    color: '#274631',
  },
  countText: {
    alignSelf: 'flex-end',
    paddingRight: 12,
    paddingBottom: 8,
    fontSize: 12,
    fontWeight: '600',
    color: '#7B827D',
  },
  segment: {
    height: 46,
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D2D8D0',
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  segmentItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  segmentItemActive: {
    backgroundColor: '#E0E9D8',
  },
  segmentText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#2C4936',
  },
  helperText: {
    marginTop: 9,
    fontSize: 12,
    lineHeight: 17,
    fontWeight: '500',
    color: '#777E79',
  },
  memberSearch: {
    height: 46,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#CCD4CA',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
  },
  memberInput: {
    flex: 1,
    marginLeft: 10,
    fontSize: 14,
    color: '#274631',
  },
  searchIcon: {
    width: 22,
    height: 22,
  },
  searchIconCircle: {
    width: 15,
    height: 15,
    borderRadius: 8,
    borderWidth: 2.5,
    borderColor: '#2C4936',
  },
  searchIconHandle: {
    position: 'absolute',
    width: 10,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: '#2C4936',
    right: 1,
    bottom: 3,
    transform: [{ rotate: '45deg' }],
  },
  searchResults: {
    marginTop: 10,
    borderRadius: 10,
    backgroundColor: '#F3F7ED',
    overflow: 'hidden',
  },
  searchResultItem: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#DDE6D8',
  },
  searchResultAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#AFC5A9',
  },
  searchResultAvatarText: {
    fontSize: 13,
    fontWeight: '800',
    color: '#274631',
  },
  searchResultInfo: {
    flex: 1,
    minWidth: 0,
    marginLeft: 10,
  },
  searchResultName: {
    fontSize: 13,
    fontWeight: '800',
    color: '#274631',
  },
  searchResultEmail: {
    marginTop: 2,
    fontSize: 11,
    color: '#777E79',
  },
  searchResultAction: {
    marginLeft: 10,
    fontSize: 12,
    fontWeight: '800',
    color: '#5F8A68',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 11,
  },
  memberChip: {
    maxWidth: 112,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 5,
    paddingRight: 8,
    borderRadius: 17,
    backgroundColor: '#E2EBDD',
  },
  memberChipCompact: {
    height: 34,
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 17,
    backgroundColor: '#E2EBDD',
  },
  chipAvatar: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#AFC5A9',
  },
  chipAvatarText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#274631',
  },
  chipText: {
    marginLeft: 7,
    fontSize: 12,
    fontWeight: '800',
    color: '#274631',
    flexShrink: 1,
  },
  chipRemove: {
    marginLeft: 7,
    fontSize: 15,
    lineHeight: 17,
    color: '#274631',
  },
  createButton: {
    height: 50,
    marginTop: 12,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6F9A78',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 4,
  },
  createButtonText: {
    fontSize: 16,
    lineHeight: 22,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  cancelButton: {
    height: 46,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5F8A68',
  },
  buttonDisabled: {
    opacity: 0.65,
  },
});

export default CreateGroupScreen;
