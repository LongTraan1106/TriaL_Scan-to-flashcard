/**
 * Group Permission Helpers
 * Kiểm tra quyền của user trong group
 */

import { GroupMember, GroupPermissions } from '../types/group';

/**
 * Get user's role in group
 */
export const getUserRoleInGroup = (
  userId: number,
  members: GroupMember[]
): GroupMember | undefined => {
  return members.find((m) => m.user_id === userId);
};

/**
 * Check if user is owner of group
 */
export const isGroupOwner = (userId: number, ownerId: number): boolean => {
  return userId === ownerId;
};

/**
 * Check if user is admin in group
 */
export const isGroupAdmin = (
  userId: number,
  members: GroupMember[]
): boolean => {
  const member = getUserRoleInGroup(userId, members);
  return member?.member_role === 'admin' || member?.member_role === 'owner';
};

/**
 * Check if user is member in group
 */
export const isGroupMember = (
  userId: number,
  members: GroupMember[]
): boolean => {
  return !!getUserRoleInGroup(userId, members);
};

/**
 * Get permissions for user in group
 */
export const getGroupPermissions = (
  userId: number,
  ownerId: number,
  members: GroupMember[]
): GroupPermissions => {
  const isOwner = isGroupOwner(userId, ownerId);
  const isMember = isGroupMember(userId, members);

  return {
    canEditGroup: isOwner,
    canDeleteGroup: isOwner,
    canAddMembers: isOwner,
    canRemoveMembers: isOwner,
    canChangeRoles: isOwner,
    canLeaveGroup: isMember,
    canViewMembers: isMember,
  };
};

/**
 * Get color for member role
 */
export const getRoleColor = (role: string): string => {
  switch (role) {
    case 'owner':
      return '#8B9D8A'; // Green
    case 'admin':
      return '#AEC3B0'; // Light green
    case 'member':
      return '#C5D8C0'; // Lighter green
    default:
      return '#F5F5F0'; // Default
  }
};

/**
 * Get display text for member role
 */
export const getRoleDisplayText = (role: string): string => {
  switch (role) {
    case 'owner':
      return 'Owner';
    case 'admin':
      return 'Admin';
    case 'member':
      return 'Member';
    default:
      return 'Unknown';
  }
};

/**
 * Check if can promote member to admin
 */
export const canPromoteToAdmin = (
  userId: number,
  targetUserId: number,
  ownerId: number,
  members: GroupMember[]
): boolean => {
  // Only owner can promote
  if (!isGroupOwner(userId, ownerId)) {
    return false;
  }

  // Cannot promote owner
  const targetMember = getUserRoleInGroup(targetUserId, members);
  if (targetMember?.member_role === 'owner') {
    return false;
  }

  return true;
};

/**
 * Check if can demote admin to member
 */
export const canDemoteAdmin = (
  userId: number,
  targetUserId: number,
  ownerId: number,
  members: GroupMember[]
): boolean => {
  // Only owner can demote
  if (!isGroupOwner(userId, ownerId)) {
    return false;
  }

  // Can only demote admins
  const targetMember = getUserRoleInGroup(targetUserId, members);
  if (targetMember?.member_role !== 'admin') {
    return false;
  }

  return true;
};

/**
 * Check if can remove member
 */
export const canRemoveMember = (
  userId: number,
  targetUserId: number,
  ownerId: number,
  members: GroupMember[]
): boolean => {
  // Can remove self
  if (userId === targetUserId) {
    return true;
  }

  // Backend only allows the owner to remove other members.
  if (!isGroupOwner(userId, ownerId)) {
    return false;
  }

  // Cannot remove owner
  const targetMember = getUserRoleInGroup(targetUserId, members);
  if (targetMember?.member_role === 'owner') {
    return false;
  }

  return true;
};

/**
 * Format member count text
 */
export const formatMemberCount = (count: number): string => {
  if (count === 1) {
    return '1 Member';
  }
  return `${count} Members`;
};

/**
 * Sort members: owner first, then admins, then members
 */
export const sortMembers = (members: GroupMember[]): GroupMember[] => {
  const roleOrder = { owner: 0, admin: 1, member: 2 };
  return [...members].sort(
    (a, b) => roleOrder[a.member_role as keyof typeof roleOrder] - roleOrder[b.member_role as keyof typeof roleOrder]
  );
};
