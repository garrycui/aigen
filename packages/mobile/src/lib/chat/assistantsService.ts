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
  // Add missing properties for session summarization
  keyTopics?: string[];
  emotionalState?: string;
  userNeeds?: string[];
  importantContext?: string;
}

export class AssistantsService {
  private static instance: AssistantsService;
  static getInstance(): AssistantsService {
    if (!AssistantsService.instance) AssistantsService.instance = new AssistantsService();
    return AssistantsService.instance;
  }

  private async apiCall(endpoint: string, method: 'GET' | 'POST' | 'DELETE' = 'GET', data?: any) {
    if (!OPENAI_API_KEY) throw new Error('OpenAI API key not configured');
    
    const headers: any = {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    };
    
    // Only add beta header for assistants endpoints
    if (endpoint.includes('/threads') || endpoint.includes('/assistants') || endpoint.includes('/runs')) {
      headers['OpenAI-Beta'] = 'assistants=v2';
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
      if (err.response) {
        console.error('OpenAI API Error:', err.response.status, err.response.data);
        throw new Error(`API Error: ${err.response.status} - ${err.response.data?.error?.message || 'Unknown error'}`);
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

  async runChatAssistant(
    threadId: string | undefined, 
    userMessage: string, 
    personalizationContext?: string,
    sessionContext?: string
  ): Promise<AssistantResponse> {
    // If threadId is missing or invalid, create a new thread
    let validThreadId = threadId;
    if (!validThreadId || typeof validThreadId !== 'string' || !validThreadId.startsWith('thread')) {
      console.warn('Invalid or missing threadId, creating new thread:', validThreadId);
      validThreadId = await this.createThread({ purpose: 'chat', recovered: 'true' });
    }
    
    try {
      this.validateThreadId(validThreadId);
      await this.addMessageToThread(validThreadId, userMessage, 'user');
      
      const runBody: any = { 
        assistant_id: CHAT_ASSISTANT_ID, 
        temperature: 0.7 
      };
      
      // Combine personalization and session context with proper length limits
      const instructions: string[] = [];
      if (personalizationContext && personalizationContext.trim()) {
        // Limit personalization context to reasonable length
        const truncatedPersonalization = personalizationContext.length > 2000 
          ? personalizationContext.substring(0, 2000) + '...'
          : personalizationContext;
        instructions.push(truncatedPersonalization);
      }
      
      if (sessionContext && sessionContext.trim()) {
        // Limit session context to reasonable length
        const truncatedSession = sessionContext.length > 1500
          ? sessionContext.substring(0, 1500) + '...'
          : sessionContext;
        instructions.push(truncatedSession);
      }
      
      if (instructions.length > 0) {
        // Combine and ensure total length is reasonable for API
        const combinedInstructions = instructions.join(' ');
        runBody.additional_instructions = combinedInstructions.length > 3000
          ? combinedInstructions.substring(0, 3000) + '...'
          : combinedInstructions;
      }
      
      const run = await this.apiCall(`/threads/${validThreadId}/runs`, 'POST', runBody);
      
      if (!run || !run.id) {
        throw new Error('Failed to create run - no run ID returned');
      }
      
      const completed = await this.waitForRunCompletion(validThreadId, run.id);
      
      if (!completed || completed.status !== 'completed') {
        throw new Error(`Run did not complete successfully: ${completed?.status}`);
      }
      
      const msgs = await this.getThreadMessages(validThreadId, 1);
      const lastAssistantMessage = msgs.find(m => m.role === 'assistant');
      
      if (!lastAssistantMessage || !lastAssistantMessage.content) {
        throw new Error('No assistant response found in thread messages');
      }
      
      return { 
        content: lastAssistantMessage.content, 
        threadId: validThreadId, 
        runId: completed.id 
      };
      
    } catch (error) {
      console.error('Error in runChatAssistant:', error);
      
      // If thread-related error, try creating a new thread and retrying once
      if (error instanceof Error && (
        error.message.includes('thread') || 
        error.message.includes('404') ||
        error.message.includes('Invalid threadId')
      )) {
        console.warn('Thread error detected, creating new thread and retrying...');
        try {
          const newThreadId = await this.createThread({ 
            purpose: 'chat', 
            recovered: 'true',
            originalThreadId: validThreadId 
          });
          
          // Add the user message to the new thread
          await this.addMessageToThread(newThreadId, userMessage, 'user');
          
          const runBody: any = { 
            assistant_id: CHAT_ASSISTANT_ID, 
            temperature: 0.7 
          };
          
          // Re-apply contexts for retry
          const instructions: string[] = [];
          if (personalizationContext?.trim()) {
            instructions.push(personalizationContext.length > 2000 
              ? personalizationContext.substring(0, 2000) + '...'
              : personalizationContext);
          }
          if (sessionContext?.trim()) {
            instructions.push(sessionContext.length > 1500
              ? sessionContext.substring(0, 1500) + '...'
              : sessionContext);
          }
          
          if (instructions.length > 0) {
            const combinedInstructions = instructions.join(' ');
            runBody.additional_instructions = combinedInstructions.length > 3000
              ? combinedInstructions.substring(0, 3000) + '...'
              : combinedInstructions;
          }
          
          const retryRun = await this.apiCall(`/threads/${newThreadId}/runs`, 'POST', runBody);
          const retryCompleted = await this.waitForRunCompletion(newThreadId, retryRun.id);
          const retryMsgs = await this.getThreadMessages(newThreadId, 1);
          const retryLastMessage = retryMsgs.find(m => m.role === 'assistant');
          
          if (retryLastMessage?.content) {
            console.log('Successfully recovered with new thread:', newThreadId);
            return { 
              content: retryLastMessage.content, 
              threadId: newThreadId, 
              runId: retryCompleted.id 
            };
          }
          
          throw new Error('Retry with new thread also failed');
          
        } catch (retryError) {
          console.error('Retry with new thread failed:', retryError);
          // Fall through to generic error response
        }
      }
      
      // Return a graceful error response instead of throwing
      const errorThreadId = validThreadId || await this.createThread({ purpose: 'chat', error: 'true' });
      return {
        content: "I apologize, but I'm having some technical difficulties right now. Could you please try asking your question again? I'm here to help! 🤖",
        threadId: errorThreadId,
        runId: `error-${Date.now()}`
      };
    }
  }

  async runAnalyticsAssistant(conversationHistory: ThreadMessage[], personalization?: any): Promise<AnalyticsResult> {
    const analyticsThreadId = await this.createThread({ purpose: 'analytics' });
    const conversationText = conversationHistory.map(m => `[${m.role}] ${m.content}`).join('\n');
    const prompt = `
Analyze this conversation and provide a JSON object with the following structure. IMPORTANT: All values must be properly quoted strings or numbers for valid JSON:

{
  "summary": "2-3 sentence summary text",
  "permaInsights": {
    "positiveEmotion": 5,
    "engagement": 6,
    "relationships": 4,
    "meaning": 5,
    "accomplishment": 3
  },
  "personalizationUpdates": {
    "chatPersona": {
      "preferredTopics": ["topic1", "topic2"],
      "emotionalSupport": "medium",
      "communicationStyle": "supportive"
    },
    "contentPreferences": {
      "primaryInterests": ["interest1", "interest2"],
      "avoidTopics": ["avoid1", "avoid2"]
    }
  },
  "suggestedQuestions": ["question1", "question2"],
  "shouldSummarize": false,
  "keyTopics": ["topic1", "topic2"],
  "emotionalState": "neutral",
  "userNeeds": ["need1", "need2"],
  "importantContext": "key information text"
}

Rules for JSON formatting:
- All strings must be in double quotes
- Numbers should be integers 1-10 for PERMA insights
- Boolean values should be true/false (not quoted)
- No trailing commas
- No unquoted values like 'moderate' or 'developing'

Personalization context: ${JSON.stringify(personalization || {})}
Conversation:
${conversationText}

Return only valid JSON:`.trim();

    try {
      await this.addMessageToThread(analyticsThreadId, prompt, 'user');
      const run = await this.apiCall(`/threads/${analyticsThreadId}/runs`, 'POST', {
        assistant_id: ANALYTICS_ASSISTANT_ID, // ✅ Correct - using analytics assistant
        temperature: 0.3
      });
      await this.waitForRunCompletion(analyticsThreadId, run.id);
      const msgs = await this.getThreadMessages(analyticsThreadId, 1);
      await this.apiCall(`/threads/${analyticsThreadId}`, 'DELETE');
      const result = msgs.find(m => m.role === 'assistant');
      if (!result) throw new Error('No analytics response found');
      
      try {
        // Clean the response by removing any markdown formatting
        let cleanContent = result.content.trim();
        
        // Remove markdown code block formatting if present
        cleanContent = cleanContent.replace(/^```json\s*\n?/, '').replace(/\n?```$/, '');
        cleanContent = cleanContent.replace(/^```\s*\n?/, '').replace(/\n?```$/, '');
        
        // Try direct JSON parse first
        const parsed = JSON.parse(cleanContent);
        
        // Validate and sanitize the parsed object
        return {
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis completed',
          permaInsights: this.validatePermaInsights(parsed.permaInsights),
          personalizationUpdates: parsed.personalizationUpdates || {},
          suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
          shouldSummarize: typeof parsed.shouldSummarize === 'boolean' ? parsed.shouldSummarize : false,
          keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
          emotionalState: typeof parsed.emotionalState === 'string' ? parsed.emotionalState : 'neutral',
          userNeeds: Array.isArray(parsed.userNeeds) ? parsed.userNeeds : [],
          importantContext: typeof parsed.importantContext === 'string' ? parsed.importantContext : ''
        };
      } catch (err) {
        console.error('JSON parse error:', err);
        console.error('Raw content:', result.content);
        
        // Try to extract JSON substring and parse again
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            
            // Attempt to fix common JSON issues
            jsonStr = this.fixCommonJsonIssues(jsonStr);
            
            const parsed = JSON.parse(jsonStr);
            return {
              summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis completed',
              permaInsights: this.validatePermaInsights(parsed.permaInsights),
              personalizationUpdates: parsed.personalizationUpdates || {},
              suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [],
              shouldSummarize: typeof parsed.shouldSummarize === 'boolean' ? parsed.shouldSummarize : false,
              keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : [],
              emotionalState: typeof parsed.emotionalState === 'string' ? parsed.emotionalState : 'neutral',
              userNeeds: Array.isArray(parsed.userNeeds) ? parsed.userNeeds : [],
              importantContext: typeof parsed.importantContext === 'string' ? parsed.importantContext : ''
            };
          }
        } catch (err2) {
          console.error('Fallback JSON parse also failed:', err2);
        }
        
        // Final fallback
        console.error('Failed to parse analytics assistant JSON:', result.content);
        return {
          summary: 'Analysis failed - JSON parse error',
          permaInsights: {},
          personalizationUpdates: {},
          suggestedQuestions: [],
          shouldSummarize: false,
          keyTopics: [],
          emotionalState: 'neutral',
          userNeeds: [],
          importantContext: ''
        };
      }
    } catch (err) {
      console.error('Analytics assistant error:', err);
      return {
        summary: 'Analysis failed',
        permaInsights: {},
        personalizationUpdates: {},
        suggestedQuestions: [],
        shouldSummarize: false,
        keyTopics: [],
        emotionalState: 'neutral',
        userNeeds: [],
        importantContext: ''
      };
    }
  }

  /**
   * Fix common JSON formatting issues in AI responses
   */
  private fixCommonJsonIssues(jsonStr: string): string {
    // Fix unquoted boolean-like values
    jsonStr = jsonStr.replace(/:\s*true(?=\s*[,}])/g, ': "true"');
    jsonStr = jsonStr.replace(/:\s*false(?=\s*[,}])/g, ': "false"');
    
