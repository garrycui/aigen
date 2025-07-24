export interface ChatQuestion {
  id: string;
  text: string;
  type: 'mbti' | 'personal' | 'ai_preference' | 'communication' | 'learning' | 'emotional' | 'goals';
  options?: string[];
  followUp?: string;
  mbtiDimension?: 'E/I' | 'S/N' | 'T/F' | 'J/P';
  category: 'personality' | 'ai_readiness' | 'communication_style' | 'learning_preference' | 'emotional_state' | 'support_needs';
}

export const chatQuestions: ChatQuestion[] = [
  // Welcome and Context Setting
  {
    id: 'intro',
    text: "Hi! I'm here to help you thrive in our AI-powered world. Let's start by getting to know you better. What's your name?",
    type: 'personal',
    category: 'personality'
  },

  // Current Emotional State & Challenges
  {
    id: 'current_feeling',
    text: "How are you feeling about the rapid changes in technology and AI these days?",
    type: 'emotional',
    category: 'emotional_state',
    options: [
      "Excited and eager to learn more",
      "Curious but a bit overwhelmed",
      "Anxious about being left behind",
      "Frustrated with the pace of change",
      "Indifferent - it doesn't affect me much"
    ]
  },

  {
    id: 'biggest_challenge',
    text: "What's your biggest challenge when it comes to technology or AI?",
    type: 'emotional',
    category: 'support_needs',
    options: [
      "Understanding how it works",
      "Keeping up with new tools",
      "Feeling confident using them",
      "Finding time to learn",
      "Knowing which tools are worth my time",
      "Fear of making mistakes or looking foolish"
    ]
  },

  // MBTI-based Personality Assessment
  {
    id: 'energy_source',
    text: "When you need to recharge or process new information, what helps you most?",
    type: 'mbti',
    mbtiDimension: 'E/I',
    category: 'personality',
    options: [
      "Talking it through with others and getting different perspectives",
      "Taking quiet time alone to think and reflect"
    ]
  },

  {
    id: 'information_preference',
    text: "When learning something new, what approach works best for you?",
    type: 'mbti',
    mbtiDimension: 'S/N',
    category: 'learning_preference',
    options: [
      "Step-by-step instructions with real examples",
      "Understanding the big picture and theory first"
    ]
  },

  {
    id: 'decision_making',
    text: "When making decisions, what do you trust most?",
    type: 'mbti',
    mbtiDimension: 'T/F',
    category: 'personality',
    options: [
      "Logic, data, and objective analysis",
      "Gut feelings and how it affects people"
    ]
  },

  {
    id: 'lifestyle_preference',
    text: "How do you prefer to approach new challenges?",
    type: 'mbti',
    mbtiDimension: 'J/P',
    category: 'personality',
    options: [
      "With a clear plan and structured approach",
      "Flexibly, adapting as I learn more"
    ]
  },

  // Communication Style Preferences
  {
    id: 'communication_tone',
    text: "When someone is teaching you something new, what tone do you prefer?",
    type: 'communication',
    category: 'communication_style',
    options: [
      "Encouraging and supportive",
      "Direct and matter-of-fact",
      "Friendly and conversational",
      "Professional and detailed",
      "Gentle and patient"
    ]
  },

  {
    id: 'feedback_style',
    text: "How do you like to receive feedback or corrections?",
    type: 'communication',
    category: 'communication_style',
    options: [
      "Immediately when I make a mistake",
      "After I've tried a few times",
      "With suggestions for improvement",
      "With encouragement about what I did right first",
      "Only when I ask for it"
    ]
  },

  {
    id: 'motivation_style',
    text: "What motivates you most when learning something challenging?",
    type: 'communication',
    category: 'communication_style',
    options: [
      "Celebrating small wins along the way",
      "Seeing clear progress toward a big goal",
      "Understanding how it will help me personally",
      "Comparing my progress to others",
      "Just knowing I'm becoming more capable"
    ]
  },

  // Learning Preferences
  {
    id: 'learning_pace',
    text: "What's your ideal learning pace?",
    type: 'learning',
    category: 'learning_preference',
    options: [
      "Fast - I like to dive in and figure things out quickly",
      "Steady - I prefer consistent, regular practice",
      "Slow and thorough - I want to master each step",
      "Variable - depends on my mood and schedule"
    ]
  },

  {
    id: 'learning_format',
    text: "How do you learn best?",
    type: 'learning',
    category: 'learning_preference',
    options: [
      "Watching videos and demonstrations",
      "Reading detailed guides and articles",
      "Hands-on practice and experimentation",
      "Interactive conversations and Q&A",
      "Short, bite-sized lessons"
    ]
  },

  // AI Experience and Attitudes
  {
    id: 'ai_experience',
    text: "What's your current experience with AI tools?",
    type: 'ai_preference',
    category: 'ai_readiness',
    options: [
      "I use them regularly and love exploring new ones",
      "I've tried a few and had mixed experiences",
      "I've experimented once or twice",
      "I've heard about them but never tried",
      "I actively avoid them"
    ]
  },

  {
    id: 'ai_concerns',
    text: "What worries you most about AI? (It's okay to have concerns!)",
    type: 'ai_preference',
    category: 'ai_readiness',
    options: [
      "It's too complicated for me to understand",
      "I might become too dependent on it",
      "It might replace human jobs or creativity",
      "Privacy and data security",
      "I don't have any major concerns",
      "The pace of change is overwhelming"
    ]
  },

  {
    id: 'ai_interest',
    text: "What interests you most about AI?",
    type: 'ai_preference',
    category: 'ai_readiness',
    options: [
      "Making my work more efficient",
      "Learning new skills and capabilities",
      "Creative projects and exploration",
      "Solving problems I couldn't before",
      "Understanding how it works",
      "Honestly, not much interests me yet"
    ]
  },

  // Support and Goal Preferences
  {
    id: 'support_type',
    text: "When you're struggling with something new, what kind of support helps most?",
    type: 'goals',
    category: 'support_needs',
    options: [
      "Step-by-step guidance until I get it",
      "Encouragement to keep trying on my own",
      "Examples of others who've succeeded",
      "Understanding why I'm struggling",
      "A break and coming back to it later"
    ]
  },

  {
    id: 'success_measure',
    text: "How do you like to measure your progress?",
    type: 'goals',
    category: 'support_needs',
    options: [
      "Clear milestones and achievements",
      "Comparing how I feel now vs. before",
      "Getting positive feedback from others",
      "Successfully completing real tasks",
      "Just feeling more confident"
    ]
  },

  {
    id: 'time_commitment',
    text: "How much time can you realistically dedicate to learning about AI?",
    type: 'goals',
    category: 'support_needs',
    options: [
      "5-10 minutes daily",
      "30 minutes a few times per week",
      "1 hour on weekends",
      "Whatever it takes - I'm motivated",
      "Very little - I need bite-sized help"
    ]
  },

  // Primary Goals
  {
    id: 'main_goal',
    text: "What would make you feel most successful with this app?",
    type: 'goals',
    category: 'support_needs',
    options: [
      "Feeling confident using AI tools",
      "Staying up-to-date without stress",
      "Finding AI tools that actually help me",
      "Understanding enough to not feel left behind",
      "Becoming excited about AI possibilities",
      "Just feeling less anxious about technology"
    ]
  },

  {
    id: 'ideal_outcome',
    text: "Six months from now, what would make you feel proud of your AI journey?",
    type: 'goals',
    category: 'support_needs',
    options: [
      "I'm using AI tools confidently in my daily life",
      "I understand AI well enough to help others",
      "I feel excited rather than worried about AI changes",
      "I've found specific AI tools that make my life better",
      "I'm not stressed about keeping up anymore"
    ]
  }
];

