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
  ImageBackground,
} from 'react-native';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../contexts/AuthContext';
import OpenEyeIcon from '../assets/icons/open_eye.svg';
import CloseEyeIcon from '../assets/icons/close_eye.svg';

const { width, height } = Dimensions.get('window');

function SignInScreen() {
  const navigation = useNavigation<any>();
  const { signIn, loading, error, clearError } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);

  // Clear error when user starts typing
  useEffect(() => {
    if (error) {
      clearError();
    }
    // Clear only after the user edits a field, not immediately when auth error appears.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password]);

  const validateInputs = (): boolean => {
    const newErrors = { email: '', password: '' };

    if (!email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!email.includes('@')) {
      newErrors.email = 'Please enter a valid email';
    }

    if (!password.trim()) {
      newErrors.password = 'Password is required';
    }

    setErrors(newErrors);
    return !newErrors.email && !newErrors.password;
  };

  const handleEmailChange = (value: string) => {
    setEmail(value);
    if (errors.email) {
      setErrors(current => ({ ...current, email: '' }));
    }
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    if (errors.password) {
      setErrors(current => ({ ...current, password: '' }));
    }
  };

  const handleSignIn = async () => {
    if (!validateInputs()) {
      return;
    }

    try {
      await signIn({
        email: email.trim(),
        password: password,
      });
      // Navigation will be handled by RootNavigator when isLoggedIn changes
    } catch (err) {
      // Error is already set in context
      Alert.alert(
        'Sign In Failed',
        err instanceof Error ? err.message : 'An error occurred during sign in'
      );
    }
  };

  const handleNavigateToSignUp = () => {
    clearError();
    setEmail('');
    setPassword('');
    setErrors({ email: '', password: '' });
    navigation.replace('SignUp');
  };

  return (
    <KeyboardAwareScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      enableOnAndroid={true}
      enableAutomaticScroll={true}
      enableResetScrollToCoords={false}
      extraHeight={120}
      extraScrollHeight={90}
      keyboardShouldPersistTaps="handled"
    >
        {/* Top Section with Welcome Text */}
        <View style={styles.topSection}>
          {/* <Text style={styles.welcomeText}>WELCOME !</Text> */}

          <View style={styles.iconContainer}>
            <Image
              source={require('../assets/Top_background.png')}
              style={styles.figImage}
            />
          </View>
        </View>
        <View style={styles.form_container}>
          {/* Sign In Form Section */}
          <ImageBackground
            source={require('../assets/background_pattern.png')}
            resizeMode="repeat"
            style={styles.formSection}
          >
            <Text style={styles.formTitle}>SIGN IN</Text>

            {/* Error Message */}
            {error && (
              <View style={styles.errorContainer}>
                <Text style={styles.errorAlert}>{error}</Text>
              </View>
            )}

            {/* Email Input */}
            <View style={styles.inputWrapper}>
              <TextInput
                style={[styles.input, errors.email && styles.inputError]}
                placeholder="Email address"
                placeholderTextColor="#3c433388"
                value={email}
                onChangeText={handleEmailChange}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
                underlineColorAndroid="transparent"
              />
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
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
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Continue Button */}
            <TouchableOpacity
              style={[styles.continueButton, loading && styles.buttonDisabled]}
              onPress={handleSignIn}
              activeOpacity={0.8}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.continueButtonText}>Continue</Text>
              )}
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpLinkContainer}>
              <Text style={styles.signUpLinkText}>Dont have account ?, </Text>
              <TouchableOpacity
                onPress={handleNavigateToSignUp}
                disabled={loading}
              >
                <Text style={styles.signUpLinkBold}>SIGN UP</Text>
              </TouchableOpacity>
              <Text style={styles.signUpLinkText}> here.</Text>
            </View>
          </ImageBackground>
        </View>
    </KeyboardAwareScrollView>
    );
  }

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E5EFD7',
  },
  scrollContent: {
    flexGrow: 1,
    backgroundColor: '#789265',
  },
  topSection: {
    backgroundColor: '#FDF7DF',
    paddingTop: width * 0.26,
    paddingBottom: 20,
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: 32,
    marginLeft: width * 0.4,
    fontWeight: '700',
    color: '#2D5A3D',
    marginBottom: 20,
    letterSpacing: 1,
  },
  iconContainer: {
    width: 200,
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
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
    paddingTop: 50,
    paddingBottom: 40,
    paddingHorizontal: 30,
    height: height * 0.55,
    alignItems: 'center',
    overflow: 'hidden',
  },
  formTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#344E39',
    // textAlign: 'center',
    marginBottom: 25,
    letterSpacing: 1,
  },
  errorContainer: {
    backgroundColor: '#FDEDEC',
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
    marginBottom: 20,
  },
  input: {
    width: width * 0.8,
    backgroundColor: '#E9EFE1',
    borderWidth: 1.3,
    borderColor: '#79876E',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 16,
    color: '#344E39',
    fontFamily: 'System',
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E9EFE1',
    borderWidth: 1.3,
    borderColor: '#79876E',
    borderRadius: 16,
    paddingHorizontal: 20,
    width: width * 0.8,
  },
  passwordInput: {
    width: width * 0.62,
    paddingVertical: 16,
    fontSize: 16,
    color: '#344E39',
    fontFamily: 'System',
  },
  eyeIcon: {
    // padding: 5,
  },
  inputError: {
    borderColor: '#E74C3C',
  },
  errorText: {
    color: '#C0392B',
    fontSize: 12,
    marginTop: 6,
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
  signUpLinkContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
    flexWrap: 'wrap',
  },
  signUpLinkText: {
    fontSize: 14,
    color: '#344E39',
    fontWeight: '400',
  },
  signUpLinkBold: {
    fontSize: 14,
    color: '#344E39',
    fontWeight: '700',
    textAlign: 'center',
    textDecorationLine: 'underline',
  },
});

export default SignInScreen;
