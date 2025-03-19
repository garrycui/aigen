import { useState } from 'react';
import { CheckCircle, XCircle, ArrowRight, RefreshCw, AlertCircle } from 'lucide-react';

interface QuizQuestion {
  id: number;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
}

interface QuizProps {
  questions: QuizQuestion[];
  onComplete: (score: number) => void;
}

const Quiz: React.FC<QuizProps> = ({ questions, onComplete }) => {
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<number, number>>({});
  const [showExplanation, setShowExplanation] = useState<Record<number, boolean>>({});
  const [score, setScore] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [showFinalReview, setShowFinalReview] = useState(false);
  const [incorrectAttempts, setIncorrectAttempts] = useState<Record<number, number[]>>({});

  const handleAnswerSelect = (answerIndex: number) => {
    const currentQuestionObj = questions[currentQuestion];
    const isCorrect = answerIndex === currentQuestionObj.correctAnswer;
    
    // If already selected the correct answer, do nothing
    if (selectedAnswers[currentQuestion] === currentQuestionObj.correctAnswer) {
      return;
    }
    
    // If selecting an answer for the first time
    if (selectedAnswers[currentQuestion] === undefined) {
      setSelectedAnswers(prev => ({
        ...prev,
        [currentQuestion]: answerIndex
      }));
      setShowExplanation(prev => ({
        ...prev,
        [currentQuestion]: true
      }));
      
      if (isCorrect) {
        setScore(prev => prev + 1);
      } else {
        // Track incorrect attempt
        setIncorrectAttempts(prev => ({
          ...prev,
          [currentQuestion]: [...(prev[currentQuestion] || []), answerIndex]
        }));
      }
    } 
    // If already made an incorrect choice and now selecting the correct answer
    else if (!isCorrect && selectedAnswers[currentQuestion] !== currentQuestionObj.correctAnswer) {
      // Track another incorrect attempt
      setIncorrectAttempts(prev => ({
        ...prev,
        [currentQuestion]: [...(prev[currentQuestion] || []), answerIndex]
      }));
      setSelectedAnswers(prev => ({
        ...prev,
        [currentQuestion]: answerIndex
      }));
    } 
    // If selecting the correct answer after previous incorrect attempt(s)
    else if (isCorrect && selectedAnswers[currentQuestion] !== currentQuestionObj.correctAnswer) {
      setSelectedAnswers(prev => ({
        ...prev,
        [currentQuestion]: answerIndex
      }));
      // Award partial credit for eventually getting it right
      // (Not incrementing the full score since it wasn't first try)
      setScore(prev => prev + 0.5);
    }
  };

  const handleNextQuestion = () => {
    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else if (!showFinalReview) {
      setShowFinalReview(true);
    } else {
      setIsCompleted(true);
      onComplete(score);
    }
  };

  const resetQuiz = () => {
    setCurrentQuestion(0);
    setSelectedAnswers({});
    setShowExplanation({});
    setScore(0);
    setIsCompleted(false);
    setShowFinalReview(false);
  };

  if (isCompleted) {
    const percentage = (score / questions.length) * 100;
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Quiz Complete!</h3>
        <div className="mb-6">
          <div className="flex items-center justify-center mb-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full border-8 border-indigo-100 flex items-center justify-center">
                <span className="text-3xl font-bold text-indigo-600">{percentage}%</span>
              </div>
              {percentage >= 70 ? (
                <CheckCircle className="absolute -top-2 -right-2 h-8 w-8 text-green-500" />
              ) : (
                <XCircle className="absolute -top-2 -right-2 h-8 w-8 text-red-500" />
              )}
            </div>
          </div>
          <p className="text-center text-gray-600 mb-4">
            You got {score} out of {questions.length} questions correct!
          </p>
          {percentage >= 70 ? (
            <p className="text-center text-green-600 font-medium">Great job! You've passed the quiz!</p>
          ) : (
            <p className="text-center text-red-600 font-medium">Keep practicing to improve your score.</p>
          )}
        </div>
        <button
          onClick={resetQuiz}
          className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <RefreshCw className="h-5 w-5 mr-2" />
          Try Again
        </button>
      </div>
    );
  }

  if (showFinalReview) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-4">Review Your Answers</h3>
        <div className="space-y-6 mb-6">
          {questions.map((question, index) => {
            const selectedAnswer = selectedAnswers[index];
            const isCorrect = selectedAnswer === question.correctAnswer;
            return (
              <div key={index} className="p-4 rounded-lg border">
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-medium text-gray-900">Question {index + 1}</h4>
                  {isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <XCircle className="h-5 w-5 text-red-500" />
                  )}
                </div>
                <p className="text-gray-700 mb-2">{question.question}</p>
                <div className="space-y-2 mb-4">
                  {question.options.map((option, optIndex) => (
                    <div
                      key={optIndex}
                      className={`p-2 rounded ${
                        optIndex === question.correctAnswer
                          ? 'bg-green-50 border-green-500'
                          : optIndex === selectedAnswer
                          ? 'bg-red-50 border-red-500'
                          : 'bg-gray-50'
                      }`}
                    >
                      {option}
                    </div>
                  ))}
                </div>
                <div className="text-sm">
                  <p className={`font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                    {isCorrect ? 'Correct!' : 'Incorrect'}
                  </p>
                  <p className="text-gray-600 mt-1">{question.explanation}</p>
                </div>
              </div>
            );
          })}
        </div>
        <button
          onClick={handleNextQuestion}
          className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          Complete Quiz
        </button>
      </div>
    );
  }

  const currentQ = questions[currentQuestion];
  const selectedAnswer = selectedAnswers[currentQuestion];
  const showingExplanation = showExplanation[currentQuestion];
  const incorrectOptions = incorrectAttempts[currentQuestion] || [];

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm font-medium text-gray-600">
            Question {currentQuestion + 1} of {questions.length}
          </span>
          <span className="text-sm font-medium text-gray-600">
            Score: {score}/{questions.length}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${((currentQuestion + 1) / questions.length) * 100}%` }}
          />
        </div>
      </div>

      <h3 className="text-lg font-medium text-gray-900 mb-4">{currentQ.question}</h3>

      <div className="space-y-3 mb-6">
        {currentQ.options.map((option, index) => {
          const isSelected = selectedAnswer === index;
          const isCorrect = index === currentQ.correctAnswer;
          const wasIncorrect = incorrectOptions.includes(index);
          const showResult = showingExplanation && (isSelected || isCorrect);
          const canStillSelect = showingExplanation && !isCorrect && !wasIncorrect && selectedAnswer !== currentQ.correctAnswer;

          return (
            <button
              key={index}
              onClick={() => handleAnswerSelect(index)}
              disabled={showingExplanation && (isCorrect || wasIncorrect || selectedAnswer === currentQ.correctAnswer)}
              className={`w-full text-left p-4 rounded-lg border-2 transition-all duration-200 ${
                !showResult && !wasIncorrect
                  ? canStillSelect
                    ? 'border-indigo-300 bg-indigo-50 hover:border-indigo-600'
                    : 'border-gray-200 hover:border-indigo-600 hover:bg-indigo-50'
                  : isCorrect
                  ? 'border-green-500 bg-green-50'
                  : isSelected || wasIncorrect
                  ? 'border-red-500 bg-red-50'
                  : showingExplanation && !canStillSelect
                  ? 'border-gray-200 opacity-50'
                  : 'border-gray-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span>{option}</span>
                {showResult ? (
                  isCorrect ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    isSelected && <XCircle className="h-5 w-5 text-red-500" />
                  )
                ) : (
                  wasIncorrect && <XCircle className="h-5 w-5 text-red-500" />
                )}
              </div>
              {showingExplanation && canStillSelect && (
                <p className="text-xs mt-1 text-indigo-600">You can still select this answer</p>
              )}
            </button>
          );
        })}
      </div>

      {showingExplanation && (
        <div className={`p-4 rounded-lg mb-6 ${
          selectedAnswer === currentQ.correctAnswer ? 'bg-green-50' : 'bg-indigo-50'
        }`}>
          <div className="flex items-start">
            <AlertCircle className={`h-5 w-5 mr-2 mt-0.5 ${
              selectedAnswer === currentQ.correctAnswer ? 'text-green-500' : 'text-indigo-500'
            }`} />
            <div>
              {selectedAnswer === currentQ.correctAnswer ? (
                <p className="font-medium text-green-700">Correct!</p>
              ) : (
                <div>
                  <p className="font-medium text-indigo-700">
                    {incorrectOptions.length > 0 ? "Try again!" : "Incorrect"}
                  </p>
                  {incorrectOptions.length > 0 && selectedAnswer !== currentQ.correctAnswer && (
                    <p className="text-sm text-indigo-600 mt-1">Select the correct answer</p>
                  )}
                </div>
              )}
              <p className="text-gray-600 mt-1">{currentQ.explanation}</p>
            </div>
          </div>
        </div>
      )}

      {(selectedAnswer === currentQ.correctAnswer || (showingExplanation && incorrectOptions.length >= currentQ.options.length - 1)) && (
        <button
          onClick={handleNextQuestion}
          className="w-full flex items-center justify-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          {currentQuestion < questions.length - 1 ? (
            <>
              Next Question
              <ArrowRight className="h-5 w-5 ml-2" />
            </>
          ) : (
            'Review Answers'
          )}
        </button>
      )}
    </div>
  );
};

export default Quiz;