export const getNextQuestion = (currentQuestionId: string | null): ChatQuestion | null => {
  if (!currentQuestionId) {
    return chatQuestions[0];
  }
  
  const currentIndex = chatQuestions.findIndex(q => q.id === currentQuestionId);
  if (currentIndex >= 0 && currentIndex < chatQuestions.length - 1) {
    return chatQuestions[currentIndex + 1];
  }
  
  return null; // Assessment complete
};

export const isAssessmentComplete = (responses: Record<string, string>): boolean => {
  const requiredQuestions = chatQuestions.filter(q => q.type !== 'personal');
  return requiredQuestions.every(question => question.id in responses);
};

// Helper function to get questions by category
export const getQuestionsByCategory = (category: ChatQuestion['category']): ChatQuestion[] => {
  return chatQuestions.filter(q => q.category === category);
};

// Helper function to determine if more questions needed based on responses
export const shouldAskFollowUp = (questionId: string, response: string): boolean => {
  // Add logic for follow-up questions based on specific responses
  const followUpTriggers: Record<string, string[]> = {
    'current_feeling': ['Anxious about being left behind', 'Frustrated with the pace of change'],
    'ai_experience': ['I actively avoid them', 'I\'ve heard about them but never tried'],
    'biggest_challenge': ['Fear of making mistakes or looking foolish']
  };
  
  return followUpTriggers[questionId]?.includes(response) || false;
};