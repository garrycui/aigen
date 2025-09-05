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
      // Format personalization context
      const personalizationCtx = this.assistantsService.formatPersonalizationContext(personalization);
      
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

      // FIX: Pass session.threadId (string) instead of entire session object
      const out = await this.assistantsService.runChatAssistant(
        session.threadId,  // ✅ FIXED: Pass threadId string, not session object
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
          // Update the session object passed in (mutation for immediate use)
          session.threadId = out.threadId;
        } catch (e) {
          console.warn('Failed to update threadId in Firebase:', e);
        }
      }

      return {
        response: out.content,
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
      const prompt = `Generate a concise, descriptive title (3-5 words) for a chat conversation that starts with: "${conversationStart.slice(0, 200)}..."

Rules:
- Focus on the main topic or theme
- Keep it under 25 characters
- Make it specific and helpful
- Don't use quotes
- Examples: "Career Advice", "Anxiety Support", "Learning Python", "Relationship Help"

Title:`;

      const response = await this.assistantsService.generateQuickResponse(prompt);
      const title = response.trim().replace(/['"]/g, '');
      
      // Validate title length and content
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
    const words = text.toLowerCase().split(' ').filter(w => w.length > 3);
    const keywords = ['help', 'advice', 'learn', 'support', 'question', 'problem', 'goal', 'plan'];
    
    for (const keyword of keywords) {
      if (words.includes(keyword)) {
        return `${keyword.charAt(0).toUpperCase() + keyword.slice(1)} Chat`;
      }
    }
    
    const hour = new Date().getHours();
    if (hour < 12) return 'Morning Chat';
    if (hour < 17) return 'Afternoon Chat';
    return 'Evening Chat';
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
