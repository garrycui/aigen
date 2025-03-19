import React from 'react';
import { X, Target, CheckCircle, Clock, BookOpen, MessageSquare } from 'lucide-react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';

interface ProgressModalProps {
  isOpen: boolean;
  onClose: () => void;
  progress: {
    assessment: boolean;
    goals: {
      total: number;
      completed: number;
    };
    tutorials: {
      total: number;
      completed: number;
    };
    posts: {
      total: number;
      published: number;
    };
  };
}

const ProgressModal: React.FC<ProgressModalProps> = ({ isOpen, onClose, progress }) => {
  if (!isOpen) return null;

  const totalProgress = Math.round(
    ((progress.assessment ? 1 : 0) +
      (progress.goals.completed / Math.max(progress.goals.total, 1)) +
      (progress.tutorials.completed / Math.max(progress.tutorials.total, 1)) +
      (progress.posts.published / Math.max(progress.posts.total, 1))) /
      4 *
      100
  );

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="fixed inset-0 bg-black/50 transition-opacity" onClick={onClose} />
        
        <div className="relative bg-white rounded-lg shadow-xl max-w-2xl w-full mx-auto">
          <div className="absolute right-4 top-4">
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-500"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Your Progress</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex justify-center">
                <div style={{ width: 200, height: 200 }}>
                  <CircularProgressbar
                    value={totalProgress}
                    text={`${totalProgress}%`}
                    styles={buildStyles({
                      pathColor: '#4f46e5',
                      textColor: '#4f46e5',
                      trailColor: '#e5e7eb'
                    })}
                  />
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-indigo-600 mr-2" />
                    <span>Assessment</span>
                  </div>
                  {progress.assessment ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-yellow-500" />
                  )}
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <Target className="h-5 w-5 text-indigo-600 mr-2" />
                    <span>Learning Goals</span>
                  </div>
                  <span className="font-medium">
                    {progress.goals.completed}/{progress.goals.total}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <BookOpen className="h-5 w-5 text-indigo-600 mr-2" />
                    <span>Tutorials</span>
                  </div>
                  <span className="font-medium">
                    {progress.tutorials.completed}/{progress.tutorials.total}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center">
                    <MessageSquare className="h-5 w-5 text-indigo-600 mr-2" />
                    <span>Forum Posts</span>
                  </div>
                  <span className="font-medium">
                    {progress.posts.published}/{progress.posts.total}
                  </span>
                </div>
              </div>
            </div>

            <div className="mt-6 p-4 bg-indigo-50 rounded-lg">
              <h3 className="font-medium text-indigo-900 mb-2">Next Steps</h3>
              <ul className="space-y-2 text-sm text-indigo-800">
                {!progress.assessment && (
                  <li>• Complete your AI adaptation assessment</li>
                )}
                {progress.goals.completed < progress.goals.total && (
                  <li>• Set and work on your learning goals</li>
                )}
                {progress.tutorials.completed < progress.tutorials.total && (
                  <li>• Complete more tutorials to enhance your skills</li>
                )}
                {progress.posts.published < progress.posts.total && (
                  <li>• Share your experiences in the community forum</li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProgressModal;