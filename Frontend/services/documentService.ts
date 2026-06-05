/**
 * Document Service
 * Xử lý OCR và Summary operations
 */

import { storageService } from '../utils/storageService';
import RNFetchBlob from 'react-native-blob-util';

const API_URL = 'https://api.mealsretrieval.site';

export interface OCRResponse {
  success: boolean;
  message: string;
  data: OCRData;
}

export interface OCRBlock {
  page: number;
  group_idx: number;
  box_idx: number;
  label: string;
  coordinate: number[];
  ocr_text: string;
}

export interface FlashcardQA {
  question: string;
  answer: string;
  explain?: string;
}

export interface FlashcardBlock extends OCRBlock {
  flashcards: FlashcardQA[];
  flashcard_raw_output?: string;
}

export interface FlashcardProcessData {
  flashcard_data: FlashcardBlock[];
  total_cards: number;
  num_blocks: number;
  processing_time: string;
}

export interface OCRData {
  ocr_results: OCRBlock[];
  extracted_text: string;
  file_name: string;
  processing_time: string;
  text_length: number;
  num_blocks: number;
}

export interface SummaryResponse {
  success: boolean;
  message: string;
  data: SummaryData;
}

export interface SummaryData {
  pages: { [key: string]: string };
  full_summary: string;
  structured_summary?: Array<OCRBlock & { summary?: string }> | null;
  key_takeaways?: string[];
  processing_time: string;
  num_pages: number;
}

export interface TakeawayResponse {
  success: boolean;
  message: string;
  data: {
    key_takeaways: string[];
    processing_time: string;
    total_takeaways: number;
  };
}

export interface ProcessedDocumentData {
  ocrData: OCRData;
  summaryData: SummaryData;
}

export interface DocumentResponse {
  success: boolean;
  message: string;
    data: {
      id: number;
      user_id: number;
      title: string;
      source_file_name?: string | null;
      ocr_data?: OCRData | null;
      extracted_text?: string | null;
      summary_data: SummaryData;
      key_takeaways?: string[] | null;
    tags?: string[];
    is_favorite: boolean;
    created_at: string;
    updated_at: string;
  };
}

export interface DocumentListItem {
  id: number;
  title: string;
  source_file_name?: string | null;
  tags?: string[];
  is_favorite: boolean;
  created_at: string;
}

export interface DocumentListResponse {
  success: boolean;
  message: string;
  data: DocumentListItem[];
}

export interface DocumentTitleResponse {
  success: boolean;
  message: string;
  data: {
    title: string;
  };
}

export interface FlashcardSet {
  id: number;
  user_id: number;
  document_id?: number | null;
  title: string;
  source_file_name?: string | null;
  flashcard_data: FlashcardBlock[];
  total_cards: number;
  tags?: string[];
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export interface FlashcardListItem {
  id: number;
  document_id?: number | null;
  title: string;
  source_file_name?: string | null;
  total_cards: number;
  tags?: string[];
  is_favorite: boolean;
  created_at: string;
}

export interface FlashcardProcessResponse {
  success: boolean;
  message: string;
  data: FlashcardProcessData;
}

export interface FlashcardSetResponse {
  success: boolean;
  message: string;
  data: FlashcardSet;
}

export interface FlashcardListResponse {
  success: boolean;
  message: string;
  data: FlashcardListItem[];
}

const getApiErrorMessage = (responseData: any, fallback: string) =>
  responseData?.message || responseData?.detail || fallback;

export type DocumentDataDomain = 'documents' | 'flashcards';
export type DocumentDataChangeListener = (domain: DocumentDataDomain) => void;

const countValidFlashcards = (flashcardData: FlashcardBlock[] = []) =>
  flashcardData.reduce(
    (total, block) =>
      total +
      (block.flashcards || []).filter(
        card => card.question?.trim() && card.answer?.trim()
      ).length,
    0
  );

class DocumentService {
  private documentsCache: DocumentListItem[] | null = null;
  private documentsRequest: Promise<DocumentListItem[]> | null = null;
  private flashcardSetsCache = new Map<string, FlashcardListItem[]>();
  private flashcardSetsRequests = new Map<string, Promise<FlashcardListItem[]>>();
  private dataChangeListeners = new Set<DocumentDataChangeListener>();

  subscribeToDataChanges(listener: DocumentDataChangeListener): () => void {
    this.dataChangeListeners.add(listener);
    return () => {
      this.dataChangeListeners.delete(listener);
    };
  }

  private notifyDataChanged(domain: DocumentDataDomain) {
    this.dataChangeListeners.forEach(listener => listener(domain));
  }

