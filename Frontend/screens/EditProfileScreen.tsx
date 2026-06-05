import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from '@react-native-documents/picker';
import { authService, AvatarUploadFile } from '../services/authService';
import { useAuth } from '../contexts/AuthContext';
import AvatarIcon from '../assets/icons/group_screen/avatar_2.svg';
import CameraIcon from '../assets/icons/camera.svg';
import OpenEyeIcon from '../assets/icons/open_eye.svg';
import CloseEyeIcon from '../assets/icons/close_eye.svg';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));
const IS_COMPACT_HEIGHT = SCREEN_HEIGHT < 720;
const PAGE_PADDING = clamp(SCREEN_WIDTH * 0.045, 16, 22);
const AVATAR_SIZE = clamp(
  Math.min(SCREEN_WIDTH * 0.28, SCREEN_HEIGHT * 0.15),
  IS_COMPACT_HEIGHT ? 88 : 96,
  124
);
const AVATAR_PANEL_HEIGHT = clamp(SCREEN_HEIGHT * 0.23, 164, 208);
const FIELD_ROW_HEIGHT = clamp(SCREEN_HEIGHT * 0.075, 58, 70);
const FIELD_ICON_SIZE = clamp(SCREEN_WIDTH * 0.11, 40, 48);
const CAMERA_BUTTON_SIZE = clamp(SCREEN_WIDTH * 0.105, 40, 48);
const CAMERA_ICON_SIZE = clamp(CAMERA_BUTTON_SIZE * 0.45, 18, 22);
const EYE_ICON_SIZE = clamp(SCREEN_WIDTH * 0.055, 20, 23);
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_PATTERN = /^(?=.*[A-Z])(?=.*\d).{6,}$/;

type PasswordStep = 'closed' | 'current' | 'verified';

