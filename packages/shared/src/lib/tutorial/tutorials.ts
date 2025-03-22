import { db } from '../common/firebase';
import { collection, addDoc, query, where, getDocs, orderBy, or, and, doc, getDoc } from 'firebase/firestore';
import { getLatestAssessment } from '../assessment/assessment';
import { Timestamp } from 'firebase/firestore';
import { tutorialCache, invalidateTutorialCache } from '../common/cache';
import { fetchWebResources, fetchVideoResources, WebResource, VideoResource } from '../common/google';

// --- IMPORT THE MOVED OPENAI-RELATED FUNCTIONS HERE ---
import {
  refineTopic,
  generateTutorialPrompt,
  generateTutorialContent,
  generateQuiz,
  determineCategory
} from '../common/openai';

// Enhanced tutorial interface with new fields
export interface Tutorial {
  id: string;
  userId: string;
  title: string;
  content: string;
  category: string;
  difficulty: string;
  likes: number;
  views: number;
  estimatedMinutes: number;
  createdAt: Timestamp | Date;
  introImageUrl?: string;
  isCodingTutorial: boolean;
  sections: TutorialSection[];
  resources: {
    webLinks: WebResource[];
    videos: VideoResource[];
  };
  quiz: QuizData;
  mbtiType?: string;
  aiPreference?: string;
}

export interface TutorialPreview {
  id: string;
  title: string;
  content: string;
  userId?: string;
  category?: string;
  difficulty?: string;
  likes?: number;
  views?: number;
  estimatedMinutes?: number;
  introImageUrl?: string;
  isCodingTutorial?: boolean;
  sections?: any[];
  resources?: {
    webLinks: any[];
    videos: any[];
  };
  quiz?: any;
}

export const adaptRecommendationToTutorial = (rec: {
  id: string;
  title: string;
  content: string;
}): TutorialPreview => {
  return {
    id: rec.id,
    title: rec.title,
    content: rec.content,
    userId: 'system',
    category: 'General',
    difficulty: 'Beginner',
    likes: 0,
    views: 0,
    estimatedMinutes: 5,
    isCodingTutorial: false,
    sections: [],
    resources: {
      webLinks: [],
      videos: []
    }
  };
};

interface TutorialSection {
  id: string;
  title: string;
  content: string;
  codeExample?: string;
  language?: string;
}

interface QuizData {
  questions: QuizQuestion[];
  passingScore: number;
}

