import { AssistantsService } from './assistantsService';
import Sentiment from 'sentiment';
// Add import for FirebaseContext
import { useFirebase } from '../../context/FirebaseContext';

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
  lastSummary?: string;
  messageCount: number;
  lastAnalyticsRun?: string;
  createdAt: string;
  updatedAt: string;
}

export class ChatService {
  private static instance: ChatService;
  private assistantsService: AssistantsService;
  // Add firebase methods as properties
  private updateChatSession?: (sessionId: string, updates: any) => Promise<any>;

  private constructor() {
    this.assistantsService = AssistantsService.getInstance();
    // Try to get firebase methods if in React context
    try {
      const firebase = useFirebase();
      this.updateChatSession = firebase.updateChatSession;
    } catch {
      // Not in React context, ignore
    }
  }

  static getInstance(): ChatService {
    if (!ChatService.instance) ChatService.instance = new ChatService();
    return ChatService.instance;
  }

  async createChatSession(userId: string, _userContext?: UserContext): Promise<ChatSession> {
    // Each user gets a unique thread for concurrency/isolation
    const threadId = await this.assistantsService.createThread({ userId, purpose: 'chat', created: new Date().toISOString() });
    return {
      id: '', // set by Firebase
      threadId,
      userId,
      title: 'New Chat',
      messageCount: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  }

  async generateResponse(
    message: string,
    session: ChatSession,
    _userContext?: UserContext,
    personalization?: any
  ): Promise<{ response: string; sentiment?: string; threadId: string; runId: string }> {
    try {
      // Use concise context and thread for cost/concurrency
      const ctx = this.assistantsService.formatPersonalizationContext(personalization);
      const out = await this.assistantsService.runChatAssistant(session.threadId, message, ctx);

      // If a new threadId is returned, update the session in Firebase (and in-memory)
      if (out.threadId && out.threadId !== session.threadId && this.updateChatSession) {
        try {
          await this.updateChatSession(session.id, { threadId: out.threadId });
          session.threadId = out.threadId;
        } catch (e) {
          // Log but do not block
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
}
