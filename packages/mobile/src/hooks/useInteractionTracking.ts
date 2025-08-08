import { useCallback } from 'react';
import { useFirebase } from '../context/FirebaseContext';
import { useDynamicPersonalization } from './useDynamicPersonalization';

interface ChatInteraction {
  messageId: string;
  userMessage: string;
  aiResponse: string;
  topics: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  engagementLevel: number; // 1-10
  timestamp: string;
}

interface TopicEngagement {
  topic: string;
  engagementScore: number;
  interactionType: 'mention' | 'question' | 'followup' | 'dismissal';
  context: string;
}

interface WellnessInteraction {
  interventionType: string;
  response: 'engaged' | 'skipped' | 'completed';
  effectiveness: number; // 1-10
  permaDimension: string;
}

export function useInteractionTracking(userId: string) {
  const { createDocument, updateDocument } = useFirebase();
  const { personalization, updatePersonalization } = useDynamicPersonalization(userId);

  // Track chat interactions for learning
  const trackChatInteraction = useCallback(async (interaction: ChatInteraction) => {
    if (!userId) return;

    try {
      // 1. Store raw interaction
      await createDocument('userInteractions', {
        userId,
        type: 'message',
        data: interaction,
        timestamp: new Date().toISOString(),
        processed: false
      });

      // 2. Process immediate updates
      await processInteractionUpdates(interaction);

    } catch (error) {
      console.error('Error tracking chat interaction:', error);
    }
  }, [userId]);

  // Track topic engagement for content personalization
  const trackTopicEngagement = useCallback(async (engagement: TopicEngagement) => {
    if (!userId || !personalization) return;

    try {
      // Store interaction
      await createDocument('userInteractions', {
        userId,
        type: 'topic_engagement',
        data: engagement,
        timestamp: new Date().toISOString(),
        processed: false
      });

      // Update content preferences based on engagement
      const updates = updateContentPreferencesFromEngagement(
        personalization.contentPreferences,
        engagement
      );

      if (updates) {
        await updatePersonalization({ contentPreferences: updates });
      }

    } catch (error) {
      console.error('Error tracking topic engagement:', error);
    }
  }, [userId, personalization, updatePersonalization]);

  // Track wellness intervention responses
  const trackWellnessInteraction = useCallback(async (interaction: WellnessInteraction) => {
    if (!userId || !personalization) return;

    try {
      // Store interaction
      await createDocument('userInteractions', {
        userId,
        type: 'intervention_response',
        data: interaction,
        timestamp: new Date().toISOString(),
        processed: false
      });

      // Update wellness profile based on intervention response
      const updates = updateWellnessFromInteraction(
        personalization.wellnessProfile,
        interaction
      );

      if (updates) {
        await updatePersonalization({ wellnessProfile: updates });
      }

    } catch (error) {
      console.error('Error tracking wellness interaction:', error);
    }
  }, [userId, personalization, updatePersonalization]);

  // Process chat interaction for personalization updates
  const processInteractionUpdates = async (interaction: ChatInteraction) => {
    if (!personalization) return;

    const updates: any = {};

    // Update chat persona based on interaction patterns
    if (interaction.engagementLevel >= 8) {
      const chatPersonaUpdates = updateChatPersonaFromInteraction(
        personalization.chatPersona,
        interaction
      );
      if (chatPersonaUpdates) {
        updates.chatPersona = chatPersonaUpdates;
      }
    }

    // Update content preferences based on topics discussed
    if (interaction.topics.length > 0) {
      const contentUpdates = updateContentFromTopics(
        personalization.contentPreferences,
        interaction.topics,
        interaction.engagementLevel
      );
      if (contentUpdates) {
        updates.contentPreferences = contentUpdates;
      }
    }

    // Apply updates if any
    if (Object.keys(updates).length > 0) {
      await updatePersonalization(updates);
    }
  };

  return {
    trackChatInteraction,
    trackTopicEngagement,
    trackWellnessInteraction
  };
}

