import { AssistantsService } from './assistantsService';
import { UnifiedPersonalizationProfile } from '../personalization/types';

export interface SessionSummary {
  sessionId: string;
  threadId: string;
  summary: string;
  keyTopics: string[];
  emotionalState: string;
  userNeeds: string[];
  importantContext: string;
  permaInsights: any;
  messageCount: number;
  duration: number;
  createdAt: string;
  completedAt: string;
}

export interface SessionContext {
  previousSessions: SessionSummary[];
  userPersonalization: any;
  recentInteractions: string;
  continuityContext: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  threadId?: string;
  title: string;
  summary?: string;
  messageCount: number;
  permaDimension?: string;
  createdAt: string;
  updatedAt: string;
  archived: boolean;
  context?: {
    userMood?: number;
    primaryTopics?: string[];
    wellnessFocus?: string[];
    sessionGoal?: string;
  };
}

export class SessionManager {
  private static instance: SessionManager;
  private assistantsService: AssistantsService;
  private sessionSummaries: Map<string, SessionSummary> = new Map();

  private constructor() {
    this.assistantsService = AssistantsService.getInstance();
  }

  static getInstance(): SessionManager {
    if (!SessionManager.instance) {
      SessionManager.instance = new SessionManager();
    }
    return SessionManager.instance;
  }

  /**
   * Generate a comprehensive session summary when closing
   */
  async summarizeAndCloseSession(
    sessionId: string,
    threadId: string,
    messageCount: number,
    updateFirebaseSession: (id: string, updates: any) => Promise<any>
  ): Promise<SessionSummary> {
    try {
      console.log(`Starting session summarization for session: ${sessionId}`);
      
      // Get all messages from the thread
      const messages = await this.assistantsService.getThreadMessages(threadId);
      
      if (messages.length < 3) {
        // Short sessions don't need complex summarization
        const basicSummary: SessionSummary = {
          sessionId,
          threadId,
          summary: 'Brief conversation',
          keyTopics: [],
          emotionalState: 'neutral',
          userNeeds: [],
          importantContext: '',
          permaInsights: {},
          messageCount: messages.length,
          duration: 0,
          createdAt: messages[0]?.timestamp || new Date().toISOString(),
          completedAt: new Date().toISOString()
        };
        
        this.sessionSummaries.set(sessionId, basicSummary);
        return basicSummary;
      }

      // Calculate session duration
      const startTime = new Date(messages[0]?.timestamp || Date.now());
      const endTime = new Date(messages[messages.length - 1]?.timestamp || Date.now());
      const duration = Math.round((endTime.getTime() - startTime.getTime()) / (1000 * 60)); // minutes

      // Create detailed summary using analytics assistant
      const summaryResult = await this.generateDetailedSummary(messages);
      
      const sessionSummary: SessionSummary = {
        sessionId,
        threadId,
        summary: summaryResult.summary,
        keyTopics: summaryResult.keyTopics || [],
        emotionalState: summaryResult.emotionalState || 'neutral',
        userNeeds: summaryResult.userNeeds || [],
        importantContext: summaryResult.importantContext || '',
        permaInsights: summaryResult.permaInsights || {},
        messageCount: messages.length,
        duration,
        createdAt: startTime.toISOString(),
        completedAt: endTime.toISOString()
      };

      // Save summary to cache and Firebase
      this.sessionSummaries.set(sessionId, sessionSummary);
      
      // Update Firebase session with summary
      await updateFirebaseSession(sessionId, {
        summary: sessionSummary.summary,
        keyTopics: sessionSummary.keyTopics,
        emotionalState: sessionSummary.emotionalState,
        userNeeds: sessionSummary.userNeeds,
        permaInsights: sessionSummary.permaInsights,
        duration: sessionSummary.duration,
        archived: true,
        completedAt: sessionSummary.completedAt
      });

      // Clean up the OpenAI thread to save costs
      await this.cleanupThread(threadId);
      
      console.log(`Session ${sessionId} summarized and archived successfully`);
      return sessionSummary;
      
    } catch (error) {
      console.error('Error summarizing session:', error);
      throw error;
    }
  }

