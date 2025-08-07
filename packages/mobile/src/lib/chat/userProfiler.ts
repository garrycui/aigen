import { ChatMessage } from './chatService';
import { getUserInsightsFromOpenAI } from '../common/openai';
import { extractUserInterests } from './interestRecommender';

export interface UserInsights {
  communicationPatterns: string[];
  interests: string[];
  learningStyle: string;
  emotionalTrends: string[];
  engagementLevel: 'high' | 'medium' | 'low';
  preferredTopics: string[];
  userNeeds?: string[];
  userGoals?: string[];
  interestTopics?: string[];
  suggestedQuestions?: string[];
}

export class UserProfiler {
  static analyzeUserFromChat(messages: ChatMessage[]): UserInsights {
    const userMessages = messages.filter(m => m.role === 'user');
    return {
      communicationPatterns: this.extractCommunicationPatterns(userMessages),
      interests: this.extractInterests(userMessages),
      learningStyle: this.determineLearningStyle(userMessages),
      emotionalTrends: this.extractEmotionalTrends(messages),
      engagementLevel: this.calculateEngagementLevel(userMessages),
      preferredTopics: this.extractTopics(userMessages),
      userNeeds: this.extractUserNeeds(userMessages),
      userGoals: this.extractUserGoals(userMessages),
      interestTopics: this.extractInterestTopics(userMessages),
    };
  }

  /**
   * Analyze user from chat using OpenAI API for deep insights.
   * Returns a promise with UserInsights.
   */
  static async analyzeUserFromChatOpenAI(messages: ChatMessage[]): Promise<UserInsights> {
    // Compose a prompt for OpenAI to analyze the chat history
    const prompt = `
You are an expert AI assistant helping to understand a user's needs, interests, personality, communication style, and learning preferences based on their chat history.

Given the following chat history (user and assistant messages), analyze and summarize:
- What are the user's main needs and goals?
- What topics or interests do they care about?
- What can you infer about their personality and communication style? If MBTI or communication style is mentioned, use it.
- What is their preferred way of learning or interacting?
- What is their emotional trend or attitude toward AI/technology?
- Suggest 2-3 personalized follow-up questions that would help the user express themselves more or clarify their needs.

Return your answer as a concise, robust JSON object with the following fields:
{
  "userNeeds": [array of strings],
  "userGoals": [array of strings],
  "interestTopics": [array of strings],
  "communicationPatterns": [array of strings],
  "learningStyle": "string",
  "emotionalTrends": [array of strings],
  "engagementLevel": "high" | "medium" | "low",
  "preferredTopics": [array of strings],
  "suggestedQuestions": [array of strings]
}

Chat history:
${messages.map(m => `[${m.role}] ${m.content}`).join('\n')}
`;

    // Call OpenAI API (see implementation in ../common/openai)
    const insights = await getUserInsightsFromOpenAI(prompt);
    return insights;
  }

  static mergeAssessmentAndChatInsights(
    assessment: { mbtiType?: string; interests?: string[]; happinessScores?: any; personalInfo?: any },
    chatInsights: UserInsights
  ): UserInsights & { mbtiType?: string; perma?: any; name?: string } {
    return {
      ...chatInsights,
      mbtiType: assessment.mbtiType,
      perma: assessment.happinessScores,
      name: assessment.personalInfo?.name,
      interests: extractUserInterests(assessment.interests, chatInsights.interests),
    };
  }

  private static extractCommunicationPatterns(messages: ChatMessage[]): string[] {
    const patterns = [];
    const avgLength = messages.reduce((sum, m) => sum + m.content.length, 0) / (messages.length || 1);
    if (avgLength > 100) patterns.push('detailed_communicator');
    if (avgLength < 30) patterns.push('concise_communicator');
    const questionCount = messages.filter(m => m.content.includes('?')).length;
    if (questionCount > messages.length * 0.3) patterns.push('curious_questioner');
    return patterns;
  }

  private static extractInterests(messages: ChatMessage[]): string[] {
    const interests: string[] = [];
    const content = messages.map(m => m.content.toLowerCase()).join(' ');
    const interestKeywords = {
      'technology': ['tech', 'ai', 'artificial intelligence', 'robot', 'automation'],
      'learning': ['learn', 'study', 'course', 'education', 'skill'],
      'career': ['job', 'work', 'career', 'professional', 'business'],
      'creativity': ['creative', 'art', 'design', 'write', 'music']
    };
    Object.entries(interestKeywords).forEach(([interest, keywords]) => {
      if (keywords.some(keyword => content.includes(keyword))) interests.push(interest);
    });
    return interests;
  }

  private static determineLearningStyle(messages: ChatMessage[]): string {
    const content = messages.map(m => m.content.toLowerCase()).join(' ');
    if (content.includes('example') || content.includes('show me')) return 'visual';
    if (content.includes('explain') || content.includes('understand')) return 'analytical';
    if (content.includes('try') || content.includes('practice')) return 'hands_on';
    return 'balanced';
  }

  private static extractEmotionalTrends(messages: ChatMessage[]): string[] {
    const trends = [];
    const sentiments = messages.map(m => m.sentiment).filter(Boolean);
    const positiveRatio = sentiments.filter(s => s === 'positive').length / (sentiments.length || 1);
    const negativeRatio = sentiments.filter(s => s === 'negative').length / (sentiments.length || 1);
    if (positiveRatio > 0.6) trends.push('generally_positive');
    if (negativeRatio > 0.4) trends.push('needs_support');
    return trends;
  }

  private static calculateEngagementLevel(messages: ChatMessage[]): 'high' | 'medium' | 'low' {
    if (messages.length > 10) return 'high';
    if (messages.length > 5) return 'medium';
    return 'low';
  }

  private static extractTopics(messages: ChatMessage[]): string[] {
    const topics: string[] = [];
    const content = messages.map(m => m.content.toLowerCase()).join(' ');
    const topicKeywords = ['ai', 'technology', 'learning', 'career', 'future', 'automation'];
    topicKeywords.forEach(topic => {
      if (content.includes(topic)) topics.push(topic);
    });
    return [...new Set(topics)];
  }

  private static extractUserNeeds(messages: ChatMessage[]): string[] {
    // Simple keyword extraction, can be improved with NLP
    const needsKeywords = ['need', 'want', 'hope', 'help me', 'solve'];
    return messages
      .filter(m => needsKeywords.some(k => m.content.toLowerCase().includes(k)))
      .map(m => m.content);
  }

  private static extractUserGoals(messages: ChatMessage[]): string[] {
    const goalKeywords = ['goal', 'achieve', 'reach', 'hope', 'want to be'];
    return messages
      .filter(m => goalKeywords.some(k => m.content.toLowerCase().includes(k)))
      .map(m => m.content);
  }

  private static extractInterestTopics(messages: ChatMessage[]): string[] {
    // Can use more advanced NLP
    const topics = ['ai', 'artificial intelligence', 'health', 'education', 'creativity', 'technology', 'career', 'life'];
    const content = messages.map(m => m.content.toLowerCase()).join(' ');
    return topics.filter(topic => content.includes(topic));
  }
}