  private invalidateDocumentsCache() {
    this.documentsCache = null;
    this.documentsRequest = null;
    this.notifyDataChanged('documents');
  }

  private invalidateFlashcardsCache() {
    this.flashcardSetsCache.clear();
    this.flashcardSetsRequests.clear();
    this.notifyDataChanged('flashcards');
  }

  private flashcardCacheKey(documentId?: number): string {
    return typeof documentId === 'number' ? `document:${documentId}` : 'all';
  }

  /**
   * Process OCR - Upload file (ảnh/PDF) và trích xuất text
   * @param filePath - đường dẫn đến file cần xử lý
   * @param centerTolerance - ngưỡng gom nhóm layout (default 50)
   * @returns extracted text từ file
   */
  async processOCR(
    filePath: string,
    centerTolerance: number = 50
  ): Promise<OCRData> {
    try {
      const accessToken = await storageService.getAccessToken();
      
      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      // Lấy tên file từ path và đảm bảo có extension
      let fileName = filePath.split('/').pop() || 'document';
      const mimeType = this.getMimeType(filePath);
      const ext = filePath.split('.').pop()?.toLowerCase() || '';

      console.log(`[OCR] Original filename: ${fileName}`);
      
      // Ensure filename has proper extension
      if (!fileName.includes('.')) {
        // Add extension based on MIME type
        const extMap: { [key: string]: string } = {
          'application/pdf': 'pdf',
          'image/png': 'png',
          'image/jpeg': 'jpg',
        };
        const fileExt = extMap[mimeType] || ext;
        fileName = `${fileName}.${fileExt}`;
      }

      console.log(`[OCR] Final filename: ${fileName}`);
      console.log(`[OCR] File path: ${filePath}`);
      console.log(`[OCR] MIME type: ${mimeType}`);

      // Check if file exists
      const exists = await RNFetchBlob.fs.exists(filePath);
      if (!exists) {
        throw new Error(`File not found at path: ${filePath}`);
      }
      console.log(`[OCR] File exists: true`);

      // Read file
      const fileContent = await RNFetchBlob.fs.readFile(filePath, 'base64');
      console.log(`[OCR] File read successfully, size: ${fileContent.length} bytes`);

      // Build request - use correct format for multipart
      // RNFetchBlob expects the file data as base64 string when type is set
      const response = await RNFetchBlob.fetch(
        'POST',
        `${API_URL}/api/ocr/process?center_tolerance=${centerTolerance}`,
        {
          'Authorization': `Bearer ${accessToken}`,
        },
        [
          {
            name: 'file',
            filename: fileName,
            type: mimeType,
            data: fileContent,  // This is base64 string
          },
        ]
      );

      console.log(`[OCR] Response received`);
      console.log(`[OCR] Response data length: ${response.data.length}`);
      
      let ocrData: OCRResponse;
      try {
        ocrData = JSON.parse(response.data);
      } catch (parseError) {
        console.error('[OCR] Failed to parse response:', response.data.substring(0, 500));
        throw new Error(`Invalid response format from OCR API: ${response.data.substring(0, 200)}`);
      }

      if (!ocrData.success) {
        throw new Error(ocrData.message || 'OCR processing failed');
      }

      console.log(`[OCR] Success! Extracted text length: ${ocrData.data.text_length}`);
      
      return ocrData.data;
    } catch (error) {
      console.error('[OCR Error]:', error);
      throw error;
    }
  }

  /**
   * Process Summary - Tóm tắt nội dung text
   * @param textContent - text được trích xuất từ OCR
   * @param llmEndpoint - URL của LLM API (optional)
   * @param modelName - tên model LLM (optional)
   * @returns summary data (pages + full_summary)
   */
  async processSummary(
    input: OCRData | string,
    llmEndpoint?: string,
    modelName?: string
  ): Promise<SummaryResponse['data']> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const isLegacyText = typeof input === 'string';
      const textContent = isLegacyText ? input : input.extracted_text;
      const ocrResults = isLegacyText ? undefined : input.ocr_results;

      if (
        (!ocrResults || ocrResults.length === 0) &&
        (!textContent || textContent.trim().length === 0)
      ) {
        throw new Error('OCR content cannot be empty');
      }

      console.log('[Summary] Processing OCR result...');

      const payload: any = {
        ...(ocrResults && ocrResults.length > 0
          ? { ocr_results: ocrResults }
          : { text_content: textContent }),
      };

      if (llmEndpoint) {
        payload.llm_endpoint = llmEndpoint;
      }