  /**
   * Generate detailed summary using analytics assistant
   */
  private async generateDetailedSummary(messages: any[]): Promise<{
    summary: string;
    keyTopics: string[];
    emotionalState: string;
    userNeeds: string[];
    importantContext: string;
    permaInsights: any;
  }> {
    const conversationText = messages.map(m => `[${m.role}] ${m.content}`).join('\n');
    
    const prompt = `
Analyze this complete conversation and provide a comprehensive JSON summary for future context:

{
  "summary": "2-3 sentence overview of the entire conversation",
  "keyTopics": ["topic1", "topic2", "topic3"],
  "emotionalState": "positive|negative|neutral|mixed",
  "userNeeds": ["need1", "need2"],
  "importantContext": "Key information to remember for future conversations",
  "permaInsights": {
    "positiveEmotion": 5,
    "engagement": 5,
    "relationships": 5,
    "meaning": 5,
    "accomplishment": 5
  },
  "personalizationUpdates": {},
  "suggestedQuestions": ["question1", "question2"],
  "shouldSummarize": false
}

Conversation:
${conversationText}
`;

    try {
      // Use the analytics assistant which returns AnalyticsResult
      const analyticsResult = await this.assistantsService.runAnalyticsAssistant(
        messages.map(m => ({
          id: m.id || `msg-${Date.now()}`,
          content: m.content,
          role: m.role,
          timestamp: m.timestamp || new Date().toISOString()
        }))
      );
      
      // Extract and validate the response
      return {
        summary: analyticsResult.summary || 'Conversation completed',
        keyTopics: analyticsResult.keyTopics || [],
        emotionalState: analyticsResult.emotionalState || 'neutral',
        userNeeds: analyticsResult.userNeeds || [],
        importantContext: analyticsResult.importantContext || '',
        permaInsights: analyticsResult.permaInsights || {}
      };
      
    } catch (error) {
      console.error('Error generating detailed summary:', error);
      return {
        summary: 'Session completed',
        keyTopics: [],
        emotionalState: 'neutral',
        userNeeds: [],
        importantContext: '',
        permaInsights: {}
      };
    }
  }

