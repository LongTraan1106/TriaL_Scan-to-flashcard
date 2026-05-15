/**
 * Invite Members Modal
 * Modal để chọn và invite members vào group
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useGroup } from '../contexts/GroupContext';
import { UserSearchResult } from '../types/group';

interface InviteMembersModalProps {
  visible: boolean;
  groupId: number;
  onClose: () => void;
  onMembersAdded: () => void;
}

export const InviteMembersModal: React.FC<InviteMembersModalProps> = ({
  visible,
  groupId,
  onClose,
  onMembersAdded,
}) => {
  const {
    userSearchResults,
    isSearchingUsers,
    isAddingMembers,
    searchUsers,
    addMembers,
    clearError,
    clearUserSearchResults,
  } = useGroup();
  const [searchText, setSearchText] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<number>>(new Set());
  const [isAdding, setIsAdding] = useState(false);

  // Debounced search with 500ms delay
  useEffect(() => {
    if (!visible || !searchText.trim()) {
      clearUserSearchResults();
      return;
    }

    const timer = setTimeout(() => {
      searchUsers(searchText, groupId);
    }, 500);

    return () => clearTimeout(timer);
  }, [searchText, visible, groupId, searchUsers, clearUserSearchResults]);

  const handleSelectUser = (userId: number) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(userId)) {
      newSelected.delete(userId);
    } else {
      newSelected.add(userId);
    }
    setSelectedUsers(newSelected);
  };

  const handleInvite = async () => {
    if (selectedUsers.size === 0) {
      Alert.alert('Error', 'Please select at least one user');
      return;
    }

    try {
      setIsAdding(true);
      await addMembers(groupId, Array.from(selectedUsers));
      
      Alert.alert('Success', `Added ${selectedUsers.size} member(s) to group!`, [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            onClose();
            onMembersAdded();
          },
        },
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to add members';
      Alert.alert('Error', errorMessage);
      clearError();
    } finally {
      setIsAdding(false);
    }
  };

  const resetForm = () => {
    setSearchText('');
    setSelectedUsers(new Set());
  };

  const handleClose = () => {
    resetForm();
    clearError();
    onClose();
  };

  const renderUserItem = ({ item }: { item: UserSearchResult }) => (
    <TouchableOpacity
      style={styles.userItem}
      onPress={() => handleSelectUser(item.id)}
    >
      <View style={styles.userInfo}>
        <Text style={styles.username}>{item.username}</Text>
        <Text style={styles.email}>{item.email}</Text>
      </View>
      <View
        style={[
          styles.checkbox,
          selectedUsers.has(item.id) ? styles.checkboxSelected : null,
        ]}
      >
        {selectedUsers.has(item.id) && (
          <Text style={styles.checkmark}>✓</Text>
        )}
      </View>
    </TouchableOpacity>
  );

  const renderEmpty = () => (
    <View style={styles.emptyContainer}>
      <Text style={styles.emptyText}>
        {searchText ? 'No users found' : 'Search users by username'}
      </Text>
    </View>
  );

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <View style={styles.modalContent}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Invite Members</Text>
            <TouchableOpacity
              onPress={handleClose}
              disabled={isSearchingUsers || isAdding || isAddingMembers}
            >
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by username"
              placeholderTextColor="#A0B0A0"
              value={searchText}
              onChangeText={setSearchText}
              editable={!isSearchingUsers && !isAdding && !isAddingMembers}
              selectionColor="#8B9D8A"
            />
          </View>

          {/* Users List */}
          {isSearchingUsers ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#8B9D8A" />
            </View>
          ) : (
            <FlatList
              data={userSearchResults}
              renderItem={renderUserItem}
              keyExtractor={(item) => item.id.toString()}
              contentContainerStyle={styles.listContent}
              ListEmptyComponent={renderEmpty}
              scrollEnabled={true}
              showsVerticalScrollIndicator={false}
              style={styles.list}
            />
          )}

          {/* Selected Count */}
          {selectedUsers.size > 0 && (
            <View style={styles.selectedInfo}>
              <Text style={styles.selectedText}>
                {selectedUsers.size} user{selectedUsers.size !== 1 ? 's' : ''} selected
              </Text>
            </View>
          )}

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleClose}
              disabled={isSearchingUsers || isAdding || isAddingMembers}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.inviteButton,
                (isSearchingUsers || isAdding || isAddingMembers || selectedUsers.size === 0) ? styles.buttonDisabled : null,
              ]}
              onPress={handleInvite}
              disabled={isSearchingUsers || isAdding || isAddingMembers || selectedUsers.size === 0}
            >
              {isAdding ? (
                <Text style={styles.inviteButtonText}>Adding...</Text>
              ) : (
                <Text style={styles.inviteButtonText}>
                  Invite ({selectedUsers.size})
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '85%',
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8B9D8A',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Search
  searchContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D0DCC8',
  },
  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#2D3C2C',
    borderWidth: 1,
    borderColor: '#D0DCC8',
  },
  // List
  list: {
    maxHeight: 300,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#D0DCC8',
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3C2C',
    marginBottom: 2,
  },
  email: {
    fontSize: 12,
    color: '#5A6B56',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#8B9D8A',
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 12,
  },
  checkboxSelected: {
    backgroundColor: '#8B9D8A',
    borderColor: '#8B9D8A',
  },
  checkmark: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Loading
  loadingContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
  },
  // Empty
  emptyContainer: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  emptyText: {
    fontSize: 14,
    color: '#5A6B56',
    textAlign: 'center',
  },
  // Selected Info
  selectedInfo: {
    backgroundColor: '#E8F0E6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: '#D0DCC8',
  },
  selectedText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3C2C',
    textAlign: 'center',
  },
  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#D0DCC8',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#C5D8C0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3C2C',
  },
  inviteButton: {
    backgroundColor: '#8B9D8A',
  },
  inviteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
