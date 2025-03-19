import React, { useState } from 'react';
import { X, Loader, BookOpen, Sparkles, Target } from 'lucide-react';
import { generateTutorial } from '../../lib/tutorial/tutorials';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';

interface GenerateTutorialModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Difficulty = 'beginner' | 'intermediate' | 'advanced';

interface DifficultyOption {
  value: Difficulty;
  label: string;
  description: string;
  icon: React.ReactNode;
}

const DIFFICULTY_OPTIONS: DifficultyOption[] = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Perfect for those new to the topic. Includes detailed explanations and basic concepts.',
    icon: <BookOpen className="h-5 w-5 text-green-500" />
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'For users with some experience. Covers more complex topics and practical applications.',
    icon: <Target className="h-5 w-5 text-blue-500" />
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Deep dives into advanced concepts. Assumes strong foundational knowledge.',
    icon: <Sparkles className="h-5 w-5 text-purple-500" />
  }
];

const GenerateTutorialModal: React.FC<GenerateTutorialModalProps> = ({ isOpen, onClose }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty>('intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<1 | 2>(1);

  const handleGenerate = async () => {
    if (!user || !query.trim()) return;

    try {
      setIsGenerating(true);
      setError(null);
      const tutorial = await generateTutorial(user.id, query, selectedDifficulty);
      onClose();
      navigate(`/tutorials/${tutorial.id}`);
    } catch (error) {
      console.error('Error generating tutorial:', error);
      setError('Failed to generate tutorial. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleNext = () => {
    if (!query.trim()) {
      setError('Please enter what you want to learn about');
      return;
    }
    setError(null);
    setStep(2);
  };

  const handleBack = () => {
    setError(null);
    setStep(1);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">
              Generate Custom Tutorial
            </h2>
            
            {/* Progress Steps */}
            <div className="flex items-center mb-8">
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step === 1 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'
              }`}>
                1
              </div>
              <div className={`flex-1 h-0.5 mx-2 ${
                step === 2 ? 'bg-indigo-600' : 'bg-gray-200'
              }`} />
              <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                step === 2 ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'
              }`}>
                2
              </div>
            </div>

            {step === 1 ? (
              <>
                <p className="text-gray-600 mb-6">
                  What would you like to learn about? We'll create a personalized tutorial based on your learning style and preferences.
                </p>

                <div className="mb-6">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    What do you want to learn?
                  </label>
                  <textarea
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="E.g., How to use ChatGPT for email management, or How to implement AI in my daily workflow..."
                    className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    rows={4}
                    required
                  />
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-end space-x-3">
                  <button
                    onClick={onClose}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleNext}
                    disabled={!query.trim()}
                    className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                      !query.trim() ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
                    }`}
                  >
                    Next
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="text-gray-600 mb-6">
                  Select the difficulty level for your tutorial. This helps us tailor the content to your experience level.
                </p>

                <div className="space-y-4 mb-6">
                  {DIFFICULTY_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      onClick={() => setSelectedDifficulty(option.value)}
                      className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
                        selectedDifficulty === option.value
                          ? 'border-indigo-600 bg-indigo-50'
                          : 'border-gray-200 hover:border-indigo-600'
                      }`}
                    >
                      <div className="flex items-center mb-2">
                        {option.icon}
                        <span className="ml-2 font-medium">{option.label}</span>
                      </div>
                      <p className="text-sm text-gray-600">{option.description}</p>
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                  </div>
                )}

                <div className="flex justify-between">
                  <button
                    onClick={handleBack}
                    className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  >
                    Back
                  </button>
                  <div className="flex space-x-3">
                    <button
                      onClick={onClose}
                      className="px-4 py-2 text-gray-700 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleGenerate}
                      disabled={isGenerating}
                      className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                        isGenerating ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
                      }`}
                    >
                      {isGenerating ? (
                        <span className="flex items-center">
                          <Loader className="animate-spin -ml-1 mr-3 h-5 w-5" />
                          Generating...
                        </span>
                      ) : (
                        'Generate Tutorial'
                      )}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GenerateTutorialModal;