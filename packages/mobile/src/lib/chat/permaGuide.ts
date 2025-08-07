export interface PERMAScores {
  positiveEmotion: number;
  engagement: number;
  relationships: number;
  meaning: number;
  accomplishment: number;
}

const PERMA_DIMENSIONS = [
  { key: 'positiveEmotion', label: 'Positive Emotion', tip: "Let's explore what brings you joy and positivity." },
  { key: 'engagement', label: 'Engagement', tip: "Let's find activities that help you feel 'in the zone'." },
  { key: 'relationships', label: 'Relationships', tip: "Let's talk about your connections and support network." },
  { key: 'meaning', label: 'Meaning', tip: "Let's reflect on what gives your life purpose and meaning." },
  { key: 'accomplishment', label: 'Accomplishment', tip: "Let's celebrate your achievements and set new goals." }
];

export function getLowestPERMA(perma: PERMAScores): { key: string; label: string; tip: string } {
  let minKey = 'positiveEmotion';
  let minValue = perma.positiveEmotion;
  for (const dim of PERMA_DIMENSIONS) {
    if ((perma as any)[dim.key] < minValue) {
      minKey = dim.key;
      minValue = (perma as any)[dim.key];
    }
  }
  return PERMA_DIMENSIONS.find(d => d.key === minKey)!;
}

export function getPERMAGuidance(perma: PERMAScores): string {
  const lowest = getLowestPERMA(perma);
  return `Focus area: ${lowest.label}. ${lowest.tip}`;
}

interface PERMAAnalysisInput {
  perma: PERMAScores;
  mbtiType?: string;
  permaAnswers?: {
    P?: { happyEvents?: string };
    E?: { flowActivity?: string };
    R?: { importantRelationships?: string[] };
    M?: { meaningSources?: string[] };
    A?: { proudAchievement?: string };
  };
}

const MBTI_DIMENSION_FOCUS: Record<string, keyof PERMAScores> = {
  INTJ: 'meaning',
  INTP: 'engagement',
  ENTJ: 'accomplishment',
  ENTP: 'engagement',
  INFJ: 'meaning',
  INFP: 'meaning',
  ENFJ: 'relationships',
  ENFP: 'engagement',
  ISTJ: 'accomplishment',
  ISFJ: 'relationships',
  ESTJ: 'accomplishment',
  ESFJ: 'relationships',
  ISTP: 'engagement',
  ISFP: 'positiveEmotion',
  ESTP: 'engagement',
  ESFP: 'positiveEmotion'
};

function getDimensionTip(
  key: keyof PERMAScores,
  answers?: PERMAAnalysisInput['permaAnswers']
): string {
  switch (key) {
    case 'positiveEmotion':
      return answers?.P?.happyEvents
        ? `Remember what made you happy recently: ${answers.P.happyEvents}. Try to bring more of that into your day.`
        : "Let's explore what brings you joy and positivity.";
    case 'engagement':
      return answers?.E?.flowActivity
        ? `You feel engaged when doing: ${answers.E.flowActivity}. Try to make time for this activity.`
        : "Let's find activities that help you feel 'in the zone'.";
    case 'relationships':
      return answers?.R?.importantRelationships?.length
        ? `Your important relationships: ${answers.R.importantRelationships.join(', ')}. Consider reaching out to one of them.`
        : "Let's talk about your connections and support network.";
    case 'meaning':
      return answers?.M?.meaningSources?.length
        ? `Sources of meaning for you: ${answers.M.meaningSources.join(', ')}. Reflect on how to nurture these.`
        : "Let's reflect on what gives your life purpose and meaning.";
    case 'accomplishment':
      return answers?.A?.proudAchievement
        ? `You are proud of: ${answers.A.proudAchievement}. Celebrate your achievements and set new goals.`
        : "Let's celebrate your achievements and set new goals.";
    default:
      return '';
  }
}

export function getPERMAGuidanceAdvanced({
  perma,
  mbtiType,
  permaAnswers
}: PERMAAnalysisInput): string {
  const lowDims = Object.entries(perma)
    .filter(([_, v]) => typeof v === 'number' && v < 7)
    .map(([k]) => k as keyof PERMAScores);

  const mbtiFocus = mbtiType ? MBTI_DIMENSION_FOCUS[mbtiType.toUpperCase()] : undefined;

  let guidance: string[] = [];

  if (mbtiFocus && lowDims.includes(mbtiFocus)) {
    guidance.push(
      `Based on your MBTI (${mbtiType}), focusing on "${PERMA_DIMENSIONS.find(d => d.key === mbtiFocus)?.label}" may help you feel more fulfilled. ${getDimensionTip(mbtiFocus, permaAnswers)}`
    );
  }

  lowDims
    .filter(dim => dim !== mbtiFocus)
    .slice(0, 2)
    .forEach(dim => {
      guidance.push(
        `Improving "${PERMA_DIMENSIONS.find(d => d.key === dim)?.label}" could also boost your happiness. ${getDimensionTip(dim, permaAnswers)}`
      );
    });

  if (guidance.length === 0) {
    guidance.push("You're doing well across all happiness dimensions! Keep nurturing what works for you.");
  }

  return guidance.join('\n\n');
}