function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const { user, accessToken, refreshUser } = useAuth();

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStep, setPasswordStep] = useState<PasswordStep>('closed');
  const [avatarFile, setAvatarFile] = useState<AvatarUploadFile | null>(null);
  const [loading, setLoading] = useState(false);
  const [verifyingPassword, setVerifyingPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [secureCurrent, setSecureCurrent] = useState(true);
  const [secureNew, setSecureNew] = useState(true);
  const [secureConfirm, setSecureConfirm] = useState(true);

  const avatarUri = avatarFile?.uri || user?.avatar_url || null;
  const emailChanged = email.trim().toLowerCase() !== (user?.email || '').toLowerCase();
  const hasPasswordChange = passwordStep === 'verified' && newPassword.length > 0;

  const canSave = useMemo(() => {
    return !loading && !!username.trim() && !!email.trim();
  }, [email, loading, username]);

  const pickAvatar = async () => {
    try {
      setError(null);
      const result = await DocumentPicker.pick({
        type: ['image/*'],
        presentationStyle: 'fullScreen',
      });

      const file = result[0];
      if (!file) {
        return;
      }

      if (file.type && !file.type.startsWith('image/')) {
        setError('Please choose a valid image file.');
        return;
      }

      setAvatarFile({
        uri: file.uri,
        name: file.name || `avatar_${Date.now()}.jpg`,
        type: file.type || 'image/jpeg',
      });
      setSuccess(null);
    } catch (pickError: any) {
      if (pickError?.code !== 'DOCUMENT_PICKER_CANCELLED') {
        setError('Cannot pick image. Please try again.');
      }
    }
  };

  const validateForm = () => {
    const nextUsername = username.trim();
    const nextEmail = email.trim().toLowerCase();

    if (!nextUsername) {
      return 'Username is required.';
    }

    if (!EMAIL_PATTERN.test(nextEmail)) {
      return 'Please enter a valid email address.';
    }

    if (emailChanged && !currentPassword.trim()) {
      return 'Current password is required to change email.';
    }

    if (passwordStep === 'current') {
      return 'Please verify your current password before setting a new password.';
    }

    if (hasPasswordChange) {
      if (!PASSWORD_PATTERN.test(newPassword)) {
        return 'New password must be 6+ chars with uppercase and number.';
      }

      if (newPassword !== confirmPassword) {
        return 'Confirm password does not match.';
      }
    }

    return null;
  };

  const verifyPassword = async () => {
    if (!accessToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    if (!currentPassword.trim()) {
      setError('Current password is required.');
      return;
    }

    try {
      setVerifyingPassword(true);
      setError(null);
      await authService.verifyCurrentPassword(accessToken, currentPassword);
      setPasswordStep('verified');
      setSuccess('Password verified. You can set a new password now.');
    } catch (verifyError) {
      setError(
        verifyError instanceof Error
          ? verifyError.message
          : 'Current password is incorrect.'
      );
    } finally {
      setVerifyingPassword(false);
    }
  };

  const saveProfile = async () => {
    if (!accessToken) {
      setError('Session expired. Please sign in again.');
      return;
    }

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setSuccess(null);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      await authService.updateProfile(accessToken, {
        username: username.trim(),
        email: email.trim().toLowerCase(),
        current_password: emailChanged || hasPasswordChange ? currentPassword : undefined,
        new_password: hasPasswordChange ? newPassword : undefined,
      });

      if (avatarFile) {
        await authService.uploadAvatar(accessToken, avatarFile);
      }

      await refreshUser();
      setSuccess('Profile updated successfully.');
      Alert.alert('Success', 'Profile updated successfully.', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
          activeOpacity={0.75}
        >
          <Text style={styles.backIcon}>{'<'}</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.avatarPanel}>
          <View style={styles.avatarFrame}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
            ) : (
              <AvatarIcon width={AVATAR_SIZE * 0.58} height={AVATAR_SIZE * 0.66} />
            )}
            <TouchableOpacity
              style={styles.cameraButton}
              onPress={pickAvatar}
              activeOpacity={0.82}
            >
              <CameraIcon width={CAMERA_ICON_SIZE} height={CAMERA_ICON_SIZE} />
            </TouchableOpacity>
          </View>
          <Text style={styles.changeAvatarText}>Change avatar</Text>
        </View>

        <SectionTitle title="Account information" />
        <View style={styles.card}>
          <FieldRow
            icon="user"
            label="Username"
            value={username}
            onChangeText={setUsername}
            placeholder="Enter username"
          />
          <View style={styles.divider} />
          <FieldRow
            icon="email"
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="Enter email"
            keyboardType="email-address"
            autoCapitalize="none"
          />
          {emailChanged && (
            <>
              <View style={styles.divider} />
              <PasswordInput
                label="Current password"
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Required for email change"
                secure={secureCurrent}
                onToggleSecure={() => setSecureCurrent((value) => !value)}
              />
            </>
          )}
        </View>

        <SectionTitle title="Security" />
        <View style={styles.card}>
          {passwordStep === 'closed' ? (
            <TouchableOpacity
              style={styles.changePasswordRow}
              onPress={() => {
                setPasswordStep('current');
                setSuccess(null);
                setError(null);
              }}
              activeOpacity={0.78}
            >
              <View style={styles.fieldIconBox}>
                <Text style={styles.lockIcon}>L</Text>
              </View>
              <View style={styles.fieldBody}>
                <Text style={styles.fieldLabel}>Password</Text>
                <Text style={styles.passwordDots}>********</Text>
              </View>
              <Text style={styles.changeText}>Change {'>'}</Text>
            </TouchableOpacity>
          ) : (
            <PasswordInput
              label="Current password"
              value={currentPassword}
              onChangeText={setCurrentPassword}
              placeholder="Enter current password"
              secure={secureCurrent}
              onToggleSecure={() => setSecureCurrent((value) => !value)}
              rightAction={
                passwordStep === 'current' ? (
                  <TouchableOpacity
                    style={styles.verifyButton}
                    onPress={verifyPassword}
                    disabled={verifyingPassword}
                    activeOpacity={0.78}
                  >
                    {verifyingPassword ? (
                      <ActivityIndicator size="small" color="#2C4936" />
                    ) : (
                      <Text style={styles.verifyText}>Verify</Text>
                    )}
                  </TouchableOpacity>
                ) : (
                  <Text style={styles.verifiedText}>Verified</Text>
                )
              }
            />
          )}

          {passwordStep === 'verified' && (
            <>
              <View style={styles.divider} />
              <PasswordInput
                label="New password"
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                secure={secureNew}
                onToggleSecure={() => setSecureNew((value) => !value)}
              />
              <View style={styles.divider} />
              <PasswordInput
                label="Confirm new password"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                secure={secureConfirm}
                onToggleSecure={() => setSecureConfirm((value) => !value)}
              />
            </>
          )}
        </View>

        {!!error && <Text style={styles.errorText}>{error}</Text>}
        {!!success && <Text style={styles.successText}>{success}</Text>}

        <TouchableOpacity
          style={[styles.saveButton, !canSave && styles.buttonDisabled]}
          onPress={saveProfile}
          disabled={!canSave}
          activeOpacity={0.82}
        >
          {loading ? (
            <ActivityIndicator color="#17442C" size="small" />
          ) : (
            <Text style={styles.saveButtonText}>Save changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => navigation.goBack()}
          disabled={loading}
          activeOpacity={0.78}
        >
          <Text style={styles.cancelButtonText}>Cancel</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SectionTitle({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function FieldRow({
  icon,
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
  autoCapitalize = 'sentences',
}: {
  icon: 'user' | 'email';
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  keyboardType?: 'default' | 'email-address';
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIconBox}>
        <Text style={styles.fieldIcon}>{icon === 'email' ? '@' : 'U'}</Text>
      </View>
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8C9A8E"
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          underlineColorAndroid="transparent"
          selectionColor="#5F8A68"
        />
      </View>
      <Text style={styles.editGlyph}>edit</Text>
    </View>
  );
}

function PasswordInput({
  label,
  value,
  onChangeText,
  placeholder,
  secure,
  onToggleSecure,
  rightAction,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  secure: boolean;
  onToggleSecure: () => void;
  rightAction?: React.ReactNode;
}) {
  return (
    <View style={styles.fieldRow}>
      <View style={styles.fieldIconBox}>
        <Text style={styles.lockIcon}>L</Text>
      </View>
      <View style={styles.fieldBody}>
        <Text style={styles.fieldLabel}>{label}</Text>
        <TextInput
          style={styles.fieldInput}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor="#8C9A8E"
          secureTextEntry={secure}
          autoCapitalize="none"
          underlineColorAndroid="transparent"
          selectionColor="#5F8A68"
        />
      </View>
      {rightAction || (
        <TouchableOpacity style={styles.eyeButton} onPress={onToggleSecure} activeOpacity={0.75}>
          {secure ? (
            <CloseEyeIcon width={EYE_ICON_SIZE} height={EYE_ICON_SIZE} />
          ) : (
            <OpenEyeIcon width={EYE_ICON_SIZE} height={EYE_ICON_SIZE} />
          )}
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EDF4E5',
  },
  header: {
    minHeight: IS_COMPACT_HEIGHT ? 50 : 56,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: PAGE_PADDING,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
  },
  backIcon: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
    color: '#17442C',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: clamp(SCREEN_WIDTH * 0.058, 20, 24),
    lineHeight: clamp(SCREEN_WIDTH * 0.07, 25, 30),
    fontWeight: '800',
    color: '#17442C',
  },
  headerSpacer: {
    width: 36,
  },
  content: {
    paddingHorizontal: PAGE_PADDING,
    paddingTop: IS_COMPACT_HEIGHT ? 8 : 12,
  },
  avatarPanel: {
    minHeight: AVATAR_PANEL_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 18,
    backgroundColor: '#C6D6C1',
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.16,
    shadowRadius: 9,
    elevation: 5,
  },
  avatarFrame: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#CFE2B5',
    borderWidth: 3,
    borderColor: '#17442C',
  },
  avatarImage: {
    width: '100%',
    height: '100%',
    borderRadius: AVATAR_SIZE / 2,
  },
  cameraButton: {
    position: 'absolute',
    right: -6,
    bottom: 8,
    width: CAMERA_BUTTON_SIZE,
    height: CAMERA_BUTTON_SIZE,
    borderRadius: CAMERA_BUTTON_SIZE / 2,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#6E8B72',
    borderWidth: 3,
    borderColor: '#FFFFFF',
  },
  changeAvatarText: {
    marginTop: IS_COMPACT_HEIGHT ? 10 : 14,
    fontSize: clamp(SCREEN_WIDTH * 0.045, 16, 18),
    lineHeight: clamp(SCREEN_WIDTH * 0.058, 21, 24),
    fontWeight: '800',
    color: '#17442C',
  },
  sectionTitle: {
    marginTop: IS_COMPACT_HEIGHT ? 18 : 24,
    marginBottom: 10,
    fontSize: clamp(SCREEN_WIDTH * 0.05, 18, 21),
    lineHeight: clamp(SCREEN_WIDTH * 0.064, 23, 27),
    fontWeight: '800',
    color: '#17442C',
  },
  card: {
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.74)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(197, 212, 188, 0.55)',
    paddingHorizontal: clamp(SCREEN_WIDTH * 0.035, 12, 15),
    paddingVertical: IS_COMPACT_HEIGHT ? 4 : 6,
    shadowOpacity: 0,
    elevation: 0,
  },
  fieldRow: {
    minHeight: FIELD_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  fieldIconBox: {
    width: FIELD_ICON_SIZE,
    height: FIELD_ICON_SIZE,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#E0EBD4',
    marginRight: 12,
  },
  fieldIcon: {
    fontSize: clamp(FIELD_ICON_SIZE * 0.42, 17, 21),
    lineHeight: clamp(FIELD_ICON_SIZE * 0.52, 22, 26),
    color: '#17442C',
  },
  lockIcon: {
    fontSize: clamp(FIELD_ICON_SIZE * 0.38, 16, 19),
    lineHeight: clamp(FIELD_ICON_SIZE * 0.52, 22, 26),
    fontWeight: '800',
    color: '#17442C',
  },
  fieldBody: {
    flex: 1,
    minWidth: 0,
  },
  fieldLabel: {
    fontSize: clamp(SCREEN_WIDTH * 0.035, 13, 15),
    lineHeight: clamp(SCREEN_WIDTH * 0.047, 18, 21),
    fontWeight: '500',
    color: '#2C4936',
  },
  fieldInput: {
    minHeight: 28,
    paddingVertical: 0,
    fontSize: clamp(SCREEN_WIDTH * 0.042, 15, 17),
    lineHeight: clamp(SCREEN_WIDTH * 0.054, 20, 23),
    fontWeight: '700',
    color: '#17442C',
  },
  editGlyph: {
    width: 32,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '800',
    color: '#617765',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(197, 212, 188, 0.58)',
  },
  changePasswordRow: {
    minHeight: FIELD_ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
  },
  passwordDots: {
    marginTop: 2,
    fontSize: clamp(SCREEN_WIDTH * 0.041, 15, 17),
    lineHeight: clamp(SCREEN_WIDTH * 0.052, 20, 23),
    letterSpacing: 0,
    color: '#17442C',
  },
  changeText: {
    fontSize: clamp(SCREEN_WIDTH * 0.039, 14, 16),
    lineHeight: clamp(SCREEN_WIDTH * 0.052, 19, 22),
    fontWeight: '700',
    color: '#2C4936',
  },
  eyeButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  verifyButton: {
    minWidth: 60,
    height: 30,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 15,
    backgroundColor: '#C8DEC9',
  },
  verifyText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#2C4936',
  },
  verifiedText: {
    fontSize: 12,
    fontWeight: '800',
    color: '#5F8A68',
  },
  errorText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#A23A34',
    textAlign: 'center',
  },
  successText: {
    marginTop: 12,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '700',
    color: '#3E7448',
    textAlign: 'center',
  },
  saveButton: {
    height: clamp(SCREEN_HEIGHT * 0.058, 46, 54),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 27,
    backgroundColor: '#A7BEA9',
    marginTop: IS_COMPACT_HEIGHT ? 18 : 24,
    shadowColor: '#1B2F22',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.16,
    shadowRadius: 7,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: clamp(SCREEN_WIDTH * 0.045, 16, 18),
    lineHeight: clamp(SCREEN_WIDTH * 0.058, 21, 24),
    fontWeight: '800',
    color: '#17442C',
  },
  cancelButton: {
    height: clamp(SCREEN_HEIGHT * 0.054, 44, 50),
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#C5D4BC',
    marginTop: 12,
    backgroundColor: 'rgba(255,255,255,0.42)',
  },
  cancelButtonText: {
    fontSize: clamp(SCREEN_WIDTH * 0.04, 15, 17),
    lineHeight: clamp(SCREEN_WIDTH * 0.052, 20, 22),
    fontWeight: '800',
    color: '#17442C',
  },
  buttonDisabled: {
    opacity: 0.62,
  },
});

export default EditProfileScreen;
