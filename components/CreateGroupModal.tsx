/**
 * Create Group Modal
 * Modal form để tạo group mới
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useGroup } from '../contexts/GroupContext';
import { CreateGroupRequest } from '../types/group';

interface CreateGroupModalProps {
  visible: boolean;
  onClose: () => void;
  onGroupCreated: () => void;
}

export const CreateGroupModal: React.FC<CreateGroupModalProps> = ({
  visible,
  onClose,
  onGroupCreated,
}) => {
  const { createGroup, isCreatingGroup, error, clearError } = useGroup();
  const [groupName, setGroupName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);

  const handleCreate = async () => {
    // Validation
    if (!groupName.trim()) {
      Alert.alert('Error', 'Please enter group name');
      return;
    }

    if (groupName.trim().length > 100) {
      Alert.alert('Error', 'Group name cannot exceed 100 characters');
      return;
    }

    if (description.trim().length > 500) {
      Alert.alert('Error', 'Description cannot exceed 500 characters');
      return;
    }

    try {
      const request: CreateGroupRequest = {
        name: groupName.trim(),
        description: description.trim() || undefined,
        is_public: isPublic,
      };

      await createGroup(request);
      
      // Success
      Alert.alert('Success', 'Group created successfully!', [
        {
          text: 'OK',
          onPress: () => {
            resetForm();
            onClose();
            onGroupCreated();
          },
        },
      ]);
    } catch (err) {
      const errorMessage = error || (err instanceof Error ? err.message : 'Failed to create group');
      Alert.alert('Error', errorMessage);
      clearError();
    }
  };

  const resetForm = () => {
    setGroupName('');
    setDescription('');
    setIsPublic(true);
  };

  const handleClose = () => {
    resetForm();
    clearError();
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={handleClose}
    >
      <View style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <View style={styles.modalContent}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Group</Text>
              <TouchableOpacity
                onPress={handleClose}
                disabled={isCreatingGroup}
              >
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Form Content */}
            <ScrollView
              style={styles.formContent}
              showsVerticalScrollIndicator={false}
            >
              {/* Group Name Input */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Group Name *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter group name"
                  placeholderTextColor="#A0B0A0"
                  value={groupName}
                  onChangeText={setGroupName}
                  maxLength={100}
                  editable={!isCreatingGroup}
                  selectionColor="#8B9D8A"
                />
                <Text style={styles.charCount}>
                  {groupName.length}/100
                </Text>
              </View>

              {/* Description Input */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Description (Optional)</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Enter group description"
                  placeholderTextColor="#A0B0A0"
                  value={description}
                  onChangeText={setDescription}
                  maxLength={500}
                  multiline={true}
                  numberOfLines={4}
                  editable={!isCreatingGroup}
                  selectionColor="#8B9D8A"
                  textAlignVertical="top"
                />
                <Text style={styles.charCount}>
                  {description.length}/500
                </Text>
              </View>

              {/* Public/Private Toggle */}
              <View style={styles.formGroup}>
                <View style={styles.toggleHeader}>
                  <Text style={styles.label}>
                    {isPublic ? 'Public Group' : 'Private Group'}
                  </Text>
                  <Switch
                    value={isPublic}
                    onValueChange={setIsPublic}
                    disabled={isCreatingGroup}
                    trackColor={{ false: '#C5D8C0', true: '#8B9D8A' }}
                    thumbColor="#FFFFFF"
                  />
                </View>
                <Text style={styles.toggleDescription}>
                  {isPublic
                    ? 'Anyone can find and join this group'
                    : 'Only invited users can join this group'}
                </Text>
              </View>
            </ScrollView>

            {/* Buttons */}
            <View style={styles.buttonContainer}>
              <TouchableOpacity
                style={[styles.button, styles.cancelButton]}
                onPress={handleClose}
                disabled={isCreatingGroup}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.button,
                  styles.createButton,
                  isCreatingGroup ? styles.buttonDisabled : null,
                ]}
                onPress={handleCreate}
                disabled={isCreatingGroup}
              >
                {isCreatingGroup ? (
                  <Text style={styles.createButtonText}>Creating...</Text>
                ) : (
                  <Text style={styles.createButtonText}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardView: {
    width: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    maxHeight: '90%',
    backgroundColor: '#F5F5F0',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
  },
  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#8B9D8A',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  // Form Content
  formContent: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    maxHeight: '70%',
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D3C2C',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: '#2D3C2C',
    borderWidth: 1,
    borderColor: '#D0DCC8',
  },
  textArea: {
    paddingVertical: 12,
    height: 100,
  },
  charCount: {
    fontSize: 12,
    color: '#8B9D8A',
    marginTop: 4,
    textAlign: 'right',
  },
  // Toggle Section
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleDescription: {
    fontSize: 12,
    color: '#5A6B56',
    marginTop: 8,
    lineHeight: 16,
  },
  // Buttons
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#D0DCC8',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#C5D8C0',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#2D3C2C',
  },
  createButton: {
    backgroundColor: '#8B9D8A',
  },
  createButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
});
