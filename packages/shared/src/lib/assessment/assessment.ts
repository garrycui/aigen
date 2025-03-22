import { 
    collection,
    addDoc,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    serverTimestamp,
  } from 'firebase/firestore';
  import { db } from '../common/firebase';
  import { updateUser, invalidateAssessmentCache, assessmentCache } from '../common/cache';
  
  // Define types for assessment data
  export type MBTIQuestion = {
    id: number;
    dimension: string;
    text: string;
    options: [string, string];
    descriptions: [string, string];
  };
  
  export type AIQuestion = {
    id: number;
    text: string;
    options: string[];
  };
  
  // Assessment constants - making them available for both web and mobile
  export const mbtiQuestions: MBTIQuestion[] = [
    {
      id: 1,
      dimension: "E/I",
      text: "How do you prefer to interact with the world and recharge?",
      options: ["Extraversion (E)", "Introversion (I)"],
      descriptions: [
        "Gain energy from social interaction and external activities",
        "Gain energy from solitude and internal reflection"
      ]
    },
    {
      id: 2,
      dimension: "S/N",
      text: "How do you prefer to take in information?",
      options: ["Sensing (S)", "Intuition (N)"],
      descriptions: [
        "Focus on concrete facts and present reality",
        "Focus on patterns, possibilities, and future potential"
      ]
    },
    {
      id: 3,
      dimension: "T/F",
      text: "How do you prefer to make decisions?",
      options: ["Thinking (T)", "Feeling (F)"],
      descriptions: [
        "Base decisions on logic and objective analysis",
        "Base decisions on values and personal impact"
      ]
    },
    {
      id: 4,
      dimension: "J/P",
      text: "How do you prefer to organize your life?",
      options: ["Judging (J)", "Perceiving (P)"],
      descriptions: [
        "Prefer structure, planning, and firm decisions",
        "Prefer flexibility, spontaneity, and keeping options open"
      ]
    }
  ];
  
  export const aiQuestions: AIQuestion[] = [
    {
      id: 5,
      text: "When introduced to a new AI tool at work, what's your typical response?",
      options: [
        "Dive right in and experiment",
        "Wait for a training session",
        "Watch colleagues use it first",
        "Prefer to avoid using it unless necessary"
      ]
    },
    {
      id: 6,
      text: "How do you feel about AI's impact on your industry?",
      options: [
        "Excited about the possibilities",
        "Cautiously optimistic",
        "Somewhat concerned",
        "Very worried"
      ]
    },
    {
      id: 7,
      text: "Which best describes your current lifestyle or work style?",
      options: [
        "Student / Academic",
        "Creative professional",
        "Corporate / Office-based role",
        "Freelancer / Self-employed",
        "Technical professional (engineering, development, etc.)",
        "Non-technical professional (marketing, sales, etc.)",
        "Unemployed / In career transition",
        "Retired",
        "Other (please specify)"
      ]
    },
    {
      id: 8,
      text: "What do you most want to accomplish with AI right now?",
      options: [
        "Boost productivity and efficiency",
        "Enhance creativity and innovation",
        "Learn new skills and capabilities",
        "Automate repetitive tasks",
        "Stay informed about AI developments",
        "Just exploring what's possible",
        "Other (please specify)"
      ]
    },
    {
      id: 9,
      text: "Which potential features would be most valuable to you?",
      options: [
        "Personalized AI learning paths",
        "AI mental wellness coaching",
        "Advanced content generation tools",
        "Industry-specific AI tutorials",
        "Community of like-minded learners",
        "One-on-one AI adaptation coaching",
        "Other (please specify)"
      ]
    }
  ];
  
  // Helper functions moved from the web components
  /**
   * Extracts MBTI type from assessment answers
   */
  export const getMBTIType = (answers: Record<number, string>): string => {
    const mbtiParts = {
      E: answers[1]?.includes('(E)') ? 'E' : undefined,
      I: answers[1]?.includes('(I)') ? 'I' : undefined,
      S: answers[2]?.includes('(S)') ? 'S' : undefined,
      N: answers[2]?.includes('(N)') ? 'N' : undefined,
      T: answers[3]?.includes('(T)') ? 'T' : undefined,
      F: answers[3]?.includes('(F)') ? 'F' : undefined,
      J: answers[4]?.includes('(J)') ? 'J' : undefined,
      P: answers[4]?.includes('(P)') ? 'P' : undefined,
    };

    return (
      (mbtiParts.E || mbtiParts.I || '_') +
      (mbtiParts.S || mbtiParts.N || '_') +
      (mbtiParts.T || mbtiParts.F || '_') +
      (mbtiParts.J || mbtiParts.P || '_')
    );
  };
  
  /**
   * Returns description for a MBTI personality type
   */
  export const getMbtiDescription = (mbtiType: string): string => {
    const descriptions: {[key: string]: string} = {
      'INTJ': 'Strategic and independent thinker with a focus on systems and innovation',
      'INTP': 'Logical and curious problem-solver who enjoys theoretical analysis',
      'ENTJ': 'Decisive leader who excels at organizing people and resources',
      'ENTP': 'Innovative explorer who enjoys debating ideas and possibilities',
      'INFJ': 'Insightful and principled visionary who values meaningful connections',
      'INFP': 'Idealistic and compassionate with strong personal values',
      'ENFJ': 'Charismatic mentor who brings out the best in others',
      'ENFP': 'Enthusiastic and creative connector who values authenticity',
      'ISTJ': 'Practical and fact-oriented organizer who values reliability',
      'ISFJ': 'Devoted caretaker who enjoys creating order and security',
      'ESTJ': 'Efficient organizer who values tradition and clear standards',
      'ESFJ': 'Warm and conscientious community builder who values harmony',
      'ISTP': 'Practical problem-solver who excels in troubleshooting',
      'ISFP': 'Gentle creator who values aesthetics and authenticity',
      'ESTP': 'Energetic problem-solver who thrives on action and variety',
      'ESFP': 'Enthusiastic collaborator who brings joy to shared experiences'
    };
    
    // Handle partial MBTI types (with some dimensions as '_')
    if (mbtiType.includes('_')) {
      return 'Your personality profile is taking shape. Complete any missing dimensions in a future assessment.';
    }
    
    return descriptions[mbtiType] || 'Analytical and thoughtful individual with a unique perspective on the world';
  };
  
  /**
   * Returns description for an AI preference
   */
  export const getAiPreferenceDescription = (aiPreference: string): string => {
    const descriptions: {[key: string]: string} = {
      'enthusiastic': 'You embrace AI technologies with excitement and are eager to explore their full potential.',
      'optimistic': 'You see the positive aspects of AI and are open to integrating it into your life and work.',
      'cautious': 'You approach AI with careful consideration, weighing benefits against potential concerns.',
      'resistant': 'You prefer a measured approach to AI adoption, focusing on proven applications.'
    };
    
    return descriptions[aiPreference] || 'You have a balanced approach to AI technologies';
  };

  // Calculate AI preference based on assessment answers
  const calculateAIPreference = (answers: any[]) => {
    // Keep the original logic focused on questions 5 and 6
    const aiToolResponse = answers.find(a => a.question_id === 5)?.answer || '';
    const aiImpactResponse = answers.find(a => a.question_id === 6)?.answer || '';
    
    const toolScores: { [key: string]: number } = {
      "Dive right in and experiment": 4,
      "Wait for a training session": 3,
      "Watch colleagues use it first": 2,
      "Prefer to avoid using it unless necessary": 1
    };
  
    const impactScores: { [key: string]: number } = {
      "Excited about the possibilities": 4,
      "Cautiously optimistic": 3,
      "Somewhat concerned": 2,
      "Very worried": 1
    };
  
    const toolScore = toolScores[aiToolResponse] || 2;
    const impactScore = impactScores[aiImpactResponse] || 2;
    const averageScore = (toolScore + impactScore) / 2;
  
    if (averageScore >= 3.5) return 'enthusiastic';
    if (averageScore >= 2.5) return 'optimistic';
    if (averageScore >= 1.5) return 'cautious';
    return 'resistant';
  };
  
  // Assessment Functions
  export const saveAssessment = async (userId: string, assessmentData: any) => {
    try {
      const aiPreference = calculateAIPreference(assessmentData.answers);
      
      // Extract additional profile data from new questions
      const lifestyle = assessmentData.answers.find((a: any) => a.question_id === 7)?.answer || '';
      const aiGoal = assessmentData.answers.find((a: any) => a.question_id === 8)?.answer || '';
      const preferredFeature = assessmentData.answers.find((a: any) => a.question_id === 9)?.answer || '';

      const assessmentRef = await addDoc(collection(db, 'assessments'), {
        userId: userId,
        mbti_type: assessmentData.mbti_type,
        ai_preference: aiPreference,
        lifestyle: lifestyle,
        ai_goal: aiGoal,
        preferred_feature: preferredFeature,
        createdAt: serverTimestamp()
      });
  
      const answers = assessmentData.answers || [];
      await Promise.all(answers.map(async (answer: any) => {
        await addDoc(collection(db, 'assessments', assessmentRef.id, 'answers'), {
          question_id: answer.question_id,
          answer: answer.answer,
          createdAt: serverTimestamp()
        });
      }));
  
      // Update user document with assessment results using service function
      await updateUser(userId, {
        hasCompletedAssessment: true,
        mbtiType: assessmentData.mbti_type,
        aiPreference: aiPreference,
        lifestyle: lifestyle,
        aiGoal: aiGoal,
        preferredFeature: preferredFeature
      });
  
      // Invalidate assessment cache
      invalidateAssessmentCache(userId);
  
      return { data: { id: assessmentRef.id } };
    } catch (error) {
      console.error('Error saving assessment:', error);
      throw error;
    }
  };
  
  /**
   * Gets the latest assessment for a user from cache or Firestore
   * @param userId User ID
   * @returns Assessment data or null if not found
   */
  export const getLatestAssessment = async (userId: string) => {
    // Create a unique cache key for this user's latest assessment
    const cacheKey = `latest-assessment-${userId}`;
  
    // Use getOrSet to retrieve from cache or fetch from Firestore
    return assessmentCache.getOrSet(cacheKey, async () => {
      try {
        const assessmentsRef = collection(db, 'assessments');
        const q = query(
          assessmentsRef,
          where('userId', '==', userId),
          orderBy('createdAt', 'desc'),
          limit(1)
        );
        
        const querySnapshot = await getDocs(q);
        if (querySnapshot.empty) {
          return { data: null };
        }
  
        const assessmentDoc = querySnapshot.docs[0];
        const answersRef = collection(db, 'assessments', assessmentDoc.id, 'answers');
        const answersSnapshot = await getDocs(answersRef);
  
        const rawData = assessmentDoc.data() as {
          userId: string;
          mbti_type: string;
          ai_preference: string;
          createdAt: any;
        };
  
        const assessment = {
          id: assessmentDoc.id,
          ...rawData,
          answers: answersSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
        };
  
        return { data: assessment };
      } catch (error) {
        console.error('Error fetching assessment:', error);
        return { data: null, error };
      }
    });
  };