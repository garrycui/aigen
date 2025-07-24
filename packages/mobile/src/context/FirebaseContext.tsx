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
  getDocs 
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
      // Save assessment document
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
      queryDocuments
    }}>
      {children}
    </FirebaseContext.Provider>
  );
}