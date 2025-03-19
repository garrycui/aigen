import React, { useState, useEffect } from 'react';
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { Smile, Meh, Frown, Tag, AlertTriangle, TrendingUp, TrendingDown, Minus, BookOpen, MessageSquare } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { saveMoodEntry, getMoodEntries, analyzeMoodEntries, getRecommendedResources, MoodEntry, MoodAnalysis } from '../../lib/mind/mindTracker';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const MOOD_OPTIONS = [
  { value: 'great', label: 'Great', icon: <Smile className="h-6 w-6 text-green-500" /> },
  { value: 'good', label: 'Good', icon: <Smile className="h-6 w-6 text-blue-500" /> },
  { value: 'okay', label: 'Okay', icon: <Meh className="h-6 w-6 text-yellow-500" /> },
  { value: 'down', label: 'Down', icon: <Frown className="h-6 w-6 text-orange-500" /> },
  { value: 'struggling', label: 'Struggling', icon: <Frown className="h-6 w-6 text-red-500" /> }
];

const COMMON_TAGS = [
  'work stress',
  'ai anxiety',
  'learning',
  'achievement',
  'overwhelmed',
  'motivated',
  'productive',
  'stuck',
  'progress',
  'challenged'
];

interface MoodTrackerProps {
  onClose: () => void;
  onUpdate: () => void;
}

