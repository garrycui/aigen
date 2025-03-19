import { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, User, Target, Sparkles } from 'lucide-react';
import { getLatestAssessment } from '../../lib/assessment/assessment';
import { useAuth } from '../../context/AuthContext';

const AssessmentSummary = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [assessmentData, setAssessmentData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { user } = useAuth();

  useEffect(() => {
    const loadAssessment = async () => {
      setIsLoading(true);
      
      // If we have data passed via state (coming from questionnaire)
      if (location.state?.answers) {
        setAssessmentData(location.state.answers);
        setIsLoading(false);
        return;
      }
      
      // Otherwise, try to fetch the user's latest assessment
      try {
        if (!user) return;
        
        const assessmentResult = await getLatestAssessment(user.id);
        
        if (assessmentResult.data) {
          // Transform the data to match expected format
          const formattedData = {
            mbti_type: assessmentResult.data.mbti_type,
            answers: assessmentResult.data.answers || []
          };
          
          setAssessmentData(formattedData);
        } else {
          // Only redirect if we can't find any assessment data
          navigate('/questionnaire', { replace: true });
        }
      } catch (error) {
        console.error('Error loading assessment:', error);
      } finally {
        setIsLoading(false);
      }
    };
    
    loadAssessment();
  }, [location, navigate, user]);

  const getMbtiDescription = (mbtiType: string) => {
    const descriptions: {[key: string]: string} = {
      'INTJ': 'Strategic and independent thinker with a focus on systems and innovation',
      'INTP': 'Logical and curious problem-solver who enjoys theoretical analysis',
      'ENTJ': 'Decisive leader who excels at organizing people and resources',
      'ENTP': 'Innovative explorer who enjoys debating ideas and possibilities',
      'INFJ': 'Insightful and principled visionary who values meaningful connections',
      'INFP': 'Idealistic and compassionate with strong personal values',
      'ENFJ': 'Charismatic mentor who brings out the best in others',
      'ENFP': 'Enthusiastic and creative connector who values authenticity',
      'ISTJ': 'Practical and fact-oriented organizer who values reliability',
      'ISFJ': 'Devoted caretaker who enjoys creating order and security',
      'ESTJ': 'Efficient organizer who values tradition and clear standards',
      'ESFJ': 'Warm and conscientious community builder who values harmony',
      'ISTP': 'Practical problem-solver who excels in troubleshooting',
      'ISFP': 'Gentle creator who values aesthetics and authenticity',
      'ESTP': 'Energetic problem-solver who thrives on action and variety',
      'ESFP': 'Enthusiastic collaborator who brings joy to shared experiences'
    };
    
    // Handle partial MBTI types (with some dimensions as '_')
    if (mbtiType.includes('_')) {
      return 'Your personality profile is taking shape. Complete any missing dimensions in a future assessment.';
    }
    
    return descriptions[mbtiType] || 'Analytical and thoughtful individual with a unique perspective on the world';
  };
  
  const getAiPreferenceDescription = (aiPreference: string) => {
    const descriptions: {[key: string]: string} = {
      'enthusiastic': 'You embrace AI technologies with excitement and are eager to explore their full potential.',
      'optimistic': 'You see the positive aspects of AI and are open to integrating it into your life and work.',
      'cautious': 'You approach AI with careful consideration, weighing benefits against potential concerns.',
      'resistant': 'You prefer a measured approach to AI adoption, focusing on proven applications.'
    };
    
    return descriptions[aiPreference] || 'You have a balanced approach to AI technologies';
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading your assessment results...</div>;
  }

  if (!assessmentData) {
    return <div className="p-8 text-center">No assessment data found. Please complete the assessment.</div>;
  }

  const { mbti_type, answers } = assessmentData;
  
  // Extract information from answers
  const getAnswer = (questionId: number) => {
    const answer = answers.find((a: any) => a.question_id === questionId);
    return answer ? answer.answer : '';
  };

  const lifestyle = getAnswer(7);
  const aiGoals = getAnswer(8);
  const preferredFeature = getAnswer(9);
  
  // Determine AI preference (this would normally come from the backend)
  const aiPreference = location.state?.aiPreference || 'optimistic';

  const handleRetakeAssessment = () => {
    navigate('/questionnaire');
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        <div className="bg-indigo-600 p-6 text-white">
          <h1 className="text-3xl font-bold">Your AI Adaptation Assessment</h1>
          <p className="mt-2 text-indigo-100">
            Here's what we've learned about your approach to AI and technology
          </p>
        </div>
        
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
            <div className="bg-indigo-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <User className="h-6 w-6 text-indigo-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">Your MBTI Profile</h2>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-indigo-600">{mbti_type}</span>
              </div>
              <p className="text-gray-600">
                {getMbtiDescription(mbti_type)}
              </p>
            </div>
            
            <div className="bg-purple-50 p-6 rounded-lg">
              <div className="flex items-center mb-4">
                <Target className="h-6 w-6 text-purple-600 mr-3" />
                <h2 className="text-xl font-semibold text-gray-800">AI Adaptation Style</h2>
              </div>
              <div className="mb-4">
                <span className="text-3xl font-bold text-purple-600 capitalize">
                  {aiPreference}
                </span>
              </div>
              <p className="text-gray-600">
                {getAiPreferenceDescription(aiPreference)}
              </p>
            </div>
          </div>
          
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-800 mb-4">Your Personal Profile</h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-medium text-gray-700">Current Lifestyle/Work Style:</h3>
                <p className="text-gray-600 mt-1 p-3 bg-gray-50 rounded">{lifestyle}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700">AI Goals:</h3>
                <p className="text-gray-600 mt-1 p-3 bg-gray-50 rounded">{aiGoals}</p>
              </div>
              
              <div>
                <h3 className="font-medium text-gray-700">Preferred Features:</h3>
                <p className="text-gray-600 mt-1 p-3 bg-gray-50 rounded">{preferredFeature}</p>
              </div>
            </div>
          </div>
          
          <div className="mb-6 bg-blue-50 p-6 rounded-lg">
            <div className="flex items-center mb-4">
              <Sparkles className="h-6 w-6 text-blue-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-800">What's Next?</h2>
            </div>
            <p className="text-gray-600 mb-4">
              Based on your assessment, we've personalized your AI Adapt experience. You'll now have access to:
            </p>
            <ul className="list-disc pl-5 mb-6 space-y-2 text-gray-600">
              <li>Personalized tutorial recommendations aligned with your learning style</li>
              <li>Communication tailored to your MBTI preferences</li>
              <li>Resources specific to your work style and AI goals</li>
              <li>Features prioritized based on your preferences</li>
            </ul>
          </div>
          
          <div className="flex justify-center space-x-4">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex items-center px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition"
            >
              Go to Your Dashboard
              <ArrowRight className="ml-2 h-5 w-5" />
            </button>
            
            <button 
              onClick={handleRetakeAssessment}
              className="flex items-center px-6 py-3 bg-white border border-indigo-600 text-indigo-600 font-medium rounded-lg hover:bg-indigo-50 transition"
            >
              Retake Assessment
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssessmentSummary;