import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Target, Plus, Trash2, BookOpen, Target as TargetIcon, Sparkles } from 'lucide-react';
import { useAuth } from '@context/AuthContext';
import { 
  LearningGoal, 
  Difficulty,
  fetchUserGoals,
  createNewGoal,
  generateTutorialsForGoal,
  updateGoalProgressById,
  deleteGoalById
} from '@shared/lib/dashboard/learningGoals';

const LearningGoals = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [goals, setGoals] = useState<LearningGoal[]>([]);
  const [isAddingGoal, setIsAddingGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({ 
    title: '', 
    description: '', 
    difficulty: 'intermediate' as Difficulty 
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    loadGoals();
  }, [user]);

  const loadGoals = async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      const userGoals = await fetchUserGoals(user.id);
      setGoals(userGoals);
      setError(null);
    } catch (error) {
      console.error('Error loading goals:', error);
      setError('Failed to load learning goals');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddGoal = async () => {
    if (!user) return;
    if (goals.length >= 3) {
      setError('You can only set up to 3 learning goals');
      return;
    }

    try {
      setIsLoading(true);
      
      // Optimistically update UI first
      const optimisticNewGoal: LearningGoal = {
        id: Date.now().toString(),
        title: newGoal.title,
        description: newGoal.description,
        progress: 0,
        status: 'not_started',
        createdAt: new Date(),
        difficulty: newGoal.difficulty
      };
      
      const optimisticGoals = [...goals, optimisticNewGoal];
      setGoals(optimisticGoals);
      
      // Reset form
      setNewGoal({ title: '', description: '', difficulty: 'intermediate' });
      setIsAddingGoal(false);
      setError(null);
      
      // Actually create the goal in the background
      const updatedGoals = await createNewGoal(user.id, goals, {
        title: optimisticNewGoal.title,
        description: optimisticNewGoal.description,
        difficulty: optimisticNewGoal.difficulty
      });
      
      // Start generating tutorials in the background (don't await)
      generateTutorialsForGoal(
        user.id,
        optimisticNewGoal.title,
        optimisticNewGoal.description,
        optimisticNewGoal.difficulty
      ).catch(err => {
        console.error('Background tutorial generation failed:', err);
        // We don't show errors for background processes to the user
      });
      
    } catch (err: any) {
      console.error('Error adding goal:', err);
      setError(err.message || 'Failed to add learning goal');
      // Revert optimistic update if it failed
      loadGoals();
    } finally {
      setIsLoading(false);
    }
  };

  const updateGoalProgress = async (goalId: string, progress: number) => {
    if (!user) return;
    try {
      setIsLoading(true);
      
      // Optimistically update UI first
      const optimisticGoals = goals.map(goal => {
        if (goal.id === goalId) {
          return {
            ...goal,
            progress,
            status: (progress === 100 ? 'completed' : 'in_progress') as 'completed' | 'in_progress'
          };
        }
        return goal;
      });
      
      setGoals(optimisticGoals);
      
      // Update in the background
      await updateGoalProgressById(user.id, goals, goalId, progress);
      setError(null);
    } catch (error) {
      console.error('Error updating goal progress:', error);
      setError('Failed to update goal progress');
      // Revert optimistic update if it failed
      loadGoals();
    } finally {
      setIsLoading(false);
    }
  };

  const deleteGoal = async (goalId: string) => {
    if (!user) return;
    try {
      setIsLoading(true);
      
      // Optimistically update UI first
      const optimisticGoals = goals.filter(goal => goal.id !== goalId);
      setGoals(optimisticGoals);
      
      // Delete in the background
      await deleteGoalById(user.id, goals, goalId);
      setError(null);
    } catch (error) {
      console.error('Error deleting goal:', error);
      setError('Failed to delete goal');
      // Revert optimistic update if it failed
      loadGoals();
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackToDashboard = () => {
    navigate('/dashboard', { state: { fromGoals: true } });
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Learning Goals</h1>
          <p className="text-gray-600">Set and track your AI learning journey</p>
        </div>
        <button
          onClick={handleBackToDashboard}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
        >
          Back to Dashboard
        </button>
      </div>
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-6">
          {goals.length < 3 && (
            <button
              onClick={() => setIsAddingGoal(true)}
              className="flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              disabled={isLoading}
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Goal
            </button>
          )}
        </div>

        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
            {error}
          </div>
        )}

        {isAddingGoal && (
          <div className="mb-6 p-4 border border-gray-200 rounded-lg">
            <h3 className="text-lg font-medium text-gray-900 mb-4">New Learning Goal</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Goal Title
                </label>
                <input
                  type="text"
                  value={newGoal.title}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  placeholder="e.g., Master ChatGPT Prompting"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={newGoal.description}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  rows={3}
                  placeholder="Describe what you want to achieve..."
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Your Experience Level
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setNewGoal(prev => ({ ...prev, difficulty: 'beginner' }))}
                    className={`flex items-center p-3 rounded-lg border-2 ${
                      newGoal.difficulty === 'beginner' 
                        ? 'border-indigo-600 bg-indigo-50' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <BookOpen className="h-5 w-5 text-green-500 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Beginner</div>
                      <div className="text-xs text-gray-500">New to this topic</div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setNewGoal(prev => ({ ...prev, difficulty: 'intermediate' }))}
                    className={`flex items-center p-3 rounded-lg border-2 ${
                      newGoal.difficulty === 'intermediate' 
                        ? 'border-indigo-600 bg-indigo-50' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <TargetIcon className="h-5 w-5 text-blue-500 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Intermediate</div>
                      <div className="text-xs text-gray-500">Some knowledge</div>
                    </div>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setNewGoal(prev => ({ ...prev, difficulty: 'advanced' }))}
                    className={`flex items-center p-3 rounded-lg border-2 ${
                      newGoal.difficulty === 'advanced' 
                        ? 'border-indigo-600 bg-indigo-50' 
                        : 'border-gray-200 hover:border-indigo-300'
                    }`}
                  >
                    <Sparkles className="h-5 w-5 text-purple-500 mr-2" />
                    <div className="text-left">
                      <div className="font-medium">Advanced</div>
                      <div className="text-xs text-gray-500">Experienced user</div>
                    </div>
                  </button>
                </div>
              </div>
              
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setIsAddingGoal(false)}
                  className="px-4 py-2 text-gray-700 hover:text-gray-900"
                  disabled={isLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddGoal}
                  disabled={!newGoal.title || !newGoal.description || isLoading}
                  className={`px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 
                    ${isLoading ? 'opacity-70 cursor-not-allowed' : ''}`}
                >
                  {isLoading ? 'Saving...' : 'Save Goal'}
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {goals.map((goal) => (
            <div key={goal.id} className="p-4 border border-gray-200 rounded-lg">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">{goal.title}</h3>
                  <p className="text-gray-600">{goal.description}</p>
                </div>
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => deleteGoal(goal.id)}
                    className="p-1 text-gray-500 hover:text-red-600"
                  >
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">Progress</span>
                  <span className="text-sm text-gray-600">{goal.progress}%</span>
                </div>
                <div className="relative pt-1">
                  <div className="flex mb-2 items-center justify-between">
                    <div>
                      <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                        {goal.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-200">
                    <div
                      style={{ width: `${goal.progress}%` }}
                      className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-indigo-600 transition-all duration-500"
                    ></div>
                  </div>
                  <div className="flex justify-between space-x-2">
                    {[0, 25, 50, 75, 100].map((progress) => (
                      <button
                        key={progress}
                        onClick={() => updateGoalProgress(goal.id, progress)}
                        className={`px-2 py-1 rounded ${
                          goal.progress >= progress
                            ? 'bg-indigo-600 text-white'
                            : 'bg-gray-200 text-gray-700'
                        }`}
                      >
                        {progress}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {goals.length === 0 && !isAddingGoal && (
            <div className="text-center py-12">
              <Target className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Learning Goals Set</h3>
              <p className="text-gray-600 mb-4">
                Set up to 3 learning goals to track your progress and get personalized recommendations.
              </p>
              <button
                onClick={() => setIsAddingGoal(true)}
                className="inline-flex items-center px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Your First Goal
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LearningGoals;