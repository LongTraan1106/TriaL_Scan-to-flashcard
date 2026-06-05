import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  ImageBackground,
} from 'react-native';
import { Dropdown } from 'react-native-element-dropdown';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import OpenEyeIcon from '../assets/icons/open_eye.svg';
import CloseEyeIcon from '../assets/icons/close_eye.svg';

const { width, height } = Dimensions.get('window');

const roleData = [
  { label: 'Student', value: 'student' },
  { label: 'Teacher', value: 'teacher' },
];

const getGmailAddress = (localPart: string) =>
  `${localPart.trim().replace(/@gmail\.com$/i, '').split('@')[0]}@gmail.com`;

const getPasswordRules = (value: string) => [
  {
    key: 'length',
    label: 'At least 6 characters',
    valid: value.length >= 6,
  },
  {
    key: 'uppercase',
    label: 'One uppercase letter',
    valid: /[A-Z]/.test(value),
  },
  {
    key: 'number',
    label: 'One number',
    valid: /[0-9]/.test(value),
  },
];

function SignUpScreen() {
  const navigation = useNavigation<any>();
  const { signUp, loading, error, clearError } = useAuth();

  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: '',
  });
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  // Clear error when user starts typing
  useEffect(() => {
    if (error) {
      clearError();
    }
    // Clear only after the user edits a field, not immediately when auth error appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [username, email, password, confirmPassword, role]);

  const validateEmail = (emailLocalPart: string) => {
    const emailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return emailRegex.test(getGmailAddress(emailLocalPart));
  };

  const validateUsername = (usernameValue: string) => {
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    return usernameRegex.test(usernameValue);
  };

  const validatePassword = (passwordValue: string) => {
    // Min 6 chars, must have uppercase and number
    if (passwordValue.length < 6) return false;
    if (!/[A-Z]/.test(passwordValue)) return false;
    if (!/[0-9]/.test(passwordValue)) return false;
    return true;
  };

  const getUsernameError = (value: string) => {
    const nextUsername = value.trim();
    if (!nextUsername) return '';
    if (nextUsername.length < 3) return 'Username must be at least 3 characters';
    if (nextUsername.length > 20) return 'Username must not exceed 20 characters';
    if (!validateUsername(nextUsername)) {
      return 'Username can only contain letters, numbers, and underscore';
    }
    return '';
  };

  const getEmailError = (value: string) => {
    if (!value.trim()) return '';
    if (!validateEmail(value)) return 'Use letters, numbers, dot, underscore, percent, plus, or dash';
    return '';
  };

  const getPasswordError = (value: string) => {
    if (!value) return '';
    if (!validatePassword(value)) return 'Password does not meet all requirements';
    return '';
  };

  const getConfirmPasswordError = (value: string, nextPassword = password) => {
    if (!value) return '';
    if (value !== nextPassword) return 'Passwords do not match';
    return '';
  };

  const handleUsernameChange = (value: string) => {
    setUsername(value);
    setErrors(current => ({
      ...current,
      username: getUsernameError(value),
    }));
  };

  const handleEmailChange = (value: string) => {
    const sanitized = value.replace(/\s/g, '').replace(/@gmail\.com$/i, '').split('@')[0];
    setEmail(sanitized);
    setErrors(current => ({
      ...current,
      email: getEmailError(sanitized),
    }));
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setErrors(current => ({
      ...current,
      password: getPasswordError(value),
      confirmPassword: getConfirmPasswordError(confirmPassword, value),
    }));
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setErrors(current => ({
      ...current,
      confirmPassword: getConfirmPasswordError(value),
    }));
  };

  const validateInputs = (): boolean => {
    const newErrors = {
      username: '',
      email: '',
      password: '',
      confirmPassword: '',
      role: '',
    };

    if (!username.trim()) {
      newErrors.username = 'Username is required';
    } else if (username.trim().length < 3) {
      newErrors.username = 'Username must be at least 3 characters';
    } else if (username.trim().length > 20) {
      newErrors.username = 'Username must not exceed 20 characters';
    } else if (!validateUsername(username)) {
      newErrors.username = 'Username can only contain letters, numbers, and underscore';
    }

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(email)) {
      newErrors.email = 'Please enter a valid Gmail username';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    } else if (!validatePassword(password)) {
      newErrors.password = 'Password must be 6+ chars with uppercase and number';
    }

    if (!confirmPassword.trim()) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (password !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (!role || (role !== 'teacher' && role !== 'student')) {
      newErrors.role = 'Please select a valid role';
    }

    setErrors(newErrors);
    return (
      !newErrors.username &&
      !newErrors.email &&
      !newErrors.password &&
      !newErrors.confirmPassword &&
      !newErrors.role
    );
  };

  const handleSignUp = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      await signUp({
        username: username.trim(),
        email: getGmailAddress(email),
        password: password,
        role: role,
      });
      // Show success modal
      setShowSuccessModal(true);
    } catch (err) {
      // Error is already set in context
      Alert.alert(
        'Sign Up Failed',
        err instanceof Error ? err.message : 'An error occurred during sign up'
      );
    }
  };

  const handleNavigateToSignInAfterSuccess = () => {
    setShowSuccessModal(false);
    clearError();
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('student');
    setErrors({ username: '', email: '', password: '', confirmPassword: '', role: '' });
    navigation.replace('SignIn');
  };

  const handleNavigateToSignIn = () => {
    clearError();
    setUsername('');
    setEmail('');
    setPassword('');
    setConfirmPassword('');
    setRole('student');
    setErrors({ username: '', email: '', password: '', confirmPassword: '', role: '' });
    navigation.replace('SignIn');
  };

  const passwordRules = getPasswordRules(password);

  const renderRoleItem = (item: { label: string; value: string }) => {
    const selected = role === item.value;
    return (
      <View style={[styles.roleItem, selected && styles.roleItemSelected]}>
        <Text style={[styles.roleItemText, selected && styles.roleItemTextSelected]}>
          {item.label}
        </Text>
        {selected && <Text style={styles.roleItemCheck}>✓</Text>}
      </View>
    );
  };

  return (
    <>
      <KeyboardAwareScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        enableOnAndroid={true}
        enableAutomaticScroll={true}
        enableResetScrollToCoords={false}
        extraHeight={90}
        extraScrollHeight={60}
        keyboardShouldPersistTaps="handled"
      >
          {/* Top Section with Welcome Text */}
          <View style={styles.topSection}>
            {/* <Text style={styles.welcomeText}>WELCOME !</Text>  */}

            <View style={styles.iconContainer}>
              <Image
                source={require('../assets/Top_background.png')}
                style={styles.figImage}
              />
            </View>
          </View>
          <View style={styles.form_container}>
            {/* Sign Up Form Section */}
            <ImageBackground
              source={require('../assets/background_pattern.png')}
              resizeMode="repeat"
              style={styles.formSection}
            >
            <Text style={styles.formTitle}>SIGN UP</Text>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorAlert}>{error}</Text>
              </View>
            )}

            {/* Username Input */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, errors.username && styles.inputError]}
                placeholder="Username"
                placeholderTextColor="#3c433388"
                value={username}
                onChangeText={handleUsernameChange}
                editable={!loading}
                maxLength={20}
                underlineColorAndroid="transparent"
              />
              {errors.username && (
                <Text style={styles.errorText}>{errors.username}</Text>
              )}
            </View>

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <View style={[styles.gmailInputContainer, errors.email && styles.inputError]}>
                <TextInput
                  style={styles.gmailInput}
                  placeholder="Email address"
                  placeholderTextColor="#3c433388"
                  value={email}
                  onChangeText={handleEmailChange}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  editable={!loading}
                  underlineColorAndroid="transparent"
                />
                <Text style={styles.gmailSuffix}>@gmail.com</Text>
              </View>
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Role Selection Dropdown */}
            <View style={styles.inputWrapper}>
              <Dropdown
                style={[styles.dropdown, errors.role && styles.inputError]}
                placeholderStyle={styles.dropdownPlaceholder}
                selectedTextStyle={styles.dropdownSelectedText}
                inputSearchStyle={styles.dropdownInputSearch}
                iconStyle={styles.dropdownIcon}
                containerStyle={styles.dropdownContainer}
                itemContainerStyle={styles.dropdownItemContainer}
                itemTextStyle={styles.dropdownItemText}
                activeColor={styles.dropdownActiveColor.backgroundColor}
                data={roleData}
                search={false}
                maxHeight={150}
                labelField="label"
                valueField="value"
                placeholder="Select Role"
                value={role}
                onChange={(item) => {
                  setRole(item.value);
                  setErrors(current => ({ ...current, role: '' }));
                }}
                renderItem={renderRoleItem}
                disable={loading}
              />
              {errors.role && (
                <Text style={styles.errorText}>{errors.role}</Text>
              )}
            </View>

            {/* Password Input */}
            <View style={styles.inputWrapper}>
              <View style={[styles.passwordContainer, errors.password && styles.inputError]}>
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Password"
                  placeholderTextColor="#3c433388"
                  value={password}
                  onChangeText={handlePasswordChange}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  style={styles.eyeIcon}
                >
                  {showPassword ? (
                    <OpenEyeIcon width={20} height={20} />
                  ) : (
                    <CloseEyeIcon width={20} height={20} />
                  )}
                </TouchableOpacity>
              </View>
              <View style={styles.passwordRules}>
                {passwordRules.map(rule => (
                  <Text
                    key={rule.key}
                    style={[
                      styles.passwordRuleText,
                      rule.valid && styles.passwordRuleValid,
                    ]}
                  >
                    {rule.valid ? '✓' : '•'} {rule.label}
                  </Text>
                ))}
              </View>
              {errors.password && <Text style={styles.errorText}>{errors.password}</Text>}
            </View>

            {/* Confirm Password Input */}
            <View style={styles.inputWrapper}>
              <View
                style={[
                  styles.passwordContainer,
                  errors.confirmPassword && styles.inputError,
                ]}
              >
                <TextInput
                  style={styles.passwordInput}
                  placeholder="Confirm password"
                  placeholderTextColor="#3c433388"
                  value={confirmPassword}
                  onChangeText={handleConfirmPasswordChange}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                  underlineColorAndroid="transparent"
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                  style={styles.eyeIcon}
                >
                  {showConfirmPassword ? (
                    <OpenEyeIcon width={20} height={20} />
                  ) : (
                    <CloseEyeIcon width={20} height={20} />
                  )}
                </TouchableOpacity>
              </View>
              {errors.confirmPassword && (
                <Text style={styles.errorText}>{errors.confirmPassword}</Text>
              )}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, loading && styles.buttonDisabled]}
              onPress={handleSignUp}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Sign In Link */}
            <View style={styles.signInLinkContainer}>
              <Text style={styles.signInLinkText}>Already have an account ?, </Text>
              <TouchableOpacity
                onPress={handleNavigateToSignIn}
                disabled={loading}
              >
                <Text style={styles.signInLinkBold}>SIGN IN</Text>
              </TouchableOpacity>
              <Text style={styles.signInLinkText}> here.</Text>
            </View>
            </ImageBackground>
          </View>
        </KeyboardAwareScrollView>

      {/* Success Modal */}
      <Modal
        visible={showSuccessModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowSuccessModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.successIcon}>
              <Text style={styles.successIconText}>✓</Text>
            </View>
            <Text style={styles.modalTitle}>Sign Up Successful!</Text>
            <Text style={styles.modalMessage}>
              Your account has been created successfully.{"\n"}Please sign in to continue.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleNavigateToSignInAfterSuccess}
            >
              <Text style={styles.modalButtonText}>Go to Sign In</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#789265',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#789265',
  },
  topSection: {
    backgroundColor: '#FDF7DF',
    paddingTop: height * 0.06,
    // paddingBottom:58,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: height * 0.37,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: '700',
    color: '#2D5A3D',
    marginBottom: 20,
    paddingLeft: width * 0.4,
    letterSpacing: 1,
    
  },
  iconContainer: {
    width: 180,
    height: 130,
    justifyContent: 'center',
    alignItems: 'center',
    // paddingTop: height * 0.05,
  },
  figImage: {
    width: width * 1,
    height: height * 1,
    resizeMode: 'contain',
  },
  form_container: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: '#789265',
  },
  formSection: {
    backgroundColor: '#A9B9A8',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(233, 239, 225, 0.55)',
    paddingTop: 10,
    paddingBottom: 30,
    paddingHorizontal: 30,
    alignItems: 'center',
    minHeight: height * 0.63,
    overflow: 'hidden',
  },
  formTitle: {
    paddingTop: 20,
    fontSize: 28,
    fontWeight: '700',
    color: '#2D5A3D',
    // textAlign: 'center',
    marginBottom: 25,
    letterSpacing: 1,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginBottom: 20,
    borderLeftWidth: 4,
    borderLeftColor: '#E74C3C',
  },
  errorAlert: {
    color: '#C0392B',
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  inputWrapper: {
    marginBottom: 16,
  },
  input: {
    backgroundColor: '#E9EFE1',
    borderWidth: 1.3,
    borderColor: '#79876E',
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 18,
    fontSize: 15,
    color: '#344E39',
    fontFamily: 'System',
    width: width * 0.8,
  },
  gmailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9EFE1',
    borderWidth: 1.1,
    borderColor: '#79876E',
    borderRadius: 16,
    paddingLeft: 18,
    paddingRight: 12,
    width: width * 0.8,
    minHeight: 52,
  },
  gmailInput: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 0,
    fontSize: 15,
    color: '#344E39',
    fontFamily: 'System',
  },
  gmailSuffix: {
    marginLeft: 6,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
    color: '#5C735B',
  },
  dropdown: {
    backgroundColor: '#E9EFE1',
    borderWidth: 1.1,
    borderColor: '#79876E',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 12,
    width: width * 0.8,
    height: 52,
  },
  dropdownPlaceholder: {
    fontSize: 15,
    color: '#3c433388',
  },
  dropdownSelectedText: {
    fontSize: 15,
    color: '#344E39',
    fontWeight: '700',
  },
  dropdownInputSearch: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#79876E',
    paddingLeft: 12,
    color: '#344E39',
    fontSize: 14,
  },
  dropdownIcon: {
    tintColor: '#79876E',
  },
  dropdownContainer: {
    backgroundColor: '#F3F7EE',
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(121, 135, 110, 0.45)',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  dropdownItemContainer: {
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  dropdownItemText: {
    fontSize: 14,
    color: '#2D5A3D',
    fontWeight: '500',
  },
  dropdownActiveColor: {
    backgroundColor: '#DDE9D8',
  },
  roleItem: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(121, 135, 110, 0.22)',
  },
  roleItemSelected: {
    backgroundColor: '#DDE9D8',
  },
  roleItemText: {
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '600',
    color: '#2D5A3D',
  },
  roleItemTextSelected: {
    fontWeight: '800',
  },
  roleItemCheck: {
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '800',
    color: '#2D5A3D',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9EFE1',
    borderWidth: 1.1,
    borderColor: '#79876E',
    borderRadius: 16,
    paddingHorizontal: 18,
    width: width * 0.8,
  },
  passwordInput: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 15,
    color: '#79876E',
    fontFamily: 'System',
  },
  passwordRules: {
    width: width * 0.8,
    paddingHorizontal: 6,
    marginTop: 7,
    gap: 3,
  },
  passwordRuleText: {
    fontSize: 11,
    lineHeight: 15,
    fontWeight: '600',
    color: 'rgba(52, 78, 57, 0.64)',
  },
  passwordRuleValid: {
    color: '#2D5A3D',
  },
  eyeIcon: {
    // padding: 8,
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    color: '#C0392B',
    fontSize: 11,
    marginTop: 4,
    paddingHorizontal: 5,
    fontWeight: '500',
  },
  continueButton: {
    backgroundColor: '#697E63',
    color: '#BED2BC',
    width: width * 0.5,
    borderRadius: 24,
    paddingVertical: 14,
    marginTop: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  continueButtonText: {
    color: '#BED2BC',
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  signInLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 25,
    flexWrap: 'wrap',
  },
  signInLinkText: {
    fontSize: 14,
    color: '#2D5A3D',
    fontWeight: '400',
  },
  signInLinkBold: {
    fontSize: 14,
    color: '#2D5A3D',
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingVertical: 40,
    paddingHorizontal: 30,
    alignItems: 'center',
    width: width * 0.85,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 10,
  },
  successIcon: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successIconText: {
    fontSize: 40,
    color: '#FFFFFF',
    fontWeight: '700',
  },
  modalTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#2D5A3D',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalMessage: {
    fontSize: 15,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 30,
    lineHeight: 22,
  },
  modalButton: {
    backgroundColor: '#697E63',
    paddingVertical: 14,
    paddingHorizontal: 40,
    borderRadius: 24,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  modalButtonText: {
    color: '#BED2BC',
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
});

export default SignUpScreen;
