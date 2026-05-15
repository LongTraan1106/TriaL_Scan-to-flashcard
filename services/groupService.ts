/**
 * Group Service
 * Xử lý tất cả API calls liên quan đến group management
 */

import { storageService } from '../utils/storageService';
import {
  Group,
  GroupDetail,
  GroupCreateResponse,
  GroupDetailResponse,
  GroupListResponse,
  BasicResponse,
  UserSearchResponse,
  CreateGroupRequest,
  UpdateGroupRequest,
  UserSearchResult,
} from '../types/group';

const API_URL = 'https://api.mealsretrieval.site';

class GroupService {
  /**
   * Create new group (teacher only)
   */
  async createGroup(data: CreateGroupRequest): Promise<Group> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/create?user_id=${userData.id}&user_role=${userData.role}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            name: data.name,
            description: data.description,
            is_public: data.is_public,
            avatar_key: data.avatar_key || 'avatar_1',
            max_members: data.max_members || 25,
          }),
        }
      );

      const responseData: GroupCreateResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to create group');
      }

      if (!responseData.data) {
        throw new Error('No data returned from server');
      }

      return responseData.data;
    } catch (error) {
      console.error('Create group error:', error);
      throw error;
    }
  }

  /**
   * Get all groups of current user
   */
  async getGroups(): Promise<Group[]> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups?user_id=${userData.id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const responseData: GroupListResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to fetch groups');
      }

      return responseData.data || [];
    } catch (error) {
      console.error('Get groups error:', error);
      throw error;
    }
  }

  /**
   * Search public groups by name
   */
  async searchPublicGroups(searchName: string): Promise<Group[]> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/search/public?search_name=${encodeURIComponent(searchName)}&user_id=${userData.id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const responseData: GroupListResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to search groups');
      }

      return responseData.data || [];
    } catch (error) {
      console.error('Search groups error:', error);
      throw error;
    }
  }

  /**
   * Get group details with members
   */
  async getGroupDetails(groupId: number): Promise<GroupDetail> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}?user_id=${userData.id}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const responseData: GroupDetailResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to fetch group details');
      }

      if (!responseData.data) {
        throw new Error('No data returned from server');
      }

      return responseData.data;
    } catch (error) {
      console.error('Get group details error:', error);
      throw error;
    }
  }

  /**
   * Add members to group (owner only)
   */
  async addMembers(groupId: number, userIds: number[]): Promise<GroupDetail> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/members?user_id=${userData.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            user_ids: userIds,
          }),
        }
      );

      const responseData: GroupDetailResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to add members');
      }

      if (!responseData.data) {
        throw new Error('No data returned from server');
      }

      return responseData.data;
    } catch (error) {
      console.error('Add members error:', error);
      throw error;
    }
  }

  /**
   * Change member role (owner only)
   */
  async changeMemberRole(
    groupId: number,
    userId: number,
    memberRole: 'admin' | 'member'
  ): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/members/${userId}/role?user_id=${userData.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            member_role: memberRole,
          }),
        }
      );

      const responseData: BasicResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to change member role');
      }
    } catch (error) {
      console.error('Change member role error:', error);
      throw error;
    }
  }

  /**
   * Remove member from group or leave group
   */
  async removeMember(groupId: number, userId: number): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/members/${userId}?user_id=${userData.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const responseData: BasicResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to remove member');
      }
    } catch (error) {
      console.error('Remove member error:', error);
      throw error;
    }
  }

  /**
   * Update group info (owner only)
   */
  async updateGroup(groupId: number, data: UpdateGroupRequest): Promise<Group> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}?user_id=${userData.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(data),
        }
      );

      const responseData: GroupCreateResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to update group');
      }

      if (!responseData.data) {
        throw new Error('No data returned from server');
      }

      return responseData.data;
    } catch (error) {
      console.error('Update group error:', error);
      throw error;
    }
  }

  /**
   * Delete group (owner only)
   */
  async deleteGroup(groupId: number): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}?user_id=${userData.id}`,
        {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const responseData: BasicResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to delete group');
      }
    } catch (error) {
      console.error('Delete group error:', error);
      throw error;
    }
  }

  /**
   * Search users by username
   */
  async searchUsers(username: string, excludeGroupId?: number): Promise<UserSearchResult[]> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      let url = `${API_URL}/api/groups/users/search?username=${encodeURIComponent(username)}`;
      if (excludeGroupId) {
        url += `&exclude_group_id=${excludeGroupId}`;
      }

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
      });

      const responseData: UserSearchResponse = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to search users');
      }

      return responseData.data || [];
    } catch (error) {
      console.error('Search users error:', error);
      throw error;
    }
  }

  /**
   * Join a public group (user adds themselves)
   */
  async joinGroup(groupId: number): Promise<Group> {
    try {
      const accessToken = await storageService.getAccessToken();
      const userData = await storageService.getUserData();

      if (!accessToken || !userData) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(
        `${API_URL}/api/groups/${groupId}/join?user_id=${userData.id}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const responseData: any = await response.json();

      if (!response.ok) {
        throw new Error(responseData.message || 'Failed to join group');
      }

      return responseData.data;
    } catch (error) {
      console.error('Join group error:', error);
      throw error;
    }
  }
}

export const groupService = new GroupService();
