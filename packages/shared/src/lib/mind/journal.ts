import { 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  limit
} from 'firebase/firestore';
import { db } from '../common/firebase';
import { 
  getUserSubcollectionDoc, 
  updateUserSubcollectionDoc, 
  userCache
} from '../common/cache';

export interface JournalEntry {
  id?: string;
  content: string;
  wordCount: number;
  timestamp: Date | any;
  completed: boolean;
  date: string; // YYYY-MM-DD format
}

export interface JournalTheme {
  name: string;
  background: string;
  textColor: string;
  accentColor: string;
  borderColor: string;
}

// Available themes for journal
export const journalThemes: JournalTheme[] = [
  {
    name: 'Light Yellow',
    background: 'bg-amber-50',
    textColor: 'text-gray-800',
    accentColor: 'bg-amber-500',
    borderColor: 'border-amber-200'
  },
  {
    name: 'Light Green',
    background: 'bg-green-50',
    textColor: 'text-gray-800',
    accentColor: 'bg-green-500',
    borderColor: 'border-green-200'
  },
  {
    name: 'Dark',
    background: 'bg-gray-900',
    textColor: 'text-gray-100',
    accentColor: 'bg-indigo-500',
    borderColor: 'border-gray-700'
  }
];

// Encouraging messages for journal writing
export const encouragingMessages = [
  "Writing today keeps the stress away! ✨",
  "Your thoughts matter. Let them flow! 🌊",
  "Future you will thank present you for journaling today! 🙏",
  "Mental clarity is just a few sentences away... 🧠",
  "Think of this as texting your future self! 📱",
  "Even a few words can make a big difference. Start small! 🌱",
  "Today's journal is tomorrow's treasure! 💎",
  "Your journal won't judge ��� it just listens. 👂",
  "Capture your thoughts before they escape! 🦋"
];

// Constants for caching TTLs
const JOURNAL_ENTRY_CACHE_TTL = 60 * 60 * 1000;       // 1 hour for individual past entries (read-only)
const JOURNAL_TODAY_CACHE_TTL = 2 * 60 * 1000;        // 2 minutes for today's entry (editable)
const JOURNAL_MONTH_CACHE_TTL = 12 * 60 * 60 * 1000;  // 12 hours for month views of past entries
const JOURNAL_TODAY_MONTH_CACHE_TTL = 5 * 60 * 1000;  // 5 minutes for current month (includes today)
const LOCAL_STORAGE_KEY = 'journal_recent_entries';

/**
 * Format date as YYYY-MM-DD for consistent storage
 */
export const formatDateKey = (date: Date): string => {
  if (!date || isNaN(date.getTime())) {
    // Return today's date as fallback without logging
    return new Date().toISOString().slice(0, 10);
  }
  
  return date.toISOString().slice(0, 10);
};

/**
 * Get today's date key in user's timezone
 */
export const getTodayKey = (): string => {
  return formatDateKey(new Date());
};

/**
 * Check if a date is today with simple string comparison of date keys
 */
export const isToday = (date: Date): boolean => {
  if (!date || isNaN(date.getTime())) {
    return false;
  }
  
  try {
    return formatDateKey(date) === getTodayKey();
  } catch (err) {
    console.error("Error checking if date is today:", err);
    return false;
  }
};

/**
 * Get a random encouraging message
 */
export const getRandomEncouragingMessage = (): string => {
  return encouragingMessages[Math.floor(Math.random() * encouragingMessages.length)];
};

// Safe localStorage helpers with error handling
const getLocalStorageEntry = (userId: string, dateKey: string): JournalEntry | null => {
  try {
    const storageKey = `${LOCAL_STORAGE_KEY}_${userId}`;
    const storedData = localStorage.getItem(storageKey);
    if (!storedData) return null;
    
    const entries = JSON.parse(storedData) as Record<string, any>;
    const entry = entries[dateKey];
    if (!entry) return null;
    
    // Safely convert timestamp string to Date
    if (entry.timestamp) {
      try {
        entry.timestamp = new Date(entry.timestamp);
      } catch (e) {
        entry.timestamp = new Date();
      }
    } else {
      entry.timestamp = new Date();
    }
    
    return entry as JournalEntry;
  } catch (e) {
    console.warn('Error reading from local storage', e);
    return null;
  }
};