      if (modelName) {
        payload.model_name = modelName;
      }

      const response = await fetch(`${API_URL}/api/summary/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const summaryData: SummaryResponse = await response.json();

      if (!response.ok) {
        throw new Error(summaryData.message || 'Summary processing failed');
      }

      console.log(`[Summary] Success! Created ${summaryData.data.num_pages} summaries`);

      return summaryData.data;
    } catch (error) {
      console.error('[Summary Error]:', error);
      throw error;
    }
  }

  /**
   * Complete flow: OCR + Summary
   * @param filePath - đường dẫn file để xử lý
   * @returns summary data
   */
  async processOCRAndSummary(filePath: string): Promise<ProcessedDocumentData> {
    try {
      console.log('[Document Processing] Starting OCR + Summary + Takeaways flow...');

      // Step 1: OCR
      const ocrData = await this.processOCR(filePath);

      // Step 2: Summary
      const summaryData = await this.processSummary(ocrData);

      // Step 3: Key takeaways
      const keyTakeaways = await this.processTakeaways(summaryData, ocrData);

      console.log('[Document Processing] Complete!');

      return {
        ocrData,
        summaryData: {
          ...summaryData,
          key_takeaways: keyTakeaways,
        },
      };
    } catch (error) {
      console.error('[Document Processing Error]:', error);
      throw error;
    }
  }

  /**
   * Xác định MIME type từ file extension
   */
  async processTakeaways(
    summaryData: SummaryData,
    ocrData?: OCRData | null,
    llmEndpoint?: string,
    modelName?: string
  ): Promise<string[]> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const payload: any = {
        summary_data: summaryData,
      };

      if (ocrData?.ocr_results?.length) {
        payload.ocr_results = ocrData.ocr_results;
      }

      if (llmEndpoint) {
        payload.llm_endpoint = llmEndpoint;
      }

      if (modelName) {
        payload.model_name = modelName;
      }

      const response = await fetch(`${API_URL}/api/takeaways/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      });

      const takeawayResponse: TakeawayResponse = await response.json();

      if (!response.ok || !takeawayResponse.success) {
        throw new Error(getApiErrorMessage(takeawayResponse, 'Failed to create key takeaways'));
      }

