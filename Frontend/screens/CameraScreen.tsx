import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { PERMISSIONS, RESULTS, request } from 'react-native-permissions';
import DocumentScanner from '@dariyd/react-native-document-scanner';
import * as DocumentPicker from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import Ideas_icon from '../assets/icons/ideas.svg';
import Surface_icon from '../assets/icons/surface.svg';
import Camera_icon from '../assets/icons/camera.svg';

function CameraScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const [isLoading, setIsLoading] = useState(false);
  const [cameraPermission, setCameraPermission] = useState<boolean | null>(null);
  const isMountedRef = useRef(true);

  // Request camera permission on mount
  useEffect(() => {
    requestCameraPermission();
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // ── Camera permission ──────────────────────────────────────────────────────

  const requestCameraPermission = async (): Promise<boolean> => {
    try {
      const permission =
        Platform.OS === 'android'
          ? PERMISSIONS.ANDROID.CAMERA
          : PERMISSIONS.IOS.CAMERA;

      const result = await request(permission);

      if (result === RESULTS.GRANTED) {
        setCameraPermission(true);
        return true;
      } else if (result === RESULTS.DENIED) {
        setCameraPermission(false);
        Alert.alert(
          'Quyền Camera Bị Từ Chối',
          'Ứng dụng cần quyền truy cập camera để hoạt động. Vui lòng cho phép quyền camera.',
          [
            { text: 'Hủy', style: 'cancel' },
            { text: 'Thử Lại', onPress: () => requestCameraPermission() },
          ]
        );
        return false;
      } else if (result === RESULTS.BLOCKED) {
        setCameraPermission(false);
        Alert.alert(
          'Quyền Camera Bị Khóa',
          'Quyền camera đã bị từ chối trước đó. Vui lòng bật trong Cài đặt ứng dụng.',
          [{ text: 'OK', style: 'cancel' }]
        );
        return false;
      }

      setCameraPermission(false);
      return false;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      setCameraPermission(false);
      return false;
    }
  };

  // ── Scan document ──────────────────────────────────────────────────────────

  const handleTakePhoto = async () => {
    try {
      const hasPermission =
        cameraPermission === true || (await requestCameraPermission());
      if (!hasPermission) {
        return;
      }

      setIsLoading(true);

      DocumentScanner.launchScanner({}, async (result: any) => {
        const scannedUris = result?.images || result;

        if (Array.isArray(scannedUris) && scannedUris.length > 0) {
          // Extract string URIs
          const imageUris = scannedUris.map((img: any) => {
            if (typeof img === 'string') return img;
            if (img?.uri) return img.uri;
            if (img?.path) return 'file://' + img.path;
            return null;
          });

          try {
            const savedUris = await saveImagesToDocuments(
              imageUris.filter((uri: any): uri is string => typeof uri === 'string' && uri.length > 0)
            );
            if (!isMountedRef.current || savedUris.length === 0) {
              return;
            }
            navigation.replace('DocumentScanResult', {
              scannedImages: savedUris,
            });
          } catch (error) {
            console.error('Error processing images:', error);
            Alert.alert('Cảnh báo', 'Có lỗi khi xử lý ảnh. Vui lòng thử lại.');
          } finally {
            if (isMountedRef.current) {
              setIsLoading(false);
            }
          }
        } else if (isMountedRef.current) {
          setIsLoading(false);
        }
      });
    } catch (error: any) {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
      console.error('Error scanning document:', error);
      Alert.alert('Lỗi', 'Không thể quét tài liệu: ' + error.message);
    }
  };

  // ── Copy file from content URI to app cache ────────────────────────────────

  const copyFileToCache = async (sourceUri: string, fileName: string): Promise<string> => {
    try {
      const cacheDir = RNFS.CachesDirectoryPath;
      const safeFileName = fileName.replace(/[^a-z0-9.]/gi, '_').toLowerCase();
      const destPath = `${cacheDir}/${Date.now()}_${safeFileName}`;

      console.log('Copying file:', { sourceUri, destPath });

      // Use RNFS.copyFile which works with content:// URIs on Android
      await RNFS.copyFile(sourceUri, destPath);

      const fileUri = `file://${destPath}`;
      console.log('File copied successfully:', fileUri);
      return fileUri;
    } catch (error) {
      console.error('Error copying file to cache:', error);
      throw error;
    }
  };

  // ── Upload PDF from device ─────────────────────────────────────────────────

  const handleUploadPDF = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.pick({
        presentationStyle: 'fullScreen',
      });

      if (result && result.length > 0) {
        const pdfFile = result[0];
        const pdfUri = pdfFile.uri;
        const pdfName = pdfFile.name || 'document.pdf';
        const pdfSize = pdfFile.size || 0;

        console.log('PDF picked from picker:', { uri: pdfUri, name: pdfName, size: pdfSize });

        try {
          // Copy file from content:// to cache
          const cachedUri = await copyFileToCache(pdfUri, pdfName);

          setIsLoading(false);

          // Navigate with cached file:// URI
          navigation.replace('DocumentScanResult', {
            pdfData: {
              uri: cachedUri,
              name: pdfName,
              size: pdfSize,
            },
          });
        } catch (copyError) {
          console.error('Error copying file:', copyError);
          Alert.alert('Lỗi', 'Không thể xử lý file PDF. Vui lòng thử lại.');
          setIsLoading(false);
        }
      }
    } catch (error: any) {
      console.error('Error picking PDF:', error);
      if (error.code !== 'DOCUMENT_PICKER_CANCELLED') {
        Alert.alert('Lỗi', 'Không thể chọn file PDF. Vui lòng thử lại.');
      }
      setIsLoading(false);
    }
  };

  const handleUploadImages = async () => {
    try {
      setIsLoading(true);
      const result = await DocumentPicker.pick({
        type: ['image/*'],
        allowMultiSelection: true,
        presentationStyle: 'fullScreen',
      });

      const imageFiles = result.filter(file => {
        return (
          typeof file.uri === 'string' &&
          file.uri.length > 0 &&
          (!file.type || file.type.startsWith('image/'))
        );
      });

      if (imageFiles.length === 0) {
        Alert.alert('Error', 'Please choose at least one valid image file.');
        return;
      }

      const localCopies = await DocumentPicker.keepLocalCopy({
        destination: 'documentDirectory',
        files: imageFiles.map((file, index) => ({
          uri: file.uri,
          fileName: file.name || `gallery_image_${Date.now()}_${index}.jpg`,
        })) as [{ uri: string; fileName: string }, ...{ uri: string; fileName: string }[]],
      });
      const savedUris = localCopies
        .filter(copy => copy.status === 'success')
        .map(copy => copy.localUri);

      if (savedUris.length === 0) {
        const copyError = localCopies.find(copy => copy.status === 'error');
        throw new Error(
          copyError?.status === 'error'
            ? copyError.copyError
            : 'No image could be copied locally.'
        );
      }

      if (!isMountedRef.current) {
        return;
      }

      navigation.replace('DocumentScanResult', {
        scannedImages: savedUris,
      });
    } catch (error: any) {
      console.error('Error picking images:', error);
      if (error?.code !== 'DOCUMENT_PICKER_CANCELLED') {
        Alert.alert('Error', 'Cannot choose images. Please try again.');
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  };

  // ── Save images to app's persistent Documents directory ───────────────────
  // No storage permission needed — DocumentDirectoryPath is app-private storage.

  const saveImagesToDocuments = async (imageUris: string[]): Promise<string[]> => {
    const documentsDir = RNFS.DocumentDirectoryPath + '/scanned_documents';

    // Ensure directory exists
    const dirExists = await RNFS.exists(documentsDir);
    if (!dirExists) {
      await RNFS.mkdir(documentsDir);
    }

    const savedUris: string[] = [];

    for (const uri of imageUris) {
      // Clean up source path (strip file:// for RNFS)
      const sourcePath = uri.startsWith('file://') ? uri.slice(7) : uri;
      if (!sourcePath) {
        continue;
      }

      // Generate unique destination filename
      const filename = `scan_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const destPath = `${documentsDir}/${filename}`;

      await RNFS.copyFile(sourcePath, destPath);

      // Return file:// URI for use with <Image>
      savedUris.push('file://' + destPath);
    }

    return savedUris;
  };

  // ── Render ─────────────────────────────────────────────────────────────────



  if (false && cameraPermission === false) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>❌ Camera Permission Denied</Text>
          <Text style={styles.errorSubText}>
            Please enable camera permission in the app settings
          </Text>
          <TouchableOpacity
            style={[styles.button, styles.retryButton]}
            onPress={requestCameraPermission}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.backCameraButton]}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.buttonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (cameraPermission === null) {
    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Checking permissions...</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Go Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Documents</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* Guide */}
      
      <View style={styles.scannerGuideContainer}>
        <View style={styles.figContainer}>
          <Image
            source={require('../assets/scan_fig.png')}
            style={styles.figImage}
          />
        </View>
        <Text style={styles.guideTitleText}>Scan your Documents</Text>
        <Text style={styles.guideDescriptionText}>
          Scan a new document, import photos from your gallery, or upload a PDF to continue.
        </Text>
        {cameraPermission === false && (
          <View style={styles.permissionNotice}>
            <Text style={styles.permissionNoticeText}>
              Camera permission is off. You can still upload images or PDF files.
            </Text>
          </View>
        )}

        <View style={styles.guideItemsContainer}>
          <View style={styles.guideItem}>
            <Surface_icon width={24} height={24}/>
            <Text style={styles.guideItemText}>Place the document on a flat surface</Text>
          </View>
          <View style={styles.guideItem}>
            <Camera_icon width={24} height={24} />
            <Text style={styles.guideItemText}>Ensure adequate lighting</Text>
          </View>
          <View style={styles.guideItem}>
            <Ideas_icon width={24} height={24} />
            <Text style={styles.guideItemText}>Take a straight-on photo</Text>
          </View>
        </View>
      </View>

      {/* Import actions */}
      <View style={styles.captureButtonContainer}>
        <TouchableOpacity
          style={[styles.scanButton, isLoading && styles.scanButtonDisabled]}
          onPress={handleTakePhoto}
          disabled={isLoading}
        >
          <Text style={styles.scanButtonText}>
            {isLoading ? '⏳ Processing...' : 'Scan Documents'}
          </Text>
        </TouchableOpacity>

        <View style={styles.secondaryActionsRow}>
          <TouchableOpacity
            style={[styles.secondaryActionButton, isLoading && styles.scanButtonDisabled]}
            onPress={handleUploadImages}
            disabled={isLoading}
          >
            <Text style={styles.secondaryActionText} numberOfLines={1}>
              Upload Images
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
          style={[styles.secondaryActionButton, isLoading && styles.scanButtonDisabled]}
          onPress={handleUploadPDF}
          disabled={isLoading}
        >
          <Text style={styles.secondaryActionText} numberOfLines={1}>
            {isLoading ? '⏳ Processing...' : 'Upload PDF'}
          </Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F6EFDD',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    margin: 5,
    borderRadius: 10,
    backgroundColor: '#6B826B',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
  },
  backButton: {
    fontSize: 14,
    color: '#fff',
    fontWeight: '600',
  },
  figContainer: {
    alignItems: 'center',
  },
  figImage: {
    width: 200,
    height: 150,
    resizeMode: 'contain',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 15,
    borderRadius: 8,
    marginBottom: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  retryButton: {
    backgroundColor: '#6B9071',
  },
  backCameraButton: {
    backgroundColor: '#888',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#333',
    marginBottom: 20,
    fontWeight: '600',
  },
  errorSubText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 25,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  scannerGuideContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    backgroundColor: '#fff',
    margin: 10,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  guideTitleText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#323C1A',
    marginBottom: 15,
    textAlign: 'center',
  },
  guideDescriptionText: {
    fontSize: 14,
    color: '#323C1A',
    textAlign: 'center',
    marginBottom: 25,
    lineHeight: 20,
  },
  permissionNotice: {
    width: '100%',
    paddingVertical: 9,
    paddingHorizontal: 12,
    marginBottom: 14,
    borderRadius: 8,
    backgroundColor: '#FFF7E1',
    borderWidth: 1,
    borderColor: '#D8B45D',
  },
  permissionNoticeText: {
    fontSize: 12,
    lineHeight: 17,
    color: '#6B5420',
    textAlign: 'center',
    fontWeight: '600',
  },
  guideItemsContainer: {
    width: '100%',
    marginBottom: 15,
  },
  guideItem: {
    paddingVertical: 10,
    paddingHorizontal: 15,
    marginVertical: 5,
    backgroundColor: '#E6F7EF',
    borderWidth: 1,
    borderColor: '#6B9071',
    borderRadius: 6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  guideItemText: {
    fontSize: 13,
    color: '#2D5341',
    fontWeight: '500',
  },
  captureButtonContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    backgroundColor: '#F6EFDD',
    gap: 12,
  },
  scanButton: {
    paddingVertical: 14,
    paddingHorizontal: 30,
    borderRadius: 25,
    backgroundColor: '#6B9071',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
    width: '100%',
    maxWidth: 420,
  },
  secondaryActionsRow: {
    width: '100%',
    maxWidth: 420,
    flexDirection: 'row',
    gap: 10,
  },
  secondaryActionButton: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 18,
    backgroundColor: '#4A7C59',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  scanButtonDisabled: {
    opacity: 0.6,
  },
  scanButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryActionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
  },
});

export default CameraScreen;

