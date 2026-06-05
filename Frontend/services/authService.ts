// API Configuration
const API_URL = 'https://api.mealsretrieval.site';

export interface SignUpRequest {
  username: string;
  email: string;
  password: string;
  role: string;  // teacher, student
}

export interface SignInRequest {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface UserResponse {
  id: number;
  username: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  documents_count: number;
  flashcards_count: number;
  groups_count: number;
  current_streak: number;
  created_at: string;
}

export interface SignUpResponse {
  success: boolean;
  message: string;
  data?: UserResponse;
}

export interface SignInResponse {
  success: boolean;
  message: string;
  data?: {
    user: UserResponse;
    tokens: TokenResponse;
  };
}

export interface RefreshTokenRequest {
  refresh_token: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  message: string;
  data?: TokenResponse;
}

export interface LogoutResponse {
  success: boolean;
  message: string;
}

export interface CurrentUserResponse {
  success: boolean;
  message: string;
  data: UserResponse;
}

export interface UpdateProfileRequest {
  username?: string;
  email?: string;
  current_password?: string;
  new_password?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data: UserResponse;
}

export interface VerifyPasswordResponse {
  success: boolean;
  message: string;
}

export interface AvatarUploadFile {
  uri: string;
  name: string;
  type: string;
}

class AuthService {
  /**
   * Sign Up - Tạo tài khoản mới
   * Constraints:
   * - username: 3-20 chars, only a-z, A-Z, 0-9, _
   * - email: must be @gmail.com
   * - password: min 6 chars, must have 1 uppercase + 1 number
   * - role: teacher or student
   */
  async signUp(request: SignUpRequest): Promise<SignUpResponse> {
    try {
      const response = await fetch(`${API_URL}/api/auth/signup`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          username: request.username,
          email: request.email,
          password: request.password,
          role: request.role,
        }),
      });

      const contentType = response.headers.get('content-type');
      
      // Check if response is JSON
      if (!contentType || !contentType.includes('application/json')) {
        const textData = await response.text();
        throw new Error(`Server error: ${response.status} - ${textData}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Sign up failed');
      }

      return data;
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    }
  }

  /**
   * Sign In - Đăng nhập
   * Note: Sign In uses EMAIL, not username
   */
  async signIn(request: SignInRequest): Promise<SignInResponse> {
    try {
      const response = await fetch(`${API_URL}/api/auth/signin`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: request.email,
          password: request.password,
        }),
      });

      const contentType = response.headers.get('content-type');
      
      if (!contentType || !contentType.includes('application/json')) {
        const textData = await response.text();
        throw new Error(`Server error: ${response.status} - ${textData}`);
      }

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Sign in failed');
      }

      return data;
    } catch (error) {
      console.error('Sign in error:', error);
      throw error;
    }
  }

  /**
   * Refresh Token - Cấp access token mới
   */
  async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      const response = await fetch(`${API_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Token refresh failed');
      }

      return data;
    } catch (error) {
      throw error;
    }
  }

  /**
   * Logout - Đăng xuất
   * Notifies backend about logout
   */
  async logout(refreshToken: string): Promise<LogoutResponse> {
    try {
      const response = await fetch(`${API_URL}/api/auth/signout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          refresh_token: refreshToken,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || data.message || 'Logout failed');
      }

      return data;
    } catch (error) {
      // Even if backend logout fails, we should clear local data
      // So we don't throw the error, just log it
      console.error('Backend logout error:', error);
      return {
        success: true,
        message: 'Logged out locally',
      };
    }
  }

  /**
   * Health Check - Kiểm tra API availability
   */
  async getCurrentUser(accessToken: string): Promise<UserResponse> {
    try {
      const response = await fetch(`${API_URL}/api/auth/me?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: CurrentUserResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to fetch current user');
      }

      return data.data;
    } catch (error) {
      console.error('Get current user error:', error);
      throw error;
    }
  }

  async verifyCurrentPassword(
    accessToken: string,
    currentPassword: string
  ): Promise<VerifyPasswordResponse> {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/me/verify-password?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            current_password: currentPassword,
          }),
        }
      );

      const data: VerifyPasswordResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Current password is incorrect');
      }

      return data;
    } catch (error) {
      console.error('Verify password error:', error);
      throw error;
    }
  }

  async updateProfile(
    accessToken: string,
    request: UpdateProfileRequest
  ): Promise<UserResponse> {
    try {
      const response = await fetch(
        `${API_URL}/api/auth/me/profile?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${accessToken}`,
          },
          body: JSON.stringify(request),
        }
      );

      const data: UpdateProfileResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to update profile');
      }

      return data.data;
    } catch (error) {
      console.error('Update profile error:', error);
      throw error;
    }
  }

  async uploadAvatar(
    accessToken: string,
    file: AvatarUploadFile
  ): Promise<UserResponse> {
    try {
      const formData = new FormData();
      formData.append('avatar', file as any);

      const response = await fetch(
        `${API_URL}/api/auth/me/avatar?access_token=${encodeURIComponent(accessToken)}`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
          body: formData,
        }
      );

      const data: UpdateProfileResponse = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Failed to upload avatar');
      }

      return data.data;
    } catch (error) {
      console.error('Upload avatar error:', error);
      throw error;
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      const response = await fetch(`${API_URL}/health`);
      return response.ok;
    } catch (error) {
      console.error('Health check failed:', error);
      return false;
    }
  }
}

export const authService = new AuthService();
