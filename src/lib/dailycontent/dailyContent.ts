import { db } from '../common/firebase';
import { collection, addDoc, query, where, getDocs, serverTimestamp, Timestamp } from 'firebase/firestore';
import { generateChatResponse } from '../common/openai';
import { getLatestAssessment } from '../assessment/assessment';

export const generateDailyContent = async (userId: string) => {
  try {
    // Get user's assessment results for personalization
    const { data: assessment } = await getLatestAssessment(userId);
    const mbtiType = assessment?.mbti_type;
    const aiPreference = assessment?.ai_preference;

    // Generate content using ChatGPT
    const prompt = `Generate an inspiring ${Math.random() > 0.5 ? 'quote' : 'joke'} about AI and technology that would resonate with a ${mbtiType || 'person'} who is ${aiPreference || ''} about AI. Make it encouraging and uplifting.`;
    
    const { response } = await generateChatResponse(prompt, [], mbtiType, aiPreference);

    // Save to Firestore
    const content = {
      userId,
      content: response,
      type: response.includes('?') ? 'joke' : 'quote',
      createdAt: serverTimestamp()
    };

    const docRef = await addDoc(collection(db, 'dailyContent'), content);
    return { id: docRef.id, ...content };
  } catch (error) {
    console.error('Error generating daily content:', error);
    return {
      userId,
      content: "Technology is not just a tool. It's an extension of human capability.",
      type: "quote",
      createdAt: serverTimestamp()
    };
  }
};

export const getDailyContent = async (userId: string) => {
  try {
    const contentRef = collection(db, 'dailyContent');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const q = query(
      contentRef,
      where('userId', '==', userId),
      where('createdAt', '>=', Timestamp.fromDate(today))
    );
    
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return generateDailyContent(userId);
    }
    
    return snapshot.docs[0].data();
  } catch (error) {
    console.error('Error fetching daily content:', error);
    return {
      userId,
      content: "Technology is not just a tool. It's an extension of human capability.",
      type: "quote",
      createdAt: serverTimestamp()
    };
  }
};