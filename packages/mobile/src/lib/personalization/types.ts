/**
 * Unified Personalization Data Model
 * Single source of truth for all user personalization across the app
 */

// Core PERMA happiness dimensions
export interface PermaScores {
  positiveEmotion: number;  // 1-10
  engagement: number;       // 1-10
  relationships: number;    // 1-10
  meaning: number;         // 1-10
  accomplishment: number;  // 1-10
}

// User's core personality and preferences (static/slow-changing)
export interface UserCore {
  mbtiType: string;
  communicationStyle: 'direct' | 'supportive' | 'analytical' | 'creative';
  socialPreference: 'solo' | 'social' | 'mixed';
  challengeLevel: 'low' | 'medium' | 'high';
  emotionalSupport: 'high' | 'medium' | 'low';
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading' | 'mixed';
}

// Content and topic preferences (evolving)
export interface ContentPreferences {
  // Core interests with enhanced search capabilities
  primaryInterests: string[];
  emergingInterests: string[]; // Interests that are growing through usage
  avoidTopics: string[];
  
  // Enhanced PERMA mapping with search queries
  permaMapping: {
    positiveEmotion: string[];
    engagement: string[];
    relationships: string[];
    meaning: string[];
    accomplishment: string[];
  };
  
  // Topic scores for ranking content relevance
  topicScores: Record<string, number>;
  
  // NEW: Auto-generated search queries for each topic
  topicSearchQueries: {
    [topicName: string]: {
      queries: string[]; // Generated search terms for this topic
      platforms: string[]; // Which platforms these queries work best on
      generatedAt: string; // When these queries were generated
      lastUsed?: string; // When these queries were last used
      successRate?: number; // How often these queries return good results (0-1)
      userFeedback?: 'positive' | 'negative' | 'neutral'; // User feedback on results
      permaDimension?: string; // Which PERMA dimension this topic serves
      priority?: number; // Search priority (1-10)
    };
  };
  
  // Query generation metadata
  queryGeneration: {
    lastGeneratedAt?: string;
    totalQueriesGenerated: number;
    llmModel?: string; // Which model was used for generation
    generationVersion: string; // Version of the generation algorithm
    pendingTopics?: string[]; // Topics that need query generation
  };
}

// Wellness goals and progress (actionable)
export interface WellnessProfile {
  currentScores: PermaScores;
  focusAreas: string[];                // PERMA areas needing improvement (max 2)
  strengths: string[];                 // PERMA areas that are strong (max 2)
  wellnessGoals: string[];            // Specific goals user is working on
  
  // NEW: Store happiness sources for future reference
  happinessSources: string[]; // What makes the user happiest
  
  interventionPreferences: {
    frequency: 'daily' | 'weekly' | 'as-needed';
    sessionLength: 'short' | 'medium' | 'long';
    preferredTime: 'morning' | 'afternoon' | 'evening' | 'flexible';
  };
}

// Dynamic activity tracking (real-time updates)
export interface ActivityTracking {
  chatMetrics: {
    totalMessages: number;
    positiveInteractions: number;
    engagementStreak: number;
    lastActiveTime: string;
    preferredTopics: Array<{ topic: string; score: number; permaDimension: string }>;
  };
  videoMetrics: {
    totalWatched: number;
    completionRate: number;
    likedTopics: string[];
    skipgedTopics: string[];
    watchTime: Record<string, number>; // topic -> minutes watched
    lastWatchedAt?: string;
    preferredChannels?: string[];
    avgSessionLength?: number; // average watch time per video in minutes
  };
  progressTracking: {
    permaImprovement: Partial<PermaScores>; // Change over time
    streaks: Record<string, number>;        // Habit streaks
    milestones: string[];                   // Achievements unlocked
  };
}

// Service marketplace preferences (future feature)
export interface ServicePreferences {
  recommendedTypes: string[];
  budget: 'low' | 'medium' | 'high';
  deliveryMethod: 'digital' | 'human' | 'hybrid';
  urgency: 'immediate' | 'planned' | 'exploratory';
}

// NEW: Add the missing ComputedFields interface
export interface ComputedFields {
  overallHappiness: number;           // Average PERMA score
  primaryPermaDimension: string;      // Strongest PERMA area
  needsAttention: string[];           // Areas declining or consistently low
  engagementLevel: 'low' | 'medium' | 'high';
  lastEngagementType: 'chat' | 'video' | 'service' | null;
}

// Main unified personalization profile
export interface UnifiedPersonalizationProfile {
  // Metadata
  userId: string;
  version: string;
  createdAt: string;
  lastUpdated: string;
  baseAssessmentId?: string;
  
  // Core data sections
  userCore: UserCore;
  contentPreferences: ContentPreferences;
  wellnessProfile: WellnessProfile;
  activityTracking: ActivityTracking;
  servicePreferences: ServicePreferences;
  
  // Quick access computed fields (for performance)
  computed: ComputedFields;
}

// Helper types for updates
export type PersonalizationUpdate = Partial<UnifiedPersonalizationProfile>;
export type PermaUpdate = Partial<PermaScores>;
export type ContentUpdate = Partial<ContentPreferences>;
export type ActivityUpdate = Partial<ActivityTracking>;

export interface TopicSearchQuery {
  queries: string[];
  platforms: string[];
  generatedAt: string;
  lastUsed?: string;
  successRate?: number;
  userFeedback?: 'positive' | 'negative' | 'neutral';
  permaDimension: string; // Make required to match topicGenerator
  priority: number; // Make required to match topicGenerator
}
