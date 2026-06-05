import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'https://api.mealsretrieval.site';

const STORAGE_KEYS = {
  ACCESS_TOKEN: '@study_helper_access_token',
  REFRESH_TOKEN: '@study_helper_refresh_token',
  USER_DATA: '@study_helper_user_data',
};

function decodeBase64Url(input: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  let str = input.replace(/-/g, '+').replace(/_/g, '/');
  while (str.length % 4) {
    str += '=';
  }

  let output = '';
  let buffer = 0;
  let bits = 0;

  for (let i = 0; i < str.length; i++) {
    const value = chars.indexOf(str[i]);
    if (value < 0 || str[i] === '=') {
      continue;
    }
    buffer = (buffer << 6) | value;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      output += String.fromCharCode((buffer >> bits) & 0xff);
    }
  }

  try {
    return decodeURIComponent(
      output
        .split('')
        .map(char => `%${(`00${char.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join('')
    );
  } catch {
    return output;
  }
}

function getJwtExpiration(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) {
      return null;
    }
    const decoded = JSON.parse(decodeBase64Url(payload));
    return typeof decoded.exp === 'number' ? decoded.exp : null;
  } catch (error) {
    console.error('Error decoding token expiration:', error);
    return null;
  }
}

class StorageService {
  private refreshPromise: Promise<string | null> | null = null;

  /**
   * Lưu access token
   */
  async saveAccessToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, token);
    } catch (error) {
      console.error('Error saving access token:', error);
      throw error;
    }
  }

  /**
   * Lấy access token
   */
  async getAccessToken(): Promise<string | null> {
    try {
      const accessToken = await AsyncStorage.getItem(STORAGE_KEYS.ACCESS_TOKEN);

      if (!accessToken) {
        return null;
      }

      const exp = getJwtExpiration(accessToken);
      const now = Math.floor(Date.now() / 1000);
      const refreshSkewSeconds = 60;

      if (exp && exp - now > refreshSkewSeconds) {
        return accessToken;
      }

      return await this.refreshAccessToken();
    } catch (error) {
      console.error('Error getting access token:', error);
      return null;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) {
      return this.refreshPromise;
    }

    this.refreshPromise = (async () => {
      try {
        const refreshToken = await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);

        if (!refreshToken) {
          return null;
        }

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

        if (!response.ok || !data.success || !data.data?.access_token) {
          console.error('Token refresh failed:', data.detail || data.message);
          await this.clearAuthData();
          return null;
        }

        await AsyncStorage.setItem(STORAGE_KEYS.ACCESS_TOKEN, data.data.access_token);
        if (data.data.refresh_token) {
          await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, data.data.refresh_token);
        }

        return data.data.access_token;
      } catch (error) {
        console.error('Error refreshing access token:', error);
        return null;
      } finally {
        this.refreshPromise = null;
      }
    })();

    return this.refreshPromise;
  }

  /**
   * Lưu refresh token
   */
  async saveRefreshToken(token: string): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
    } catch (error) {
      console.error('Error saving refresh token:', error);
      throw error;
    }
  }

  /**
   * Lấy refresh token
   */
  async getRefreshToken(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('Error getting refresh token:', error);
      return null;
    }
  }

  /**
   * Lưu user data
   */
  async saveUserData(userData: any): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.USER_DATA, JSON.stringify(userData));
    } catch (error) {
      console.error('Error saving user data:', error);
      throw error;
    }
  }

  /**
   * Lấy user data
   */
  async getUserData(): Promise<any | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.USER_DATA);
      return data ? JSON.parse(data) : null;
    } catch (error) {
      console.error('Error getting user data:', error);
      return null;
    }
  }

  /**
   * Xóa tất cả auth data (logout)
   */
  async clearAuthData(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);
    } catch (error) {
      console.error('Error clearing auth data:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả auth data
   */
  async getAllAuthData(): Promise<{
    accessToken: string | null;
    refreshToken: string | null;
    userData: any | null;
  }> {
    try {
      const [accessToken, refreshToken, userData] = await AsyncStorage.multiGet([
        STORAGE_KEYS.ACCESS_TOKEN,
        STORAGE_KEYS.REFRESH_TOKEN,
        STORAGE_KEYS.USER_DATA,
      ]);

      return {
        accessToken: accessToken[1],
        refreshToken: refreshToken[1],
        userData: userData[1] ? JSON.parse(userData[1]) : null,
      };
    } catch (error) {
      console.error('Error getting all auth data:', error);
      return {
        accessToken: null,
        refreshToken: null,
        userData: null,
      };
    }
  }
}

export const storageService = new StorageService();
