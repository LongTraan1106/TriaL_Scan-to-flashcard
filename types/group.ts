/**
 * Group Management Types
 * Định nghĩa tất cả các kiểu dữ liệu liên quan đến group
 */

// ==================== Group Types ====================

export interface GroupMember {
  id: number;
  group_id: number;
  user_id: number;
  username: string;
  email: string;
  member_role: 'owner' | 'admin' | 'member';
  joined_at: string;
}

export interface Group {
  id: number;
  name: string;
  description?: string;
  owner_id: number;
  owner_name?: string;
  is_public: boolean;
  member_count: number;
  max_members?: number;
  avatar_key?: 'avatar_1' | 'avatar_2' | 'avatar_3' | 'avatar_4' | 'avatar_5';
  created_at: string;
  updated_at: string;
}

export interface GroupDetail extends Group {
  members: GroupMember[];
}

// ==================== Request Types ====================

export interface CreateGroupRequest {
  name: string;
  description?: string;
  is_public: boolean;
  avatar_key?: 'avatar_1' | 'avatar_2' | 'avatar_3' | 'avatar_4' | 'avatar_5';
  max_members?: number;
}

export interface UpdateGroupRequest {
  name?: string;
  description?: string;
  is_public?: boolean;
  avatar_key?: 'avatar_1' | 'avatar_2' | 'avatar_3' | 'avatar_4' | 'avatar_5';
  max_members?: number;
}

export interface AddMembersRequest {
  user_ids: number[];
}

export interface ChangeMemberRoleRequest {
  member_role: 'admin' | 'member';
}

export interface SearchUsersRequest {
  username: string;
}

// ==================== Response Types ====================

export interface GroupCreateResponse {
  success: boolean;
  message: string;
  data?: Group;
}

export interface GroupDetailResponse {
  success: boolean;
  message: string;
  data?: GroupDetail;
}

export interface GroupListResponse {
  success: boolean;
  message: string;
  data?: Group[];
}

export interface GroupMembersResponse {
  success: boolean;
  message: string;
  data?: GroupMember[];
}

export interface BasicResponse {
  success: boolean;
  message: string;
  data?: any;
}

// ==================== User Search Response ====================

export interface UserSearchResult {
  id: number;
  username: string;
  email: string;
  role: string;
}

export interface UserSearchResponse {
  success: boolean;
  message: string;
  data?: UserSearchResult[];
}

// ==================== Context Types ====================

export interface GroupContextType {
  // State
  groups: Group[];
  currentGroup: GroupDetail | null;
  groupMembers: GroupMember[];
  searchResults: Group[];
  userSearchResults: UserSearchResult[];
  loading: boolean;
  isFetchingGroups: boolean;
  isCreatingGroup: boolean;
  isFetchingGroupDetails: boolean;
  isSearchingGroups: boolean;
  isAddingMembers: boolean;
  isChangingMemberRole: boolean;
  isRemovingMember: boolean;
  isUpdatingGroup: boolean;
  isDeletingGroup: boolean;
  isJoiningGroup: boolean;
  isSearchingUsers: boolean;
  error: string | null;

  // Methods
  createGroup: (data: CreateGroupRequest) => Promise<Group>;
  getGroups: () => Promise<void>;
  getGroupDetails: (groupId: number) => Promise<void>;
  searchPublicGroups: (searchName: string) => Promise<void>;
  addMembers: (groupId: number, userIds: number[]) => Promise<void>;
  changeMemberRole: (groupId: number, userId: number, role: 'admin' | 'member') => Promise<void>;
  removeMember: (groupId: number, userId: number) => Promise<void>;
  updateGroup: (groupId: number, data: UpdateGroupRequest) => Promise<void>;
  deleteGroup: (groupId: number) => Promise<void>;
  joinGroup: (groupId: number) => Promise<void>;
  searchUsers: (username: string, excludeGroupId?: number) => Promise<void>;
  clearError: () => void;
  clearCurrentGroup: () => void;
  clearSearchResults: () => void;
  clearUserSearchResults: () => void;
}

// ==================== Permission Helper Types ====================

export interface UserGroupRole {
  groupId: number;
  userId: number;
  role: 'owner' | 'admin' | 'member' | null;
}

export interface GroupPermissions {
  canEditGroup: boolean;
  canDeleteGroup: boolean;
  canAddMembers: boolean;
  canRemoveMembers: boolean;
  canChangeRoles: boolean;
  canLeaveGroup: boolean;
  canViewMembers: boolean;
}
