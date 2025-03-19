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