const setLocalStorageEntry = (userId: string, dateKey: string, entry: JournalEntry): void => {
  try {
    const storageKey = `${LOCAL_STORAGE_KEY}_${userId}`;
    let entries: Record<string, any> = {};
    
    // Get existing entries
    try {
      const storedData = localStorage.getItem(storageKey);
      if (storedData) entries = JSON.parse(storedData);
    } catch (e) {
      console.warn('Error parsing stored journal data, resetting', e);
    }
    
    // Create safe entry copy with serializable timestamp 
    const safeEntry = { ...entry };
    safeEntry.timestamp = new Date().toISOString();
    
    // Add entry to store
    entries = { ...entries, [dateKey]: safeEntry };
    
    // Limit to 5 most recent entries
    const entryKeys = Object.keys(entries).sort().reverse();
    if (entryKeys.length > 5) {
      const newEntries: Record<string, any> = {};
      entryKeys.slice(0, 5).forEach(key => {
        newEntries[key] = entries[key];
      });
      entries = newEntries;
    }
    
    localStorage.setItem(storageKey, JSON.stringify(entries));
  } catch (e) {
    console.warn('Error writing to local storage', e);
  }
};

// Clear journal caches including localStorage
export const clearJournalCaches = (userId: string): number => {
  if (!userId) return 0;
  
  try {
    localStorage.removeItem(`${LOCAL_STORAGE_KEY}_${userId}`);
  } catch (e) {
    console.warn('Error clearing localStorage:', e);
  }
  
  // Clear all journal-related cache entries
  const keysToDelete = userCache.keys().filter(key => 
    key.includes(`-${userId}-journals`)
  );
  
  keysToDelete.forEach(key => userCache.delete(key));
  return keysToDelete.length;
};

/**
 * Load a journal entry for a specific date
 */
export const loadJournalEntry = async (userId: string, date: Date): Promise<JournalEntry | null> => {
  if (!userId) return null;

  try {
    const dateKey = formatDateKey(date);
    const todayKey = getTodayKey();
    const isTodaysEntry = dateKey === todayKey;
    
    // Use localStorage for today's entry for better performance
    if (isTodaysEntry) {
      const localEntry = getLocalStorageEntry(userId, dateKey);
      if (localEntry) return localEntry;
    }
    
    // Choose appropriate TTL based on whether it's today's entry
    const cacheTTL = isTodaysEntry ? JOURNAL_TODAY_CACHE_TTL : JOURNAL_ENTRY_CACHE_TTL;
    
    // Load from database via cache service
    const journalEntry = await getUserSubcollectionDoc(
      userId, 'journals', dateKey, cacheTTL
    );
    
    if (journalEntry && journalEntry.content) {
      // Handle timestamp sanitization quietly without excessive logging
      let timestamp = new Date();
      
      if (journalEntry.timestamp) {
        try {
          // Handle different formats of timestamps
          if (journalEntry.timestamp?.toDate && typeof journalEntry.timestamp.toDate === 'function') {
            timestamp = journalEntry.timestamp.toDate();
          } else if (journalEntry.timestamp?.seconds && journalEntry.timestamp?.nanoseconds) {
            timestamp = new Date(
              journalEntry.timestamp.seconds * 1000 + 
              journalEntry.timestamp.nanoseconds / 1000000
            );
          } else if (journalEntry.timestamp instanceof Date) {
            timestamp = journalEntry.timestamp;
          } else if (typeof journalEntry.timestamp === 'string') {
            timestamp = new Date(journalEntry.timestamp);
          } else if (typeof journalEntry.timestamp === 'number') {
            timestamp = new Date(journalEntry.timestamp);
          }
          
          // Final validation
          if (isNaN(timestamp.getTime())) {
            timestamp = isTodaysEntry ? new Date() : new Date(dateKey);
          }
        } catch (e) {
          timestamp = isTodaysEntry ? new Date() : new Date(dateKey);
        }
      } else {
        timestamp = isTodaysEntry ? new Date() : new Date(dateKey);
      }
      
      const entry: JournalEntry = {
        id: journalEntry.id,
        content: journalEntry.content,
        wordCount: journalEntry.wordCount || 0,
        timestamp: timestamp,
        completed: !!journalEntry.completed,
        date: dateKey
      };
      
      if (isTodaysEntry) {
        setLocalStorageEntry(userId, dateKey, entry);
      }
      
      return entry;
    }
    
    return null;
  } catch (error) {
    console.error('Error loading journal entry:', error);
    return null;
  }
};

/**
 * Save a journal entry - only allows saving today's entry
 */