const MoodTracker: React.FC<MoodTrackerProps> = ({ onClose, onUpdate }) => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [rating, setRating] = useState<number>(5);
  const [selectedMood, setSelectedMood] = useState<string>('okay');
  const [notes, setNotes] = useState<string>('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState<string>('');
  const [entries, setEntries] = useState<MoodEntry[]>([]);
  const [analysis, setAnalysis] = useState<MoodAnalysis | null>(null);
  const [resources, setResources] = useState<any>(null);
  const [view, setView] = useState<'entry' | 'history' | 'insights'>('entry');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (user) {
      loadMoodData();
    }
  }, [user]);

  const loadMoodData = async () => {
    try {
      if (!user) return;
      const moodEntries = await getMoodEntries(user.id);
      setEntries(moodEntries);
      
      if (moodEntries.length > 0) {
        const moodAnalysis = await analyzeMoodEntries(moodEntries);
        setAnalysis(moodAnalysis);
        
        if (moodAnalysis.riskLevel !== 'low') {
          const recommendedResources = await getRecommendedResources(user.id, moodAnalysis);
          setResources(recommendedResources);
        }
      }
    } catch (error) {
      console.error('Error loading mood data:', error);
    }
  };

  const handleSubmit = async () => {
    if (!user) return;

    try {
      setIsSubmitting(true);
      await saveMoodEntry(user.id, rating, selectedMood, notes, selectedTags);
      await loadMoodData();
      onUpdate();
      setView('insights');
    } catch (error) {
      console.error('Error saving mood entry:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleTagToggle = (tag: string) => {
    setSelectedTags(prev => 
      prev.includes(tag)
        ? prev.filter(t => t !== tag)
        : [...prev, tag]
    );
  };

  const handleAddCustomTag = () => {
    if (customTag.trim() && !selectedTags.includes(customTag.trim())) {
      setSelectedTags(prev => [...prev, customTag.trim()]);
      setCustomTag('');
    }
  };

  const chartData = {
    labels: entries.map(entry => 
      new Date(entry.createdAt.toDate()).toLocaleDateString()
    ).reverse(),
    datasets: [{
      label: 'Mood Rating',
      data: entries.map(entry => entry.rating).reverse(),
      fill: false,
      borderColor: 'rgb(99, 102, 241)',
      tension: 0.1
    }]
  };

  const renderTrendIcon = () => {
    if (!analysis) return null;
    
    switch (analysis.trend) {
      case 'improving':
        return <TrendingUp className="h-5 w-5 text-green-500" />;
      case 'declining':
        return <TrendingDown className="h-5 w-5 text-red-500" />;
      default:
        return <Minus className="h-5 w-5 text-gray-500" />;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Mind Tracker</h2>
        <div className="flex space-x-2">
          <button
            onClick={() => setView('entry')}
            className={`px-3 py-1 rounded-lg ${
              view === 'entry'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            New Entry
          </button>
          <button
            onClick={() => setView('history')}
            className={`px-3 py-1 rounded-lg ${
              view === 'history'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            History
          </button>
          <button
            onClick={() => setView('insights')}
            className={`px-3 py-1 rounded-lg ${
              view === 'insights'
                ? 'bg-indigo-100 text-indigo-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Insights
          </button>
        </div>
      </div>

      {view === 'entry' && (
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              How are you feeling? (1-10)
            </label>
            <input
              type="range"
              min="1"
              max="10"
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
            />
            <div className="flex justify-between text-sm text-gray-600 mt-1">
              <span>1</span>
              <span>5</span>
              <span>10</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Select your mood
            </label>
            <div className="grid grid-cols-5 gap-2">
              {MOOD_OPTIONS.map(mood => (
                <button
                  key={mood.value}
                  onClick={() => setSelectedMood(mood.value)}
                  className={`p-2 rounded-lg border-2 transition-colors ${
                    selectedMood === mood.value
                      ? 'border-indigo-600 bg-indigo-50'
                      : 'border-gray-200 hover:border-indigo-600'
                  }`}
                >
                  <div className="flex flex-col items-center">
                    {mood.icon}
                    <span className="text-sm mt-1">{mood.label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Add tags
            </label>
            <div className="flex flex-wrap gap-2 mb-2">
              {COMMON_TAGS.map(tag => (
                <button
                  key={tag}
                  onClick={() => handleTagToggle(tag)}
                  className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                    selectedTags.includes(tag)
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center">
                    <Tag className="h-3 w-3 mr-1" />
                    {tag}
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={customTag}
                onChange={(e) => setCustomTag(e.target.value)}
                placeholder="Add custom tag..."
                className="flex-1 px-3 py-1 border rounded-lg"
                onKeyPress={(e) => e.key === 'Enter' && handleAddCustomTag()}
              />
              <button
                onClick={handleAddCustomTag}
                className="px-3 py-1 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                Add
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="How are you feeling? What's on your mind?"
              className="w-full p-3 border rounded-lg"
              rows={4}
            />
          </div>

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:text-gray-900"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              {isSubmitting ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </div>
      )}

      {view === 'history' && (
        <div>
          <div className="bg-white rounded-lg p-4 mb-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Mood History</h3>
            <div className="h-64">
              <Line data={chartData} options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                  y: {
                    min: 1,
                    max: 10,
                    ticks: {
                      stepSize: 1
                    }
                  }
                }
              }} />
            </div>
          </div>

          <div className="space-y-4">
            {entries.map(entry => (
              <div key={entry.id} className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center">
                    {MOOD_OPTIONS.find(m => m.value === entry.mood)?.icon}
                    <span className="ml-2 font-medium">
                      Rating: {entry.rating}/10
                    </span>
                  </div>
                  <span className="text-sm text-gray-500">
                    {new Date(entry.createdAt.toDate()).toLocaleDateString()}
                  </span>
                </div>
                {entry.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {entry.tags.map(tag => (
                      <span key={tag} className="px-2 py-1 bg-gray-200 rounded-full text-xs">
                        {tag}
                      </span>
                    ))}
                  </div>
                )}
                {entry.notes && (
                  <p className="text-gray-600 text-sm">{entry.notes}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'insights' && analysis && (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Trend</h4>
                {renderTrendIcon()}
              </div>
              <p className="text-gray-600 capitalize">{analysis.trend}</p>
            </div>
            
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Average Rating</h4>
                <span className="text-indigo-600 font-medium">
                  {analysis.averageRating.toFixed(1)}/10
                </span>
              </div>
              <p className="text-gray-600">Past 7 days</p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">Risk Level</h4>
                <AlertTriangle className={`h-5 w-5 ${
                  analysis.riskLevel === 'high'
                    ? 'text-red-500'
                    : analysis.riskLevel === 'moderate'
                    ? 'text-yellow-500'
                    : 'text-green-500'
                }`} />
              </div>
              <p className="text-gray-600 capitalize">{analysis.riskLevel}</p>
            </div>
          </div>

          {analysis.commonTags.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Common Themes</h4>
              <div className="flex flex-wrap gap-2">
                {analysis.commonTags.map(tag => (
                  <span key={tag} className="px-3 py-1 bg-gray-200 rounded-full text-sm">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {analysis.suggestions.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Suggestions</h4>
              <ul className="space-y-2">
                {analysis.suggestions.map((suggestion, index) => (
                  <li key={index} className="flex items-center text-gray-600">
                    <span className="mr-2">•</span>
                    {suggestion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {resources && (resources.tutorials.length > 0 || resources.posts.length > 0) && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">Recommended Resources</h4>
              <div className="space-y-2">
                {resources.tutorials.map((tutorial: { id: string; title: string }) => (
                  <button
                    key={tutorial.id}
                    onClick={() => navigate(`/tutorials/${tutorial.id}`)}
                    className="w-full text-left p-3 rounded-lg bg-white hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <BookOpen className="h-5 w-5 text-indigo-600 mr-2" />
                      <span>{tutorial.title}</span>
                    </div>
                  </button>
                ))}
                {resources.posts.map((post: { id: string; title: string }) => (
                  <button
                    key={post.id}
                    onClick={() => navigate(`/forum/${post.id}`)}
                    className="w-full text-left p-3 rounded-lg bg-white hover:bg-indigo-50 transition-colors"
                  >
                    <div className="flex items-center">
                      <MessageSquare className="h-5 w-5 text-indigo-600 mr-2" />
                      <span>{post.title}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MoodTracker;