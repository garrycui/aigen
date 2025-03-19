import React, { useState, useEffect } from 'react';
import { Star, X, MessageSquare, ThumbsUp } from 'lucide-react';
import { saveReview } from '@shared/lib/review/reviews';
import { useAuth } from '@context/AuthContext';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  platform?: 'ios' | 'android' | 'web';
  isPeriodic?: boolean;
}

const ReviewModal: React.FC<ReviewModalProps> = ({ isOpen, onClose, platform = 'web', isPeriodic = false }) => {
  const { user } = useAuth();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [generalFeedback, setGeneralFeedback] = useState('');
  const [featureSuggestion, setFeatureSuggestion] = useState('');
  const [usabilityRating, setUsabilityRating] = useState(0);
  const [contentRating, setContentRating] = useState(0);
  const [mostValuedFeature, setMostValuedFeature] = useState('');
  const [biggestChallenge, setBiggestChallenge] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  
  // Animation states
  const [isVisible, setIsVisible] = useState(false);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [isOpen]);

  // Handle modal close with animation
  const handleClose = () => {
    setIsExiting(true);
    setTimeout(() => {
      onClose();
      setIsExiting(false);
    }, 300); // Match transition duration
  };

  if (!isOpen || !user) return null;

  const handleRatingClick = async (selectedRating: number) => {
    setRating(selectedRating);
    setShowFeedbackForm(true);
    setCurrentStep(0);
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setIsSubmitting(true);
      await saveReview(user.id, {
        rating,
        usabilityRating,
        contentRating,
        mostValuedFeature,
        biggestChallenge,
        generalFeedback,
        featureSuggestion,
        platform
      }, isPeriodic);
      onClose();
    } catch (error) {
      console.error('Error submitting review:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const nextStep = () => {
    setCurrentStep(prev => prev + 1);
  };

  const prevStep = () => {
    setCurrentStep(prev => Math.max(0, prev - 1));
  };

  const steps = [
    // Step 0: App aspects ratings
    <div key="step0" className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How would you rate the app's ease of use?
        </label>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map(value => (
            <button
              key={value}
              onClick={() => setUsabilityRating(value)}
              className={`p-2 rounded-full ${
                value <= usabilityRating
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'text-gray-400'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          How would you rate the quality of learning content?
        </label>
        <div className="flex space-x-2">
          {[1, 2, 3, 4, 5].map(value => (
            <button
              key={value}
              onClick={() => setContentRating(value)}
              className={`p-2 rounded-full ${
                value <= contentRating
                  ? 'bg-indigo-100 text-indigo-600'
                  : 'text-gray-400'
              }`}
            >
              {value}
            </button>
          ))}
        </div>
      </div>
    </div>,
    
    // Step 1: Most valued and challenging aspects
    <div key="step1" className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Which feature of AI Adapt has provided you the most value?
        </label>
        <select
          value={mostValuedFeature}
          onChange={e => setMostValuedFeature(e.target.value)}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select a feature...</option>
          <option value="Personalized tutorials">Personalized tutorials</option>
          <option value="AI Assistant">AI Assistant</option>
          <option value="Learning goals">Learning goals</option>
          <option value="Mind Tracker">Mind Tracker</option>
          <option value="Community forums">Community forums</option>
          <option value="Daily content">Daily content</option>
          <option value="Progress tracking">Progress tracking</option>
          <option value="Other">Other</option>
        </select>
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What has been your biggest challenge in adapting to AI?
        </label>
        <select
          value={biggestChallenge}
          onChange={e => setBiggestChallenge(e.target.value)}
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">Select a challenge...</option>
          <option value="Understanding AI capabilities">Understanding AI capabilities</option>
          <option value="Learning technical skills">Learning technical skills</option>
          <option value="Finding relevant resources">Finding relevant resources</option>
          <option value="Time management">Time management</option>
          <option value="Overcoming anxiety about AI">Overcoming anxiety about AI</option>
          <option value="Applying AI to my specific field">Applying AI to my specific field</option>
          <option value="Keeping up with rapid changes">Keeping up with rapid changes</option>
          <option value="Other">Other</option>
        </select>
      </div>
    </div>,
    
    // Step 2: General feedback and feature suggestions
    <div key="step2" className="space-y-6">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Any additional thoughts on your experience with AI Adapt?
        </label>
        <textarea
          value={generalFeedback}
          onChange={e => setGeneralFeedback(e.target.value)}
          placeholder="What's working well? What could be improved?"
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          rows={3}
        />
      </div>
      
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          What specific feature or improvement would make AI Adapt more valuable to you?
        </label>
        <textarea
          value={featureSuggestion}
          onChange={e => setFeatureSuggestion(e.target.value)}
          placeholder="I wish the app could..."
          className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-indigo-500"
          rows={2}
        />
      </div>
    </div>
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div 
          className={`fixed inset-0 bg-black transition-opacity duration-300 ${
            isVisible && !isExiting ? 'opacity-50' : 'opacity-0'
          }`} 
          onClick={handleClose} 
        />
        
        <div 
          className={`relative bg-white rounded-lg shadow-xl max-w-md w-full mx-auto transition-all duration-300 ${
            isVisible && !isExiting 
              ? 'opacity-100 scale-100 translate-y-0' 
              : 'opacity-0 scale-95 translate-y-4'
          }`}
        >
          <div className="absolute right-4 top-4">
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            {!showFeedbackForm ? (
              <>
                <div className="flex items-center justify-center mb-4">
                  <ThumbsUp className="h-8 w-8 text-indigo-500 mr-2" />
                  <h2 className="text-2xl font-bold text-center text-gray-900">
                    {isPeriodic ? "Your Journey Continues!" : "Your Opinion Matters"}
                  </h2>
                </div>
                <p className="text-center text-gray-600 mb-6">
                  {isPeriodic 
                    ? "It's been a while since your last review. How has your AI adaptation journey evolved?" 
                    : "Help us improve Thrive and better support your AI adaptation journey. How has your experience been?"}
                </p>
                <div className="flex justify-center space-x-2 mb-6">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onMouseEnter={() => setHoveredRating(value)}
                      onMouseLeave={() => setHoveredRating(0)}
                      onClick={() => handleRatingClick(value)}
                      className="p-1 focus:outline-none"
                    >
                      <Star
                        className={`h-8 w-8 ${
                          value <= (hoveredRating || rating)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                <div className="flex items-center justify-center mb-4">
                  <MessageSquare className="h-8 w-8 text-indigo-500 mr-2" />
                  <h2 className="text-2xl font-bold text-center text-gray-900">
                    {isPeriodic ? "Help Us Grow With You" : "Help Shape AI Adapt"}
                  </h2>
                </div>
                
                {isPeriodic && (
                  <p className="text-center text-gray-600 mb-4">
                    Your continued feedback helps us adapt our platform to your evolving needs.
                  </p>
                )}
                
                <div className="mb-6 flex justify-center">
                  <div className="flex items-center space-x-1">
                    {steps.map((_, index) => (
                      <div 
                        key={index}
                        className={`h-2 w-${index === currentStep ? '6' : '4'} rounded-full ${
                          index === currentStep 
                            ? 'bg-indigo-600' 
                            : index < currentStep 
                              ? 'bg-indigo-400' 
                              : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                </div>
                
                {steps[currentStep]}
                
                <div className="mt-8 flex justify-between">
                  <button
                    onClick={prevStep}
                    className={`px-4 py-2 ${
                      currentStep === 0
                        ? 'text-gray-400 cursor-not-allowed'
                        : 'text-gray-700 hover:text-gray-900'
                    }`}
                    disabled={currentStep === 0}
                  >
                    Back
                  </button>
                  
                  {currentStep < steps.length - 1 ? (
                    <button
                      onClick={nextStep}
                      className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
                    >
                      Continue
                    </button>
                  ) : (
                    <button
                      onClick={handleSubmit}
                      disabled={isSubmitting}
                      className={`px-6 py-2 bg-indigo-600 text-white rounded-lg transition-colors ${
                        isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
                      }`}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center">
                          <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Submitting...
                        </span>
                      ) : (
                        'Submit Feedback'
                      )}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReviewModal;