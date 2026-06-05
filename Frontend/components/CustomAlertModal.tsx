import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
} from 'react-native';

export interface AlertButton {
  text: string;
  onPress: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
  isLoading?: boolean;
}

interface CustomAlertModalProps {
  visible: boolean;
  title: string;
  message: string;
  buttons: AlertButton[];
  icon?: string;
  isLoading?: boolean;
  onDismiss?: () => void;
}

export function CustomAlertModal({
  visible,
  title,
  message,
  buttons,
  icon = '!',
  isLoading = false,
  onDismiss,
}: CustomAlertModalProps) {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onDismiss}
    >
      {/* Background Overlay */}
      <View style={styles.overlay}>
        {/* Modal Container */}
        <View style={styles.modalContainer}>
          {/* Icon/Header Section */}
          {icon && (
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>{icon}</Text>
            </View>
          )}

          {/* Content Section */}
          <View style={styles.contentContainer}>
            <Text style={styles.title}>{title}</Text>
            <Text style={styles.message}>{message}</Text>
          </View>

          {/* Button Section */}
          <View style={styles.buttonContainer}>
            {buttons.map((button, index) => {
              const isDestructive = button.style === 'destructive';
              const isCancel = button.style === 'cancel';
              const loading = button.isLoading || isLoading;

              return (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.button,
                    isDestructive && styles.destructiveButton,
                    isCancel && styles.cancelButton,
                    !isDestructive && !isCancel && styles.defaultButton,
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={button.onPress}
                  disabled={loading}
                  activeOpacity={loading ? 1 : 0.7}
                >
                  {loading ? (
                    <ActivityIndicator
                      color={isDestructive ? '#FFF' : isCancel ? '#666' : '#FFF'}
                      size="small"
                    />
                  ) : (
                    <Text
                      style={[
                        styles.buttonText,
                        isDestructive && styles.destructiveButtonText,
                        isCancel && styles.cancelButtonText,
                        !isDestructive && !isCancel && styles.defaultButtonText,
                      ]}
                    >
                      {button.text}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 28,
    width: '100%',
    maxWidth: 340,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  iconContainer: {
    alignItems: 'center',
    marginBottom: 12,
  },
  icon: {
    fontSize: 48,
  },
  contentContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#2D5341',
    marginBottom: 8,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  buttonContainer: {
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  defaultButton: {
    backgroundColor: '#6B9071',
  },
  destructiveButton: {
    backgroundColor: '#CC3333',
  },
  cancelButton: {
    backgroundColor: '#E8E8E8',
    borderWidth: 1,
    borderColor: '#D0D0D0',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  defaultButtonText: {
    color: '#FFF',
  },
  destructiveButtonText: {
    color: '#FFF',
  },
  cancelButtonText: {
    color: '#333',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
