export interface ChatQuestion {
  id: string;
  text: string;
  type: 'text' | 'slider' | 'single' | 'multi';
  options?: string[];
  dimension?: 'user_id' | 'PE' | 'MBTI_EI' | 'MBTI_SN' | 'MBTI_TF' | 'MBTI_JP' | 'mbti_type' | 'M' | 'E' | 'R' | 'A' | 'context';
  stage: 1 | 2 | 3;
  required?: boolean;
}

export const chatQuestions: ChatQuestion[] = [
  // Stage 1: Core Profile (required)
  {
    id: 'nickname',
    text: "What would you like us to call you?",
    type: 'text',
    dimension: 'user_id',
    stage: 1,
    required: true,
  },
  {
    id: 'current_mood',
    text: "On a scale from 0 to 10, how happy are you feeling right now?",
    type: 'slider',
    dimension: 'PE',
    stage: 1,
    required: true,
    options: ['0', '10'], // for UI min/max
  },

  // MBTI Flow (can be delivered after Stage 1 or in Stage 2)
  {
    id: 'mbti_know',
    text: "Do you know your MBTI personality type? (e.g. INTJ, ENFP, etc.)",
    type: 'single',
    options: ["Yes, I know my MBTI type", "No, I'm not sure"],
    dimension: 'MBTI_EI',
    stage: 2,
  },
  {
    id: 'mbti_input',
    text: "Great! Please enter your MBTI type (e.g. INTJ, ENFP):",
    type: 'text',
    dimension: 'mbti_type',
    stage: 2,
  },
  {
    id: 'mbti_ei',
    text: "When you want to feel happier, do you prefer: A) Spending time with others and sharing joy, or B) Enjoying peaceful moments alone to recharge?",
    type: 'single',
    options: [
      "Spending time with others and sharing joy",
      "Enjoying peaceful moments alone to recharge"
    ],
    dimension: 'MBTI_EI',
    stage: 2,
  },
  {
    id: 'mbti_sn',
    text: "What brings you more happiness: A) Experiencing real, tangible things and details, or B) Imagining possibilities and dreaming big?",
    type: 'single',
    options: [
      "Experiencing real, tangible things and details",
      "Imagining possibilities and dreaming big"
    ],
    dimension: 'MBTI_SN',
    stage: 2,
  },
  {
    id: 'mbti_tf',
    text: "When making choices for your happiness, do you rely more on: A) Logical reasons and facts, or B) Feelings and how it affects you and others?",
    type: 'single',
    options: [
      "Logical reasons and facts",
      "Feelings and how it affects you and others"
    ],
    dimension: 'MBTI_TF',
    stage: 2,
  },
  {
    id: 'mbti_jp',
    text: "To stay happy, do you prefer: A) Having a clear plan and routine, or B) Going with the flow and adapting as you go?",
    type: 'single',
    options: [
      "Having a clear plan and routine",
      "Going with the flow and adapting as you go"
    ],
    dimension: 'MBTI_JP',
    stage: 2,
  },

  // Stage 2: Personality / Preferences / Motivation (recommended)
  {
    id: 'past_week_happiness',
    text: "In the last 7 days, how often did you feel happy?",
    type: 'slider',
    dimension: 'PE',
    stage: 2,
    options: ['0', '10'],
  },
  {
    id: 'stress_burnout',
    text: "In the last 7 days, how often did you feel stressed or exhausted?",
    type: 'slider',
    dimension: 'M',
    stage: 2,
    options: ['0', '10'],
  },
  {
    id: 'content_preferences',
    text: "Which types of short videos or articles do you enjoy? (Select all that apply)",
    type: 'multi',
    options: [
      "Comedy / Humor",
      "Science / Knowledge",
      "Music / Dance",
      "DIY / Crafts",
      "Gaming / Live Streams"
    ],
    dimension: 'E',
    stage: 2,
  },
  {
    id: 'happiness_driver',
    text: "What makes you feel most fulfilled?",
    type: 'single',
    options: [
      "Learning something new",
      "Connecting with others",
      "Creating or making things",
      "Simply relaxing"
    ],
    dimension: 'E', // also R/A
    stage: 2,
  },
  {
    id: 'usage_scenario',
    text: "When do you usually open this app for some fun?",
    type: 'single',
    options: [
      "During commute / waiting for transport",
      "Lunch break / quick rest",
      "Before bed",
      "Waiting around / downtime"
    ],
    dimension: 'context',
    stage: 2,
  },

  // Stage 3: Deep Profile (optional, delivered gradually)
  {
    id: 'coping_preference',
    text: "When you’re feeling down, you tend to:",
    type: 'single',
    options: [
      "Be alone and reflect",
      "Talk with someone"
    ],
    dimension: 'R',
    stage: 3,
  },
  {
    id: 'reward_preference',
    text: "After completing a small task, what kind of reward do you prefer?",
    type: 'single',
    options: [
      "A system badge",
      "Likes from friends/community",
      "A congratulatory message or joke"
    ],
    dimension: 'A',
    stage: 3,
  },
  {
    id: 'meaningful_content',
    text: "Which type of longer-form content appeals to you most?",
    type: 'single',
    options: [
      "Inspirational stories / personal growth",
      "In-depth interviews / talks",
      "Philosophy / thought-provoking programs"
    ],
    dimension: 'M',
    stage: 3,
  },
  {
    id: 'flow_challenge',
    text: "Would you be willing to try a one-minute focused challenge (e.g. quick puzzle) to get into ‘flow’?",
    type: 'single',
    options: [
      "Yes",
      "No"
    ],
    dimension: 'E',
    stage: 3,
  },
];

// Helper: Get next question by id (for chatQuestions)
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

// Helper: Check if assessment is complete
export const isAssessmentComplete = (responses: Record<string, string>): boolean => {
  const requiredQuestions = chatQuestions.filter(q => q.required);
  return requiredQuestions.every(question => question.id in responses);
};

// Helper: Get questions by category
export const getQuestionsByCategory = (category: ChatQuestion['dimension']): ChatQuestion[] => {
  return chatQuestions.filter(q => q.dimension === category);
};

// Helper: Should ask follow-up
export const shouldAskFollowUp = (questionId: string, response: string): boolean => {
  const followUpTriggers: Record<string, string[]> = {
    'current_mood': ['0', '1', '2', '3'],
    'stress_burnout': ['7', '8', '9', '10'],
  };
  return followUpTriggers[questionId]?.includes(response) || false;
};