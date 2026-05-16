/**
 * Group Context
 * Quản lý state cho group management across the app
 */

import React, { createContext, useState, useCallback, ReactNode } from 'react';
import { groupService } from '../services/groupService';
import {
  Group,
  GroupDetail,
  GroupContextType,
  CreateGroupRequest,
  UpdateGroupRequest,
  UserSearchResult,
  GroupSharedItem,
  ShareGroupItemRequest,
  GroupMember,
} from '../types/group';

export const GroupContext = createContext<GroupContextType | undefined>(undefined);

interface GroupProviderProps {
  children: ReactNode;
}

export const GroupProvider: React.FC<GroupProviderProps> = ({ children }) => {
  // State
  const [groups, setGroups] = useState<Group[]>([]);
  const [currentGroup, setCurrentGroup] = useState<GroupDetail | null>(null);
  const [groupMembers, setGroupMembers] = useState<GroupMember[]>([]);
  const [groupSharedItems, setGroupSharedItems] = useState<GroupSharedItem[]>([]);
  const [searchResults, setSearchResults] = useState<Group[]>([]);
  const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
  const [isFetchingGroups, setIsFetchingGroups] = useState(false);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [isFetchingGroupDetails, setIsFetchingGroupDetails] = useState(false);
  const [isSearchingGroups, setIsSearchingGroups] = useState(false);
  const [isAddingMembers, setIsAddingMembers] = useState(false);
  const [isChangingMemberRole, setIsChangingMemberRole] = useState(false);
  const [isRemovingMember, setIsRemovingMember] = useState(false);
  const [isTransferringOwnership, setIsTransferringOwnership] = useState(false);
  const [isUpdatingGroup, setIsUpdatingGroup] = useState(false);
  const [isDeletingGroup, setIsDeletingGroup] = useState(false);
  const [isJoiningGroup, setIsJoiningGroup] = useState(false);
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [isFetchingSharedItems, setIsFetchingSharedItems] = useState(false);
  const [isSharingItem, setIsSharingItem] = useState(false);
  const [isRemovingSharedItem, setIsRemovingSharedItem] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loading =
    isFetchingGroups ||
    isCreatingGroup ||
    isFetchingGroupDetails ||
    isSearchingGroups ||
    isAddingMembers ||
    isChangingMemberRole ||
    isRemovingMember ||
    isTransferringOwnership ||
    isUpdatingGroup ||
    isDeletingGroup ||
    isJoiningGroup ||
    isSearchingUsers ||
    isFetchingSharedItems ||
    isSharingItem ||
    isRemovingSharedItem;

  // ==================== Create Group ====================

  const createGroup = useCallback(async (data: CreateGroupRequest) => {
    try {
      setIsCreatingGroup(true);
      setError(null);

      const newGroup = await groupService.createGroup(data);
      setGroups((prev) => [...prev, newGroup]);
      return newGroup;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to create group';
      setError(errorMessage);
      throw err;
    } finally {
      setIsCreatingGroup(false);
    }
  }, []);

  // ==================== Get Groups ====================

  const getGroups = useCallback(async () => {
    try {
      setIsFetchingGroups(true);
      setError(null);

      const fetchedGroups = await groupService.getGroups();
      setGroups(fetchedGroups);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch groups';
      setError(errorMessage);
      throw err;
    } finally {
      setIsFetchingGroups(false);
    }
  }, []);

  // ==================== Get Group Details ====================

  const getGroupDetails = useCallback(async (groupId: number) => {
    try {
      setIsFetchingGroupDetails(true);
      setError(null);

      const groupDetail = await groupService.getGroupDetails(groupId);
      setCurrentGroup(groupDetail);
      setGroupMembers(groupDetail.members);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch group details';
      setError(errorMessage);
      throw err;
    } finally {
      setIsFetchingGroupDetails(false);
    }
  }, []);

  // ==================== Search Public Groups ====================

  const searchPublicGroups = useCallback(async (searchName: string) => {
    try {
      setIsSearchingGroups(true);
      setError(null);

      const results = await groupService.searchPublicGroups(searchName);
      setSearchResults(results);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to search groups';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSearchingGroups(false);
    }
  }, []);

  // ==================== Add Members ====================

  const addMembers = useCallback(async (groupId: number, userIds: number[]) => {
    try {
      setIsAddingMembers(true);
      setError(null);

      const updatedGroup = await groupService.addMembers(groupId, userIds);
      
      // Update current group if it matches
      if (currentGroup && currentGroup.id === groupId) {
        setCurrentGroup(updatedGroup);
        setGroupMembers(updatedGroup.members);
      }
      
      // Update groups list
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? updatedGroup : g))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to add members';
      setError(errorMessage);
      throw err;
    } finally {
      setIsAddingMembers(false);
    }
  }, [currentGroup]);

  // ==================== Change Member Role ====================

  const changeMemberRole = useCallback(
    async (groupId: number, userId: number, role: 'admin' | 'member') => {
      try {
        setIsChangingMemberRole(true);
        setError(null);

        await groupService.changeMemberRole(groupId, userId, role);

        // Update current group members
        if (currentGroup && currentGroup.id === groupId) {
          const updatedMembers = groupMembers.map((m) =>
            m.user_id === userId ? { ...m, member_role: role } : m
          );
          setGroupMembers(updatedMembers);
          setCurrentGroup({ ...currentGroup, members: updatedMembers });
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to change member role';
        setError(errorMessage);
        throw err;
      } finally {
        setIsChangingMemberRole(false);
      }
    },
    [currentGroup, groupMembers]
  );

  // ==================== Remove Member ====================

  const removeMember = useCallback(
    async (groupId: number, userId: number) => {
      try {
        setIsRemovingMember(true);
        setError(null);

        await groupService.removeMember(groupId, userId);

        // Update current group
        if (currentGroup && currentGroup.id === groupId) {
          const updatedMembers = groupMembers.filter((m) => m.user_id !== userId);
          setGroupMembers(updatedMembers);
          setCurrentGroup({
            ...currentGroup,
            members: updatedMembers,
            member_count: updatedMembers.length,
          });
        }

        // Update groups list
        setGroups((prev) =>
          prev.map((g) =>
            g.id === groupId ? { ...g, member_count: g.member_count - 1 } : g
          )
        );
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to remove member';
        setError(errorMessage);
        throw err;
      } finally {
        setIsRemovingMember(false);
      }
    },
    [currentGroup, groupMembers]
  );

  const transferOwnership = useCallback(async (groupId: number, targetUserId: number) => {
    try {
      setIsTransferringOwnership(true);
      setError(null);

      const updatedGroup = await groupService.transferOwnership(groupId, targetUserId);
      setCurrentGroup(updatedGroup);
      setGroupMembers(updatedGroup.members);
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? { ...g, ...updatedGroup } : g))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to transfer ownership';
      setError(errorMessage);
      throw err;
    } finally {
      setIsTransferringOwnership(false);
    }
  }, []);

  // ==================== Update Group ====================

  const updateGroup = useCallback(async (groupId: number, data: UpdateGroupRequest) => {
    try {
      setIsUpdatingGroup(true);
      setError(null);

      const updatedGroup = await groupService.updateGroup(groupId, data);

      // Update current group
      if (currentGroup && currentGroup.id === groupId) {
        setCurrentGroup({ ...currentGroup, ...updatedGroup });
      }

      // Update groups list
      setGroups((prev) =>
        prev.map((g) => (g.id === groupId ? updatedGroup : g))
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update group';
      setError(errorMessage);
      throw err;
    } finally {
      setIsUpdatingGroup(false);
    }
  }, [currentGroup]);

  // ==================== Delete Group ====================

  const deleteGroup = useCallback(async (groupId: number) => {
    try {
      setIsDeletingGroup(true);
      setError(null);

      await groupService.deleteGroup(groupId);

      // Remove from groups list
      setGroups((prev) => prev.filter((g) => g.id !== groupId));

      // Clear current group if deleted
      if (currentGroup && currentGroup.id === groupId) {
        setCurrentGroup(null);
        setGroupMembers([]);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to delete group';
      setError(errorMessage);
      throw err;
    } finally {
      setIsDeletingGroup(false);
    }
  }, [currentGroup]);

  // ==================== Join Public Group ====================

  const joinGroup = useCallback(async (groupId: number) => {
    try {
      setIsJoiningGroup(true);
      setError(null);

      await groupService.joinGroup(groupId);

      // Refresh groups list to show new membership
      const updatedGroups = await groupService.getGroups();
      setGroups(updatedGroups);

      // Refresh current group details
      const groupDetails = await groupService.getGroupDetails(groupId);
      setCurrentGroup(groupDetails);
      setGroupMembers(groupDetails.members);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to join group';
      setError(errorMessage);
      throw err;
    } finally {
      setIsJoiningGroup(false);
    }
  }, []);

  // ==================== Search Users ====================

  const searchUsers = useCallback(async (username: string, excludeGroupId?: number) => {
    try {
      setIsSearchingUsers(true);
      setError(null);

      const results = await groupService.searchUsers(username, excludeGroupId);
      setUserSearchResults(results);
    } catch (err) {
      // Don't throw error for search - just show empty results
      // This provides better UX: "No users found" instead of error alert
      const errorMessage = err instanceof Error ? err.message : 'Failed to search users';
      console.error('Search users error:', errorMessage);
      setUserSearchResults([]);
      setError(null); // Don't show error alert, let component show "No users found"
    } finally {
      setIsSearchingUsers(false);
    }
  }, []);

  // ==================== Clear Functions ====================

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const clearCurrentGroup = useCallback(() => {
    setCurrentGroup(null);
    setGroupMembers([]);
    setGroupSharedItems([]);
  }, []);

  const clearSearchResults = useCallback(() => {
    setSearchResults([]);
  }, []);

  const clearUserSearchResults = useCallback(() => {
    setUserSearchResults([]);
  }, []);

  // ==================== Group Shared Items ====================

  const getGroupSharedItems = useCallback(async (groupId: number) => {
    try {
      setIsFetchingSharedItems(true);
      setError(null);

      const items = await groupService.getGroupSharedItems(groupId);
      setGroupSharedItems(items);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch shared items';
      setError(errorMessage);
      throw err;
    } finally {
      setIsFetchingSharedItems(false);
    }
  }, []);

  const shareGroupItem = useCallback(async (groupId: number, data: ShareGroupItemRequest) => {
    try {
      setIsSharingItem(true);
      setError(null);

      const items = await groupService.shareGroupItem(groupId, data);
      setGroupSharedItems(items);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to share item';
      setError(errorMessage);
      throw err;
    } finally {
      setIsSharingItem(false);
    }
  }, []);

  const removeGroupSharedItem = useCallback(async (groupId: number, sharedItemId: number) => {
    try {
      setIsRemovingSharedItem(true);
      setError(null);

      const items = await groupService.removeGroupSharedItem(groupId, sharedItemId);
      setGroupSharedItems(items);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to remove shared item';
      setError(errorMessage);
      throw err;
    } finally {
      setIsRemovingSharedItem(false);
    }
  }, []);

  // ==================== Provider Value ====================

  const value: GroupContextType = {
    groups,
    currentGroup,
    groupMembers,
    groupSharedItems,
    searchResults,
    userSearchResults,
    loading,
    isFetchingGroups,
    isCreatingGroup,
    isFetchingGroupDetails,
    isSearchingGroups,
    isAddingMembers,
    isChangingMemberRole,
    isRemovingMember,
    isTransferringOwnership,
    isUpdatingGroup,
    isDeletingGroup,
    isJoiningGroup,
    isSearchingUsers,
    isFetchingSharedItems,
    isSharingItem,
    isRemovingSharedItem,
    error,
    createGroup,
    getGroups,
    getGroupDetails,
    searchPublicGroups,
    addMembers,
    changeMemberRole,
    removeMember,
    transferOwnership,
    updateGroup,
    deleteGroup,
    joinGroup,
    searchUsers,
    getGroupSharedItems,
    shareGroupItem,
    removeGroupSharedItem,
    clearError,
    clearCurrentGroup,
    clearSearchResults,
    clearUserSearchResults,
  };

  return <GroupContext.Provider value={value}>{children}</GroupContext.Provider>;
};

/**
 * Hook to use GroupContext
 */
export const useGroup = (): GroupContextType => {
  const context = React.useContext(GroupContext);
  if (!context) {
    throw new Error('useGroup must be used within GroupProvider');
  }
  return context;
};
