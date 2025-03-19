import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, ThumbsUp, Eye, Clock, Share2, Bookmark, Code, ChevronRight, ChevronLeft } from 'lucide-react';
import { doc, updateDoc, increment } from 'firebase/firestore'; // Remove unused imports
import { db } from '../../lib/common/firebase';
import { Tutorial, getTutorial } from '../../lib/tutorial/tutorials';
import { getUser, getUserSubcollectionDoc, updateUserSubcollectionDoc } from '../../lib/common/cache'; // Update imports
import { useAuth } from '../../context/AuthContext';
import ReactMarkdown from 'react-markdown';
import CodeEditor from '../../components/tutorial/CodeEditor';
import TutorialProgress from '../../components/tutorial/TutorialProgress';
import ResourceCard from '../../components/tutorial/ResourceCard';
import TutorialCelebration from '../../components/tutorial/TutorialCelebration';
import { markTutorialComplete } from '../../lib/dashboard/progress';

interface QuizAnswer {
  questionId: number;
  selectedAnswer: number;
}

const TutorialDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [tutorial, setTutorial] = useState<Tutorial | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [isBookmarked, setIsBookmarked] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);
  const [currentSection, setCurrentSection] = useState(0);
  const [completedSections, setCompletedSections] = useState<number[]>([]);
  const [timeSpent, setTimeSpent] = useState(0);
  const [showCodeEditor, setShowCodeEditor] = useState(false);
  const [quizAnswers, setQuizAnswers] = useState<QuizAnswer[]>([]);
  const [showQuiz, setShowQuiz] = useState(false);
  const [quizScore, setQuizScore] = useState<number | null>(null);
  const [currentQuizQuestion, setCurrentQuizQuestion] = useState(0);
  const [currentVideoIndex, setCurrentVideoIndex] = useState(0);
  const [currentWebIndex, setCurrentWebIndex] = useState(0);
  const [allSectionsCompleted, setAllSectionsCompleted] = useState(false);
  const [celebrationVisible, setCelebrationVisible] = useState(false);

  const handlePrevVideo = () => {
    if (!tutorial) return;
    setCurrentVideoIndex((prev) =>
      prev > 0 ? prev - 1 : tutorial.resources.videos.length - 1
    );
  };

  const handleNextVideo = () => {
    if (!tutorial) return;
    setCurrentVideoIndex((prev) =>
      prev < tutorial.resources.videos.length - 1 ? prev + 1 : 0
    );
  };

  const handlePrevWeb = () => {
    if (!tutorial) return;
    setCurrentWebIndex((prev) =>
      prev > 0 ? prev - 1 : tutorial.resources.webLinks.length - 1
    );
  };

  const handleNextWeb = () => {
    if (!tutorial) return;
    setCurrentWebIndex((prev) =>
      prev < tutorial.resources.webLinks.length - 1 ? prev + 1 : 0
    );
  };

  useEffect(() => {
    const loadTutorial = async () => {
      if (!id) return;

      try {
        setIsLoading(true);
        
        // Fetch tutorial data using cached method
        const tutorialData = await getTutorial(id);
        
        // Increment view count directly on Firestore (this is fine as it's tutorial data, not user data)
        await updateDoc(doc(db, 'tutorials', id), {
          views: increment(1)
        });

        // Get user's interaction status if logged in
        if (user) {
          // Use centralized user service to get tutorial interaction
          const interactionData = await getUserSubcollectionDoc(user.id, 'tutorialInteractions', id);
          
          if (interactionData && Object.keys(interactionData).length > 0) {
            setIsLiked(interactionData.liked || false);
            setIsBookmarked(interactionData.bookmarked || false);
            setCompletedSections(interactionData.completedSections || []);
            setTimeSpent(interactionData.timeSpent || 0);
            
            // If quiz answers exist, restore them
            if (interactionData.quizAnswers) {
              setQuizAnswers(interactionData.quizAnswers);
              setQuizScore(interactionData.quizScore || null);
            }
            
            // Check if all sections are completed
            const allCompleted = interactionData.completedSections && 
              interactionData.completedSections.length === tutorialData.sections.length;
            setAllSectionsCompleted(allCompleted);
            
            // Auto-show quiz if all sections are completed but quiz isn't passed yet
            if (allCompleted && !interactionData.quizPassed) {
              setShowQuiz(true);
            }

            // Show the user's first uncompleted section
            const firstUncompletedSection = tutorialData.sections.findIndex(
              (_: any, index: number) => !interactionData.completedSections.includes(index)
            );
            setCurrentSection(firstUncompletedSection !== -1 ? firstUncompletedSection : 0);
          }

          // Check if tutorial is marked as completed using centralized user service
          const userData = await getUser(user.id);
          const completed = userData?.completedTutorials || [];
          if (completed.includes(id)) {
            setIsCompleted(true);
          }
        }

        setTutorial(tutorialData);
      } catch (err) {
        console.error('Error loading tutorial:', err);
        setError('Failed to load tutorial');
      } finally {
        setIsLoading(false);
      }
    };

    loadTutorial();
  }, [id, user]);

  // Time tracking
  useEffect(() => {
    const timer = setInterval(() => {
      setTimeSpent(prev => prev + 1);
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, []);

  const handleLike = async () => {
    if (!user || !tutorial) return;

    try {
      // Update tutorial likes count (still direct as it's tutorial data)
      const tutorialRef = doc(db, 'tutorials', tutorial.id);
      await updateDoc(tutorialRef, {
        likes: increment(isLiked ? -1 : 1)
      });

      // Use centralized user service to update interaction
      await updateUserSubcollectionDoc(
        user.id, 
        'tutorialInteractions', 
        tutorial.id,
        { liked: !isLiked }
      );

      setIsLiked(!isLiked);
      setTutorial(prev => prev ? {
        ...prev,
        likes: prev.likes + (isLiked ? -1 : 1)
      } : null);
    } catch (error) {
      console.error('Error toggling like:', error);
    }
  };

  const handleBookmark = async () => {
    if (!user || !tutorial) return;

    try {
      // Use centralized user service to update interaction
      await updateUserSubcollectionDoc(
        user.id, 
        'tutorialInteractions', 
        tutorial.id,
        { bookmarked: !isBookmarked }
      );
      
      setIsBookmarked(!isBookmarked);
    } catch (error) {
      console.error('Error toggling bookmark:', error);
    }
  };

  const handleShare = async () => {
    if (!tutorial) return;

    try {
      await navigator.share({
        title: tutorial.title,
        text: 'Check out this tutorial on AI Adapt!',
        url: window.location.href
      });
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSectionComplete = async (sectionIndex: number) => {
    if (!user || !tutorial) return;

    try {
      // Simplify this function since updateUserSubcollectionDoc now handles document creation
      const updatedSections = [...completedSections, sectionIndex];
      
      await updateUserSubcollectionDoc(
        user.id,
        'tutorialInteractions',
        tutorial.id,
        {
          completedSections: updatedSections,
          timeSpent
        }
      );
      
      setCompletedSections(updatedSections);
      
      // Check if all sections are now completed
      const allCompleted = updatedSections.length === tutorial.sections.length;
      setAllSectionsCompleted(allCompleted);
      
      // Auto jump to the next uncompleted section or show quiz if all completed
      if (allCompleted) {
        setShowQuiz(true);
      } else {
        const nextSection = tutorial.sections.findIndex((_, index) => !updatedSections.includes(index));
        if (nextSection !== -1) {
          setCurrentSection(nextSection);
        }
      }
    } catch (error) {
      console.error('Error marking section as complete:', error);
    }
  };

  const handleQuizAnswer = async (questionId: number, selectedAnswer: number) => {
    if (!tutorial || !user) return;
    
    // Update the quiz answers
    const updatedAnswers = [...quizAnswers];
    const existingIndex = updatedAnswers.findIndex(a => a.questionId === questionId);
    
    if (existingIndex >= 0) {
      updatedAnswers[existingIndex] = { questionId, selectedAnswer };
    } else {
      updatedAnswers.push({ questionId, selectedAnswer });
    }
    
    setQuizAnswers(updatedAnswers);
    
    // Save quiz progress using centralized user service
    try {
      await updateUserSubcollectionDoc(
        user.id,
        'tutorialInteractions',
        tutorial.id,
        { quizAnswers: updatedAnswers }
      );
    } catch (error) {
      console.error('Error saving quiz progress:', error);
    }

    // If all questions are answered, calculate final score
    const allQuestionsAnswered = tutorial.quiz.questions.every((_, index) => {
      return updatedAnswers.some(a => a.questionId === index);
    });

    if (allQuestionsAnswered) {
      // Calculate score based on correct answers
      const correctAnswers = tutorial.quiz.questions.reduce((count, question, index) => {
        const answer = updatedAnswers.find(a => a.questionId === index);
        return answer && answer.selectedAnswer === question.correctAnswer ? count + 1 : count;
      }, 0);
      
      const score = (correctAnswers / tutorial.quiz.questions.length) * 100;
      setQuizScore(score);
      
      // Save the score using centralized user service
      try {
        const quizPassed = score >= tutorial.quiz.passingScore;
        
        await updateUserSubcollectionDoc(
          user.id,
          'tutorialInteractions',
          tutorial.id,
          {
            quizScore: score,
            quizPassed
          }
        );
        
        if (quizPassed) {
          // Use markTutorialComplete to update user's completed tutorials list
          // This function also handles cache invalidation
          await markTutorialComplete(user.id, tutorial.id);
          
          setIsCompleted(true);
          setCelebrationVisible(true);
        }
      } catch (error) {
        console.error('Error saving quiz results:', error);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-8"></div>
          <div className="h-8 bg-gray-200 rounded w-3/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-full"></div>
            <div className="h-4 bg-gray-200 rounded w-2/3"></div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !tutorial) {
    return (
      <div className="max-w-4xl mx-auto px-4">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'Tutorial not found'}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4">
      <TutorialCelebration 
        isVisible={celebrationVisible}
        onDismiss={() => setCelebrationVisible(false)}
        score={quizScore || 0}
      />
      
      <Link 
        to="/tutorials"
        className="inline-flex items-center text-indigo-600 hover:text-indigo-800 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to Tutorials
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <article className="bg-white rounded-lg shadow-md">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-800 text-sm font-medium rounded-full">
                  {tutorial.category}
                </span>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>{tutorial.estimatedMinutes} min read</span>
                  </div>
                  <div className="flex items-center text-gray-500">
                    <Eye className="h-4 w-4 mr-1" />
                    <span>{tutorial.views}</span>
                  </div>
                </div>
              </div>

              <h1 className="text-3xl font-bold text-gray-900 mb-4">
                {tutorial.title}
              </h1>

              {/* Show either sections or quiz */}
              {showQuiz ? (
                <div className="mt-8 border-t pt-8">
                  <h2 className="text-2xl font-bold mb-6">Knowledge Check</h2>
                  <div className="space-y-6">
                    <div className="bg-gray-50 p-6 rounded-lg">
                      <h3 className="font-medium mb-4">{tutorial.quiz.questions[currentQuizQuestion].question}</h3>
                      <div className="space-y-2">
                        {tutorial.quiz.questions[currentQuizQuestion].options.map((option, optionIndex) => {
                          const currentAnswer = quizAnswers.find(a => a.questionId === currentQuizQuestion);
                          const isSelected = currentAnswer?.selectedAnswer === optionIndex;
                          const isCorrect = optionIndex === tutorial.quiz.questions[currentQuizQuestion].correctAnswer;
                          const showResult = currentAnswer !== undefined;
                          const canChange = showResult && !isCorrect && currentAnswer.selectedAnswer !== tutorial.quiz.questions[currentQuizQuestion].correctAnswer;

                          return (
                            <button
                              key={optionIndex}
                              onClick={() => handleQuizAnswer(currentQuizQuestion, optionIndex)}
                              disabled={showResult && !canChange}
                              className={`w-full text-left p-3 rounded-lg border transition-colors ${
                                showResult
                                  ? isCorrect
                                    ? 'border-green-500 bg-green-50 text-green-700'
                                    : isSelected
                                    ? canChange
                                      ? 'border-red-500 bg-red-50 text-red-700 hover:bg-red-100'
                                      : 'border-red-500 bg-red-50 text-red-700'
                                    : 'border-gray-200 bg-gray-50 text-gray-500'
                                  : 'border-gray-200 hover:border-indigo-600'
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <span>{option}</span>
                                {showResult && (isCorrect || isSelected) && (
                                  <span className={`text-sm font-medium ${isCorrect ? 'text-green-600' : 'text-red-600'}`}>
                                    {isCorrect ? '✓ Correct' : '✗ Incorrect'}
                                  </span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                      {quizAnswers.find(a => a.questionId === currentQuizQuestion) !== undefined && (
                        <div className="mt-4 p-4 rounded-lg bg-gray-100">
                          <p className={`text-sm font-medium ${
                            quizAnswers.find(a => a.questionId === currentQuizQuestion)?.selectedAnswer === tutorial.quiz.questions[currentQuizQuestion].correctAnswer
                              ? 'text-green-600'
                              : 'text-red-600'
                          }`}>
                            {tutorial.quiz.questions[currentQuizQuestion].explanation}
                            {quizAnswers.find(a => a.questionId === currentQuizQuestion)?.selectedAnswer !== tutorial.quiz.questions[currentQuizQuestion].correctAnswer && (
                              <span className="block mt-2 text-indigo-600">
                                Try again! Select the correct answer.
                              </span>
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between">
                      <button
                        onClick={() => setCurrentQuizQuestion(prev => Math.max(0, prev - 1))}
                        disabled={currentQuizQuestion === 0}
                        className="px-4 py-2 text-gray-600 disabled:text-gray-400"
                      >
                        Previous
                      </button>
                      <button
                        onClick={() => setCurrentQuizQuestion(prev => Math.min(tutorial.quiz.questions.length - 1, prev + 1))}
                        disabled={currentQuizQuestion === tutorial.quiz.questions.length - 1}
                        className="px-4 py-2 text-gray-600 disabled:text-gray-400"
                      >
                        Next
                      </button>
                    </div>

                    {quizScore !== null && (
                      <div className={`p-4 rounded-lg ${
                        quizScore >= tutorial.quiz.passingScore
                          ? 'bg-green-50 text-green-800'
                          : 'bg-red-50 text-red-800'
                      }`}>
                        <p className="font-medium">Your Score: {Math.round(quizScore)}%</p>
                        <p>
                          {quizScore >= tutorial.quiz.passingScore
                            ? 'Congratulations! You have passed the quiz!'
                            : 'Keep trying! Select the correct answers to complete the quiz.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <>
                  {/* Section Navigation */}
                  <div className="flex justify-between items-center mb-6">
                    <button
                      onClick={() => setCurrentSection(prev => Math.max(0, prev - 1))}
                      disabled={currentSection === 0}
                      className="flex items-center text-indigo-600 disabled:text-gray-400"
                    >
                      <ChevronLeft className="h-5 w-5" />
                      Previous
                    </button>
                    <span className="text-gray-600">
                      Section {currentSection + 1} of {tutorial.sections.length}
                    </span>
                    <button
                      onClick={() => setCurrentSection(prev => Math.min(tutorial.sections.length - 1, prev + 1))}
                      disabled={currentSection === tutorial.sections.length - 1}
                      className="flex items-center text-indigo-600 disabled:text-gray-400"
                    >
                      Next
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Current Section Content */}
                  <div className="prose max-w-none mb-6">
                    <h2 className="text-2xl font-bold mb-4">{tutorial.sections[currentSection].title}</h2>
                    <ReactMarkdown
                      components={{
                        a: ({node, ...props}) => <a {...props} className="text-blue-600 hover:underline" />
                      }}
                    >
                      {tutorial.sections[currentSection].content}
                    </ReactMarkdown>
                  </div>

                  {/* Code Example */}
                  {tutorial.sections[currentSection].codeExample && (
                    <div className="mb-6">
                      <CodeEditor
                        initialCode={tutorial.sections[currentSection].codeExample}
                        language={tutorial.sections[currentSection].language || 'javascript'}
                        readOnly
                      />
                    </div>
                  )}

                  {/* Section Complete Button */}
                  {!completedSections.includes(currentSection) ? (
                    <button
                      onClick={() => handleSectionComplete(currentSection)}
                      className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 mb-6"
                    >
                      Complete Section
                    </button>
                  ) : (
                    <div className="w-full px-4 py-2 bg-green-100 text-green-800 rounded-lg mb-6 text-center">
                      Section Completed
                    </div>
                  )}
                </>
              )}

              {/* Show quiz button if all sections are completed but not showing quiz */}
              {allSectionsCompleted && !showQuiz && !isCompleted && (
                <button
                  onClick={() => setShowQuiz(true)}
                  className="w-full px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 mb-6"
                >
                  Take Knowledge Check Quiz
                </button>
              )}
              
              {/* Show return to sections button if viewing quiz */}
              {showQuiz && (
                <button
                  onClick={() => setShowQuiz(false)}
                  className="w-full mt-4 px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 mb-6"
                >
                  Return to Sections
                </button>
              )}

              {/* Action Buttons */}
              <div className="flex items-center justify-between border-t pt-4 mt-6">
                <div className="flex items-center space-x-4">
                  <button
                    onClick={handleLike}
                    className={`flex items-center space-x-1 ${
                      isLiked
                        ? 'text-indigo-600'
                        : 'text-gray-500 hover:text-indigo-600'
                    }`}
                  >
                    <ThumbsUp className={`h-5 w-5 ${isLiked ? 'fill-current' : ''}`} />
                    <span>{tutorial.likes}</span>
                  </button>
                  <button
                    onClick={handleBookmark}
                    className={`flex items-center space-x-1 ${
                      isBookmarked
                        ? 'text-indigo-600'
                        : 'text-gray-500 hover:text-indigo-600'
                    }`}
                  >
                    <Bookmark className={`h-5 w-5 ${isBookmarked ? 'fill-current' : ''}`} />
                    <span>Save</span>
                  </button>
                  <button
                    onClick={handleShare}
                    className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600"
                  >
                    <Share2 className="h-5 w-5" />
                    <span>Share</span>
                  </button>
                  {tutorial.isCodingTutorial && (
                    <button
                      onClick={() => setShowCodeEditor(!showCodeEditor)}
                      className="flex items-center space-x-1 text-gray-500 hover:text-indigo-600"
                    >
                      <Code className="h-5 w-5" />
                      <span>Code Editor</span>
                    </button>
                  )}
                </div>
                <div className="text-sm text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded text-xs font-medium">
                    {tutorial.difficulty}
                  </span>
                </div>
              </div>
            </div>
          </article>

          {/* Video Tutorials Section */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Video Tutorials</h2>
            {tutorial?.resources.videos[currentVideoIndex] && (
              <div className="relative">
                <iframe
                  src={tutorial.resources.videos[currentVideoIndex].url}
                  title={tutorial.resources.videos[currentVideoIndex].title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-96 rounded-lg mb-4"
                ></iframe>
                <button
                  onClick={handlePrevVideo}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextVideo}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                <ResourceCard
                  type="video"
                  title={tutorial.resources.videos[currentVideoIndex].title}
                  description={tutorial.resources.videos[currentVideoIndex].description}
                  url={tutorial.resources.videos[currentVideoIndex].url}
                  thumbnail={tutorial.resources.videos[currentVideoIndex].thumbnail}
                />
                {/* Dots for Video */}
                <div className="flex justify-center mt-4 space-x-2">
                  {tutorial.resources.videos.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentVideoIndex(i)}
                      className={`h-2 w-2 rounded-full cursor-pointer ${
                        currentVideoIndex === i ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Web Tutorials Section */}
          <div className="mt-8">
            <h2 className="text-xl font-bold mb-4">Web Tutorials</h2>
            {tutorial?.resources.webLinks[currentWebIndex] && (
              <div className="relative">
                <ResourceCard
                  type="web"
                  title={tutorial.resources.webLinks[currentWebIndex].title}
                  description={tutorial.resources.webLinks[currentWebIndex].description}
                  url={tutorial.resources.webLinks[currentWebIndex].url}
                  thumbnail={tutorial.resources.webLinks[currentWebIndex].thumbnail}
                />
                <button
                  onClick={handlePrevWeb}
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  onClick={handleNextWeb}
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-gradient-to-br from-indigo-500 to-purple-500 text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
                {/* Dots for Web */}
                <div className="flex justify-center mt-4 space-x-2">
                  {tutorial.resources.webLinks.map((_, i) => (
                    <div
                      key={i}
                      onClick={() => setCurrentWebIndex(i)}
                      className={`h-2 w-2 rounded-full cursor-pointer ${
                        currentWebIndex === i ? 'bg-indigo-600' : 'bg-gray-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          <TutorialProgress
            tutorial={tutorial}
            currentSection={currentSection}
            completedSections={completedSections}
            timeSpent={timeSpent}
          />

          {showCodeEditor && (
            <div className="sticky top-6">
              <CodeEditor
                language={tutorial.sections[currentSection].language || 'javascript'}
                onClose={() => setShowCodeEditor(false)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TutorialDetail;