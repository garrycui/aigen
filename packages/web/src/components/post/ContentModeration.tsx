import React, { useState } from 'react';
import { AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react';
import { moderateContent, ModerationResult } from '@shared/lib/post/moderation';

interface ContentModerationProps {
  content: string;
  onValidationComplete: (isValid: boolean) => void;
  type?: 'title' | 'content';
}

const ContentModeration: React.FC<ContentModerationProps> = ({
  content,
  onValidationComplete,
  type = 'content'
}) => {
  const [isChecking, setIsChecking] = useState(false);
  const [result, setResult] = useState<ModerationResult | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const checkContent = async () => {
    if (!content.trim()) {
      onValidationComplete(false);
      return;
    }

    setIsChecking(true);
    try {
      const moderationResult = await moderateContent(content, type);
      setResult(moderationResult);
      setShowSuggestions(!!moderationResult.suggestions?.length);
      onValidationComplete(moderationResult.allowed);
    } catch (error) {
      console.error('Moderation check failed:', error);
      setResult({
        allowed: false,
        category: 'error',
        reason: 'Moderation check failed',
        suggestions: ['Please try again']
      });
      onValidationComplete(false);
    } finally {
      setIsChecking(false);
    }
  };

  // Debounce content checks
  React.useEffect(() => {
    const handler = setTimeout(() => {
      if (content.trim()) {
        checkContent();
      }
    }, 500);

    return () => clearTimeout(handler);
  }, [content]);

  if (!content.trim() || !result) return null;

  return (
    <div className="mt-2">
      {isChecking ? (
        <div className="flex items-center text-gray-500">
          <RefreshCw className="h-4 w-4 animate-spin mr-2" />
          <span className="text-sm">Checking {type}...</span>
        </div>
      ) : result.allowed ? (
        <div className="flex items-start">
          <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="text-green-700 font-medium">
              {type === 'title' ? 'Title looks good!' : 'Content looks good!'}
            </p>
            {result.suggestions && result.suggestions.length > 0 && (
              <div className="mt-1">
                <button
                  onClick={() => setShowSuggestions(!showSuggestions)}
                  className="text-sm text-indigo-600 hover:text-indigo-800"
                >
                  {showSuggestions ? 'Hide' : 'Show'} suggestions for improvement
                </button>
                {showSuggestions && (
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {result.suggestions.map((suggestion, index) => (
                      <li key={index} className="flex items-center">
                        <span className="mr-2">•</span>
                        {suggestion}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex items-start">
          <AlertTriangle className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
          <div>
            <p className="text-red-700 font-medium">
              {result.reason || `This ${type} cannot be published`}
            </p>
            {result.suggestions && (
              <ul className="mt-2 space-y-1 text-sm text-gray-600">
                {result.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-center">
                    <span className="mr-2">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModeration;