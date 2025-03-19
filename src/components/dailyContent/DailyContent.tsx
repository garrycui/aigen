import { useState, useEffect } from 'react';
import { Quote, Laugh } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getDailyContent } from '../../lib/dailycontent/dailyContent';

const DailyContent = () => {
  const { user } = useAuth();
  const [content, setContent] = useState<{
    content: string;
    type: 'quote' | 'joke';
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadContent = async () => {
      if (!user) return;
      
      try {
        setIsLoading(true);
        setError(null);
        const dailyContent = await getDailyContent(user.id);
        if (dailyContent && 'content' in dailyContent && 'type' in dailyContent) {
          setContent(dailyContent as { content: string; type: 'quote' | 'joke' });
        } else {
          throw new Error('Invalid daily content format');
        }
      } catch (error) {
        console.error('Error loading daily content:', error);
        setError('Failed to load daily content. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    loadContent();
  }, [user]);

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-6 h-6 bg-gray-200 rounded-full animate-pulse"></div>
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse"></div>
        </div>
        <div className="h-20 bg-gray-200 rounded animate-pulse"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="text-red-600">{error}</div>
      </div>
    );
  }

  if (!content) return null;

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center space-x-2 mb-4">
        {content.type === 'quote' ? (
          <Quote className="h-6 w-6 text-indigo-600" />
        ) : (
          <Laugh className="h-6 w-6 text-indigo-600" />
        )}
        <h2 className="text-lg font-semibold text-gray-900">
          Daily {content.type === 'quote' ? 'Inspiration' : 'Humor'}
        </h2>
      </div>
      <blockquote className="text-gray-700 italic border-l-4 border-indigo-600 pl-4">
        {content.content}
      </blockquote>
    </div>
  );
};

export default DailyContent;