import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { BookOpen, CheckCircle, Clock, Code } from 'lucide-react';
import { Tutorial } from '../../lib/tutorial/tutorials';

interface TutorialProgressProps {
  tutorial: Tutorial;
  currentSection: number;
  completedSections: number[];
  timeSpent: number;
}

const TutorialProgress: React.FC<TutorialProgressProps> = ({
  tutorial,
  currentSection,
  completedSections,
  timeSpent
}) => {
  const progress = (completedSections.length / tutorial.sections.length) * 100;
  const timeProgress = Math.min((timeSpent / tutorial.estimatedMinutes) * 100, 100);

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="grid grid-cols-3 gap-6">
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3">
            <CircularProgressbar
              value={progress}
              text={`${Math.round(progress)}%`}
              styles={buildStyles({
                pathColor: '#4f46e5',
                textColor: '#4f46e5',
                trailColor: '#e5e7eb'
              })}
            />
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <BookOpen className="h-4 w-4 mr-1" />
            <span>Overall Progress</span>
          </div>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3">
            <CircularProgressbar
              value={(currentSection / tutorial.sections.length) * 100}
              text={`${currentSection}/${tutorial.sections.length}`}
              styles={buildStyles({
                pathColor: '#4f46e5',
                textColor: '#4f46e5',
                trailColor: '#e5e7eb'
              })}
            />
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <CheckCircle className="h-4 w-4 mr-1" />
            <span>Current Section</span>
          </div>
        </div>

        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3">
            <CircularProgressbar
              value={timeProgress}
              text={`${timeSpent}m`}
              styles={buildStyles({
                pathColor: '#4f46e5',
                textColor: '#4f46e5',
                trailColor: '#e5e7eb'
              })}
            />
          </div>
          <div className="flex items-center justify-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-1" />
            <span>Time Spent</span>
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>Section Progress</span>
          <span>{completedSections.length}/{tutorial.sections.length} Complete</span>
        </div>
        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-indigo-600 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {tutorial.isCodingTutorial && (
        <div className="mt-4 p-3 bg-gray-50 rounded-lg flex items-center">
          <Code className="h-5 w-5 text-indigo-600 mr-2" />
          <span className="text-sm text-gray-700">
            This tutorial includes interactive code examples
          </span>
        </div>
      )}

      {tutorial.resources && (
        <div className="mt-4 grid grid-cols-2 gap-4">
          {tutorial.resources.webLinks.length > 0 && (
            <div className="p-3 bg-blue-50 rounded-lg">
              <span className="text-sm font-medium text-blue-700">
                {tutorial.resources.webLinks.length} Web Tutorials
              </span>
            </div>
          )}
          {tutorial.resources.videos.length > 0 && (
            <div className="p-3 bg-red-50 rounded-lg">
              <span className="text-sm font-medium text-red-700">
                {tutorial.resources.videos.length} Video Tutorials
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TutorialProgress;