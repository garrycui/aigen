import { useState } from 'react';
import { ChevronRight, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getAuth } from 'firebase/auth';
import { saveAssessment, mbtiQuestions, aiQuestions, getMBTIType } from '@shared/lib/assessment/assessment';
import type { MBTIQuestion, AIQuestion } from '@shared/lib/assessment/assessment';

const Questionnaire = () => {
  const navigate = useNavigate();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState<Record<number, string>>({});
  const [customAnswers, setCustomAnswers] = useState<Record<number, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  
  const allQuestions = [...mbtiQuestions, ...aiQuestions];
  const currentQuestionData = allQuestions[currentQuestion];
  const isMBTIQuestion = currentQuestion < mbtiQuestions.length;

  const handleAnswer = (answer: string) => {
    setAnswers(prev => ({
      ...prev,
      [currentQuestionData.id]: answer
    }));
    
    // If not "Other" option or already at last question, move to next question
    if (!answer.includes("Other") || currentQuestion >= allQuestions.length - 1) {
      if (currentQuestion < allQuestions.length - 1) {
        setCurrentQuestion(prev => prev + 1);
      }
    }
  };

  const handleCustomAnswerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCustomAnswers(prev => ({
      ...prev,
      [currentQuestionData.id]: e.target.value
    }));
  };

  const handleCustomAnswerSubmit = () => {
    if (currentQuestion < allQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    }
  };

  const handleBack = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Not authenticated');
      }

      const mbtiType = getMBTIType(answers);
      
      // Include custom answers for "Other" options
      const processedAnswers = Object.entries(answers).map(([id, answer]) => {
        const questionId = parseInt(id);
        if (answer.includes("Other") && customAnswers[questionId]) {
          return {
            question_id: questionId,
            answer: `${answer}: ${customAnswers[questionId]}`
          };
        }
        return {
          question_id: questionId,
          answer
        };
      });
      
      const assessmentData = {
        mbti_type: mbtiType,
        answers: processedAnswers
      };

      const result = await saveAssessment(user.uid, assessmentData);
      
      // Navigate to summary page instead of dashboard
      navigate('/assessment/summary', { 
        state: { 
          message: 'Assessment completed successfully!',
          answers: assessmentData,
          aiPreference: (result?.data as any)?.aiPreference || 'optimistic'
        }
      });
    } catch (error) {
      console.error('Failed to save assessment:', error);
      alert('Failed to save assessment. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const renderMBTIPreview = () => {
    const mbtiType = getMBTIType(answers);
    const dimensions = [
      { label: 'Extraversion/Introversion', value: mbtiType[0] },
      { label: 'Sensing/Intuition', value: mbtiType[1] },
      { label: 'Thinking/Feeling', value: mbtiType[2] },
      { label: 'Judging/Perceiving', value: mbtiType[3] }
    ];

    return (
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-700 mb-2">Your MBTI Profile</h3>
        <div className="flex items-center justify-center space-x-2 mb-3">
          {mbtiType.split('').map((letter, index) => (
            <div
              key={index}
              className={`w-8 h-8 flex items-center justify-center rounded ${
                letter === '_'
                  ? 'bg-gray-200 text-gray-400'
                  : 'bg-indigo-100 text-indigo-700'
              } font-bold text-lg transition-all duration-300`}
            >
              {letter}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
          {dimensions.map((dim, index) => (
            <div key={index} className="flex items-center justify-between">
              <span>{dim.label}:</span>
              <span className={dim.value !== '_' ? 'font-medium text-indigo-700' : 'text-gray-400'}>
                {dim.value !== '_' ? dim.value : 'Not selected'}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-lg shadow-md p-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">AI Adaptation Assessment</h1>
          <p className="text-gray-600 mb-4">
            This brief assessment helps us understand your learning style and AI comfort level. 
            Your responses will be used to create a personalized learning path and provide tailored 
            recommendations to help you effectively adapt to AI technologies.
          </p>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <p className="text-sm text-blue-800">
              <strong>Why take this assessment?</strong> Your answers will help us:
            </p>
            <ul className="mt-2 text-sm text-blue-700 space-y-1">
              <li>• Customize your learning experience</li>
              <li>• Match you with relevant resources and tools</li>
              <li>• Provide personalized AI adaptation strategies</li>
              <li>• Track your progress more effectively</li>
            </ul>
          </div>
          <div className="mt-6">
            <p className="text-gray-600">
              Question {currentQuestion + 1} of {allQuestions.length}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-4">
              <div
                className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                style={{ width: `${((currentQuestion + 1) / allQuestions.length) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {isMBTIQuestion && renderMBTIPreview()}

        <div className="mb-8">
          {isMBTIQuestion && (
            <div className="mb-4">
              <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
                MBTI Dimension: {(currentQuestionData as MBTIQuestion).dimension}
              </span>
            </div>
          )}
          
          <h2 className="text-xl font-semibold mb-4">{currentQuestionData.text}</h2>
          
          <div className="space-y-4">
            {isMBTIQuestion ? (
              (currentQuestionData as MBTIQuestion).options.map((option, index) => (
                <button
                  key={index}
                  onClick={() => handleAnswer(option)}
                  className={`w-full text-left p-6 rounded-lg border transition-all duration-200 ${
                    answers[currentQuestionData.id] === option
                      ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                      : 'border-gray-200 hover:border-indigo-600 hover:bg-indigo-50'
                  }`}
                >
                  <div className="flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-medium">{option}</span>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                    <p className="text-sm text-gray-600">
                      {(currentQuestionData as MBTIQuestion).descriptions[index]}
                    </p>
                  </div>
                </button>
              ))
            ) : (
              (currentQuestionData as AIQuestion).options.map((option, index) => (
                <div key={index} className="w-full">
                  <button
                    onClick={() => handleAnswer(option)}
                    className={`w-full text-left p-4 rounded-lg border transition-all duration-200 ${
                      answers[currentQuestionData.id] === option
                        ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 hover:border-indigo-600 hover:bg-indigo-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span>{option}</span>
                      <ChevronRight className="h-5 w-5 text-gray-400" />
                    </div>
                  </button>
                  
                  {option.includes("Other") && answers[currentQuestionData.id] === option && (
                    <div className="mt-2 p-3 border border-indigo-200 rounded-lg bg-indigo-50">
                      <div className="flex items-center">
                        <input
                          type="text"
                          value={customAnswers[currentQuestionData.id] || ''}
                          onChange={handleCustomAnswerChange}
                          placeholder="Please specify..."
                          className="flex-grow p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        />
                        <button
                          onClick={handleCustomAnswerSubmit}
                          className="ml-2 p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-300"
                          disabled={!customAnswers[currentQuestionData.id]}
                        >
                          Continue
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        <div className="flex justify-between items-center">
          {currentQuestion > 0 && (
            <button
              onClick={handleBack}
              className="flex items-center px-4 py-2 text-indigo-600 hover:text-indigo-800 transition-colors"
            >
              <ChevronLeft className="h-5 w-5 mr-1" />
              Previous Question
            </button>
          )}
          
          {currentQuestion === allQuestions.length - 1 && Object.keys(answers).length === allQuestions.length && (
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className={`ml-auto bg-indigo-600 text-white px-6 py-2 rounded-lg transition-colors ${
                isSaving ? 'bg-indigo-400 cursor-not-allowed' : 'hover:bg-indigo-700'
              }`}
            >
              {isSaving ? (
                <span className="flex items-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Saving...
                </span>
              ) : (
                'Complete Assessment'
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default Questionnaire;