    // Fix unquoted common values
    jsonStr = jsonStr.replace(/:\s*moderate(?=\s*[,}])/g, ': "moderate"');
    jsonStr = jsonStr.replace(/:\s*developing(?=\s*[,}])/g, ': "developing"');
    jsonStr = jsonStr.replace(/:\s*neutral(?=\s*[,}])/g, ': "neutral"');
    jsonStr = jsonStr.replace(/:\s*low(?=\s*[,}])/g, ': "low"');
    jsonStr = jsonStr.replace(/:\s*high(?=\s*[,}])/g, ': "high"');
    jsonStr = jsonStr.replace(/:\s*medium(?=\s*[,}])/g, ': "medium"');
    
    // Fix trailing commas
    jsonStr = jsonStr.replace(/,(\s*[}\]])/g, '$1');
    
    return jsonStr;
  }

  /**
   * Validate and convert PERMA insights to proper format
   */
  private validatePermaInsights(permaInsights: any): any {
    if (!permaInsights || typeof permaInsights !== 'object') {
      return {};
    }

    const validated: any = {};
    const permaKeys = ['positiveEmotion', 'engagement', 'relationships', 'meaning', 'accomplishment'];
    
    permaKeys.forEach(key => {
      let value = permaInsights[key];
      
      // Convert string numbers to actual numbers
      if (typeof value === 'string') {
        const numValue = parseInt(value, 10);
        if (!isNaN(numValue)) {
          value = numValue;
        } else {
          // Convert descriptive values to numbers
          switch (value.toLowerCase()) {
            case 'low': value = 3; break;
            case 'moderate': value = 5; break;
            case 'high': value = 7; break;
            case 'neutral': value = 5; break;
            case 'developing': value = 4; break;
            default: value = 5;
          }
        }
      }
      
      // Ensure it's a valid number between 1-10
      if (typeof value === 'number' && value >= 1 && value <= 10) {
        validated[key] = Math.round(value);
      } else {
        validated[key] = 5; // Default value
      }
    });

    return validated;
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

  async generateQuickResponse(prompt: string): Promise<string> {
    try {
      const response = await this.apiCall('/chat/completions', 'POST', {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 50,
        temperature: 0.3
      });
      
      return response.choices?.[0]?.message?.content?.trim() || '';
    } catch (error) {
      console.error('Error generating quick response:', error);
      throw error;
    }
  }

  async deleteThread(threadId: string): Promise<void> {
    try {
      this.validateThreadId(threadId);
      await this.apiCall(`/threads/${threadId}`, 'DELETE');
      console.log(`Thread ${threadId} deleted successfully`);
    } catch (error) {
      console.error(`Error deleting thread ${threadId}:`, error);
      throw error;
    }
  }
}
