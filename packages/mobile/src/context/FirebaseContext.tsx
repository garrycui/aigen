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

  // Utility to recursively remove undefined fields from an object
  function removeUndefinedFields(obj: any): any {
    if (Array.isArray(obj)) {
      return obj.map(removeUndefinedFields);
    } else if (obj && typeof obj === 'object') {
      return Object.entries(obj).reduce((acc, [key, value]) => {
        if (value !== undefined) {
          acc[key] = removeUndefinedFields(value);
        }
        return acc;
      }, {} as any);
    }
    return obj;
  }

  // Generic CRUD operations
  const createDocument = async (collectionName: string, data: any): Promise<FirebaseResponse> => {
    try {
      const cleanData = removeUndefinedFields(data);
      const docRef = await addDoc(collection(db, collectionName), {
        ...cleanData,
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
      const cleanData = removeUndefinedFields(data);
      const docRef = doc(db, collectionName, documentId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        // Document exists, update it
        await updateDoc(docRef, {
          ...cleanData,
          updatedAt: serverTimestamp()
        });
      } else {
        // Document doesn't exist, create it with setDoc
        await setDoc(docRef, {
          ...cleanData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
      
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

  // Enhanced chat session operations
  const saveChatSession = async (userId: string, sessionData: any): Promise<FirebaseResponse> => {
    try {
      const cleanData = removeUndefinedFields(sessionData);
      
      // Remove any empty id field to avoid conflicts
      const { id, ...dataWithoutId } = cleanData;
      
      // Ensure required fields are present
      const sessionDoc = {
        userId,
        ...dataWithoutId,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        archived: cleanData.archived || false,
        messageCount: cleanData.messageCount || 0
      };
      
      console.log('Saving chat session to Firebase:', sessionDoc);
      const sessionRef = await addDoc(collection(db, 'chatSessions'), sessionDoc);
      
      console.log(`Chat session created with ID: ${sessionRef.id}`);
      return { success: true, data: { id: sessionRef.id } };
    } catch (error) {
      console.error('Error saving chat session:', error);
      return { success: false, error: 'Failed to save chat session' };
    }
  };

  const updateChatSession = async (sessionId: string, updates: any): Promise<FirebaseResponse> => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required for update');
      }
      
      const cleanUpdates = removeUndefinedFields(updates);
      const sessionRef = doc(db, 'chatSessions', sessionId);
      
      // Always include updatedAt timestamp
      const updateData = {
        ...cleanUpdates,
        updatedAt: serverTimestamp()
      };
      
      await updateDoc(sessionRef, updateData);
      
      console.log(`Chat session ${sessionId} updated successfully`);
      return { success: true, data: { id: sessionId } };
    } catch (error) {
      console.error(`Error updating chat session ${sessionId}:`, error);
      return { success: false, error: 'Failed to update chat session' };
    }
  };

  const getChatSessions = async (userId: string): Promise<FirebaseResponse> => {
    try {
      const q = query(
        collection(db, 'chatSessions'), 
        where('userId', '==', userId)
      );
      const querySnapshot = await getDocs(q);
      
      const sessions = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        // Ensure timestamps are properly formatted
        createdAt: doc.data().createdAt?.toDate?.()?.toISOString() || doc.data().createdAt,
        updatedAt: doc.data().updatedAt?.toDate?.()?.toISOString() || doc.data().updatedAt
      }));
      
      return { success: true, data: sessions };
    } catch (error) {
      console.error('Error fetching chat sessions:', error);
      return { success: false, error: 'Failed to fetch chat sessions' };
    }
  };

  const saveChatMessage = async (sessionId: string, message: any): Promise<FirebaseResponse> => {
    try {
      if (!sessionId) {
        throw new Error('Session ID is required to save message');
      }
      
      const cleanMessage = removeUndefinedFields(message);
      const messageDoc = {
        sessionId,
        ...cleanMessage,
        createdAt: serverTimestamp()
      };
      
      const messageRef = await addDoc(collection(db, 'chatMessages'), messageDoc);
      
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
    try {
      const cleanUpdates = removeUndefinedFields(updates);
      const docRef = doc(db, 'userPersonalization', userId);
      await setDoc(docRef, {
        ...cleanUpdates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true, data: { id: userId } };
    } catch (error) {
      console.error('Error updating user personalization:', error);
      return { success: false, error: 'Failed to update user personalization' };
    }
  };

  const saveInteraction = async (userId: string, interactionData: any): Promise<FirebaseResponse> => {
    try {
      const cleanData = removeUndefinedFields(interactionData);
      const interactionRef = await addDoc(collection(db, 'userInteractions'), {
        userId,
        ...cleanData,
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
        const cleanData = removeUndefinedFields(data);
        const userRef = doc(db, 'userPersonalization', userId);
        batch.update(userRef, {
          ...cleanData,
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