interface QuizQuestion {
  id: number;
  type: 'multiple-choice' | 'true-false' | 'fill-in-blank';
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

// Tutorial categories
export const TUTORIAL_CATEGORIES = [
  'AI Tools',
  'Productivity',
  'Communication',
  'Technical Skills',
  'Workplace Integration',
  'Career Development'
];

// Tutorial difficulty levels
export const TUTORIAL_DIFFICULTY_LEVELS = [
  'beginner',
  'intermediate',
  'advanced'
];

// Helper function to get categories with "All" option for UI display
export const getUICategories = () => {
  return ['All', ...TUTORIAL_CATEGORIES];
};

// Helper function to get difficulty levels with "All" option for UI display
export const getUIDifficultyLevels = () => {
  return ['All', ...TUTORIAL_DIFFICULTY_LEVELS];
};

/**
 * Parse the generated tutorial content into sections
 */
const parseSections = (content: string): TutorialSection[] => {
  const sections: TutorialSection[] = [];
  const lines = content.split('\n');
  let currentSection: Partial<TutorialSection> = {};

  lines.forEach(line => {
    if (line.startsWith('## ')) {
      if (currentSection.title) {
        sections.push(currentSection as TutorialSection);
      }
      currentSection = {
        id: Date.now().toString() + Math.random().toString(16).slice(2),
        title: line.replace('## ', '').trim(),
        content: ''
      };
    } else if (line.includes('```')) {
      const language = line.replace('```', '').trim();
      if (language && !currentSection.language) {
        currentSection.language = language;
        currentSection.codeExample = '';
      } else if (currentSection.codeExample !== undefined) {
        currentSection.content += currentSection.codeExample + '\n';
        delete currentSection.codeExample;
      }
    } else if (currentSection.codeExample !== undefined) {
      currentSection.codeExample += line + '\n';
    } else if (currentSection.title) {
      currentSection.content += line + '\n';
    }
  });

  if (currentSection.title) {
    sections.push(currentSection as TutorialSection);
  }

  return sections;
};

/**
 * Check if the content likely includes code
 */
const detectCodeContent = (content: string): boolean => {
  return content.includes('```') ||
         content.includes('function') ||
         content.includes('class') ||
         content.includes('const') ||
         content.includes('let');
};

/**
 * Generate a tutorial and store it in Firestore
 */
export const generateTutorial = async (
  userId: string,
  query: string,
  difficulty: string = 'beginner'
) => {
  try {
    // Refine the topic
    const refinedTitle = await refineTopic(query, difficulty);

    // Get user MBTI & AI preference data
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type || '';
    const aiPreference = assessment?.ai_preference || '';

    // Generate the main tutorial content via OpenAI (now handled in openai.ts)
    const content = await generateTutorialContent({
      refinedTitle,
      difficulty,
      mbtiType,
      aiPreference,
      // We reuse the same prompt logic from tutorials, now in openai.ts
      promptBuilder: generateTutorialPrompt
    });

    // Parse sections and detect coding content
    const sections = parseSections(content);
    const isCodingTutorial = detectCodeContent(content);

    // Fetch resources from Google (unchanged)
    const [webResources, videoResources] = await Promise.all([
      fetchWebResources(refinedTitle),
      fetchVideoResources(refinedTitle)
    ]);

    // Generate quiz questions from the tutorial content (openai.ts)
    const quiz = await generateQuiz(content);

    // Determine an appropriate category using OpenAI (openai.ts)
    const category = await determineCategory(refinedTitle, content, TUTORIAL_CATEGORIES);

    // Build tutorial data object
    const tutorialData = {
      title: refinedTitle,
      content,
      sections,
      isCodingTutorial,
      category,
      difficulty,
      resources: {
        webLinks: webResources || [],
        videos: videoResources || []
      },
      quiz: quiz || { questions: [], passingScore: 70 },
      estimatedMinutes: Math.ceil(content.split(' ').length / 200),
      createdAt: new Date(),
      likes: 0,
      views: 0,
      userId,
      mbtiType,
      aiPreference
    };

    // Save to Firestore
    const tutorialRef = await addDoc(collection(db, 'tutorials'), tutorialData);
    
    // Invalidate cache for tutorial listings
    invalidateTutorialCache();

    return {
      id: tutorialRef.id,
      ...tutorialData
    };
  } catch (error) {
    console.error('Error generating tutorial:', error);
    throw error;
  }
};

/**
 * Get recommended tutorials based on user preferences and completed tutorials
 */
export const getRecommendedTutorials = async (
  userId: string,
  completedTutorialIds: string[],
  limit = 3
) => {
  const cacheKey = `recommended-tutorials-${userId}-${completedTutorialIds.join('-')}-${limit}`;
  
  return tutorialCache.getOrSet(cacheKey, async () => {
    try {
      const tutorialsRef = collection(db, 'tutorials');
      const assessment = await getLatestAssessment(userId);
      const preferredMbti = assessment.data?.mbti_type;

      let combinedQuery;
      if (preferredMbti) {
        combinedQuery = query(
          tutorialsRef,
          or(
            where('userId', '==', userId),
            and(
              where('userId', '!=', userId),
              where('mbtiType', '==', preferredMbti)
            )
          ),
          orderBy('likes', 'desc'),
          orderBy('createdAt', 'desc')
        );
      } else {
        combinedQuery = query(
          tutorialsRef,
          where('userId', '==', userId),
          orderBy('likes', 'desc'),
        );
      }

      const snapshot = await getDocs(combinedQuery);
      const tutorials = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })).filter(tutorial => !completedTutorialIds.includes(tutorial.id));

      return tutorials.slice(0, limit);
    } catch (error) {
      console.error('Error getting recommended tutorials:', error);
      return [];
    }
  }, 30 * 60 * 1000); // 30 min TTL for recommendations
};

/**
 * Get a paginated list of tutorials with optional search and filter
 */
export const getTutorials = async (
  page: number = 1,
  limit: number = 10,
  searchQuery?: string,
  categories?: string[],
  difficulties?: string[],
  sortField: string = 'createdAt',
  sortDirection: 'asc' | 'desc' = 'desc'
): Promise<Tutorial[]> => {
  const limitVal = Math.min(50, Math.max(1, limit)); // Limit between 1-50
  const cacheKey = `tutorials-${page}-${limitVal}-${searchQuery || 'none'}-${categories?.join(',') || 'all'}-${difficulties?.join(',') || 'all'}-${sortField}-${sortDirection}`;
  
  return tutorialCache.getOrSet(cacheKey, async () => {
    try {
      const tutorialsRef = collection(db, 'tutorials');
      let allTutorials: Tutorial[] = [];
      
      if ((!categories || categories.length === 0) && (!difficulties || difficulties.length === 0)) {
        // No filters case - just get everything with sorting
        const tutorialQuery = query(
          tutorialsRef,
          orderBy(sortField, sortDirection)
        );
        const snapshot = await getDocs(tutorialQuery);
        allTutorials = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Tutorial[];
      } else {
        // With filters case
        const baseQuery = query(
          tutorialsRef,
          orderBy(sortField, sortDirection)
        );
        const snapshot = await getDocs(baseQuery);
        
        allTutorials = snapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Tutorial[];
        
        if (categories && categories.length > 0) {
          allTutorials = allTutorials.filter(t => categories.includes(t.category));
        }
        
        if (difficulties && difficulties.length > 0) {
          allTutorials = allTutorials.filter(t => 
            difficulties.includes(t.difficulty.toLowerCase())
          );
        }
      }
      
      // Apply search query filter
      if (searchQuery) {
        const queryLower = searchQuery.toLowerCase();
        allTutorials = allTutorials.filter(t =>
          t.title?.toLowerCase().includes(queryLower) ||
          t.content?.toLowerCase().includes(queryLower)
        );
      }
      
      // Handle pagination
      const totalCount = allTutorials.length;
      const startIndex = (page - 1) * limitVal;
      const paginatedTutorials = allTutorials.slice(startIndex, startIndex + limitVal);
      
      // Convert Firestore Timestamps to JS Date objects
      return paginatedTutorials.map(tutorial => {
        if (tutorial.createdAt && typeof tutorial.createdAt === 'object' && 'toDate' in tutorial.createdAt) {
          return {
            ...tutorial,
            createdAt: tutorial.createdAt.toDate()
          };
        }
        return tutorial;
      });
    } catch (error) {
      console.error('Error fetching tutorials:', error);
      return [];
    }
  });
};

/**
 * Get a single tutorial by ID
 */
export const getTutorial = async (tutorialId: string) => {
  const cacheKey = `tutorial-${tutorialId}`;
  
  return tutorialCache.getOrSet(cacheKey, async () => {
    try {
      const tutorialRef = doc(db, 'tutorials', tutorialId);
      const tutorialDoc = await getDoc(tutorialRef);

      if (!tutorialDoc.exists()) {
        throw new Error('Tutorial not found');
      }

      const tutorialData = tutorialDoc.data() as Tutorial;
      
      return {
        ...tutorialData,
        id: tutorialDoc.id
      };
    } catch (error) {
      console.error('Error fetching tutorial:', error);
      throw error;
    }
  });
};
