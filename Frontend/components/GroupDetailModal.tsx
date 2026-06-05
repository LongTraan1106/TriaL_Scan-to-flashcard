/**
 * Group Detail Modal
 * Modal để xem chi tiết group và quản lý members
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useGroup } from '../contexts/GroupContext';
import { InviteMembersModal } from './InviteMembersModal';
import {
  GroupMember,
  Group,
} from '../types/group';
import {
  getGroupPermissions,
  getRoleDisplayText,
  getRoleColor,
  sortMembers,
  formatMemberCount,
} from '../utils/groupPermissionHelpers';

interface GroupDetailModalProps {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onDataUpdated: () => void;
}

export const GroupDetailModal: React.FC<GroupDetailModalProps> = ({
  visible,
  group,
  onClose,
  onDataUpdated,
}) => {
  const { user } = useAuth();
  const {
    groupMembers,
    isFetchingGroupDetails,
    isJoiningGroup,
    isDeletingGroup,
    getGroupDetails,
    removeMember,
    changeMemberRole,
    deleteGroup,
    joinGroup,
  } = useGroup();
  
  const [showInviteModal, setShowInviteModal] = useState(false);

  useEffect(() => {
    if (visible && group) {
      getGroupDetails(group.id);
    }
  }, [visible, group, getGroupDetails]);

  if (!group) {
    return null;
  }

  // Check if user is a member
  const isMember = groupMembers && groupMembers.length > 0 && groupMembers.some(m => m.user_id === user?.id);

  const permissions = getGroupPermissions(
    user?.id || 0,
    group.owner_id,
    groupMembers
  );

  const handleJoinGroup = async () => {
    try {
      await joinGroup(group.id);
      Alert.alert('Success', 'Joined group successfully!');
      onDataUpdated();
    } catch (error) {
      Alert.alert(
        'Error',
        error instanceof Error ? error.message : 'Failed to join group'
      );
    }
  };

  const handleRemoveMember = (memberId: number, memberName: string) => {
    Alert.alert(
      'Remove Member',
      `Are you sure you want to remove ${memberName}?`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Remove',
          onPress: async () => {
            try {
              await removeMember(group.id, memberId);
              Alert.alert('Success', 'Member removed successfully');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to remove member'
              );
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handlePromoteToAdmin = (memberId: number, memberName: string) => {
    Alert.alert(
      'Promote to Admin',
      `Promote ${memberName} to admin?`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Promote',
          onPress: async () => {
            try {
              await changeMemberRole(group.id, memberId, 'admin');
              Alert.alert('Success', 'Member promoted to admin');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to promote member'
              );
            }
          },
        },
      ]
    );
  };

  const handleDemoteToMember = (memberId: number, memberName: string) => {
    Alert.alert(
      'Demote to Member',
      `Demote ${memberName} to member?`,
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Demote',
          onPress: async () => {
            try {
              await changeMemberRole(group.id, memberId, 'member');
              Alert.alert('Success', 'Member demoted to member');
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to demote member'
              );
            }
          },
        },
      ]
    );
  };

  const handleLeaveGroup = () => {
    Alert.alert(
      'Leave Group',
      'Are you sure you want to leave this group?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Leave',
          onPress: async () => {
            try {
              await removeMember(group.id, user?.id || 0);
              Alert.alert('Success', 'Left group successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    onClose();
                    onDataUpdated();
                  },
                },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to leave group'
              );
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const handleDeleteGroup = () => {
    Alert.alert(
      'Delete Group',
      'Are you sure you want to delete this group? This action cannot be undone.',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            try {
              await deleteGroup(group.id);
              Alert.alert('Success', 'Group deleted successfully', [
                {
                  text: 'OK',
                  onPress: () => {
                    onClose();
                    onDataUpdated();
                  },
                },
              ]);
            } catch (error) {
              Alert.alert(
                'Error',
                error instanceof Error ? error.message : 'Failed to delete group'
              );
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const renderMemberItem = ({ item }: { item: GroupMember }) => {
    const isOwner = item.member_role === 'owner';
    const isAdmin = item.member_role === 'admin';
    const isRegularMember = item.member_role === 'member';
    const canManage = permissions.canChangeRoles && !isOwner;

    return (
      <View style={styles.memberItem}>
        <View style={styles.memberInfo}>
          <Text style={styles.memberName}>{item.username}</Text>
          <Text style={styles.memberEmail}>{item.email}</Text>
          <View
            style={[
              styles.roleBadge,
              { backgroundColor: getRoleColor(item.member_role) },
            ]}
          >
            <Text style={styles.roleBadgeText}>
              {getRoleDisplayText(item.member_role)}
            </Text>
          </View>
        </View>

        {canManage && (
          <View style={styles.memberActions}>
            {isRegularMember && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handlePromoteToAdmin(item.user_id, item.username)}
              >
                <Text style={styles.actionButtonText}>Make Admin</Text>
              </TouchableOpacity>
            )}

            {isAdmin && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => handleDemoteToMember(item.user_id, item.username)}
              >
                <Text style={styles.actionButtonText}>Demote</Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.actionButton, styles.removeButton]}
              onPress={() => handleRemoveMember(item.user_id, item.username)}
            >
              <Text style={styles.removeButtonText}>Remove</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const sortedMembers = sortMembers(groupMembers);

  return (
    <>
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={onClose}
      >
        <View style={styles.centeredView}>
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title} numberOfLines={1}>
                {group.name}
              </Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Content Wrapper */}
            <View style={styles.contentWrapper}>
              <ScrollView style={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {/* Group Info */}
                <View style={styles.groupInfoSection}>
                  {group.description && (
                    <Text style={styles.description} numberOfLines={2}>
                      {group.description}
                    </Text>
                  )}
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {formatMemberCount(group.member_count)}
                    </Text>
                    <Text style={styles.infoLabel}>
                      {group.is_public ? 'Public' : 'Private'}
                    </Text>
                  </View>
                  {group.owner_name && (
                    <Text style={styles.ownerLabel}>
                      Created by: {group.owner_name}
                    </Text>
                  )}
                </View>

                {/* Not Member View - Show Join Button */}
                {!isMember && group.is_public ? (
                  <View style={styles.joinContainer}>
                    <Text style={styles.joinText}>You are not a member of this group yet</Text>
                    <TouchableOpacity
                      style={[styles.button, styles.joinButtonLarge]}
                      onPress={handleJoinGroup}
                      disabled={isJoiningGroup}
                    >
                      <Text style={styles.joinButtonLargeText}>
                        {isJoiningGroup ? 'Joining...' : 'Join Group'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <>
                    {/* Member View - Show Full Details */}
                    {/* Members Section Title */}
                    <View style={styles.sectionHeader}>
                      <Text style={styles.sectionTitle}>Members</Text>
                      {permissions.canAddMembers && (
                        <TouchableOpacity
                          onPress={() => setShowInviteModal(true)}
                          style={styles.inviteButton}
                        >
                          <Text style={styles.inviteButtonText}>+ Invite</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {/* Members List */}
                    {isFetchingGroupDetails ? (
                      <View style={styles.loadingContainer}>
                        <ActivityIndicator size="large" color="#8B9D8A" />
                      </View>
                    ) : (
                      <FlatList
                        data={sortedMembers}
                        renderItem={renderMemberItem}
                        keyExtractor={(item) => item.id.toString()}
                        contentContainerStyle={styles.listContent}
                        scrollEnabled={false}
                      />
                    )}
                  </>
                )}
              </ScrollView>
            </View>

            {/* Action Buttons */}
            <View style={styles.buttonContainer}>
              {permissions.canDeleteGroup && (
                <TouchableOpacity
                  style={[styles.button, styles.deleteButton]}
                  onPress={handleDeleteGroup}
                  disabled={isDeletingGroup}
                >
                  <Text style={styles.deleteButtonText}>
                    {isDeletingGroup ? 'Deleting...' : 'Delete Group'}
                  </Text>
                </TouchableOpacity>
              )}

              {permissions.canLeaveGroup && !permissions.canDeleteGroup && (
                <TouchableOpacity
                  style={[styles.button, styles.leaveButton]}
                  onPress={handleLeaveGroup}
                >
                  <Text style={styles.leaveButtonText}>Leave Group</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.button, styles.closeButtonStyle]}
                onPress={onClose}
              >
                <Text style={styles.closeButtonStyleText}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Invite Members Modal */}
      <InviteMembersModal
        visible={showInviteModal}
        groupId={group.id}
        onClose={() => setShowInviteModal(false)}
        onMembersAdded={() => {
          getGroupDetails(group.id);
          onDataUpdated();
        }}
      />
    </>
  );
};

const styles = StyleSheet.create({
  centeredView: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '90%',
    height: '80%',
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    flexDirection: 'column',
  },
  contentWrapper: {
    flex: 1,
    overflow: 'hidden',
  },
  scrollContent: {
    flexGrow: 1,
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
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  closeButton: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Group Info
  groupInfoSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#E8F0E6',
    borderBottomWidth: 1,
    borderBottomColor: '#D0DCC8',
  },
  description: {
    fontSize: 13,
    color: '#2D3C2C',
    marginBottom: 8,
    lineHeight: 18,
  },
  infoRow: {
    flexDirection: 'row',
    gap: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A6B56',
  },
  ownerLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#5A6B56',
    marginTop: 8,
  },
  // Section Header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#D0DCC8',
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#2D3C2C',
  },
  inviteButton: {
    backgroundColor: '#8B9D8A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  inviteButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Members List
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxHeight: 300,
  },
  memberItem: {
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
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3C2C',
    marginBottom: 2,
  },
  memberEmail: {
    fontSize: 12,
    color: '#5A6B56',
    marginBottom: 6,
  },
  roleBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  roleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Member Actions
  memberActions: {
    flexDirection: 'row',
    gap: 6,
    marginLeft: 12,
  },
  actionButton: {
    backgroundColor: '#AEC3B0',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 6,
  },
  actionButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#2D3C2C',
  },
  removeButton: {
    backgroundColor: '#E8CCC4',
  },
  removeButtonText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#8B3A2C',
  },
  // Loading
  loadingContainer: {
    height: 150,
    justifyContent: 'center',
    alignItems: 'center',
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
  deleteButton: {
    backgroundColor: '#E8CCC4',
  },
  deleteButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#8B3A2C',
  },
  leaveButton: {
    backgroundColor: '#C5D8C0',
  },
  leaveButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3C2C',
  },
  closeButtonStyle: {
    backgroundColor: '#8B9D8A',
  },
  closeButtonStyleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  // Join Container
  joinContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 32,
    minHeight: 200,
  },
  joinText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3C2C',
    marginBottom: 24,
    textAlign: 'center',
    lineHeight: 22,
  },
  joinButtonLarge: {
    backgroundColor: '#8B9D8A',
    width: '80%',
    paddingVertical: 14,
  },
  joinButtonLargeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#FFFFFF',
  },
});