  /**
   * Parse analytics response with fallbacks
   */
  private parseAnalyticsResponse(response: any): {
    summary: string;
    keyTopics: string[];
    emotionalState: string;
    userNeeds: string[];
    importantContext: string;
    permaInsights: any;
  } {
    try {
      let parsed: any;
      
      if (typeof response === 'string') {
        // Try to extract JSON from the string
        const jsonMatch = response.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          throw new Error('No JSON found in response');
        }
      } else if (typeof response === 'object' && response !== null) {
        parsed = response;
      } else {
        throw new Error('Invalid response format');
      }
      
      return {
        summary: parsed.summary || 'Session completed',
        keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
        emotionalState: parsed.emotionalState || 'neutral',
        userNeeds: Array.isArray(parsed.userNeeds) ? parsed.userNeeds : [],
        importantContext: parsed.importantContext || '',
        permaInsights: parsed.permaInsights || {}
      };
    } catch (error) {
      console.error('Error parsing analytics response:', error);
      return {
        summary: 'Session completed',
        keyTopics: [],
        emotionalState: 'neutral',
        userNeeds: [],
        importantContext: '',
        permaInsights: {}
      };
    }
  }

  /**
   * Build context for new sessions based on previous sessions and unified personalization
   */
  async buildSessionContext(
    userId: string,
    getRecentSessions: (userId: string, limit: number) => Promise<any[]>,
    personalization?: UnifiedPersonalizationProfile // UPDATED: Use unified type
  ): Promise<SessionContext> {
    try {
      // Get last 3 sessions for context
      const recentSessions = await getRecentSessions(userId, 3);
      
      const previousSessions: SessionSummary[] = recentSessions
        .filter(session => session.summary && session.archived)
        .map(session => ({
          sessionId: session.id,
          threadId: session.threadId,
          summary: session.summary,
          keyTopics: session.keyTopics || [],
          emotionalState: session.emotionalState || 'neutral',
          userNeeds: session.userNeeds || [],
          importantContext: session.importantContext || '',
          permaInsights: session.permaInsights || {},
          messageCount: session.messageCount || 0,
          duration: session.duration || 0,
          createdAt: session.createdAt,
          completedAt: session.completedAt || session.updatedAt
        }));

      // ENHANCED: Build continuity context with personalization awareness
      const continuityContext = this.buildEnhancedContinuityContext(previousSessions, personalization);
      
      // Build recent interactions summary
      const recentInteractions = this.buildRecentInteractionsContext(previousSessions);

      return {
        previousSessions,
        userPersonalization: personalization,
        recentInteractions,
        continuityContext
      };
      
    } catch (error) {
      console.error('Error building session context:', error);
      return {
        previousSessions: [],
        userPersonalization: personalization,
        recentInteractions: '',
        continuityContext: ''
      };
    }
  }

  /**
   * ENHANCED: Build continuity context with personalization awareness
   */
  private buildEnhancedContinuityContext(
    previousSessions: SessionSummary[], 
    personalization?: UnifiedPersonalizationProfile
  ): string {
    if (previousSessions.length === 0) return '';
    
    const contexts: string[] = [];
    
    // Recent session summary
    const lastSession = previousSessions[0];
    if (lastSession) {
      contexts.push(`Last conversation: ${lastSession.summary}`);
      
      if (lastSession.keyTopics.length > 0) {
        contexts.push(`Recent topics: ${lastSession.keyTopics.join(', ')}`);
      }
      
      if (lastSession.userNeeds.length > 0) {
        contexts.push(`User was seeking: ${lastSession.userNeeds.join(', ')}`);
      }
      
      if (lastSession.importantContext) {
        contexts.push(`Important context: ${lastSession.importantContext}`);
      }
    }
    
    // ENHANCED: Add personalization-aware context
    if (personalization) {
      // Focus on user's current focus areas
      if (personalization.wellnessProfile.focusAreas.length > 0) {
        contexts.push(`User is working on improving: ${personalization.wellnessProfile.focusAreas.join(', ')}`);
      }
      
      // Include recent engagement patterns
      if (personalization.activityTracking.chatMetrics.preferredTopics.length > 0) {
        const topTopics = personalization.activityTracking.chatMetrics.preferredTopics
          .slice(0, 2)
          .map(t => t.topic);
        contexts.push(`User especially engages with: ${topTopics.join(', ')}`);
      }
      
      // Include current mood/happiness level
      if (personalization.computed.overallHappiness) {
        const moodLevel = personalization.computed.overallHappiness;
        if (moodLevel <= 4) {
          contexts.push('User may need extra emotional support right now');
        } else if (moodLevel >= 8) {
          contexts.push('User is in a positive state - good time for growth conversations');
        }
      }
    }
    
    // Patterns across sessions
    const allTopics = previousSessions.flatMap(s => s.keyTopics);
    const topicCounts = allTopics.reduce((acc, topic) => {
      acc[topic] = (acc[topic] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    const recurringTopics = Object.entries(topicCounts)
      .filter(([, count]) => count > 1)
      .map(([topic]) => topic);
    
    if (recurringTopics.length > 0) {
      contexts.push(`Recurring interests: ${recurringTopics.join(', ')}`);
    }
    
    return contexts.join('. ');
  }

  /**
   * Build recent interactions context
   */
  private buildRecentInteractionsContext(previousSessions: SessionSummary[]): string {
    if (previousSessions.length === 0) return '';
    
    const recentSummaries = previousSessions
      .slice(0, 2)
      .map(session => `${session.summary} (${session.emotionalState} mood)`)
      .join('; ');
    
    return `Recent conversations: ${recentSummaries}`;
  }

  /**
   * Format session context for assistant instructions
   */
  formatContextForAssistant(context: SessionContext): string {
    const instructions: string[] = [];
    
    if (context.continuityContext) {
      instructions.push(`Conversation continuity: ${context.continuityContext}`);
    }
    
    if (context.recentInteractions) {
      instructions.push(`Recent context: ${context.recentInteractions}`);
    }
    
    // Add personalization if available
    if (context.userPersonalization) {
      const personalizedInstructions = this.assistantsService.formatPersonalizationContext(context.userPersonalization);
      if (personalizedInstructions) {
        instructions.push(personalizedInstructions);
      }
    }
    
    instructions.push(
      "Remember this context throughout our conversation. Reference previous topics naturally when relevant, but don't overwhelm the user with too much history at once."
    );
    
    return instructions.join(' ');
  }

  /**
   * Clean up OpenAI thread to save costs
   */
  private async cleanupThread(threadId: string): Promise<void> {
    try {
      await this.assistantsService.deleteThread(threadId);
      console.log(`Thread ${threadId} cleaned up successfully`);
    } catch (error) {
      console.warn(`Failed to cleanup thread ${threadId}:`, error);
      // Don't throw - cleanup failure shouldn't break the flow
    }
  }

  /**
   * Get cached session summary
   */
  getSessionSummary(sessionId: string): SessionSummary | null {
    return this.sessionSummaries.get(sessionId) || null;
  }

  /**
   * Check if session should be closed based on criteria
   */
  shouldCloseSession(messageCount: number, lastActivityTime: string, maxMessages = 50, maxInactiveHours = 24): boolean {
    // Close if message limit reached
    if (messageCount >= maxMessages) {
      return true;
    }
    
    // Close if inactive for too long
    const lastActivity = new Date(lastActivityTime);
    const now = new Date();
    const hoursSinceActivity = (now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60);
    
    if (hoursSinceActivity >= maxInactiveHours) {
      return true;
    }
    
    return false;
  }

  static generateSessionTitle(messages: string[], personalization: UnifiedPersonalizationProfile): string {
    // Extract key themes from conversation
    const commonWords = this.extractKeyWords(messages);
    const userFocus = personalization.wellnessProfile.focusAreas[0];
    
    // Generate contextual title
    if (commonWords.includes('stress') || commonWords.includes('anxiety')) {
      return `Stress Relief Chat - ${new Date().toLocaleDateString()}`;
    }
    if (commonWords.includes('goal') || commonWords.includes('achievement')) {
      return `Goal Setting Session - ${userFocus}`;
    }
    if (commonWords.includes('relationship') || commonWords.includes('friend')) {
      return `Relationship Discussion`;
    }
    
    return `${userFocus} Conversation - ${new Date().toLocaleDateString()}`;
  }

  static determineSessionContext(
    messages: any[], 
    personalization: UnifiedPersonalizationProfile
  ): ChatSession['context'] {
    const recentMessages = messages.slice(-5);
    const messageText = recentMessages.map(m => m.content).join(' ').toLowerCase();
    
    // Analyze user mood from sentiment
    const positiveWords = ['happy', 'great', 'good', 'excited', 'love'];
    const negativeWords = ['sad', 'stressed', 'tired', 'anxious', 'difficult'];
    
    let moodScore = 5; // neutral
    positiveWords.forEach(word => {
      if (messageText.includes(word)) moodScore += 1;
    });
    negativeWords.forEach(word => {
      if (messageText.includes(word)) moodScore -= 1;
    });
    
    // Extract topics
    const topics = this.extractTopicsFromMessages(recentMessages);
    
    // Determine wellness focus based on conversation
    const wellnessFocus = this.mapTopicsToWellness(topics, personalization);
    
    return {
      userMood: Math.max(1, Math.min(10, moodScore)),
      primaryTopics: topics.slice(0, 3),
      wellnessFocus,
      sessionGoal: this.inferSessionGoal(topics, personalization)
    };
  }

  private static extractKeyWords(messages: string[]): string[] {
    const text = messages.join(' ').toLowerCase();
    const keywords = [
      'stress', 'anxiety', 'goal', 'achievement', 'relationship', 'friend',
      'happy', 'sad', 'work', 'family', 'health', 'exercise', 'sleep'
    ];
    
    return keywords.filter(keyword => text.includes(keyword));
  }

  private static extractTopicsFromMessages(messages: any[]): string[] {
    // Extract key topics from conversation
    const topics: string[] = [];
    
    messages.forEach(message => {
      const content = message.content.toLowerCase();
      
      // Topic patterns
      if (content.includes('work') || content.includes('job') || content.includes('career')) {
        topics.push('career');
      }
      if (content.includes('relationship') || content.includes('partner') || content.includes('friend')) {
        topics.push('relationships');
      }
      if (content.includes('health') || content.includes('exercise') || content.includes('fitness')) {
        topics.push('health');
      }
      if (content.includes('stress') || content.includes('anxiety') || content.includes('worry')) {
        topics.push('stress-management');
      }
      if (content.includes('goal') || content.includes('dream') || content.includes('plan')) {
        topics.push('goal-setting');
      }
    });
    
    return [...new Set(topics)];
  }

  private static mapTopicsToWellness(
    topics: string[], 
    personalization: UnifiedPersonalizationProfile
  ): string[] {
    const mapping: Record<string, string> = {
      'career': 'accomplishment',
      'relationships': 'relationships',
      'health': 'positiveEmotion',
      'stress-management': 'positiveEmotion',
      'goal-setting': 'accomplishment'
    };
    
    const wellnessDimensions = topics.map(topic => mapping[topic]).filter(Boolean);
    
    // Add user's focus areas
    wellnessDimensions.push(...personalization.wellnessProfile.focusAreas);
    
    return [...new Set(wellnessDimensions)];
  }

  private static inferSessionGoal(
    topics: string[], 
    personalization: UnifiedPersonalizationProfile
  ): string {
    if (topics.includes('stress-management')) {
      return 'Reduce stress and improve emotional wellbeing';
    }
    if (topics.includes('goal-setting')) {
      return 'Clarify and work towards personal goals';
    }
    if (topics.includes('relationships')) {
      return 'Improve social connections and communication';
    }
    
    // Default based on user's primary focus area
    const primaryFocus = personalization.wellnessProfile.focusAreas[0];
    switch (primaryFocus) {
      case 'positiveEmotion': return 'Boost mood and positive emotions';
      case 'engagement': return 'Find activities that create flow and engagement';
      case 'relationships': return 'Strengthen social connections';
      case 'meaning': return 'Discover purpose and meaning';
      case 'accomplishment': return 'Achieve personal goals and build confidence';
      default: return 'Improve overall wellbeing and happiness';
    }
  }
}