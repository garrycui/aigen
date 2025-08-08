import { generateChatResponse } from '../common/openai';
import { UserProfiler } from './userProfiler';
import { getPersonaPrompt } from './persona';
import { getPERMAGuidanceAdvanced } from './permaGuide';
import { extractUserInterests, recommendTopics } from './interestRecommender';

export interface ChatMessage {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: string;
  sentiment?: 'positive' | 'negative' | 'neutral';
}

export interface UserContext {
  mbtiType?: string;
  aiPreference?: string;
  communicationStyle?: string;
  learningPreference?: string;
  emotionalState?: string;
  supportNeeds?: string;
  perma?: any; // Add this
  interests?: string[]; // Add this
  name?: string; // Add this
}

export class ChatService {
  private static instance: ChatService;
  static getInstance(): ChatService {
    if (!ChatService.instance) {
      ChatService.instance = new ChatService();
    }
    return ChatService.instance;
  }

  async generateResponse(
    message: string,
    chatHistory: ChatMessage[],
    userContext?: UserContext & { perma?: any; interests?: string[]; name?: string; mbtiType?: string; permaAnswers?: any }
  ): Promise<{ response: string; sentiment?: string }> {
    try {
      // Persona and context
      const persona = getPersonaPrompt(userContext?.mbtiType || '', userContext?.name || '');
      const permaGuidance = (userContext?.perma && userContext?.mbtiType && userContext?.permaAnswers)
        ? getPERMAGuidanceAdvanced({
            perma: userContext.perma,
            mbtiType: userContext.mbtiType,
            permaAnswers: userContext.permaAnswers
          })
        : '';
      const interests = userContext?.interests || [];
      const topics = recommendTopics(interests);

      // Build a summary of recent chat history for context
      const historySummary = chatHistory.slice(-6).map(msg =>
        `${msg.role === 'user' ? (userContext?.name || 'User') : 'AI'}: ${msg.content}`
      ).join('\n');

      const contextEnhance = `
${persona}
${permaGuidance ? `\n${permaGuidance}` : ''}
User interests: ${topics.join(', ')}.

You are a highly engaging, emotionally intelligent AI companion.
- Always maintain awareness of the ongoing conversation and reference relevant parts of the chat history below.
- Respond in a natural, warm, and conversational way (never robotic).
- Match the user's message length and style: reply concisely if the user is brief, and provide a bit more detail if the user writes longer messages.
- Keep responses friendly, clear, and easy to read—avoid long paragraphs or overwhelming the user.
- Use short paragraphs, bullet points, or lists if helpful.
- Use the user's name (${userContext?.name || 'User'}) when appropriate.
- Show empathy, curiosity, encouragement, and a touch of humor when suitable.
- Ask thoughtful, open-ended follow-up questions based on what the user just said or previous context.
- If the user mentions a previous topic, smoothly continue or connect to it.
- If the user seems disengaged, gently re-engage them with a question or by referencing their interests.
- Avoid repeating yourself and keep responses concise but warm.
- If the user shares something personal or emotional, acknowledge it with care.
- If the user asks for advice, tailor it to their MBTI and happiness needs.

Recent chat history:
${historySummary}

User message: ${message}
`;

      const formattedHistory: { role: string; content: string }[] = []; // Already included above, so don't double-send
      const result = await generateChatResponse(
        contextEnhance,
        formattedHistory,
        userContext?.mbtiType,
        userContext?.aiPreference
      );
      return {
        response: result.response,
        sentiment: this.analyzeSentiment(message)
      };
    } catch (error) {
      return {
        response: "I'm having a bit of trouble thinking right now. Could you try asking me again? 🤔",
        sentiment: 'neutral'
      };
    }
  }

  async getUserInsightsAndSuggestions(chatHistory: ChatMessage[]): Promise<{ insights: any; suggestedQuestions: string[] }> {
    const insights = await UserProfiler.analyzeUserFromChatOpenAI(chatHistory);
    return {
      insights,
      suggestedQuestions: insights.suggestedQuestions || []
    };
  }

  generateSuggestedQuestions(
    chatHistory: ChatMessage[],
    userInsights?: any
  ): string[] {
    // Dynamically generate suggested questions based on insights and history
    const suggestions: string[] = [];
    if (userInsights?.userNeeds?.length) {
      suggestions.push('What else do you hope AI can help you with?');
    }
    if (userInsights?.interestTopics?.length) {
      suggestions.push(`Would you like to discuss new trends in ${userInsights.interestTopics[0]}?`);
    }
    if (userInsights?.userGoals?.length) {
      suggestions.push('What do you think are the main obstacles to your goals right now?');
    }
    if (suggestions.length === 0) {
      suggestions.push('Do you have any new thoughts about AI recently?');
      suggestions.push('Is there anything else you want me to help with?');
    }
    return suggestions.slice(0, 2);
  }

  generateSummaryMessage(userInsights: any): string | null {
    // Brief summary of what the AI has learned about the user
    if (!userInsights) return null;
    let summary = 'Summary: I understand that you';
    if (userInsights.userNeeds?.length) summary += ` need "${userInsights.userNeeds[0]}"`;
    if (userInsights.interestTopics?.length) summary += `, are interested in "${userInsights.interestTopics.join(', ')}"`;
    if (userInsights.userGoals?.length) summary += `, and your goal is "${userInsights.userGoals[0]}"`;
    summary += '. If this is not accurate, please correct me!';
    return summary.length > 10 ? summary : null;
  }

  private analyzeSentiment(message: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = ['good', 'great', 'awesome', 'love', 'excited', 'happy', 'amazing'];
    const negativeWords = ['bad', 'hate', 'terrible', 'worried', 'scared', 'confused', 'frustrated'];
    const lower = message.toLowerCase();
    const pos = positiveWords.filter(w => lower.includes(w)).length;
    const neg = negativeWords.filter(w => lower.includes(w)).length;
    if (pos > neg) return 'positive';
    if (neg > pos) return 'negative';
    return 'neutral';
  }

  generateSessionTitle(firstMessage: string): string {
    const words = firstMessage.split(' ').slice(0, 4).join(' ');
    return words.length > 30 ? words.substring(0, 30) + '...' : words;
  }
}