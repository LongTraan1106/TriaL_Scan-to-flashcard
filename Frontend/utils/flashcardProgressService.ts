import AsyncStorage from '@react-native-async-storage/async-storage';

export type FlashcardStudyStatus = 'known' | 'unknown';

export interface FlashcardSetProgress {
  setId: number;
  knownCount: number;
  studiedCount: number;
  totalCards: number;
  statuses: Record<string, FlashcardStudyStatus>;
  updatedAt: string;
}

type ProgressListener = (setId: number, progress: FlashcardSetProgress) => void;

const STORAGE_PREFIX = '@study_helper_flashcard_progress:';

class FlashcardProgressService {
  private listeners = new Set<ProgressListener>();

  subscribe(listener: ProgressListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  async getProgress(setId: number, totalCards: number = 0): Promise<FlashcardSetProgress> {
    try {
      const stored = await AsyncStorage.getItem(this.storageKey(setId));
      if (!stored) {
        return this.emptyProgress(setId, totalCards);
      }

      const parsed = JSON.parse(stored) as Partial<FlashcardSetProgress>;
      const statuses = parsed.statuses || {};
      return this.normalizeProgress(setId, statuses, totalCards || parsed.totalCards || 0);
    } catch (error) {
      console.error('[Flashcard Progress] Cannot read progress:', error);
      return this.emptyProgress(setId, totalCards);
    }
  }

  async getProgressMap(
    sets: Array<{ id: number; total_cards: number }>
  ): Promise<Record<number, FlashcardSetProgress>> {
    const entries = await Promise.all(
      sets.map(async set => [set.id, await this.getProgress(set.id, set.total_cards)] as const)
    );
    return entries.reduce((map, [setId, progress]) => {
      map[setId] = progress;
      return map;
    }, {} as Record<number, FlashcardSetProgress>);
  }

  async markCard(
    setId: number,
    cardId: string,
    status: FlashcardStudyStatus,
    totalCards: number
  ): Promise<FlashcardSetProgress> {
    const current = await this.getProgress(setId, totalCards);
    const next = this.normalizeProgress(
      setId,
      {
        ...current.statuses,
        [cardId]: status,
      },
      totalCards
    );

    await AsyncStorage.setItem(this.storageKey(setId), JSON.stringify(next));
    this.listeners.forEach(listener => listener(setId, next));
    return next;
  }

  async clearProgress(setId: number): Promise<void> {
    await AsyncStorage.removeItem(this.storageKey(setId));
  }

  private normalizeProgress(
    setId: number,
    statuses: Record<string, FlashcardStudyStatus>,
    totalCards: number
  ): FlashcardSetProgress {
    const values = Object.values(statuses);
    return {
      setId,
      knownCount: values.filter(status => status === 'known').length,
      studiedCount: values.length,
      totalCards,
      statuses,
      updatedAt: new Date().toISOString(),
    };
  }

  private emptyProgress(setId: number, totalCards: number): FlashcardSetProgress {
    return this.normalizeProgress(setId, {}, totalCards);
  }

  private storageKey(setId: number): string {
    return `${STORAGE_PREFIX}${setId}`;
  }
}

export const flashcardProgressService = new FlashcardProgressService();
