export interface AssessmentResult {
  mbtiType: string;
  personalInfo: {
    name?: string;
    primaryGoal?: string;
  };
  interests: string[];
  emotionBaseline: number;
  happinessScores: {
    positiveEmotion: number;
    engagement: number;
    relationships: number;
    meaning: number;
    accomplishment: number;
  };
}

export const analyzeMBTI = (responses: Record<string, string | string[]>): string => {
  if (typeof responses['mbti_input'] === 'string' && responses['mbti_input'].length === 4) {
    return responses['mbti_input'].toUpperCase();
  }
  let result = '';
  const ei = responses['mbti_ei'];
  result += (typeof ei === 'string' && ei.toLowerCase().includes('others')) ? 'E' : 'I';
  const sn = responses['mbti_sn'];
  result += (typeof sn === 'string' && sn.toLowerCase().includes('tangible')) ? 'S' : 'N';
  const tf = responses['mbti_tf'];
  result += (typeof tf === 'string' && tf.toLowerCase().includes('logical')) ? 'T' : 'F';
  const jp = responses['mbti_jp'];
  result += (typeof jp === 'string' && jp.toLowerCase().includes('plan')) ? 'J' : 'P';
  return result;
};

export const analyzePERMA = (responses: Record<string, string | string[]>): AssessmentResult['happinessScores'] => {
  const scores = {
    positiveEmotion: Math.round(
      ((Number(responses['current_mood'] ?? 5) + Number(responses['past_week_happiness'] ?? 5)) / 2)
    ),
    engagement: 0,
    relationships: 0,
    meaning: 0,
    accomplishment: 0,
  };
  if (Array.isArray(responses['content_preferences'])) {
    scores.engagement += responses['content_preferences'].length * 2;
    if (responses['content_preferences'].includes('Gaming / Live Streams')) scores.engagement += 2;
  }
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Learning')) {
    scores.engagement += 3;
  }
  if (typeof responses['flow_challenge'] === 'string' && responses['flow_challenge'] === 'Yes') {
    scores.engagement += 2;
  }
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Connecting')) {
    scores.relationships += 3;
  }
  if (typeof responses['coping_preference'] === 'string' && responses['coping_preference'].includes('Talk')) {
    scores.relationships += 2;
  }
  scores.meaning = 10 - Number(responses['stress_burnout'] ?? 5);
  if (typeof responses['meaningful_content'] === 'string') {
    scores.meaning += 2;
  }
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Creating')) {
    scores.accomplishment += 3;
  }
  if (typeof responses['reward_preference'] === 'string' && responses['reward_preference'].includes('badge')) {
    scores.accomplishment += 2;
  }
  return scores;
};

export const generateAssessmentResult = (responses: Record<string, string | string[]>): AssessmentResult => {
  const mbtiType = analyzeMBTI(responses);
  const happinessScores = analyzePERMA(responses);
  return {
    mbtiType,
    personalInfo: {
      name: typeof responses['nickname'] === 'string' ? responses['nickname'] : '',
      primaryGoal: typeof responses['happiness_driver'] === 'string' ? responses['happiness_driver'] : '',
    },
    interests: Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [],
    emotionBaseline: Number(responses['current_mood'] ?? 5),
    happinessScores,
  };
};
