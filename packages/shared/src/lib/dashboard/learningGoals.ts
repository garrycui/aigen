
import { 
  getLearningGoals, 
  updateLearningGoals, 
  tutorialCache 
} from '../common/cache';
import { generateTutorialTopics } from '../common/openai';
import { generateTutorial } from '../tutorial/tutorials';

export interface LearningGoal {
  id: string;
  title: string;
  description: string;
  progress: number;
  status: 'not_started' | 'in_progress' | 'completed';
  createdAt: Date;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export type Difficulty = 'beginner' | 'intermediate' | 'advanced';

export const fetchUserGoals = async (userId: string): Promise<LearningGoal[]> => {
  try {
    return await getLearningGoals(userId);
  } catch (error) {
    console.error('Error fetching learning goals:', error);
    throw new Error('Failed to load learning goals');
  }
};

export const createNewGoal = async (
  userId: string,
  currentGoals: LearningGoal[],
  newGoalData: { title: string, description: string, difficulty: Difficulty }
): Promise<LearningGoal[]> => {
  if (currentGoals.length >= 3) {
    throw new Error('You can only set up to 3 learning goals');
  }

  const newGoalObj: LearningGoal = {
    id: Date.now().toString(),
    title: newGoalData.title,
    description: newGoalData.description,
    progress: 0,
    status: 'not_started',
    createdAt: new Date(),
    difficulty: newGoalData.difficulty
  };

  // Create updated goals array with the new goal
  const updatedGoals = [...currentGoals, newGoalObj];
  
  // Update learning goals in cache
  await updateLearningGoals(userId, updatedGoals);

  return updatedGoals;
};

export const generateTutorialsForGoal = async (
  userId: string, 
  goalTitle: string, 
  goalDescription: string, 
  difficulty: Difficulty
): Promise<void> => {
  try {
    // Generate tutorial topics
    const topics = await generateTutorialTopics(goalTitle, goalDescription);
    
    // Limit to 3 tutorials per goal
    const selectedTopics = topics.slice(0, 3);
    
    // Generate a tutorial for each topic using the selected difficulty
    for (const topic of selectedTopics) {
      await generateTutorial(userId, topic, difficulty);
    }
    
    // Invalidate recommended tutorials cache
    if (userId) {
      const recommendedCacheKeys = tutorialCache.keys().filter(key => 
        key.includes(`recommended-tutorials-${userId}`)
      );
      
      if (recommendedCacheKeys.length > 0) {
        recommendedCacheKeys.forEach(key => tutorialCache.delete(key));
        console.log(`Invalidated ${recommendedCacheKeys.length} recommended tutorial cache entries for new goals`);
      }
    }
  } catch (error) {
    console.error('Error generating tutorials for goal:', error);
    throw error;
  }
};

export const updateGoalProgressById = async (
  userId: string, 
  goals: LearningGoal[], 
  goalId: string, 
  progress: number
): Promise<LearningGoal[]> => {
  const updatedGoals = goals.map(goal => {
    if (goal.id === goalId) {
      return {
        ...goal,
        progress,
        status: (progress === 100 ? 'completed' : 'in_progress') as 'completed' | 'in_progress'
      };
    }
    return goal;
  });

  await updateLearningGoals(userId, updatedGoals);
  return updatedGoals;
};

export const deleteGoalById = async (
  userId: string, 
  goals: LearningGoal[], 
  goalId: string
): Promise<LearningGoal[]> => {
  const updatedGoals = goals.filter(goal => goal.id !== goalId);
  await updateLearningGoals(userId, updatedGoals);
  return updatedGoals;
};