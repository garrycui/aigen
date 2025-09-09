import { AssistantsService } from './assistantsService';
import { SessionManager, SessionContext } from './sessionManager';
import Sentiment from 'sentiment';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
  threadId?: string;
  runId?: string;
}

export interface UserContext {
  mbtiType?: string;
  aiPreference?: string;
  communicationStyle?: string;
  learningPreference?: string;
  emotionalState?: string;
  supportNeeds?: string;
  perma?: any;
  interests?: string[];
  name?: string;
}

export interface ChatSession {
  id: string;
  threadId: string;
  userId: string;
  title: string;
  theme?: string;
  summary?: string;
  messageCount: number;
  lastAnalyticsRun?: string;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
}

export class ChatService {
  private static instance: ChatService;
  private assistantsService: AssistantsService;
  private sessionManager: SessionManager;

  private constructor() {
    this.assistantsService = AssistantsService.getInstance();
    this.sessionManager = SessionManager.getInstance();
  }

  static getInstance(): ChatService {
    if (!ChatService.instance) ChatService.instance = new ChatService();
    return ChatService.instance;
  }

  async createChatSession(
    userId: string, 
    userContext?: UserContext,
    getRecentSessions?: (userId: string, limit: number) => Promise<any[]>,
    personalization?: any
  ): Promise<{ session: ChatSession; sessionContext?: SessionContext }> {
    try {
      // Build context from previous sessions if available
      let sessionContext: SessionContext | undefined;
      if (getRecentSessions) {
        sessionContext = await this.sessionManager.buildSessionContext(
          userId, 
          getRecentSessions, 
          personalization
        );
      }

      // Create thread metadata with session context info
      const threadMetadata = {
        userId,
        purpose: 'chat',
        created: new Date().toISOString(),
        hasContext: sessionContext?.continuityContext ? 'true' : 'false',
        hasPreviousSessions: (sessionContext?.previousSessions?.length && sessionContext.previousSessions.length > 0) ? 'true' : 'false'
      };

      const threadId = await this.assistantsService.createThread(threadMetadata);
      
      // If we have previous session context, add it as the first message to the thread
      if (sessionContext && sessionContext.previousSessions?.length && sessionContext.previousSessions.length > 0) {
        const contextMessage = this.buildContextMessage(sessionContext);
        if (contextMessage) {
          await this.assistantsService.addMessageToThread(threadId, contextMessage, 'assistant');
        }
      }
      
      const session: ChatSession = {
        id: '', // Will be set by Firebase
        threadId,
        userId,
        title: 'New Chat',
        messageCount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      return { session, sessionContext };
    } catch (error) {
      console.error('Error creating chat session:', error);
      throw error;
    }
  }

  /**
   * Build context message from previous sessions for thread initialization
   */
  private buildContextMessage(sessionContext: SessionContext): string | null {
    if (!sessionContext.previousSessions?.length || sessionContext.previousSessions.length === 0) {
      return null;
    }
    
    const recentSession = sessionContext.previousSessions[0];
    const contextParts: string[] = [];
    
    // Add main context
    if (recentSession.summary) {
      contextParts.push(`Previous conversation: ${recentSession.summary}`);
    }
    
    // Add key topics if available
    if (recentSession.keyTopics?.length && recentSession.keyTopics.length > 0) {
      contextParts.push(`Topics we discussed: ${recentSession.keyTopics.join(', ')}`);
    }
    
    // Add important context
    if (recentSession.importantContext) {
      contextParts.push(`Important context: ${recentSession.importantContext}`);
    }
    
    // Add emotional state continuity
    if (recentSession.emotionalState && recentSession.emotionalState !== 'neutral') {
      contextParts.push(`User's emotional state was: ${recentSession.emotionalState}`);
    }
    
    // Add user needs
    if (recentSession.userNeeds?.length && recentSession.userNeeds.length > 0) {
      contextParts.push(`User needs: ${recentSession.userNeeds.join(', ')}`);
    }
    
    if (contextParts.length === 0) return null;
    
    return `[CONTEXT FROM PREVIOUS SESSION] ${contextParts.join('. ')}. Please use this context to provide continuity in our conversation, but don't explicitly mention this is from a previous session unless relevant.`;
  }

  async generateResponse(
    message: string,
    session: ChatSession,
    userContext?: UserContext,
    personalization?: any,
    sessionContext?: SessionContext,
    updateSessionCallback?: (sessionId: string, updates: any) => Promise<any>
  ): Promise<{ response: string; sentiment?: string; threadId: string; runId: string }> {
    try {
      // Enhanced personalization context for happiness focus
      const personalizationCtx = this.formatPersonalizationContextForHappiness(personalization);
      
      // Format session context with previous session summaries
      let sessionCtx = '';
      if (sessionContext) {
        sessionCtx = this.sessionManager.formatContextForAssistant(sessionContext);
      }
      
      // Add previous session summary context if available
      if (sessionContext?.previousSessions?.length && sessionContext.previousSessions.length > 0) {
        const recentSummary = sessionContext.previousSessions[0];
        if (recentSummary.summary) {
          let summaryContext = `Previous conversation context: ${recentSummary.summary}. `;
          if (recentSummary.keyTopics?.length > 0) {
            summaryContext += `Recent topics discussed: ${recentSummary.keyTopics.join(', ')}. `;
          }
          if (recentSummary.importantContext) {
            summaryContext += `Important context to remember: ${recentSummary.importantContext}. `;
          }
          sessionCtx = summaryContext + sessionCtx;
        }
      }

      const out = await this.assistantsService.runChatAssistant(
        session.threadId,
        message, 
        personalizationCtx,
        sessionCtx
      );

      // Handle threadId changes - update session if thread was recovered
      if (out.threadId && out.threadId !== session.threadId && updateSessionCallback) {
        try {
          console.log(`Thread ID changed from ${session.threadId} to ${out.threadId}, updating session`);
          await updateSessionCallback(session.id, { 
            threadId: out.threadId,
            updatedAt: new Date().toISOString()
          });
          session.threadId = out.threadId;
        } catch (e) {
          console.warn('Failed to update threadId in Firebase:', e);
        }
      }

      // Post-process response for consistent formatting
      const processedResponse = this.postProcessResponse(out.content);

      return {
        response: processedResponse,
        sentiment: ChatService.analyzeSentiment(message),
        threadId: out.threadId,
        runId: out.runId
      };
    } catch (error) {
      console.error('Error generating response:', error);
      return {
        response: "I'm having a bit of trouble thinking right now. Could you try asking me again? 🤔",
        sentiment: 'neutral',
        threadId: session.threadId,
        runId: ''
      };
    }
  }

  /**
   * Enhanced personalization context formatting focused on happiness
   */
  private formatPersonalizationContextForHappiness(personalization: any): string {
    if (!personalization) return '';
    
    const ctx: string[] = [];
    
    // User Core Information with happiness focus
    if (personalization.userCore) {
      const { mbtiType, communicationStyle, socialPreference, challengeLevel, emotionalSupport, learningStyle } = personalization.userCore;
      
      if (mbtiType) {
        ctx.push(`User MBTI: ${mbtiType}. Adapt your communication to support their personality type and happiness.`);
      }
      if (communicationStyle) {
        ctx.push(`Preferred communication: ${communicationStyle}. Match this style to maximize engagement and joy.`);
      }
      if (emotionalSupport) {
        ctx.push(`Emotional support needs: ${emotionalSupport}. Provide appropriate encouragement and validation.`);
      }
    }
    
    // Wellness Profile with PERMA focus
    if (personalization.wellnessProfile) {
      const { focusAreas, strengths, happinessSources, wellnessGoals, currentScores } = personalization.wellnessProfile;
      
      if (focusAreas?.length) {
        ctx.push(`🎯 PRIORITY: Help improve these happiness areas: ${focusAreas.join(', ')}. Focus conversations on building these PERMA dimensions.`);
      }
      if (strengths?.length) {
        ctx.push(`💪 User's happiness strengths: ${strengths.join(', ')}. Leverage and celebrate these areas.`);
      }
      if (happinessSources?.length) {
        ctx.push(`😊 What makes user happy: ${happinessSources.join(', ')}. Reference these joy sources in responses.`);
      }
      if (wellnessGoals?.length) {
        ctx.push(`🎯 Happiness goals: ${wellnessGoals.join(', ')}. Support progress toward these objectives.`);
      }
      if (currentScores) {
        const overallHappiness = Object.values(currentScores as Record<string, number>).reduce((a: number, b: number) => a + b, 0) / 5;
        ctx.push(`📊 Current happiness level: ${overallHappiness.toFixed(1)}/10. Adjust tone and approach accordingly.`);
      }
    }
    
    // Content Preferences
    if (personalization.contentPreferences) {
      const { primaryInterests, emergingInterests } = personalization.contentPreferences;
      
      if (primaryInterests?.length) {
        ctx.push(`❤️ Core interests: ${primaryInterests.slice(0, 5).join(', ')}. Connect advice to these interests for higher engagement.`);
      }
      if (emergingInterests?.length) {
        ctx.push(`🌱 Growing interests: ${emergingInterests.join(', ')}. Nurture these developing passions.`);
      }
    }
    
    // Core happiness directive
    ctx.push(
      "🌟 CORE MISSION: Your primary goal is to increase this user's happiness and wellbeing. " +
      "(1) Use personality insights to create resonating responses. " +
      "(2) Actively target focus areas to build happiness. " +
      "(3) Connect with their joy sources and interests. " +
      "(4) Provide support that matches their emotional needs. " +
      "(5) Maintain an encouraging, growth-focused tone. " +
      "(6) Ask engaging questions that promote self-discovery and positive reflection."
    );
    
    return ctx.length ? `Personalization context: ${ctx.join(' ')}` : '';
  }

  /**
   * Post-process response to ensure consistent formatting for ChatMessage
   */
  private postProcessResponse(content: string): string {
    let processed = content;
    
    // Ensure proper spacing for headers
    processed = processed.replace(/^(#{1,3})\s*(.+)$/gm, '\n$1 $2\n');
    
    // Ensure proper list formatting
    processed = processed.replace(/^(\s*)[-*+]\s+(.+)$/gm, '$1- $2');
    processed = processed.replace(/^(\s*)(\d+\.)\s+(.+)$/gm, '$1$2 $3');
    
    // Ensure proper quote formatting
    processed = processed.replace(/^>\s*(.+)$/gm, '> $1');
    
    // Clean up excessive whitespace
    processed = processed.replace(/\n{3,}/g, '\n\n');
    processed = processed.trim();
    
    // Add engagement element if response is getting long and doesn't have one
    if (processed.length > 200 && !processed.includes('?') && !processed.includes('What') && !processed.includes('How')) {
      processed += '\n\nWhat would you like to explore further? 🤔';
    }
    
    return processed;
  }

  async closeSession(
    session: ChatSession,
    updateSessionCallback: (sessionId: string, updates: any) => Promise<any>
  ): Promise<void> {
    try {
      console.log(`Closing session ${session.id} with ${session.messageCount} messages`);
      
      await this.sessionManager.summarizeAndCloseSession(
        session.id,
        session.threadId,
        session.messageCount || 0,
        updateSessionCallback
      );
      
      console.log(`Session ${session.id} closed and summarized successfully`);
    } catch (error) {
      console.error('Error closing session:', error);
      // Still mark as archived even if summarization fails
      await updateSessionCallback(session.id, {
        archived: true,
        updatedAt: new Date().toISOString()
      });
    }
  }

  shouldCloseSession(session: ChatSession): boolean {
    return this.sessionManager.shouldCloseSession(
      session.messageCount || 0,
      session.updatedAt
    );
  }

  async analyzeConversation(
    session: ChatSession,
    personalization?: any
  ): Promise<{
    summary: string;
    permaInsights: any;
    personalizationUpdates: any;
    suggestedQuestions: string[];
    shouldSummarize: boolean;
  }> {
    try {
      // Only send the last N messages for cost savings
      const messages = await this.assistantsService.getThreadMessages(session.threadId, 20);
      if (messages.length < 5) {
        return {
          summary: 'Conversation too short for analysis',
          permaInsights: {},
          personalizationUpdates: {},
          suggestedQuestions: [],
          shouldSummarize: false
        };
      }
      const analytics = await this.assistantsService.runAnalyticsAssistant(messages, personalization);
      return {
        summary: analytics.summary,
        permaInsights: analytics.permaInsights,
        personalizationUpdates: analytics.personalizationUpdates,
        suggestedQuestions: analytics.suggestedQuestions ?? [],
        shouldSummarize: analytics.shouldSummarize
      };
    } catch (error) {
      console.error('Error analyzing conversation:', error);
      return {
        summary: 'Analysis failed',
        permaInsights: {},
        personalizationUpdates: {},
        suggestedQuestions: [],
        shouldSummarize: false
      };
    }
  }

  async summarizeSession(session: ChatSession): Promise<string> {
    try {
      return await this.assistantsService.summarizeAndTrimThread(session.threadId);
    } catch (error) {
      console.error('Error summarizing session:', error);
      return 'Summarization failed';
    }
  }

  shouldRunAnalytics(session: ChatSession, forceRun = false): boolean {
    if (forceRun) return true;
    // Only run analytics every 10 messages for cost savings
    const since = session.messageCount - (session.lastAnalyticsRun ? parseInt(session.lastAnalyticsRun) : 0);
    return since >= 10;
  }

  async getUserInsightsAndSuggestions(chatHistory: ChatMessage[]): Promise<{ insights: any; suggestedQuestions: string[] }> {
    // Use analytics assistant for insights, but only on demand
    const svc = this.assistantsService;
    // Only send the last N messages for cost savings
    const history = chatHistory.slice(-20).map(m => ({
      id: m.id,
      content: m.content,
      role: m.role,
      timestamp: m.timestamp
    }));
    const analytics = await svc.runAnalyticsAssistant(history);
    return { insights: analytics.personalizationUpdates || {}, suggestedQuestions: analytics.suggestedQuestions || [] };
  }

  generateSummaryMessage(userInsights: any): string | null {
    if (!userInsights) return null;
    let summary = 'Summary: ';
    if (userInsights.userNeeds?.length) summary += `Needs: ${userInsights.userNeeds[0]}. `;
    if (userInsights.interestTopics?.length) summary += `Interests: ${userInsights.interestTopics.join(', ')}. `;
    if (userInsights.userGoals?.length) summary += `Goal: ${userInsights.userGoals[0]}. `;
    summary += 'If this is not accurate, please correct me!';
    return summary.length > 10 ? summary : null;
  }

  public static analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
    const sentiment = new Sentiment();
    const result = sentiment.analyze(message);
    if (result.score > 1) return 'positive';
    if (result.score < -1) return 'negative';
    return 'neutral';
  }

  async generateSessionTitle(conversationStart: string): Promise<string> {
    try {
      const prompt = `Generate a concise, positive title (3-5 words) for a happiness-focused conversation that starts with: "${conversationStart.slice(0, 200)}..."

Rules:
- Focus on the main happiness theme or growth area
- Keep it under 25 characters
- Make it uplifting and specific
- Use title case
- No quotes
- Examples: "Building Daily Joy", "Career Growth Chat", "Mindfulness Journey", "Relationship Wisdom"

Title:`;

      const response = await this.assistantsService.generateQuickResponse(prompt);
      const title = response.trim().replace(/['"]/g, '');
      
      if (title.length > 30 || title.length < 3) {
        return this.generateFallbackTitle(conversationStart);
      }
      
      return title;
    } catch (error) {
      console.error('Error generating session title:', error);
      return this.generateFallbackTitle(conversationStart);
    }
  }

  private generateFallbackTitle(text: string): string {
    const happinessWords = ['happiness', 'joy', 'wellbeing', 'growth', 'positive', 'mindful'];
    const actionWords = ['building', 'exploring', 'discovering', 'creating', 'nurturing'];
    
    const words = text.toLowerCase().split(' ').filter(w => w.length > 3);
    
    // Look for happiness-related words
    for (const word of words) {
      if (happinessWords.some(hw => word.includes(hw))) {
        const action = actionWords[Math.floor(Math.random() * actionWords.length)];
        return `${action.charAt(0).toUpperCase() + action.slice(1)} ${word.charAt(0).toUpperCase() + word.slice(1)}`;
      }
    }
    
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning Happiness Chat';
    if (hour < 17) return 'Afternoon Reflection';
    return 'Evening Growth Talk';
  }

  async categorizeSession(messages: ChatMessage[]): Promise<{ theme: string; summary: string }> {
    if (messages.length < 3) {
      return { theme: 'General', summary: 'New conversation' };
    }

    try {
      const conversationText = messages.slice(0, 10).map(m => `[${m.role}] ${m.content}`).join('\n');
      const prompt = `Analyze this conversation and provide a JSON response with:
- theme: one of ["Wellness", "Learning", "Support", "Career", "Relationships", "General"]
- summary: brief 1-sentence summary

Conversation:
${conversationText}

JSON:`;

      const response = await this.assistantsService.generateQuickResponse(prompt);
      try {
        const parsed = JSON.parse(response);
        return {
          theme: parsed.theme || 'General',
          summary: parsed.summary || 'Chat conversation'
        };
      } catch {
        return { theme: 'General', summary: 'Chat conversation' };
      }
    } catch (error) {
      console.error('Error categorizing session:', error);
      return { theme: 'General', summary: 'Chat conversation' };
    }
  }
}
