import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';

interface SignOutConfirmationModalProps {
  visible: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function SignOutConfirmationModal({
  visible,
  onConfirm,
  onCancel,
  isLoading = false,
}: SignOutConfirmationModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onCancel}
    >
      {/* Background Overlay */}
      <View style={styles.overlay}>
        {/* Modal Container */}
        <View style={styles.modalContainer}>
          {/* Icon/Header Section */}
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>👋</Text>
          </View>

          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>Sign Out</Text>
            <Text style={styles.message}>
              Are you sure you want to sign out?
            </Text>
          </View>

          {/* Button Section */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={isLoading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.signOutButton, isLoading && styles.buttonDisabled]}
              onPress={onConfirm}
              disabled={isLoading}
              activeOpacity={isLoading ? 1 : 0.7}
            >
              {isLoading ? (
                <ActivityIndicator color="#F5F5F0" size="small" />
              ) : (
                <Text style={styles.signOutButtonText}>Sign Out</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 24,
    paddingVertical: 32,
    width: '100%',
    maxWidth: 320,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 48,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 28,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#2D3C2C',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6B7B68',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    flexDirection: 'column',
    gap: 12,
  },
  cancelButton: {
    backgroundColor: '#E8E8E8',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    borderColor: '#D0D0D0',
    borderWidth: 1,
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3C2C',
  },
  signOutButton: {
    backgroundColor: '#8B9D8A',
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  signOutButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#F5F5F0',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
});
