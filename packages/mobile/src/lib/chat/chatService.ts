import { generateChatResponse } from '../common/openai';
import { UserProfiler } from './userProfiler';

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
    userContext?: UserContext
  ): Promise<{ response: string; sentiment?: string }> {
    try {
      // Persona and context
      let persona = `You are an enthusiastic, funny, and supportive AI companion. Use humor, emojis, and ask follow-up questions.`;
      let contextEnhance = '';
      if (userContext) {
        if (userContext.aiPreference === 'resistant') contextEnhance += ' User is cautious about AI, be extra encouraging.';
        if (userContext.aiPreference === 'beginner') contextEnhance += ' User is new to AI, explain clearly and celebrate wins.';
        if (userContext.aiPreference === 'advanced') contextEnhance += ' User is AI-savvy, share advanced insights.';
        if (userContext.emotionalState === 'anxious') contextEnhance += ' User is anxious, be reassuring.';
        if (userContext.mbtiType) contextEnhance += ` User MBTI: ${userContext.mbtiType}.`;
        if (userContext.communicationStyle) contextEnhance += ` Communication style: ${userContext.communicationStyle}.`;
        if (userContext.learningPreference) contextEnhance += ` Learning preference: ${userContext.learningPreference}.`;
      }
      // Request concise, robust answers
      const enhancedPrompt = `${persona}${contextEnhance}
Always respond concisely, clearly, and robustly. Avoid unnecessary repetition. Adapt your tone and style to the user's MBTI and communication preferences.

User message: ${message}`;
      const formattedHistory = chatHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      const result = await generateChatResponse(
        enhancedPrompt,
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