export const saveJournalEntry = async (
  userId: string, 
  entry: JournalEntry
): Promise<boolean> => {
  if (!userId || !entry.content.trim()) return false;
  
  try {
    // Double-check this is today's entry
    const todayKey = getTodayKey();
    if (entry.date !== todayKey) {
      return false; // Silently fail in production - don't log error
    }
    
    // Save to localStorage first for better perceived performance
    setLocalStorageEntry(userId, entry.date, entry);
    
    // Prepare entry for Firestore (with serverTimestamp)
    const firestoreEntry = {
      content: entry.content.trim(),
      wordCount: entry.wordCount || 0,
      completed: !!entry.completed,
      date: entry.date,
      timestamp: serverTimestamp() // Use Firestore serverTimestamp
    };
    
    // Save using cache service
    await updateUserSubcollectionDoc(
      userId, 'journals', entry.date, firestoreEntry
    );
    
    return true;
  } catch (error) {
    console.error('Error saving journal entry:', error);
    return false;
  }
};

/**
 * Get all journal entries for a specific month
 */
export const getMonthEntries = async (
  userId: string, 
  year: number, 
  month: number
): Promise<{[date: string]: JournalEntry}> => {
  if (!userId) return {};
  
  try {
    // Format month for cache key
    const monthStr = `${year}-${(month + 1).toString().padStart(2, '0')}`;
    
    // Get first and last day of the month
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    
    const firstDayStr = formatDateKey(firstDay);
    const lastDayStr = formatDateKey(lastDay);
    
    // Cache key and settings
    const specificCacheKey = `user-${userId}-journals-month-${monthStr}`;
    const isCurrentMonth = new Date().getFullYear() === year && 
                          new Date().getMonth() === month;
    const cacheTTL = isCurrentMonth ? JOURNAL_TODAY_MONTH_CACHE_TTL : JOURNAL_MONTH_CACHE_TTL;
    
    // Check cache
    const entriesMap = userCache.get(specificCacheKey) as Record<string, JournalEntry> | undefined;
    if (entriesMap) return entriesMap;
    
    // Query Firestore
    const journalsRef = collection(db, 'users', userId, 'journals');
    const q = query(
      journalsRef,
      where('date', '>=', firstDayStr),
      where('date', '<=', lastDayStr),
      limit(100)
    );
    
    const snapshot = await getDocs(q);
    const result: Record<string, JournalEntry> = {};
    
    snapshot.forEach(doc => {
      const data = doc.data();
      result[doc.id] = {
        id: doc.id,
        content: data.content || '',
        wordCount: data.wordCount || 0,
        timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(),
        completed: !!data.completed,
        date: data.date || doc.id
      };
    });
    
    userCache.set(specificCacheKey, result, cacheTTL);
    
    return result;
  } catch (error) {
    console.error('Error loading month entries:', error);
    return {};
  }
};

/**
 * Update user's streak count
 */
export const updateStreak = async (userId: string, currentStreak: number): Promise<number> => {
  const newStreak = currentStreak + 1;
  
  try {
    await updateUserSubcollectionDoc(
      userId, 'journalSettings', 'streak', { value: newStreak }
    );
    return newStreak;
  } catch (error) {
    console.error('Error updating streak:', error);
    return currentStreak;
  }
};

/**
 * Get the current streak from Firestore
 */
export const getStoredStreak = async (userId: string): Promise<number> => {
  if (!userId) return 0;
  
  try {
    const streakDoc = await getUserSubcollectionDoc(
      userId, 'journalSettings', 'streak'
    );
    return streakDoc?.value || 0;
  } catch (error) {
    console.error('Error getting streak:', error);
    return 0;
  }
};

/**
 * Get user's theme preference from Firestore
 */
export const getStoredTheme = async (
  userId: string, 
  defaultTheme: JournalTheme
): Promise<JournalTheme> => {
  if (!userId) return defaultTheme;
  
  try {
    const themeDoc = await getUserSubcollectionDoc(
      userId, 'journalSettings', 'theme'
    );
    
    if (themeDoc?.name) {
      const theme = journalThemes.find(t => t.name === themeDoc.name);
      return theme || defaultTheme;
    }
    return defaultTheme;
  } catch (error) {
    console.error('Error getting theme preference:', error);
    return defaultTheme;
  }
};

/**
 * Save user's theme preference to Firestore
 */
export const saveThemePreference = async (userId: string, themeName: string): Promise<void> => {
  if (!userId) return;
  
  try {
    await updateUserSubcollectionDoc(
      userId, 'journalSettings', 'theme', { name: themeName }
    );
  } catch (error) {
    console.error('Error saving theme preference:', error);
  }
};

/**
 * Calculate word count from text
 */
export const calculateWordCount = (text: string): number => {
  if (!text || !text.trim()) return 0;
  const words = text.trim().split(/\s+/);
  return words.length;
};

/**
 * Check if the day is complete (past midnight in user's timezone)
 */
export const isDayComplete = (dateStr: string): boolean => {
  return dateStr !== getTodayKey();
};
