import React, { createContext, useContext } from 'react';
import { 
  getFirestore, 
  collection, 
  addDoc, 
  doc, 
  updateDoc, 
  getDoc, 
  setDoc,
  serverTimestamp,
  query,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { getApp } from 'firebase/app';

interface FirebaseResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

interface FirebaseContextType {
  // User Profile operations
  getUserProfile: (userId: string) => Promise<FirebaseResponse>;
  updateUserProfile: (userId: string, profileData: any) => Promise<FirebaseResponse>;
  createUserProfile: (userId: string, profileData: any) => Promise<FirebaseResponse>;
  
  // Assessment operations
  saveAssessment: (userId: string, assessmentData: any) => Promise<FirebaseResponse>;
  getUserAssessment: (userId: string) => Promise<FirebaseResponse>;
  
  // Generic CRUD operations
  createDocument: (collectionName: string, data: any) => Promise<FirebaseResponse>;
  getDocument: (collectionName: string, documentId: string) => Promise<FirebaseResponse>;
  updateDocument: (collectionName: string, documentId: string, data: any) => Promise<FirebaseResponse>;
  queryDocuments: (collectionName: string, field: string, operator: any, value: any) => Promise<FirebaseResponse>;

  // Chat operations
  saveChatSession: (userId: string, sessionData: any) => Promise<FirebaseResponse>;
  getChatSessions: (userId: string) => Promise<FirebaseResponse>;
  updateChatSession: (sessionId: string, updates: any) => Promise<FirebaseResponse>;
  saveChatMessage: (sessionId: string, message: any) => Promise<FirebaseResponse>;
  getChatMessages: (sessionId: string) => Promise<FirebaseResponse>;
  saveUserInsights: (userId: string, insights: any) => Promise<FirebaseResponse>;
  getUserInsights: (userId: string) => Promise<FirebaseResponse>;

  // Personalization operations
  getUserPersonalization: (userId: string) => Promise<FirebaseResponse>;
  updateUserPersonalization: (userId: string, updates: any) => Promise<FirebaseResponse>;
  saveInteraction: (userId: string, interactionData: any) => Promise<FirebaseResponse>;
  getDailyInteractions: (userId: string, date: string) => Promise<FirebaseResponse>;
  batchUpdatePersonalization: (updates: Array<{userId: string, data: any}>) => Promise<FirebaseResponse>;
}

const FirebaseContext = createContext<FirebaseContextType | null>(null);

export const useFirebase = () => {
  const context = useContext(FirebaseContext);
  if (!context) {
    throw new Error('useFirebase must be used within a FirebaseProvider');
  }
  return context;
};

export function FirebaseProvider({ children }: { children: React.ReactNode }) {
  const app = getApp();
  const db = getFirestore(app);

  // Generic CRUD operations
  const createDocument = async (collectionName: string, data: any): Promise<FirebaseResponse> => {
    try {
      const docRef = await addDoc(collection(db, collectionName), {
        ...data,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, data: { id: docRef.id } };
    } catch (error) {
      console.error(`Error creating document in ${collectionName}:`, error);
      return { success: false, error: `Failed to create ${collectionName} document` };
    }
  };

  const getDocument = async (collectionName: string, documentId: string): Promise<FirebaseResponse> => {
    try {
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { success: true, data: { id: docSnap.id, ...docSnap.data() } };
      } else {
        return { success: false, error: 'Document not found' };
    }
    } catch (error) {
      console.error(`Error fetching document from ${collectionName}:`, error);
      return { success: false, error: `Failed to fetch ${collectionName} document` };
    }
  };

  const updateDocument = async (collectionName: string, documentId: string, data: any): Promise<FirebaseResponse> => {
    try {
      const docRef = doc(db, collectionName, documentId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp()
      });
      return { success: true, data: { id: documentId } };
    } catch (error) {
      console.error(`Error updating document in ${collectionName}:`, error);
      return { success: false, error: `Failed to update ${collectionName} document` };
    }
  };

  const queryDocuments = async (collectionName: string, field: string, operator: any, value: any): Promise<FirebaseResponse> => {
    try {
      const q = query(collection(db, collectionName), where(field, operator, value));
      const querySnapshot = await getDocs(q);
      const documents = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      return { success: true, data: documents };
    } catch (error) {
      console.error(`Error querying documents from ${collectionName}:`, error);
      return { success: false, error: `Failed to query ${collectionName} documents` };
    }
  };

  // User Profile operations
  const getUserProfile = async (userId: string): Promise<FirebaseResponse> => {
    return await getDocument('users', userId);
  };

  const updateUserProfile = async (userId: string, profileData: any): Promise<FirebaseResponse> => {
    try {
      const userRef = doc(db, 'users', userId);
      const docSnap = await getDoc(userRef);
      
      if (docSnap.exists()) {
        // Document exists, update it
        await updateDoc(userRef, {
          ...profileData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Document doesn't exist, create it
        await setDoc(userRef, {
          ...profileData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
      return { success: true, data: { id: userId } };
    } catch (error) {
      console.error('Error updating/creating user profile:', error);
      return { success: false, error: 'Failed to update user profile' };
    }
  };

  const createUserProfile = async (userId: string, profileData: any): Promise<FirebaseResponse> => {
    try {
      const userRef = doc(db, 'users', userId);
      await setDoc(userRef, {
        ...profileData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, data: { id: userId } };
    } catch (error) {
      console.error('Error creating user profile:', error);
      return { success: false, error: 'Failed to create user profile' };
    }
  };

  // Assessment operations
  const saveAssessment = async (userId: string, assessmentData: any): Promise<FirebaseResponse> => {
    try {
      // assessmentData now includes 'responses' (all answers)
      const assessmentRef = await addDoc(collection(db, 'assessments'), {
        userId: userId,
        ...assessmentData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { success: true, data: { id: assessmentRef.id } };
    } catch (error) {
      console.error('Error saving assessment:', error);
      return { success: false, error: 'Failed to save assessment' };
    }
  };

  const getUserAssessment = async (userId: string): Promise<FirebaseResponse> => {
    return await queryDocuments('assessments', 'userId', '==', userId);
  };

  // Chat operations
  const saveChatSession = async (userId: string, sessionData: any): Promise<FirebaseResponse> => {
    try {
      const sessionRef = await addDoc(collection(db, 'chatSessions'), {
        userId,
        ...sessionData,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
      return { success: true, data: { id: sessionRef.id } };
    } catch (error) {
      console.error('Error saving chat session:', error);
      return { success: false, error: 'Failed to save chat session' };
    }
  };

  const getChatSessions = async (userId: string): Promise<FirebaseResponse> => {
    return await queryDocuments('chatSessions', 'userId', '==', userId);
  };

  const updateChatSession = async (sessionId: string, updates: any): Promise<FirebaseResponse> => {
    return await updateDocument('chatSessions', sessionId, updates);
  };

  const saveChatMessage = async (sessionId: string, message: any): Promise<FirebaseResponse> => {
    try {
      const messageRef = await addDoc(collection(db, 'chatMessages'), {
        sessionId,
        ...message,
        createdAt: serverTimestamp()
      });
      return { success: true, data: { id: messageRef.id } };
    } catch (error) {
      console.error('Error saving chat message:', error);
      return { success: false, error: 'Failed to save chat message' };
    }
  };

  const getChatMessages = async (sessionId: string): Promise<FirebaseResponse> => {
    return await queryDocuments('chatMessages', 'sessionId', '==', sessionId);
  };

  const saveUserInsights = async (userId: string, insights: any): Promise<FirebaseResponse> => {
    try {
      const insightsRef = doc(db, 'userInsights', userId);
      await setDoc(insightsRef, {
        ...insights,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true, data: { id: userId } };
    } catch (error) {
      console.error('Error saving user insights:', error);
      return { success: false, error: 'Failed to save user insights' };
    }
  };

  const getUserInsights = async (userId: string): Promise<FirebaseResponse> => {
    return await getDocument('userInsights', userId);
  };

  // Personalization operations
  const getUserPersonalization = async (userId: string): Promise<FirebaseResponse> => {
    return await getDocument('userPersonalization', userId);
  };

  const updateUserPersonalization = async (userId: string, updates: any): Promise<FirebaseResponse> => {
    return await updateDocument('userPersonalization', userId, updates);
  };

  const saveInteraction = async (userId: string, interactionData: any): Promise<FirebaseResponse> => {
    try {
      const interactionRef = await addDoc(collection(db, 'userInteractions'), {
        userId,
        ...interactionData,
        createdAt: serverTimestamp()
      });
      return { success: true, data: { id: interactionRef.id } };
    } catch (error) {
      console.error('Error saving interaction:', error);
      return { success: false, error: 'Failed to save interaction' };
    }
  };

  const getDailyInteractions = async (userId: string, date: string): Promise<FirebaseResponse> => {
    return await getDocument(`userInteractions/${userId}/daily`, date);
  };

  const batchUpdatePersonalization = async (updates: Array<{userId: string, data: any}>): Promise<FirebaseResponse> => {
    try {
      const batch = writeBatch(db);
      
      updates.forEach(({ userId, data }) => {
        const userRef = doc(db, 'userPersonalization', userId);
        batch.update(userRef, {
          ...data,
          lastUpdated: serverTimestamp()
        });
      });

      await batch.commit();
      return { success: true };
    } catch (error) {
      console.error('Error batch updating personalization:', error);
      return { success: false, error: 'Failed to batch update' };
    }
  };

  return (
    <FirebaseContext.Provider value={{
      // User Profile operations
      getUserProfile,
      updateUserProfile,
      createUserProfile,
      
      // Assessment operations
      saveAssessment,
      getUserAssessment,
      
      // Generic CRUD operations
      createDocument,
      getDocument,
      updateDocument,
      queryDocuments,

      // Chat operations
      saveChatSession,
      getChatSessions,
      updateChatSession,
      saveChatMessage,
      getChatMessages,
      saveUserInsights,
      getUserInsights,

      // Personalization operations
      getUserPersonalization,
      updateUserPersonalization,
      saveInteraction,
      getDailyInteractions,
      batchUpdatePersonalization
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}