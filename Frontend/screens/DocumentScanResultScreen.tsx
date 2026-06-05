import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  FlatList,
  Dimensions,
  NativeScrollEvent,
  NativeSyntheticEvent,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation, useRoute } from '@react-navigation/native';
import DocumentScanner from '@dariyd/react-native-document-scanner';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import Flashcard_icon from '../assets/icons/flashcard.svg';
import Summarize_icon from '../assets/icons/doc.svg';
import Scan_icon from '../assets/icons/scan.svg';
import Trash_icon from '../assets/icons/trash_can.svg';
import { CustomAlertModal, AlertButton } from '../components/CustomAlertModal';
import { documentService, OCRData, OCRBlock } from '../services/documentService';

const { width, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GALLERY_HEIGHT = SCREEN_HEIGHT * 0.48;

function removeIndexedState<T>(
  state: {[key: number]: T},
  removedIndex: number
): {[key: number]: T} {
  return Object.keys(state).reduce((next, key) => {
    const numericKey = Number(key);
    if (numericKey < removedIndex) {
      next[numericKey] = state[numericKey];
    } else if (numericKey > removedIndex) {
      next[numericKey - 1] = state[numericKey];
    }
    return next;
  }, {} as {[key: number]: T});
}

function DocumentScanResultScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  
  const { scannedImages: rawInitialImages = [], pdfData: rawPdfData } = route.params || {};
  const initialImages = Array.isArray(rawInitialImages)
    ? rawInitialImages.filter(
        (uri: any): uri is string => typeof uri === 'string' && uri.length > 0
      )
    : [];
  const pdfData =
    rawPdfData && typeof rawPdfData.uri === 'string'
      ? {
          ...rawPdfData,
          name: rawPdfData.name || 'document.pdf',
          size: typeof rawPdfData.size === 'number' ? rawPdfData.size : 0,
        }
      : null;
  const [images, setImages] = useState<string[]>(initialImages);
  const [currentPage, setCurrentPage] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [rescanningPageIndex, setRescanningPageIndex] = useState<number | null>(null);
  const [imageLoadErrors, setImageLoadErrors] = useState<{[key: number]: string}>({});
  const [imageLoadingStates, setImageLoadingStates] = useState<{[key: number]: boolean}>({});
  const [pdfPages, setPdfPages] = useState<number>(0);
  const flatListRef = useRef<FlatList>(null);

  // Custom Alert Modal State
  const [alertModalVisible, setAlertModalVisible] = useState(false);
  const [alertConfig, setAlertConfig] = useState<{
    title: string;
    message: string;
    icon: string;
    buttons: AlertButton[];
  }>({
    title: '',
    message: '',
    icon: '!',
    buttons: [],
  });

  // Handle scroll to update current page indicator
  const handleScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const contentOffsetX = event.nativeEvent.contentOffset.x;
    const page = Math.round(contentOffsetX / width);
    setCurrentPage(page);
  };

  // ============ Real Functions ============

  const buildOcrDataFromCurrentDocument = async (): Promise<OCRData> => {
    if (pdfData) {
      const pdfFilePath = pdfData.uri.startsWith('file://')
        ? pdfData.uri.substring(7)
        : pdfData.uri;
      return documentService.processOCR(pdfFilePath);
    }

    let combinedOcrResults: OCRBlock[] = [];
    let combinedExtractedText = '';
    let totalTime = 0;

    for (let i = 0; i < images.length; i++) {
      const imagePath = images[i].startsWith('file://')
        ? images[i].substring(7)
        : images[i];
      const ocrData = await documentService.processOCR(imagePath);

      combinedExtractedText += `\n\n--- IMAGE ${i + 1} ---\n`;
      combinedExtractedText += ocrData.extracted_text;
      combinedOcrResults.push(
        ...ocrData.ocr_results.map(block => ({
          ...block,
          page: i + 1,
        }))
      );

      const timeMatch = (ocrData.processing_time || '0s').match(/[\d.]+/);
      if (timeMatch) {
        totalTime += parseFloat(timeMatch[0]);
      }
    }

    return {
      ocr_results: combinedOcrResults,
      extracted_text: combinedExtractedText.trim(),
      file_name: `scanned_images_${images.length}`,
      processing_time: `${totalTime.toFixed(2)}s`,
      text_length: combinedExtractedText.length,
      num_blocks: combinedOcrResults.length,
    };
  };

  const handleSummarize = async () => {
    if (!pdfData && images.length === 0) {
      setAlertConfig({
        title: 'Error',
        message: 'No document available to summarize.',
        icon: '!',
        buttons: [
          {
            text: 'OK',
            onPress: () => setAlertModalVisible(false),
            style: 'default',
          },
        ],
      });
      setAlertModalVisible(true);
      return;
    }

    setIsProcessing(true);

    // Show loading alert
    setAlertConfig({
      title: 'Processing',
      message: 'Extracting content from the document. Please wait.',
      icon: '...',
      buttons: [],
    });
    setAlertModalVisible(true);

    try {
      let allSummaryData: any = {
        pages: {},
        full_summary: '',
        structured_summary: [],
        processing_time: '',
        num_pages: 0,
      };
      let allOcrData: OCRData | null = null;

      if (pdfData) {
        // Process PDF
        const pdfFilePath = pdfData.uri.startsWith('file://') 
          ? pdfData.uri.substring(7) 
          : pdfData.uri;

        console.log('[Summary Flow] Processing PDF:', pdfFilePath);

        try {
          const processedData = await documentService.processOCRAndSummary(pdfFilePath);
          allSummaryData = processedData.summaryData;
          allOcrData = processedData.ocrData;
        } catch (pdfError) {
          const errorMsg = pdfError instanceof Error ? pdfError.message : 'Unknown error';
          console.error('[Summary Flow] PDF Error:', pdfError);
          
          // Re-throw with context
          if (errorMsg.includes('Text content cannot be empty') || errorMsg.includes('empty')) {
            throw new Error('Could not extract readable content from this PDF. The document may be blurry or empty.');
          }
          throw pdfError;
        }
      } else {
        // Process multiple images
        console.log('[Summary Flow] Processing', images.length, 'images');

        let combinedPages: { [key: string]: string } = {};
        let combinedFullSummary = '';
        let combinedStructuredSummary: Array<OCRBlock & { summary?: string }> = [];
        let combinedOcrResults: OCRBlock[] = [];
        let combinedExtractedText = '';
        let totalTime = 0;
        let successCount = 0;
        let emptyContentCount = 0;
        let errorCount = 0;

        for (let i = 0; i < images.length; i++) {
          const imagePath = images[i].startsWith('file://')
            ? images[i].substring(7)
            : images[i];

          console.log(`[Summary Flow] Processing image ${i + 1}/${images.length}`);

          try {
            const processedData = await documentService.processOCRAndSummary(imagePath);
            const { summaryData, ocrData } = processedData;

            // Merge page results
            Object.keys(summaryData.pages).forEach(pageKey => {
              // Rename page keys to avoid collisions across multiple images
              const newKey = `page_${i + 1}_${pageKey}`;
              combinedPages[newKey] = summaryData.pages[pageKey];
            });

            // Merge full summary
            if (Object.keys(combinedPages).length > 0) {
              combinedFullSummary += '\n\n' + '='.repeat(50) + '\n\n';
            }
            combinedFullSummary += `--- IMAGE ${i + 1} ---\n`;
            combinedFullSummary += summaryData.full_summary;
            combinedExtractedText += `\n\n--- IMAGE ${i + 1} ---\n`;
            combinedExtractedText += ocrData.extracted_text;
            combinedOcrResults.push(
              ...ocrData.ocr_results.map(block => ({
                ...block,
                page: i + 1,
              }))
            );
            if (summaryData.structured_summary) {
              combinedStructuredSummary.push(
                ...summaryData.structured_summary.map(block => ({
                  ...block,
                  page: i + 1,
                }))
              );
            }

            // Accumulate processing time
            const timeString = summaryData.processing_time || '0s';
            const timeMatch = timeString.match(/[\d.]+/);
            if (timeMatch) {
              totalTime += parseFloat(timeMatch[0]);
            }

            successCount++;
          } catch (imageError) {
            const errorMsg = imageError instanceof Error ? imageError.message : 'Unknown error';
            console.error(`[Summary Flow] Error processing image ${i + 1}:`, imageError);

            // Detect empty content error
            if (errorMsg.includes('Text content cannot be empty') || errorMsg.includes('empty')) {
              emptyContentCount++;
              combinedPages[`page_${i + 1}_skipped`] = 
                'This image could not be processed because it is blurry or empty.';
            } else {
              errorCount++;
              combinedPages[`page_${i + 1}_error`] = 
                `Processing error: ${errorMsg}`;
            }
          }
        }

        // Check if all images failed
        if (successCount === 0) {
          setAlertModalVisible(false);
          throw new Error('Could not extract content from any image. Please scan again with better quality.');
        }

        // Build summary with metadata about what succeeded/failed
        let metadataMsg = '';
        if (successCount > 0 || emptyContentCount > 0 || errorCount > 0) {
          metadataMsg = `\n\nProcessing results:\n`;
          if (successCount > 0) metadataMsg += `Successful: ${successCount} image(s)\n`;
          if (emptyContentCount > 0) metadataMsg += `Blurry or empty: ${emptyContentCount} image(s)\n`;
          if (errorCount > 0) metadataMsg += `Other errors: ${errorCount} image(s)\n`;
        }

        allSummaryData = {
          pages: combinedPages,
          full_summary: combinedFullSummary + metadataMsg,
          structured_summary: combinedStructuredSummary,
          processing_time: `${totalTime.toFixed(2)}s`,
          num_pages: successCount,
        };
        allOcrData = {
          ocr_results: combinedOcrResults,
          extracted_text: combinedExtractedText.trim(),
          file_name: `scanned_images_${images.length}`,
          processing_time: `${totalTime.toFixed(2)}s`,
          text_length: combinedExtractedText.length,
          num_blocks: combinedOcrResults.length,
        };
      }

      console.log('[Summary Flow] Completed! Navigating to SummaryScreen');

      // Close loading alert
      setAlertModalVisible(false);

      // Show partial success warning if applicable
      if (allSummaryData.num_pages && allSummaryData.num_pages > 0) {
        const totalFiles = pdfData ? 1 : images.length;
        const successCount = allSummaryData.num_pages;
        const failCount = totalFiles - successCount;

        if (failCount > 0) {
          // Show warning before navigating
          setAlertConfig({
            title: 'Partial Processing',
            message: `Only ${successCount}/${totalFiles} image(s) were processed successfully.\n\n` +
              `${failCount} image(s) could not be read because they were blurry or empty.\n\n` +
              'You can view the current result or scan again for better quality.',
            icon: '!',
            buttons: [
              {
                text: 'View Result',
                onPress: () => {
                  setAlertModalVisible(false);
                  navigation.navigate('Summary', {
                    summaryData: allSummaryData,
                    ocrData: allOcrData,
                  });
                },
                style: 'default',
              },
              {
                text: 'Scan Again',
                onPress: () => {
                  setAlertModalVisible(false);
                  handleRescan();
                },
                style: 'default',
              },
            ],
          });
          setAlertModalVisible(true);
        } else {
          // All succeeded - navigate directly
          navigation.navigate('Summary', {
            summaryData: allSummaryData,
            ocrData: allOcrData,
          });
        }
      } else {
        // No successful processing
        throw new Error('Could not process any image. Please scan again.');
      }
    } catch (error) {
      console.error('[Summary Error]:', error);

      const errorMessage = error instanceof Error 
        ? error.message 
        : 'An error occurred while summarizing the document.';

      // Handle specific error: empty text content
      if (errorMessage.includes('Text content cannot be empty') || errorMessage.includes('empty')) {
        setAlertConfig({
          title: 'Document Not Clear',
          message: 'Could not extract readable content from this document.\n\n' +
            'The document may be blurry, empty, or in an unsupported format.\n\n' +
            'Please scan again with better quality and make sure the document has readable content.',
          icon: '!',
          buttons: [
            {
              text: 'Scan Again',
              onPress: () => {
                setAlertModalVisible(false);
                handleRescan();
              },
              style: 'default',
            },
            {
              text: 'Cancel',
              onPress: () => setAlertModalVisible(false),
              style: 'cancel',
            },
          ],
        });
      } else {
        // Generic error handling
        setAlertConfig({
          title: 'Processing Error',
          message: `${errorMessage}\n\n` +
            'Please check your connection, try again, or scan the document again if the issue continues.',
          icon: '!',
          buttons: [
            {
              text: 'Scan Again',
              onPress: () => {
                setAlertModalVisible(false);
                handleRescan();
              },
              style: 'default',
            },
            {
              text: 'Cancel',
              onPress: () => setAlertModalVisible(false),
              style: 'cancel',
            },
          ],
        });
      }
      setAlertModalVisible(true);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateFlashcard = async () => {
    setIsProcessing(true);
    setAlertConfig({
      title: 'Creating Flashcards',
      message: 'Extracting OCR content and creating flashcards from this document...',
      icon: '...',
      buttons: [],
    });
    setAlertModalVisible(true);

    try {
      const ocrData = await buildOcrDataFromCurrentDocument();
      const processed = await documentService.processFlashcards(ocrData);
      const title = pdfData?.name
        ? `Flashcards - ${pdfData.name}`
        : `Flashcards - ${images.length} scanned page${images.length > 1 ? 's' : ''}`;

      setAlertModalVisible(false);
      navigation.navigate('FlashcardDetail', {
        title,
        draftFlashcardData: processed.flashcard_data,
        draftTotalCards: processed.total_cards,
        saveOptions: {
          sourceFileName: ocrData.file_name,
          tags: ['Flashcard'],
        },
        sourceFlow: 'scanResult',
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Cannot create flashcards';
      setAlertConfig({
        title: 'Error',
        message: errorMessage,
        icon: '!',
        buttons: [
          {
            text: 'OK',
            onPress: () => setAlertModalVisible(false),
            style: 'default',
          },
        ],
      });
      setAlertModalVisible(true);
    } finally {
      setIsProcessing(false);
    }
  };

  // Save new pages to DocumentDirectoryPath
  const saveImagesToDocuments = async (imageUris: string[]): Promise<string[]> => {
    const documentsDir = RNFS.DocumentDirectoryPath + '/scanned_documents';
    const dirExists = await RNFS.exists(documentsDir);
    if (!dirExists) {
      await RNFS.mkdir(documentsDir);
    }
    const savedUris: string[] = [];
    for (const uri of imageUris) {
      const sourcePath = uri.startsWith('file://') ? uri.slice(7) : uri;
      const filename = `scan_${Date.now()}_${Math.random().toString(36).slice(2)}.jpg`;
      const destPath = `${documentsDir}/${filename}`;
      await RNFS.copyFile(sourcePath, destPath);
      savedUris.push('file://' + destPath);
    }
    return savedUris;
  };

  const normalizeScannerResult = (result: any): string[] => {
    const scannedUris = result?.images || result;

    if (!Array.isArray(scannedUris) || scannedUris.length === 0) {
      return [];
    }

    return scannedUris
      .map((img: any) => {
        if (typeof img === 'string') return img;
        if (img?.uri) return img.uri;
        if (img?.path) return 'file://' + img.path;
        return img;
      })
      .filter((uri: any): uri is string => typeof uri === 'string' && uri.length > 0);
  };

  const removeLocalImageFile = async (uri?: string) => {
    if (!uri) return;

    try {
      const imagePath = uri.startsWith('file://') ? uri.slice(7) : uri;
      if (
        imagePath.startsWith(RNFS.DocumentDirectoryPath) &&
        (await RNFS.exists(imagePath))
      ) {
        await RNFS.unlink(imagePath);
      }
    } catch (error) {
      console.warn('Cannot remove scanned image file:', error);
    }
  };

  // Scan additional pages and append them to the current list
  const handleRescan = () => {
    if (isScanning || isProcessing) return;
    setIsScanning(true);

    DocumentScanner.launchScanner({}, async (result: any) => {
      try {
        const imageUris = normalizeScannerResult(result);

        if (imageUris.length === 0) {
          // User cancelled - no alert needed
          return;
        }

        // Save and append
        const savedUris = await saveImagesToDocuments(imageUris);
        setImages(prev => {
          const updated = [...prev, ...savedUris];
          // Scroll to first new page after state update
          setTimeout(() => {
            flatListRef.current?.scrollToIndex({
              index: prev.length,
              animated: true,
            });
          }, 150);
          return updated;
        });
      } catch (error) {
        console.error('Error appending scanned pages:', error);
        setAlertConfig({
          title: 'Error',
          message: 'Cannot save the new page. Please try again.',
          icon: '!',
          buttons: [
            {
              text: 'OK',
              onPress: () => setAlertModalVisible(false),
              style: 'default',
            },
          ],
        });
        setAlertModalVisible(true);
      } finally {
        setIsScanning(false);
      }
    });
  };

  const handleRescanPage = (pageIndex: number) => {
    if (isScanning || isProcessing) return;
    setIsScanning(true);
    setRescanningPageIndex(pageIndex);

    DocumentScanner.launchScanner({}, async (result: any) => {
      try {
        const imageUris = normalizeScannerResult(result);

        if (imageUris.length === 0) {
          return;
        }

        const [savedUri] = await saveImagesToDocuments([imageUris[0]]);
        const previousUri = images[pageIndex];

        setImages(prev => {
          if (pageIndex < 0 || pageIndex >= prev.length) {
            return prev;
          }

          const updated = [...prev];
          updated[pageIndex] = savedUri;
          return updated;
        });
        setImageLoadErrors(prev => {
          const updated = { ...prev };
          delete updated[pageIndex];
          return updated;
        });
        setImageLoadingStates(prev => ({ ...prev, [pageIndex]: true }));
        flatListRef.current?.scrollToIndex({ index: pageIndex, animated: true });
        await removeLocalImageFile(previousUri);
      } catch (error) {
        console.error('Error rescanning page:', error);
        setAlertConfig({
          title: 'Error',
          message: 'Cannot replace this page. Please try again.',
          icon: '!',
          buttons: [
            {
              text: 'OK',
              onPress: () => setAlertModalVisible(false),
              style: 'default',
            },
          ],
        });
        setAlertModalVisible(true);
      } finally {
        setIsScanning(false);
        setRescanningPageIndex(null);
      }
    });
  };

  const handleDeletePage = (pageIndex: number) => {
    setAlertConfig({
      title: 'Delete Page',
      message: `Delete scanned page ${pageIndex + 1}?`,
      icon: '!',
      buttons: [
        {
          text: 'Cancel',
          onPress: () => setAlertModalVisible(false),
          style: 'cancel',
        },
        {
          text: 'Delete',
          onPress: async () => {
            setAlertModalVisible(false);
            const deletedUri = images[pageIndex];

            setImages(prev => {
              const updated = prev.filter((_, index) => index !== pageIndex);
              const nextPage = Math.max(0, Math.min(pageIndex, updated.length - 1));
              setCurrentPage(nextPage);

              if (updated.length > 0) {
                setTimeout(() => {
                  flatListRef.current?.scrollToIndex({
                    index: nextPage,
                    animated: true,
                  });
                }, 150);
              }

              return updated;
            });
            setImageLoadErrors(prev => removeIndexedState(prev, pageIndex));
            setImageLoadingStates(prev => removeIndexedState(prev, pageIndex));
            await removeLocalImageFile(deletedUri);
          },
          style: 'destructive',
        },
      ],
    });
    setAlertModalVisible(true);
  };

  const handleCancel = () => {
    setAlertConfig({
      title: 'Cancel Scan',
      message: 'Are you sure you want to cancel these scanned pages?',
      icon: '!',
      buttons: [
        {
          text: 'No',
          onPress: () => setAlertModalVisible(false),
          style: 'cancel',
        },
        {
          text: 'Yes',
          onPress: () => {
            setAlertModalVisible(false);
            navigation.popToTop();
          },
          style: 'destructive',
        },
      ],
    });
    setAlertModalVisible(true);
  };

  // Render document page in gallery
  const renderDocumentPage = ({ item, index }: { item: string; index: number }) => {
    const hasError = imageLoadErrors[index];
    const isLoading = imageLoadingStates[index];
    const isPageBusy = isProcessing || isScanning;

    return (
      <View style={styles.pageContainer}>
        <View style={styles.pageWrapper}>
          <View style={styles.pageActionsOverlay}>
            <TouchableOpacity
              style={[
                styles.pageActionButton,
                rescanningPageIndex === index && styles.pageActionButtonBusy,
              ]}
              onPress={() => handleRescanPage(index)}
              disabled={isPageBusy}
              activeOpacity={0.82}
            >
              {rescanningPageIndex === index ? (
                <ActivityIndicator size="small" color="#2D5341" />
              ) : (
                <>
                  <Scan_icon width={15} height={15} />
                  <Text style={styles.pageActionText}>Rescan</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.pageActionButton, styles.pageDeleteButton]}
              onPress={() => handleDeletePage(index)}
              disabled={isPageBusy}
              activeOpacity={0.82}
            >
              <Trash_icon width={13} height={13} />
              <Text style={[styles.pageActionText, styles.pageDeleteText]}>Delete</Text>
            </TouchableOpacity>
          </View>

          {hasError ? (
            <View style={styles.errorContent}>
              <Text style={styles.errorMessage}>Cannot load image</Text>
              <Text style={styles.errorDetail}>{hasError}</Text>
            </View>
          ) : (
            <>
              {isLoading && (
                <View style={styles.loadingOverlay}>
                  <ActivityIndicator size="large" color="#6B9071" />
                </View>
              )}
              <Image
                source={{ uri: item }}
                style={styles.documentImage}
                resizeMode="contain"
                onLoadStart={() => {
                  console.log(`Image ${index} - Loading started`);
                  setImageLoadingStates(prev => ({ ...prev, [index]: true }));
                }}
                onLoadEnd={() => {
                  console.log(`Image ${index} - Loading ended`);
                  setImageLoadingStates(prev => ({ ...prev, [index]: false }));
                }}
                onError={(error) => {
                  console.error(`Image ${index} - Error:`, error.nativeEvent.error);
                  setImageLoadErrors(prev => ({
                    ...prev,
                    [index]: error.nativeEvent.error || 'Unknown error',
                  }));
                }}
              />
            </>
          )}

          <View style={styles.pageNumber}>
            <Text style={styles.pageNumberText}>Page {index + 1}</Text>
          </View>
        </View>
      </View>
    );
  };

  if (!images || images.length === 0) {
    if (!pdfData) {
      return (
        <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>No documents scanned</Text>
            <TouchableOpacity
              style={[styles.button, styles.backButton]}
              onPress={() => navigation.goBack()}
            >
              <Text style={styles.buttonText}>Go Back</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }
  }

  // If PDF is provided, show PDF view
  if (pdfData) {
    const pdfUri = pdfData.uri.startsWith('file://')
      ? pdfData.uri
      : `file://${pdfData.uri}`;

    return (
      <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleCancel}>
            <Text style={styles.cancelButton}>x</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle}>PDF Preview</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* PDF Viewer */}
        <View style={styles.pdfContainer}>
          <Pdf
            source={{ uri: pdfUri }}
            onLoadComplete={(numberOfPages) => {
              console.log(`PDF has ${numberOfPages} pages`);
              setPdfPages(numberOfPages);
            }}
            onPageChanged={(page) => {
              setCurrentPage(page - 1);
            }}
            onError={(error: any) => {
              console.error('PDF error:', error);
              // More detailed error message
              let errorMsg = 'Cannot load PDF file';
              if (error?.message?.includes('permission')) {
                errorMsg = 'File permission error. Please check app permissions.';
              }
              setAlertConfig({
                title: 'Error',
                message: errorMsg,
                icon: '!',
                buttons: [
                  {
                    text: 'OK',
                    onPress: () => setAlertModalVisible(false),
                    style: 'default',
                  },
                ],
              });
              setAlertModalVisible(true);
            }}
            style={styles.pdf}
          />
        </View>

        {/* Page Indicator for PDF */}
        {pdfPages > 0 && (
          <View style={styles.pageIndicatorContainer}>
            <Text style={styles.pageIndicatorText}>
              {currentPage + 1} / {pdfPages}
            </Text>
          </View>
        )}

        {/* Info Section */}
        <View style={styles.infoSection}>
          <Text style={styles.infoText}>
            {pdfData.name}
          </Text>
          <Text style={styles.infoSubText}>
            Size: {(pdfData.size / 1024 / 1024).toFixed(2)} MB - {pdfPages} pages
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.summarizeButton, isProcessing && styles.buttonDisabled]}
            onPress={handleSummarize}
            disabled={isProcessing}
          >
            <Summarize_icon width={24} height={24} style={{ marginBottom: 4 }} />
            <Text style={styles.actionButtonText}>Summary</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.flashcardButton, isProcessing && styles.buttonDisabled]}
            onPress={handleCreateFlashcard}
            disabled={isProcessing}
          >
            <Flashcard_icon width={24} height={24} style={{ marginBottom: 4 }} />
            <Text style={styles.actionButtonText}>Flashcard</Text>
          </TouchableOpacity>
        </View>

        {/* Custom Alert Modal */}
        <CustomAlertModal
          visible={alertModalVisible}
          title={alertConfig.title}
          message={alertConfig.message}
          icon={alertConfig.icon}
          buttons={alertConfig.buttons}
          onDismiss={() => setAlertModalVisible(false)}
        />
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleCancel}>
          <Text style={styles.cancelButton}>x</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Scan Results</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Document Gallery */}
      <View style={styles.gallerySection}>
        <FlatList
          ref={flatListRef}
          data={images}
          renderItem={renderDocumentPage}
          keyExtractor={(_, index) => `page-${index}`}
          horizontal
          pagingEnabled
          scrollEventThrottle={16}
          onScroll={handleScroll}
          getItemLayout={(_, index) => ({
            length: width,
            offset: width * index,
            index,
          })}
          onScrollToIndexFailed={({ index }) => {
            setTimeout(() => {
              flatListRef.current?.scrollToOffset({
                offset: width * index,
                animated: true,
              });
            }, 150);
          }}
          showsHorizontalScrollIndicator={false}
        />

        {/* Page Indicator */}
        <View style={styles.pageIndicatorContainer}>
          <Text style={styles.pageIndicatorText}>
            {currentPage + 1} / {images.length}
          </Text>
        </View>

        {/* Dots Indicator */}
        <View style={styles.dotsContainer}>
          {images.map((_: string, index: number) => (
            <View
              key={`dot-${index}`}
              style={[
                styles.dot,
                currentPage === index ? styles.activeDot : styles.inactiveDot,
              ]}
            />
          ))}
        </View>
      </View>

      {/* Info Section */}
      <View style={styles.infoSection}>
        <Text style={styles.infoText}>
          Scanned {images.length} pages successfully!
        </Text>
        <Text style={styles.infoSubText}>
          You can summarize, create flashcards, or adjust individual pages.
        </Text>
      </View>

      {/* Action Buttons */}
      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.actionButton, styles.summarizeButton, isProcessing && styles.buttonDisabled]}
          onPress={handleSummarize}
          disabled={isProcessing}
        >
          <Summarize_icon width={24} height={24} style={{ marginBottom: 4 }} />
          <Text style={styles.actionButtonText}>Summary</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.flashcardButton, isProcessing && styles.buttonDisabled]}
          onPress={handleCreateFlashcard}
          disabled={isProcessing}
        >
          <Flashcard_icon width={24} height={24} style={{ marginBottom: 4 }} />
          <Text style={styles.actionButtonText}>Flashcard</Text>
        </TouchableOpacity>
      </View>

      {/* Secondary Action */}
      <View style={styles.secondaryActionsContainer}>
        <TouchableOpacity
          style={[
            styles.secondaryButton,
            styles.rescanButton,
            (isScanning || isProcessing) && styles.buttonDisabled,
          ]}
          onPress={handleRescan}
          disabled={isScanning || isProcessing}
        >
          <Text style={styles.secondaryButtonText}>
          {isScanning ? 'Scanning...' : 'Scan more pages'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Custom Alert Modal */}
      <CustomAlertModal
        visible={alertModalVisible}
        title={alertConfig.title}
        message={alertConfig.message}
        icon={alertConfig.icon}
        buttons={alertConfig.buttons}
        onDismiss={() => setAlertModalVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5EEDB',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 12,
    margin: 10,
    borderRadius: 10,
    backgroundColor: '#6B9071',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
  },
  cancelButton: {
    fontSize: 24,
    color: '#fff',
    fontWeight: '600',
    paddingHorizontal: 10,
  },
  gallerySection: {
    height: GALLERY_HEIGHT + 50, // image area + page indicator
    marginVertical: 10,
  },
  pageContainer: {
    width: width,          // full width; FlatList handles paging
    paddingHorizontal: 20,
    height: GALLERY_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pageWrapper: {
    width: '100%',
    height: GALLERY_HEIGHT,
    backgroundColor: '#fff',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  documentImage: {
    width: '100%',
    height: '100%',
  },
  pageActionsOverlay: {
    position: 'absolute',
    top: 10,
    right: 10,
    zIndex: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pageActionButton: {
    minWidth: 78,
    height: 32,
    paddingHorizontal: 9,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(245, 238, 219, 0.94)',
    borderWidth: 1,
    borderColor: 'rgba(107, 144, 113, 0.45)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.14,
    shadowRadius: 2,
    elevation: 3,
  },
  pageActionButtonBusy: {
    minWidth: 40,
  },
  pageDeleteButton: {
    backgroundColor: 'rgba(255, 246, 244, 0.96)',
    borderColor: 'rgba(164, 86, 75, 0.34)',
  },
  pageActionText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '800',
    color: '#2D5341',
  },
  pageDeleteText: {
    color: '#8B3F35',
  },
  pageNumber: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(107, 144, 113, 0.9)',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  pageNumberText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },

  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    zIndex: 5,
  },
  errorContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#ffe6e6',
  },
  errorMessage: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#c33',
    marginBottom: 8,
  },
  errorDetail: {
    fontSize: 10,
    color: '#666',
    paddingHorizontal: 10,
    textAlign: 'center',
  },
  pageIndicatorContainer: {
    alignItems: 'center',
    marginBottom: 10,
  },
  pageIndicatorText: {
    fontSize: 14,
    color: '#555',
    fontWeight: '600',
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 6,
    marginBottom: 5,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  activeDot: {
    backgroundColor: '#6B9071',
    width: 24,
  },
  inactiveDot: {
    backgroundColor: '#C5D8C0',
  },
  infoSection: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#fff',
    borderRadius: 10,
    marginHorizontal: 10,
    marginBottom: 15,
  },
  infoText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2D5341',
    marginBottom: 5,
  },
  infoSubText: {
    fontSize: 12,
    color: '#666',
    lineHeight: 18,
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 10,
    marginBottom: 12,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 3,
    elevation: 4,
  },
  summarizeButton: {
    backgroundColor: '#AEC3B0',
  },
  flashcardButton: {
    backgroundColor: '#AEC3B0',
  },
  actionButtonText: {
    color: '#344E39',
    fontSize: 12,
    fontWeight: '700',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  secondaryActionsContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  secondaryButton: {
    paddingVertical: 11,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
  },
  rescanButton: {
    borderColor: '#6B9071',
    backgroundColor: '#6B9071',
    width: '50%',
  },
  secondaryButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
  },
  backButton: {
    backgroundColor: '#6B9071',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 10,
  },
  button: {
    justifyContent: 'center',
    alignItems: 'center',
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
  pdfContainer: {
    flex: 1,
    margin: 10,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  pdf: {
    flex: 1,
    backgroundColor: '#f0f0f0',
  },
});

export default DocumentScanResultScreen;
