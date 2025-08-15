import axios from 'axios';

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY || process.env.OPENAI_API_KEY;
const OPENAI_API_URL = 'https://api.openai.com/v1';
const CHAT_ASSISTANT_ID = process.env.EXPO_PUBLIC_OPENAI_CHAT_ASSISTANT_ID || '';
const ANALYTICS_ASSISTANT_ID = process.env.EXPO_PUBLIC_OPENAI_ANALYTICS_ASSISTANT_ID || '';

export interface ThreadMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
}

export interface AssistantResponse {
  content: string;
  threadId: string;
  runId: string;
}

export interface AnalyticsResult {
  summary: string;
  permaInsights: any;
  personalizationUpdates: any;
  suggestedQuestions?: string[];
  shouldSummarize: boolean;
}

export class AssistantsService {
  private static instance: AssistantsService;
  static getInstance(): AssistantsService {
    if (!AssistantsService.instance) AssistantsService.instance = new AssistantsService();
    return AssistantsService.instance;
  }

  private async apiCall(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: any) {
    if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
    const headers = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
      'OpenAI-Beta': 'assistants=v2' // <-- Required for Assistants API
    };
    // Add debug logging for request
    if (method !== 'GET') {
      console.log('OpenAI API Request:', endpoint, JSON.stringify(data, null, 2));
    }
    try {
      const res = await axios({
        method,
        url: `${OPENAI_API_URL}${endpoint}`,
        data,
        headers,
        timeout: 30000
      });
      return res.data;
    } catch (err: any) {
      // Log response data if available
      if (err.response) {
        console.error('OpenAI API Error:', err.response.status, err.response.data);
      }
      throw err;
    }
  }

  private validateThreadId(threadId: string) {
    if (!threadId || typeof threadId !== 'string' || !threadId.startsWith('thread')) {
      throw new Error(`Invalid threadId: ${threadId}`);
    }
  }

  async createThread(metadata?: any): Promise<string> {
    const thread = await this.apiCall('/threads', 'POST', { metadata });
    return thread.id;
  }

  async addMessageToThread(threadId: string, content: string, role: 'user' | 'assistant' = 'user') {
    this.validateThreadId(threadId);
    await this.apiCall(`/threads/${threadId}/messages`, 'POST', { role, content });
  }

  async getThreadMessages(threadId: string, limit: number = 20): Promise<ThreadMessage[]> {
    this.validateThreadId(threadId);
    const response = await this.apiCall(`/threads/${threadId}/messages?limit=${limit}`, 'GET');
    return (response.data || []).map((msg: any) => ({
      id: msg.id,
      content: msg?.content?.[0]?.text?.value || '',
      role: msg.role,
      timestamp: new Date((msg.created_at || 0) * 1000).toISOString()
    })).reverse();
  }

  private async waitForRunCompletion(threadId: string, runId: string, maxWaitMs = 30000) {
    this.validateThreadId(threadId);
    const start = Date.now();
    while (Date.now() - start < maxWaitMs) {
      const run = await this.apiCall(`/threads/${threadId}/runs/${runId}`, 'GET');
      if (run.status === 'completed') return run;
      if (run.status === 'failed' || run.status === 'cancelled') {
        throw new Error(`Run ${run.status}: ${run.last_error?.message || 'Unknown error'}`);
      }
      await new Promise(r => setTimeout(r, 1000));
    }
    throw new Error('Run timed out');
  }

  async runChatAssistant(threadId: string | undefined, userMessage: string, personalizationContext?: string): Promise<AssistantResponse> {
    // If threadId is missing or invalid, create a new thread
    let validThreadId = threadId;
    if (!validThreadId || typeof validThreadId !== 'string' || !validThreadId.startsWith('thread')) {
      validThreadId = await this.createThread({ purpose: 'chat' });
    }
    this.validateThreadId(validThreadId);
    await this.addMessageToThread(validThreadId, userMessage, 'user');
    const runBody: any = { assistant_id: CHAT_ASSISTANT_ID, temperature: 0.7 };
    if (personalizationContext) runBody.additional_instructions = personalizationContext;
    const run = await this.apiCall(`/threads/${validThreadId}/runs`, 'POST', runBody);
    const completed = await this.waitForRunCompletion(validThreadId, run.id);
    const msgs = await this.getThreadMessages(validThreadId, 1);
    const last = msgs.find(m => m.role === 'assistant');
    if (!last) throw new Error('No assistant response found');
    return { content: last.content, threadId: validThreadId, runId: completed.id };
  }

  async runAnalyticsAssistant(conversationHistory: ThreadMessage[], personalization?: any): Promise<AnalyticsResult> {
    const analyticsThreadId = await this.createThread({ purpose: 'analytics' });
    const conversationText = conversationHistory.map(m => `[${m.role}] ${m.content}`).join('\n');
    const prompt = `
Analyze this conversation and provide a JSON object with:
- summary (2-3 sentences)
- permaInsights: { positiveEmotion, engagement, relationships, meaning, accomplishment }
- personalizationUpdates: 
    - Update chatPersona.preferredTopics: Add new topics if user shows interest, re-rank or demote topics that are ignored, and remove topics if user avoids them.
    - Update chatPersona.emotionalSupport: Adjust if user sentiment or engagement changes.
    - Update chatPersona.communicationStyle: If user shows a preference for a certain style, adapt to that.
    - Update contentPreferences.primaryInterests: Add new interests/topics based on chat engagement, re-rank or remove topics not engaged with.
    - Update contentPreferences.avoidTopics: Add topics/content types to avoid if user shows dislike or avoidance.
- suggestedQuestions: two concise questions
- shouldSummarize: boolean

Personalization context: ${JSON.stringify(personalization || {})}
Conversation:
${conversationText}
`.trim();

    try {
      await this.addMessageToThread(analyticsThreadId, prompt, 'user');
      const run = await this.apiCall(`/threads/${analyticsThreadId}/runs`, 'POST', {
        assistant_id: ANALYTICS_ASSISTANT_ID,
        temperature: 0.3
      });
      await this.waitForRunCompletion(analyticsThreadId, run.id);
      const msgs = await this.getThreadMessages(analyticsThreadId, 1);
      await this.apiCall(`/threads/${analyticsThreadId}`, 'DELETE');
      const result = msgs.find(m => m.role === 'assistant');
      if (!result) throw new Error('No analytics response found');
      try {
        // Try direct JSON parse first
        return JSON.parse(result.content);
      } catch (err) {
        // Try to extract JSON substring and parse again
        try {
          const match = result.content.match(/\{[\s\S]*\}/);
          if (match) {
            return JSON.parse(match[0]);
          }
        } catch (err2) {
          // Ignore, will fall through to error below
        }
        // Log and return fallback
        console.error('Failed to parse analytics assistant JSON:', result.content);
        return {
          summary: 'Analysis failed',
          permaInsights: {},
          personalizationUpdates: {},
          suggestedQuestions: [],
          shouldSummarize: false
        };
      }
    } catch (err) {
      console.error('Analytics assistant error:', err);
      return {
        summary: 'Analysis failed',
        permaInsights: {},
        personalizationUpdates: {},
        suggestedQuestions: [],
        shouldSummarize: false
      };
    }
  }

  async summarizeAndTrimThread(threadId: string, keepLastN = 10): Promise<string> {
    this.validateThreadId(threadId);
    const messages = await this.getThreadMessages(threadId);
    if (messages.length <= keepLastN) return 'No summarization needed';
    const toSummarize = messages.slice(0, -keepLastN);
    const { summary } = await this.runAnalyticsAssistant(toSummarize);
    return summary;
  }

  formatPersonalizationContext(personalization: any): string {
    if (!personalization) return '';
    const ctx: string[] = [];
    if (personalization.chatPersona?.mbtiType) {
      ctx.push(`User MBTI: ${personalization.chatPersona.mbtiType}. Adapt your communication style and approach to match this personality type.`);
    }
    if (personalization.chatPersona?.communicationStyle) {
      ctx.push(`Preferred communication style: ${personalization.chatPersona.communicationStyle}.`);
    }
    if (personalization.chatPersona?.preferredTopics?.length) {
      ctx.push(`Preferred topics (with scores): ${personalization.chatPersona.preferredTopics.map((t: any) => `${t.topic} (${t.score})`).join(', ')}.`);
    }
    if (personalization.learning?.engagementTriggers?.length) {
      ctx.push(`Engagement triggers: ${personalization.learning.engagementTriggers.join(', ')}.`);
    }
    if (personalization.learning?.happinessDrivers?.length) {
      ctx.push(`Happiness drivers: ${personalization.learning.happinessDrivers.join(', ')}.`);
    }
    if (personalization.learning?.avoidancePatterns?.length) {
      ctx.push(`Avoidance patterns: ${personalization.learning.avoidancePatterns.join(', ')}.`);
    }
    if (personalization.contentPreferences?.primaryInterests?.length) {
      ctx.push(`User interests: ${personalization.contentPreferences.primaryInterests.slice(0, 5).join(', ')}.`);
    }
    if (personalization.contentPreferences?.avoidTopics?.length) {
      ctx.push(`Topics to avoid: ${personalization.contentPreferences.avoidTopics.join(', ')}.`);
    }
    if (personalization.servicePersonalization?.engagementStyle) {
      ctx.push(`Engagement style: ${JSON.stringify(personalization.servicePersonalization.engagementStyle)}.`);
    }
    if (personalization.servicePersonalization?.conversationStyle) {
      ctx.push(`Conversation style: ${JSON.stringify(personalization.servicePersonalization.conversationStyle)}.`);
    }
    if (personalization.servicePersonalization?.recommendedServiceTypes?.length) {
      ctx.push(`Recommended services: ${personalization.servicePersonalization.recommendedServiceTypes.join(', ')}.`);
    }
    if (personalization.wellnessProfile?.focusAreas?.length) {
      ctx.push(`Focus on improving these PERMA happiness areas: ${personalization.wellnessProfile.focusAreas.join(', ')}.`);
    }
    ctx.push(
      "Your goals: (1) Use the user's MBTI and communication preferences to shape your tone, language, and approach. (2) Intentionally target the user's PERMA focus areas and happiness drivers to improve their well-being. (3) Keep the user engaged and positive—ask questions, offer encouragement, and suggest relevant topics or services. (4) Adapt your response length: be concise for short questions, and provide more detail for open-ended or emotional topics. (5) Avoid topics and patterns the user dislikes."
    );
    return ctx.length ? `Personalization context: ${ctx.join(' ')}.` : '';
  }
}