// Helper functions for updating personalization
function updateChatPersonaFromInteraction(
  chatPersona: any,
  interaction: ChatInteraction
): any {
  const updates = { ...chatPersona };
  
  // Ensure learningPatterns exists
  if (!updates.learningPatterns) {
    updates.learningPatterns = {
      responsePreferences: [],
      engagementTriggers: [],
      avoidancePatterns: []
    };
  }
  
  // Learn response preferences
  if (interaction.engagementLevel >= 8) {
    const responsePattern = extractResponsePattern(interaction.aiResponse);
    if (responsePattern && !updates.learningPatterns.responsePreferences.includes(responsePattern)) {
      updates.learningPatterns.responsePreferences.push(responsePattern);
      
      // Keep only top 10 preferences
      if (updates.learningPatterns.responsePreferences.length > 10) {
        updates.learningPatterns.responsePreferences = updates.learningPatterns.responsePreferences.slice(-10);
      }
    }
  }

  // Learn engagement triggers
  if (interaction.engagementLevel >= 7) {
    interaction.topics.forEach(topic => {
      if (!updates.learningPatterns.engagementTriggers.includes(topic)) {
        updates.learningPatterns.engagementTriggers.push(topic);
      }
    });
    
    // Keep only top 15 triggers
    if (updates.learningPatterns.engagementTriggers.length > 15) {
      updates.learningPatterns.engagementTriggers = updates.learningPatterns.engagementTriggers.slice(-15);
    }
  }

  return updates;
}

function updateContentPreferencesFromEngagement(
  contentPreferences: any,
  engagement: TopicEngagement
): any {
  const updates = { ...contentPreferences };
  const { topic, engagementScore, interactionType } = engagement;

  // Ensure dynamicInterests exists
  if (!updates.dynamicInterests) {
    updates.dynamicInterests = {
      emerging: [],
      declining: [],
      seasonal: {}
    };
  }

  // High engagement - add to emerging interests
  if (engagementScore >= 8 && interactionType !== 'dismissal') {
    if (!updates.dynamicInterests.emerging.includes(topic)) {
      updates.dynamicInterests.emerging.push(topic);
    }
    
    // Remove from declining if it was there
    updates.dynamicInterests.declining = updates.dynamicInterests.declining.filter(
      (t: string) => t !== topic
    );
  }

  // Low engagement or dismissal - add to declining
  if (engagementScore <= 3 || interactionType === 'dismissal') {
    if (!updates.dynamicInterests.declining.includes(topic)) {
      updates.dynamicInterests.declining.push(topic);
    }
    
    // Remove from emerging if it was there
    updates.dynamicInterests.emerging = updates.dynamicInterests.emerging.filter(
      (t: string) => t !== topic
    );
  }

  // Promote emerging interests to primary interests
  if (updates.dynamicInterests.emerging.length >= 3) {
    const topEmerging = updates.dynamicInterests.emerging.slice(0, 2);
    updates.primaryInterests = [...new Set([...updates.primaryInterests, ...topEmerging])];
    updates.dynamicInterests.emerging = updates.dynamicInterests.emerging.slice(2);
  }

  // Add declining interests to avoid topics
  if (updates.dynamicInterests.declining.length >= 3) {
    const topDeclining = updates.dynamicInterests.declining.slice(0, 2);
    updates.avoidTopics = [...new Set([...updates.avoidTopics, ...topDeclining])];
    updates.dynamicInterests.declining = updates.dynamicInterests.declining.slice(2);
  }

  return updates;
}

function updateWellnessFromInteraction(
  wellnessProfile: any,
  interaction: WellnessInteraction
): any {
  const updates = { ...wellnessProfile };
  const { interventionType, response, effectiveness, permaDimension } = interaction;

  // Ensure progressTracking exists
  if (!updates.progressTracking) {
    updates.progressTracking = {
      trendingUp: [],
      needsAttention: [],
      interventionSuccess: {}
    };
  }

  // Track intervention success
  if (response === 'completed' && effectiveness >= 7) {
    updates.progressTracking.interventionSuccess[interventionType] = 
      (updates.progressTracking.interventionSuccess[interventionType] || 0) + 1;
  }

  // Update trending dimensions
  if (effectiveness >= 8) {
    if (!updates.progressTracking.trendingUp.includes(permaDimension)) {
      updates.progressTracking.trendingUp.push(permaDimension);
    }
    
    // Remove from needs attention
    updates.progressTracking.needsAttention = updates.progressTracking.needsAttention.filter(
      (dim: string) => dim !== permaDimension
    );
  }

  // Track dimensions needing attention
  if (response === 'skipped' || effectiveness <= 3) {
    if (!updates.progressTracking.needsAttention.includes(permaDimension)) {
      updates.progressTracking.needsAttention.push(permaDimension);
    }
  }

  return updates;
}

function extractResponsePattern(response: string): string | null {
  // Simple pattern extraction - could be enhanced with ML
  if (response.includes('question')) return 'questioning';
  if (response.includes('step') || response.includes('first')) return 'step-by-step';
  if (response.includes('example')) return 'example-based';
  if (response.includes('feel') || response.includes('understand')) return 'empathetic';
  return null;
}

function updateContentFromTopics(
  contentPreferences: any,
  topics: string[],
  engagementLevel: number
): any {
  // This could update PERMA mapping based on which topics get discussed
  // and how engaged the user is with them
  return null; // Implement based on specific needs
}