      return takeawayResponse.data.key_takeaways || [];
    } catch (error) {
      console.error('[Takeaways Error]:', error);
      return [];
    }
  }

  async processFlashcards(ocrData: OCRData): Promise<FlashcardProcessData> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      if (!ocrData.ocr_results || ocrData.ocr_results.length === 0) {
        throw new Error('OCR results cannot be empty');
      }

      const response = await fetch(`${API_URL}/api/flashcards/process`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          ocr_results: ocrData.ocr_results,
        }),
      });

      const processResponse: FlashcardProcessResponse = await response.json();

      if (!response.ok || !processResponse.success) {
        throw new Error(getApiErrorMessage(processResponse, 'Failed to create flashcards'));
      }

      if (
        !processResponse.data ||
        processResponse.data.total_cards <= 0 ||
        countValidFlashcards(processResponse.data.flashcard_data) <= 0
      ) {
        throw new Error('LLM did not return any valid flashcards. Please try again with a clearer document.');
      }

      return processResponse.data;
    } catch (error) {
      console.error('[Flashcard Process Error]:', error);
      throw error;
    }
  }

  async saveFlashcardSet(
    title: string,
    flashcardData: FlashcardBlock[],
    options?: {
      documentId?: number | null;
      sourceFileName?: string | null;
      tags?: string[];
    }
  ): Promise<FlashcardSet> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      if (!title || title.trim().length === 0) {
        throw new Error('Flashcard title cannot be empty');
      }

      if (!flashcardData || countValidFlashcards(flashcardData) <= 0) {
        throw new Error('Cannot save an empty flashcard set');
      }

      const payload = {
        title: title.trim(),
        document_id: options?.documentId ?? undefined,
        source_file_name: options?.sourceFileName ?? undefined,
        flashcard_data: flashcardData,
        tags: options?.tags || ['Flashcard'],
      };

      const response = await fetch(`${API_URL}/api/flashcards/save?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const saveResponse: FlashcardSetResponse = await response.json();

      if (!response.ok || !saveResponse.success) {
        throw new Error(getApiErrorMessage(saveResponse, 'Failed to save flashcards'));
      }

      this.invalidateFlashcardsCache();
      return saveResponse.data;
    } catch (error) {
      console.error('[Flashcard Save Error]:', error);
      throw error;
    }
  }

  async getFlashcardSets(documentId?: number, forceRefresh: boolean = false): Promise<FlashcardListItem[]> {
    const cacheKey = this.flashcardCacheKey(documentId);

    if (!forceRefresh && this.flashcardSetsCache.has(cacheKey)) {
      return this.flashcardSetsCache.get(cacheKey) || [];
    }

    if (!forceRefresh && this.flashcardSetsRequests.has(cacheKey)) {
      return this.flashcardSetsRequests.get(cacheKey)!;
    }

    const request = this.fetchFlashcardSets(documentId).finally(() => {
      this.flashcardSetsRequests.delete(cacheKey);
    });
    this.flashcardSetsRequests.set(cacheKey, request);
    return request;
  }

  private async fetchFlashcardSets(documentId?: number): Promise<FlashcardListItem[]> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const documentQuery = documentId ? `&document_id=${encodeURIComponent(documentId)}` : '';
      const response = await fetch(`${API_URL}/api/flashcards/list?access_token=${encodeURIComponent(accessToken)}${documentQuery}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const listResponse: FlashcardListResponse = await response.json();

      if (!response.ok || !listResponse.success) {
        throw new Error(getApiErrorMessage(listResponse, 'Failed to fetch flashcards'));
      }

      const data = listResponse.data || [];
      this.flashcardSetsCache.set(this.flashcardCacheKey(documentId), data);
      return data;
    } catch (error) {
      console.error('[Flashcard List Error]:', error);
      throw error;
    }
  }

  async getFlashcardDetail(flashcardId: number): Promise<FlashcardSet> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(`${API_URL}/api/flashcards/${flashcardId}?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const detailResponse: FlashcardSetResponse = await response.json();

      if (!response.ok || !detailResponse.success) {
        throw new Error(getApiErrorMessage(detailResponse, 'Failed to fetch flashcard detail'));
      }

      return detailResponse.data;
    } catch (error) {
      console.error('[Flashcard Detail Error]:', error);
      throw error;
    }
  }

  async toggleFlashcardFavorite(flashcardId: number, isFavorite: boolean): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(`${API_URL}/api/flashcards/${flashcardId}/favorite?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          is_favorite: isFavorite,
        }),
      });

      const toggleResponse = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(toggleResponse, 'Failed to update flashcard favorite'));
      }
      this.flashcardSetsCache.forEach((sets, key) => {
        this.flashcardSetsCache.set(
          key,
          sets.map(set =>
            set.id === flashcardId ? { ...set, is_favorite: isFavorite } : set
          )
        );
      });
      this.notifyDataChanged('flashcards');
    } catch (error) {
      console.error('[Flashcard Favorite Error]:', error);
      throw error;
    }
  }

  async deleteFlashcardSet(flashcardId: number): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(`${API_URL}/api/flashcards/${flashcardId}?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const deleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(getApiErrorMessage(deleteResponse, 'Failed to delete flashcard set'));
      }
      this.invalidateFlashcardsCache();
    } catch (error) {
      console.error('[Flashcard Delete Error]:', error);
      throw error;
    }
  }

  private getMimeType(filePath: string): string {
    const ext = filePath.split('.').pop()?.toLowerCase() || '';
    
    const mimeTypes: { [key: string]: string } = {
      'pdf': 'application/pdf',
      'png': 'image/png',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
    };

    return mimeTypes[ext] || 'application/octet-stream';
  }

  /**
   * Save Document - Lưu tài liệu đã tóm tắt vào database
   * @param title - Tên tài liệu
   * @param summaryData - Dữ liệu tóm tắt từ OCR + Summary
   * @param tags - Tags cho document (optional)
   * @returns saved document data
   */
  async saveDocument(
    title: string,
    summaryData: SummaryData,
    ocrData?: OCRData | null,
    tags?: string[]
  ): Promise<DocumentResponse['data']> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      if (!title || title.trim().length === 0) {
        throw new Error('Document title cannot be empty');
      }

      console.log('[Document Save] Saving document...');

      const payload = {
        title: title.trim(),
        ocr_data: ocrData || undefined,
        source_file_name: ocrData?.file_name,
        extracted_text: ocrData?.extracted_text,
        summary_data: summaryData,
        key_takeaways: summaryData.key_takeaways || [],
        tags: tags || [],
      };

      const response = await fetch(`${API_URL}/api/documents/save?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const saveResponse: DocumentResponse = await response.json();

      if (!response.ok) {
        throw new Error(saveResponse.message || 'Failed to save document');
      }

      console.log(`[Document Save] Document saved successfully with ID: ${saveResponse.data.id}`);

      this.invalidateDocumentsCache();
      return saveResponse.data;
    } catch (error) {
      console.error('[Document Save Error]:', error);
      throw error;
    }
  }

  async generateDocumentTitle(summaryData: SummaryData): Promise<string> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      const response = await fetch(`${API_URL}/api/documents/generate-title?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          summary_data: summaryData,
        }),
      });

      const titleResponse: DocumentTitleResponse = await response.json();

      if (!response.ok || !titleResponse.success) {
        throw new Error(getApiErrorMessage(titleResponse, 'Failed to generate document title'));
      }

      return titleResponse.data.title || 'Scanned Document';
    } catch (error) {
      console.error('[Document Title Error]:', error);
      throw error;
    }
  }

  /**
   * Get Documents List - Lấy danh sách documents của user
   * @returns array of documents
   */
  async getDocuments(forceRefresh: boolean = false): Promise<DocumentListItem[]> {
    if (!forceRefresh && this.documentsCache) {
      return this.documentsCache;
    }

    if (!forceRefresh && this.documentsRequest) {
      return this.documentsRequest;
    }

    this.documentsRequest = this.fetchDocuments().finally(() => {
      this.documentsRequest = null;
    });
    return this.documentsRequest;
  }

  private async fetchDocuments(): Promise<DocumentListItem[]> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      console.log('[Documents List] Fetching documents...');

      const response = await fetch(`${API_URL}/api/documents/list?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const listResponse: DocumentListResponse = await response.json();

      if (!response.ok) {
        throw new Error(listResponse.message || 'Failed to fetch documents');
      }

      console.log(`[Documents List] Fetched ${listResponse.data.length} documents`);

      this.documentsCache = listResponse.data;
      return listResponse.data;
    } catch (error) {
      console.error('[Documents List Error]:', error);
      throw error;
    }
  }

  /**
   * Get Document Detail - Lấy chi tiết một document
   * @param documentId - ID của document
   * @returns document details
   */
  async getDocumentDetail(documentId: number): Promise<DocumentResponse['data']> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      console.log(`[Document Detail] Fetching document ${documentId}...`);

      const response = await fetch(`${API_URL}/api/documents/${documentId}?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const detailResponse: DocumentResponse = await response.json();

      if (!response.ok) {
        throw new Error(detailResponse.message || 'Failed to fetch document');
      }

      console.log(`[Document Detail] Fetched document: ${detailResponse.data.title}`);

      return detailResponse.data;
    } catch (error) {
      console.error('[Document Detail Error]:', error);
      throw error;
    }
  }

  /**
   * Delete Document - Xóa một document
   * @param documentId - ID của document
   */
  async deleteDocument(documentId: number): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      console.log(`[Document Delete] Deleting document ${documentId}...`);

      const response = await fetch(`${API_URL}/api/documents/${documentId}?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const deleteResponse = await response.json();

      if (!response.ok) {
        throw new Error(deleteResponse.message || 'Failed to delete document');
      }

      console.log(`[Document Delete] Document deleted successfully`);
      this.invalidateDocumentsCache();
      this.invalidateFlashcardsCache();
    } catch (error) {
      console.error('[Document Delete Error]:', error);
      throw error;
    }
  }

  /**
   * Toggle Favorite - Cập nhật trạng thái yêu thích
   * @param documentId - ID của document
   * @param isFavorite - Trạng thái yêu thích
   */
  async toggleFavorite(documentId: number, isFavorite: boolean): Promise<void> {
    try {
      const accessToken = await storageService.getAccessToken();

      if (!accessToken) {
        throw new Error('Unauthorized: No access token found');
      }

      console.log(`[Favorite Toggle] Updating document ${documentId} favorite status...`);

      const payload = {
        is_favorite: isFavorite,
      };

      const response = await fetch(`${API_URL}/api/documents/${documentId}/favorite?access_token=${encodeURIComponent(accessToken)}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const toggleResponse = await response.json();

      if (!response.ok) {
        throw new Error(toggleResponse.message || 'Failed to update favorite status');
      }

      console.log(`[Favorite Toggle] Updated successfully`);
      if (this.documentsCache) {
        this.documentsCache = this.documentsCache.map(document =>
          document.id === documentId
            ? { ...document, is_favorite: isFavorite }
            : document
        );
      }
      this.notifyDataChanged('documents');
    } catch (error) {
      console.error('[Favorite Toggle Error]:', error);
      throw error;
    }
  }
}

export const documentService = new DocumentService();
