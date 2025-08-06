export interface AssessmentResult {
  mbtiType: string;
  personalInfo: {
    name?: string;
    primaryGoal?: string;
    happyEvents?: string;
    flowActivity?: string;
    importantRelationships?: string[];
    meaningSources?: string[];
    proudAchievement?: string;
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
  permaAnswers: {
    P: {
      currentMood?: string;
      pastWeekHappiness?: string;
      happyEvents?: string;
    };
    E: {
      contentPreferences?: string[];
      happinessDriver?: string;
      flowChallenge?: string;
      flowActivity?: string;
    };
    R: {
      copingPreference?: string;
      importantRelationships?: string[];
    };
    M: {
      stressBurnout?: string;
      meaningfulContent?: string;
      meaningSources?: string[];
    };
    A: {
      rewardPreference?: string;
      proudAchievement?: string;
    };
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
  // Positive Emotion (P)
  let positiveEmotion = 0;
  const mood = Number(responses['current_mood'] ?? 5);
  const weekHappiness = Number(responses['past_week_happiness'] ?? 5);
  positiveEmotion = Math.round((mood + weekHappiness) / 2);

  // If user shared happy events, boost score slightly
  if (typeof responses['pe_happy_events'] === 'string' && responses['pe_happy_events'].trim().length > 0) {
    positiveEmotion = Math.min(positiveEmotion + 1, 10);
  }

  // Engagement (E)
  let engagement = 0;
  const contentPrefs = Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [];
  engagement += Math.min(contentPrefs.length * 2, 6); // max 6 from preferences
  if (contentPrefs.includes('Gaming / Live Streams')) engagement += 1;
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Learning')) engagement += 2;
  if (typeof responses['flow_challenge'] === 'string' && responses['flow_challenge'] === 'Yes') engagement += 2;
  if (typeof responses['e_flow_activity'] === 'string' && responses['e_flow_activity'].trim().length > 0) engagement += 1;
  engagement = Math.min(engagement, 10);

  // Relationships (R)
  let relationships = 0;
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Connecting')) relationships += 2;
  if (typeof responses['coping_preference'] === 'string' && responses['coping_preference'].includes('Talk')) relationships += 2;
  const rels = Array.isArray(responses['r_important_relationships']) ? responses['r_important_relationships'] : [];
  relationships += Math.min(rels.length, 4); // up to 4 for relationships selected
  relationships = Math.min(relationships, 10);

  // Meaning (M)
  let meaning = 0;
  const burnout = Number(responses['stress_burnout'] ?? 5);
  meaning += Math.max(10 - burnout, 0); // inverse of stress
  if (typeof responses['meaningful_content'] === 'string' && responses['meaningful_content'].trim().length > 0) meaning += 1;
  const sources = Array.isArray(responses['m_meaning_sources']) ? responses['m_meaning_sources'] : [];
  meaning += Math.min(sources.length, 3); // up to 3 for meaning sources
  meaning = Math.min(meaning, 10);

  // Accomplishment (A)
  let accomplishment = 0;
  if (typeof responses['happiness_driver'] === 'string' && responses['happiness_driver'].includes('Creating')) accomplishment += 2;
  if (typeof responses['reward_preference'] === 'string' && responses['reward_preference'].includes('badge')) accomplishment += 2;
  if (typeof responses['a_proud_achievement'] === 'string' && responses['a_proud_achievement'].trim().length > 0) accomplishment += 2;
  accomplishment = Math.min(accomplishment, 10);

  return {
    positiveEmotion,
    engagement,
    relationships,
    meaning,
    accomplishment,
  };
};

export const generateAssessmentResult = (responses: Record<string, string | string[]>): AssessmentResult => {
  const mbtiType = analyzeMBTI(responses);
  const happinessScores = analyzePERMA(responses);
  return {
    mbtiType,
    personalInfo: {
      name: typeof responses['nickname'] === 'string' ? responses['nickname'] : '',
      primaryGoal: typeof responses['happiness_driver'] === 'string' ? responses['happiness_driver'] : '',
      happyEvents: typeof responses['pe_happy_events'] === 'string' ? responses['pe_happy_events'] : '',
      flowActivity: typeof responses['e_flow_activity'] === 'string' ? responses['e_flow_activity'] : '',
      importantRelationships: Array.isArray(responses['r_important_relationships']) ? responses['r_important_relationships'] : [],
      meaningSources: Array.isArray(responses['m_meaning_sources']) ? responses['m_meaning_sources'] : [],
      proudAchievement: typeof responses['a_proud_achievement'] === 'string' ? responses['a_proud_achievement'] : '',
    },
    interests: Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [],
    emotionBaseline: Number(responses['current_mood'] ?? 5),
    happinessScores,
    permaAnswers: {
      P: {
        currentMood: typeof responses['current_mood'] === 'string' ? responses['current_mood'] : '',
        pastWeekHappiness: typeof responses['past_week_happiness'] === 'string' ? responses['past_week_happiness'] : '',
        happyEvents: typeof responses['pe_happy_events'] === 'string' ? responses['pe_happy_events'] : '',
      },
      E: {
        contentPreferences: Array.isArray(responses['content_preferences']) ? responses['content_preferences'] : [],
        happinessDriver: typeof responses['happiness_driver'] === 'string' ? responses['happiness_driver'] : '',
        flowChallenge: typeof responses['flow_challenge'] === 'string' ? responses['flow_challenge'] : '',
        flowActivity: typeof responses['e_flow_activity'] === 'string' ? responses['e_flow_activity'] : '',
      },
      R: {
        copingPreference: typeof responses['coping_preference'] === 'string' ? responses['coping_preference'] : '',
        importantRelationships: Array.isArray(responses['r_important_relationships']) ? responses['r_important_relationships'] : [],
      },
      M: {
        stressBurnout: typeof responses['stress_burnout'] === 'string' ? responses['stress_burnout'] : '',
        meaningfulContent: typeof responses['meaningful_content'] === 'string' ? responses['meaningful_content'] : '',
        meaningSources: Array.isArray(responses['m_meaning_sources']) ? responses['m_meaning_sources'] : [],
      },
      A: {
        rewardPreference: typeof responses['reward_preference'] === 'string' ? responses['reward_preference'] : '',
        proudAchievement: typeof responses['a_proud_achievement'] === 'string' ? responses['a_proud_achievement'] : '',
      },
    }
  };
};
