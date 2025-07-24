export interface AssessmentResult {
  mbtiType: string;
  aiReadiness: 'beginner' | 'intermediate' | 'advanced' | 'resistant';
  aiPreference: 'beginner' | 'intermediate' | 'advanced' | 'resistant'; // Added for backward compatibility
  communicationStyle: string;
  learningPreference: string;
  emotionalState: string;
  supportNeeds: string[];
  personalizedRecommendations: {
    contentTone: string;
    interactionStyle: string;
    learningPath: string;
    motivationStrategy: string;
  };
  personalInfo: {
    name?: string;
    primaryGoal?: string;
    timeCommitment?: string;
  };
}

export const analyzeMBTI = (responses: Record<string, string>): string => {
  let result = '';
  
  // Extraversion vs Introversion
  const energyResponse = responses['energy_source'];
  if (energyResponse?.includes('others')) {
    result += 'E';
  } else {
    result += 'I';
  }
  
  // Sensing vs Intuition
  const infoResponse = responses['information_preference'];
  if (infoResponse?.includes('Step-by-step')) {
    result += 'S';
  } else {
    result += 'N';
  }
  
  // Thinking vs Feeling
  const decisionResponse = responses['decision_making'];
  if (decisionResponse?.includes('Logic')) {
    result += 'T';
  } else {
    result += 'F';
  }
  
  // Judging vs Perceiving
  const lifestyleResponse = responses['lifestyle_preference'];
  if (lifestyleResponse?.includes('plan')) {
    result += 'J';
  } else {
    result += 'P';
  }
  
  return result;
};

export const analyzeAIReadiness = (responses: Record<string, string>): 'beginner' | 'intermediate' | 'advanced' | 'resistant' => {
  const experience = responses['ai_experience'] || '';
  const feeling = responses['current_feeling'] || '';
  const concerns = responses['ai_concerns'] || '';
  
  if (experience.includes('actively avoid') || concerns.includes('not much interests me')) {
    return 'resistant';
  }
  
  if (experience.includes('regularly') && feeling.includes('Excited')) {
    return 'advanced';
  }
  
  if (experience.includes('tried a few') || experience.includes('experimented')) {
    return 'intermediate';
  }
  
  return 'beginner';
};

export const analyzeCommunicationStyle = (responses: Record<string, string>): string => {
  const tone = responses['communication_tone'] || '';
  const feedback = responses['feedback_style'] || '';
  const motivation = responses['motivation_style'] || '';
  
  // Determine primary communication preference
  if (tone.includes('Encouraging') || motivation.includes('small wins')) {
    return 'supportive_cheerleader';
  } else if (tone.includes('Direct') || feedback.includes('Immediately')) {
    return 'direct_coach';
  } else if (tone.includes('Friendly') || tone.includes('conversational')) {
    return 'friendly_guide';
  } else if (tone.includes('Gentle') || feedback.includes('encouragement')) {
    return 'gentle_mentor';
  } else {
    return 'professional_instructor';
  }
};

export const analyzeLearningPreference = (responses: Record<string, string>): string => {
  const pace = responses['learning_pace'] || '';
  const format = responses['learning_format'] || '';
  
  if (format.includes('videos')) return 'visual_learner';
  if (format.includes('reading')) return 'text_learner';
  if (format.includes('hands-on')) return 'kinesthetic_learner';
  if (format.includes('conversations')) return 'social_learner';
  if (format.includes('bite-sized')) return 'micro_learner';
  
  return 'mixed_learner';
};

export const analyzeEmotionalState = (responses: Record<string, string>): string => {
  const feeling = responses['current_feeling'] || '';
  const challenge = responses['biggest_challenge'] || '';
  
  if (feeling.includes('Excited')) return 'enthusiastic';
  if (feeling.includes('Curious') && challenge.includes('time')) return 'motivated_but_busy';
  if (feeling.includes('Anxious') || challenge.includes('confident')) return 'anxious_but_willing';
  if (feeling.includes('Frustrated')) return 'frustrated_learner';
  if (feeling.includes('Indifferent')) return 'skeptical_observer';
  
  return 'cautiously_optimistic';
};

export const analyzeSupportNeeds = (responses: Record<string, string>): string[] => {
  const needs: string[] = [];
  const support = responses['support_type'] || '';
  const challenge = responses['biggest_challenge'] || '';
  const time = responses['time_commitment'] || '';
  
  if (support.includes('Step-by-step')) needs.push('detailed_guidance');
  if (support.includes('encouragement')) needs.push('emotional_support');
  if (support.includes('examples')) needs.push('social_proof');
  if (challenge.includes('time')) needs.push('time_efficiency');
  if (challenge.includes('confident')) needs.push('confidence_building');
  if (time.includes('little') || time.includes('5-10 minutes')) needs.push('micro_learning');
  
  return needs;
};

export const generatePersonalizedRecommendations = (
  mbtiType: string,
  communicationStyle: string,
  learningPreference: string,
  emotionalState: string,
  responses: Record<string, string>
) => {
  const recommendations = {
    contentTone: 'supportive',
    interactionStyle: 'guided',
    learningPath: 'structured',
    motivationStrategy: 'progress_tracking'
  };

  // Adjust based on communication style
  switch (communicationStyle) {
    case 'supportive_cheerleader':
      recommendations.contentTone = 'encouraging';
      recommendations.motivationStrategy = 'celebration_focused';
      break;
    case 'direct_coach':
      recommendations.contentTone = 'direct';
      recommendations.interactionStyle = 'challenge_based';
      break;
    case 'gentle_mentor':
      recommendations.contentTone = 'patient';
      recommendations.interactionStyle = 'nurturing';
      break;
  }

  // Adjust based on learning preference
  switch (learningPreference) {
    case 'micro_learner':
      recommendations.learningPath = 'bite_sized';
      break;
    case 'kinesthetic_learner':
      recommendations.learningPath = 'hands_on';
      break;
    case 'social_learner':
      recommendations.interactionStyle = 'community_focused';
      break;
  }

  // Adjust based on emotional state
  switch (emotionalState) {
    case 'anxious_but_willing':
      recommendations.contentTone = 'reassuring';
      recommendations.motivationStrategy = 'confidence_building';
      break;
    case 'frustrated_learner':
      recommendations.interactionStyle = 'problem_solving';
      recommendations.motivationStrategy = 'quick_wins';
      break;
  }

  return recommendations;
};

export const generateAssessmentResult = (responses: Record<string, string>): AssessmentResult => {
  const mbtiType = analyzeMBTI(responses);
  const aiReadiness = analyzeAIReadiness(responses);
  const communicationStyle = analyzeCommunicationStyle(responses);
  const learningPreference = analyzeLearningPreference(responses);
  const emotionalState = analyzeEmotionalState(responses);
  const supportNeeds = analyzeSupportNeeds(responses);
  
  const personalizedRecommendations = generatePersonalizedRecommendations(
    mbtiType,
    communicationStyle,
    learningPreference,
    emotionalState,
    responses
  );

  return {
    mbtiType,
    aiReadiness,
    aiPreference: aiReadiness, // For backward compatibility
    communicationStyle,
    learningPreference,
    emotionalState,
    supportNeeds,
    personalizedRecommendations,
    personalInfo: {
      name: responses['intro'],
      primaryGoal: responses['main_goal'],
      timeCommitment: responses['time_commitment']
    }
  };
};