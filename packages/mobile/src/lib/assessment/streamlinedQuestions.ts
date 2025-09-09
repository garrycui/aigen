export interface StreamlinedQuestion {
  id: string;
  text: string;
  type: 'text' | 'slider' | 'single' | 'multi';
  options?: string[];
  category: 'profile' | 'interests' | 'happiness' | 'goals' | 'mbti';
  required: boolean;
  weight: number; // Impact on personalization (1-5)
  followUp?: string; // Optional follow-up question ID
  categorizedOptions?: { // New field for interests question
    title: string;
    icon: string;
    interests: string[];
  }[];
}

// Redesigned to properly assess MBTI, PERMA, and interests
export const streamlinedQuestions: StreamlinedQuestion[] = [
  // 1. Start with name for personalization
  {
    id: 'name',
    text: "What should we call you?",
    type: 'text',
    category: 'profile',
    required: true,
    weight: 2
  },

  // 2. Capture interests FIRST - this drives everything else (ENHANCED)
  {
    id: 'primary_interests',
    text: "What sparks your curiosity and brings you joy? Choose everything that interests you!",
    type: 'multi',
    options: [
      // Positive Emotion Boosters
      "Comedy & Entertainment", 
      "Music & Arts", 
      "Sports & Movement",
      "Food & Culinary Adventures",
      "Travel & Exploration",
      
      // Engagement & Flow Activities  
      "Learning & Education",
      "Science & Technology",
      "Creative Projects & DIY",
      "Reading & Storytelling",
      "Gaming & Interactive Media",
      
      // Relationships & Social Connection
      "Relationships & Social Life",
      "Family & Community",
      "Helping Others & Volunteering",
      
      // Meaning & Purpose
      "Personal Growth & Self-Improvement",
      "Spirituality & Mindfulness", 
      "Social Causes & Making a Difference",
      
      // Accomplishment & Success
      "Career & Professional Development",
      "Health & Wellness",
      "Finance & Life Management",
      
      // Nature & Wonder
      "Nature & Animals",
      "Photography & Visual Arts"
    ],
    categorizedOptions: [
      {
        title: "Positive Emotion Boosters",
        icon: "🎉",
        interests: ["Comedy & Entertainment", "Music & Arts", "Sports & Movement", "Food & Culinary Adventures", "Travel & Exploration"]
      },
      {
        title: "Engagement & Flow Activities", 
        icon: "🧠",
        interests: ["Learning & Education", "Science & Technology", "Creative Projects & DIY", "Reading & Storytelling", "Gaming & Interactive Media"]
      },
      {
        title: "Relationships & Connection",
        icon: "💝", 
        interests: ["Relationships & Social Life", "Family & Community", "Helping Others & Volunteering"]
      },
      {
        title: "Meaning & Purpose",
        icon: "🎯",
        interests: ["Personal Growth & Self-Improvement", "Spirituality & Mindfulness", "Social Causes & Making a Difference"]
      },
      {
        title: "Achievement & Success",
        icon: "🏆",
        interests: ["Career & Professional Development", "Health & Wellness", "Finance & Life Management"]
      },
      {
        title: "Nature & Wonder",
        icon: "🌱",
        interests: ["Nature & Animals", "Photography & Visual Arts"]
      }
    ],
    category: 'interests',
    required: true,
    weight: 5
  },

  // 3-7: PROPER PERMA ASSESSMENT (5 questions for 5 dimensions)
  {
    id: 'positive_emotion_score',
    text: "How often do you feel joyful, grateful, and optimistic in your daily life?",
    type: 'slider',
    options: ['1', '10'],
    category: 'happiness',
    required: true,
    weight: 5
  },

  {
    id: 'engagement_score', 
    text: "How often do you get so absorbed in activities that you lose track of time?",
    type: 'slider',
    options: ['1', '10'],
    category: 'happiness',
    required: true,
    weight: 5
  },

  {
    id: 'relationships_score',
    text: "How satisfied are you with the love and support you have in your life?",
    type: 'slider',
    options: ['1', '10'], 
    category: 'happiness',
    required: true,
    weight: 5
  },

  {
    id: 'meaning_score',
    text: "How meaningful and purposeful does your life feel to you?",
    type: 'slider',
    options: ['1', '10'],
    category: 'happiness', 
    required: true,
    weight: 5
  },

  {
    id: 'accomplishment_score',
    text: "How proud are you of what you've achieved and accomplished?",
    type: 'slider',
    options: ['1', '10'],
    category: 'happiness',
    required: true,
    weight: 5
  },

  // 8-11: PROPER MBTI ASSESSMENT (4 questions for 4 dimensions)
  {
    id: 'mbti_energy',
    text: "Which energizes you more?",
    type: 'single',
    options: [
      "Being around people and talking through ideas",
      "Having quiet time to think and reflect"
    ],
    category: 'mbti',
    required: true,
    weight: 4
  },

  {
    id: 'mbti_information',
    text: "When learning something new, you prefer:",
    type: 'single',
    options: [
      "Starting with concrete facts and real examples",
      "Starting with big picture concepts and possibilities"
    ],
    category: 'mbti',
    required: true,
    weight: 4
  },

  {
    id: 'mbti_decisions',
    text: "When making important decisions, you typically:",
    type: 'single',
    options: [
      "Focus on logical analysis and objective criteria",
      "Consider how it affects people and personal values"
    ],
    category: 'mbti',
    required: true,
    weight: 4
  },

  {
    id: 'mbti_lifestyle',
    text: "Do you prefer:",
    type: 'single',
    options: [
      "Having things planned and decided in advance",
      "Keeping options open and being flexible"
    ],
    category: 'mbti',
    required: true,
    weight: 4
  },

  // 12. What brings them joy (helps understand their happiness drivers)
  {
    id: 'happiness_sources',
    text: "What typically makes you feel happiest? (Choose your top 3)",
    type: 'multi',
    options: [
      "Spending time with people I care about",
      "Learning something new and interesting", 
      "Achieving goals I've set for myself",
      "Helping others or making a difference",
      "Having fun and laughing",
      "Being creative or artistic",
      "Relaxing and taking time for myself",
      "Exploring new places or experiences",
      "Working on challenging problems",
      "Being recognized for my accomplishments"
    ],
    category: 'happiness',
    required: true,
    weight: 4
  },

  // 13. Goals and aspirations
  {
    id: 'main_goals',
    text: "What are you most hoping to achieve or improve in your life? (Choose up to 3)",
    type: 'multi',
    options: [
      "Be happier and more positive",
      "Reduce stress and anxiety", 
      "Improve my relationships",
      "Find more meaning and purpose",
      "Achieve important goals",
      "Learn new skills or knowledge",
      "Get healthier and fitter",
      "Advance my career", 
      "Be more creative",
      "Have more fun and adventure"
    ],
    category: 'goals',
    required: true,
    weight: 4
  },

  // 14. Challenge preference (for content difficulty)
  {
    id: 'challenge_preference', 
    text: "When it comes to personal growth, do you prefer:",
    type: 'single',
    options: [
      "Small, gentle steps that feel manageable",
      "Moderate challenges that push me a bit", 
      "Big challenges that really stretch me"
    ],
    category: 'profile',
    required: true,
    weight: 3
  },

  // 15. Usage intent (helps with app personalization)
  {
    id: 'app_usage_goals',
    text: "How would you most like this app to help you?",
    type: 'single',
    options: [
      "Help me feel happier day-to-day",
      "Recommend content I'll love",
      "Support my personal growth",
      "Connect me with helpful resources",
      "All of the above!"
    ],
    category: 'goals', 
    required: true,
    weight: 3
  }
];
