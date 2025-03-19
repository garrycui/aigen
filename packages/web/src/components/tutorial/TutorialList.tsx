import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getTutorials, Tutorial } from '@shared/lib/tutorial/tutorials';
import { useAuth } from '@context/AuthContext';
import TutorialCard from './TutorialCard';
import { db } from '@shared/lib/common/firebase';
import { doc, getDoc } from 'firebase/firestore';

interface TutorialListProps {
  searchQuery?: string;
  categories?: string[];
  difficulties?: string[];
  limit?: number;
  sortField?: string;
  sortDirection?: 'asc' | 'desc';
}

const TutorialList: React.FC<TutorialListProps> = ({ 
  searchQuery = '', 
  categories = [],
  difficulties = [],
  limit =6,
  sortField = 'createdAt',
  sortDirection = 'desc'
}) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tutorials, setTutorials] = useState<Tutorial[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [completedTutorialIds, setCompletedTutorialIds] = useState<string[]>([]);

  useEffect(() => {
    const loadTutorials = async () => {
      if (!user) return;
      try {
        setIsLoading(true);
        setError(null);
        
        // Reset to first page when filters change
        if (categories.length > 0 || difficulties.length > 0) {
          setCurrentPage(1);
        }
        
        // Pass all categories and difficulties to the query
        const fetchedTutorials = await getTutorials(
          currentPage, 
          limit, 
          searchQuery, 
          categories.length > 0 ? categories : undefined, 
          difficulties.length > 0 ? difficulties : undefined,
          sortField,
          sortDirection
        );

        setTutorials(fetchedTutorials);
      } catch (err) {
        console.error('Error loading tutorials:', err);
        setError('Failed to load tutorials. Please try again.');
      } finally {
        setIsLoading(false);
      }
    };
    loadTutorials();
  }, [user, searchQuery, categories, difficulties, limit, sortField, sortDirection, currentPage]);

  useEffect(() => {
    const loadCompleted = async () => {
      if (!user) return;
      const userRef = doc(db, 'users', user.id);
      const userDoc = await getDoc(userRef);
      const completed = userDoc.data()?.completedTutorials || [];
      setCompletedTutorialIds(completed);
    };
    loadCompleted();
  }, [user]);

  const handleTutorialClick = (tutorialId: string) => {
    navigate(`/tutorials/${tutorialId}`);
  };

  const handlePrevPage = () => {
    if(currentPage > 1) setCurrentPage(prev => prev - 1);
  };

  const handleNextPage = () => {
    if(tutorials.length === limit) setCurrentPage(prev => prev + 1);
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-pulse">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow-md p-6">
            <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-full mb-4"></div>
            <div className="flex justify-between">
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
              <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        <p>{error}</p>
        <button 
          onClick={() => window.location.reload()}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  if (tutorials.length === 0) {
    return (
      <div className="text-center py-12 bg-white rounded-lg shadow-md">
        <p className="text-gray-600">
          {searchQuery || categories.length > 0 || difficulties.length > 0
            ? 'No tutorials match your filters. Try adjusting your search criteria.'
            : 'No tutorials available yet.'}
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {tutorials.map((tutorial) => (
          <TutorialCard
            key={tutorial.id}
            tutorial={tutorial}
            onClick={handleTutorialClick}
            isCompleted={completedTutorialIds.includes(tutorial.id)}
          />
        ))}
      </div>
      
      {/* Pagination Controls */}
      <div className="flex justify-between items-center mt-6">
        <button 
          onClick={handlePrevPage} 
          disabled={currentPage === 1}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Previous
        </button>
        <span>Page {currentPage}</span>
        <button 
          onClick={handleNextPage} 
          disabled={tutorials.length < limit}
          className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </>
  );
};

export default TutorialList;