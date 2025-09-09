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
      
      // Enhanced instructions for better formatting
      const formattingInstructions = `
FORMATTING REQUIREMENTS - FOLLOW EXACTLY:
- Use markdown formatting for structure and readability
- Use **bold** for emphasis and key points
- Use proper headers: # for main topics, ## for sections, ### for subsections
- Use numbered lists (1. 2. 3.) for sequential steps or ordered content
- Use bullet points (-) for unordered lists and examples
- Use > for quotes or important notes
- Use --- for section dividers when needed
- Keep paragraphs concise with proper line breaks
- Always use proper sequential numbering (1. 2. 3. 4.) not repeated (1. 1. 1. 1.)
- End with a question or engagement prompt when appropriate

RESPONSE STRUCTURE:
- Start with a clear header if the topic is substantial
- Break content into digestible sections
- Use visual hierarchy with headers and lists
- Provide clear, actionable guidance
- Maintain encouraging and supportive tone
- Use straight dividers (---) for major section breaks
`;
      
      // Combine personalization and session context with proper length limits
      const instructions: string[] = [formattingInstructions];
      
      if (personalizationContext && personalizationContext.trim()) {
        const truncatedPersonalization = personalizationContext.length > 1800 
          ? personalizationContext.substring(0, 1800) + '...'
          : personalizationContext;
        instructions.push(truncatedPersonalization);
      }
      
      if (sessionContext && sessionContext.trim()) {
        const truncatedSession = sessionContext.length > 1200
          ? sessionContext.substring(0, 1200) + '...'
          : sessionContext;
        instructions.push(truncatedSession);
      }
      
      if (instructions.length > 1) {
        const combinedInstructions = instructions.join('\n\n');
        runBody.additional_instructions = combinedInstructions.length > 3500
          ? combinedInstructions.substring(0, 3500) + '...'
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
      
      // Post-process the response for better formatting
      const formattedContent = this.enhanceResponseFormatting(lastAssistantMessage.content);
      
      return { 
        content: formattedContent, 
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
          
          await this.addMessageToThread(newThreadId, userMessage, 'user');
          
          const runBody: any = { 
            assistant_id: CHAT_ASSISTANT_ID, 
            temperature: 0.7 
          };
          
          // Re-apply contexts and formatting instructions for retry
          const formattingInstructions = `
FORMATTING: Use markdown (headers, bold, lists, quotes) for clear structure and readability.
STYLE: Be conversational, structured, encouraging. Include engagement prompts.
`;
          const instructions: string[] = [formattingInstructions];
          
          if (personalizationContext?.trim()) {
            instructions.push(personalizationContext.length > 1800 
              ? personalizationContext.substring(0, 1800) + '...'
              : personalizationContext);
          }
          if (sessionContext?.trim()) {
            instructions.push(sessionContext.length > 1200
              ? sessionContext.substring(0, 1200) + '...'
              : sessionContext);
          }
          
          if (instructions.length > 1) {
            const combinedInstructions = instructions.join('\n\n');
            runBody.additional_instructions = combinedInstructions.length > 3500
              ? combinedInstructions.substring(0, 3500) + '...'
              : combinedInstructions;
          }
          
          const retryRun = await this.apiCall(`/threads/${newThreadId}/runs`, 'POST', runBody);
          const retryCompleted = await this.waitForRunCompletion(newThreadId, retryRun.id);
          const retryMsgs = await this.getThreadMessages(newThreadId, 1);
          const retryLastMessage = retryMsgs.find(m => m.role === 'assistant');
          
          if (retryLastMessage?.content) {
            console.log('Successfully recovered with new thread:', newThreadId);
            const formattedRetryContent = this.enhanceResponseFormatting(retryLastMessage.content);
            return { 
              content: formattedRetryContent, 
              threadId: newThreadId, 
              runId: retryCompleted.id 
            };
          }
          
          throw new Error('Retry with new thread also failed');
          
        } catch (retryError) {
          console.error('Retry with new thread failed:', retryError);
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

  /**
   * Enhance response formatting for better ChatMessage display
   */
  private enhanceResponseFormatting(content: string): string {
    let formatted = content;
    
    // Ensure proper spacing around headers
    formatted = formatted.replace(/^(#{1,4})\s*(.+)$/gm, '\n$1 $2\n');
    
    // Ensure proper numbered list formatting with preserved numbers
    formatted = formatted.replace(/^(\d+)\.\s+(.+)$/gm, '$1. $2');
    
    // Ensure proper bullet list formatting
    formatted = formatted.replace(/^(-|\*)\s+(.+)$/gm, '- $2');
    
    // Ensure proper spacing around quotes
    formatted = formatted.replace(/^>\s*(.+)$/gm, '> $1');
    
    // Ensure proper divider formatting
    formatted = formatted.replace(/^(---+|\*\*\*+)$/gm, '---');
    
    // Clean up multiple consecutive newlines
    formatted = formatted.replace(/\n{3,}/g, '\n\n');
    
    // Trim whitespace
    formatted = formatted.trim();
    
    return formatted;
  }

  async runAnalyticsAssistant(conversationHistory: ThreadMessage[], personalization?: any): Promise<AnalyticsResult> {
    const analyticsThreadId = await this.createThread({ purpose: 'analytics' });
    const conversationText = conversationHistory.map(m => `[${m.role}] ${m.content}`).join('\n');
    
    const prompt = `
Analyze this happiness-focused conversation and provide a JSON object with the following structure. 

IMPORTANT: All values must be properly quoted strings or numbers for valid JSON:

{
  "summary": "2-3 sentence summary focusing on happiness themes and user progress",
  "permaInsights": {
    "positiveEmotion": 5,
    "engagement": 6,
    "relationships": 4,
    "meaning": 5,
    "accomplishment": 3
  },
  "personalizationUpdates": {
    "contentPreferences": {
      "emergingInterests": ["topic1", "topic2"],
      "topicScores": {"happiness": 8, "wellbeing": 7}
    },
    "userCore": {
      "emotionalSupport": "medium",
      "communicationStyle": "supportive"
    }
  },
  "suggestedQuestions": [
    "What activities bring you the most joy?",
    "How can we build on your strengths?"
  ],
  "shouldSummarize": false,
  "keyTopics": ["happiness", "personal growth"],
  "emotionalState": "optimistic",
  "userNeeds": ["encouragement", "goal setting"],
  "importantContext": "User is actively working on improving wellbeing"
}

ANALYSIS FOCUS:
- Identify PERMA improvements and growth opportunities
- Suggest happiness-focused questions that encourage exploration
- Note emerging interests that align with user's joy sources
- Assess emotional progression and support needs
- Focus on strengths and positive development

Rules for JSON formatting:
- All strings must be in double quotes
- Numbers should be integers 1-10 for PERMA insights
- Boolean values should be true/false (not quoted)
- No trailing commas or unquoted values

Personalization context: ${JSON.stringify(personalization || {})}
Conversation:
${conversationText}

Return only valid JSON:`.trim();

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
        let cleanContent = result.content.trim();
        cleanContent = cleanContent.replace(/^```json\s*\n?/, '').replace(/\n?```$/, '');
        cleanContent = cleanContent.replace(/^```\s*\n?/, '').replace(/\n?```$/, '');
        
        const parsed = JSON.parse(cleanContent);
        
        return {
          summary: typeof parsed.summary === 'string' ? parsed.summary : 'Analysis completed - user showing positive engagement',
          permaInsights: this.validatePermaInsights(parsed.permaInsights),
          personalizationUpdates: parsed.personalizationUpdates || {},
          suggestedQuestions: Array.isArray(parsed.suggestedQuestions) ? parsed.suggestedQuestions : [
            "What's bringing you joy lately?",
            "How can we build on your recent progress?"
          ],
          shouldSummarize: typeof parsed.shouldSummarize === 'boolean' ? parsed.shouldSummarize : false,
          keyTopics: Array.isArray(parsed.keyTopics) ? parsed.keyTopics : ['happiness', 'growth'],
          emotionalState: typeof parsed.emotionalState === 'string' ? parsed.emotionalState : 'positive',
          userNeeds: Array.isArray(parsed.userNeeds) ? parsed.userNeeds : ['encouragement'],
          importantContext: typeof parsed.importantContext === 'string' ? parsed.importantContext : 'User engaging positively'
        };
      } catch (err) {
        console.error('JSON parse error:', err);
        console.error('Raw content:', result.content);
        
        try {
          const jsonMatch = result.content.match(/\{[\s\S]*\}/);
          if (jsonMatch) {
            let jsonStr = jsonMatch[0];
            jsonStr = this.fixCommonJsonIssues(jsonStr);
            const parsed = JSON.parse(jsonStr);
            return {
              summary: typeof parsed.summary === 'string' ? parsed.summary : 'Conversation analysis completed',
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
        
        return {
          summary: 'Analysis failed - JSON parse error',
          permaInsights: {},
          personalizationUpdates: {},
          suggestedQuestions: ["How can I help you feel happier today?"],
          shouldSummarize: false,
          keyTopics: ['conversation'],
          emotionalState: 'neutral',
          userNeeds: ['support'],
          importantContext: 'Technical analysis issue - manual review needed'
        };
      }
    } catch (err) {
      console.error('Analytics assistant error:', err);
      return {
        summary: 'Analysis failed due to technical error',
        permaInsights: {},
        personalizationUpdates: {},
        suggestedQuestions: ["What would make you happier today?"],
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
    
    // UPDATED: Use UnifiedPersonalizationProfile structure
    // User Core Information
    if (personalization.userCore) {
      const { mbtiType, communicationStyle, socialPreference, challengeLevel, emotionalSupport, learningStyle } = personalization.userCore;
      
      if (mbtiType) {
        ctx.push(`User MBTI: ${mbtiType}. Adapt your communication style to match this personality type.`);
      }
      if (communicationStyle) {
        ctx.push(`Preferred communication style: ${communicationStyle}.`);
      }
      if (socialPreference) {
        ctx.push(`Social preference: ${socialPreference}. Adjust interaction style accordingly.`);
      }
      if (challengeLevel) {
        ctx.push(`Challenge level preference: ${challengeLevel}. Provide appropriately challenging content.`);
      }
      if (emotionalSupport) {
        ctx.push(`Emotional support needs: ${emotionalSupport}. Adjust empathy and support accordingly.`);
      }
      if (learningStyle) {
        ctx.push(`Learning style: ${learningStyle}. Present information in this format when possible.`);
      }
    }
    
    // Wellness Profile
    if (personalization.wellnessProfile) {
      const { focusAreas, strengths, happinessSources, wellnessGoals } = personalization.wellnessProfile;
      
      if (focusAreas?.length) {
        ctx.push(`PRIORITY: Help improve these PERMA areas: ${focusAreas.join(', ')}. Focus conversations on these areas.`);
      }
      if (strengths?.length) {
        ctx.push(`User's PERMA strengths: ${strengths.join(', ')}. Leverage these in conversations.`);
      }
      if (happinessSources?.length) {
        ctx.push(`What makes user happy: ${happinessSources.join(', ')}. Reference these for positive interactions.`);
      }
      if (wellnessGoals?.length) {
        ctx.push(`Wellness goals: ${wellnessGoals.join(', ')}. Support progress toward these goals.`);
      }
    }
    
    // Content Preferences
    if (personalization.contentPreferences) {
      const { primaryInterests, emergingInterests, avoidTopics } = personalization.contentPreferences;
      
      if (primaryInterests?.length) {
        ctx.push(`Primary interests: ${primaryInterests.slice(0, 5).join(', ')}. Use these for examples and connections.`);
      }
      if (emergingInterests?.length) {
        ctx.push(`Emerging interests: ${emergingInterests.join(', ')}. These are developing interests to nurture.`);
      }
      if (avoidTopics?.length) {
        ctx.push(`Topics to avoid: ${avoidTopics.join(', ')}.`);
      }
    }
    
    // Activity Tracking Context
    if (personalization.activityTracking) {
      const { chatMetrics } = personalization.activityTracking;
      if (chatMetrics?.preferredTopics?.length) {
        const topTopics = chatMetrics.preferredTopics.slice(0, 3).map((t: any) => `${t.topic} (${t.score})`);
        ctx.push(`Most engaged topics: ${topTopics.join(', ')}.`);
      }
    }
    
    // Computed Fields
    if (personalization.computed) {
      const { overallHappiness, needsAttention, engagementLevel } = personalization.computed;
      
      if (overallHappiness) {
        ctx.push(`Current happiness level: ${overallHappiness}/10. Adjust tone and approach accordingly.`);
      }
      if (needsAttention?.length) {
        ctx.push(`Areas needing immediate attention: ${needsAttention.join(', ')}. Prioritize these in conversations.`);
      }
      if (engagementLevel) {
        ctx.push(`Engagement level: ${engagementLevel}. Match energy and interaction style.`);
      }
    }
    
    // Core Directive
    ctx.push(
      "CORE OBJECTIVES: (1) Use personality insights to shape tone and approach. (2) Actively target focus areas to improve wellbeing. (3) Connect with user's interests and happiness sources. (4) Provide support level matching their emotional needs. (5) Avoid topics they dislike. (6) Adapt to their engagement level and learning style."
    );
    
    return ctx.length ? `Personalization context: ${ctx.join(' ')}` : '';
  }

  async generateQuickResponse(prompt: string): Promise<string> {
    try {
      // Enhanced prompt for better formatting
      const enhancedPrompt = `${prompt}

Format your response with:
- Clear structure using markdown if helpful
- Concise, actionable language
- Encouraging tone focused on happiness and growth
- Maximum 2-3 sentences for quick responses`;

      const response = await this.apiCall('/chat/completions', 'POST', {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: enhancedPrompt }],
        max_tokens: 80,
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
