import React from 'react';
import {CheckCircle, Code } from 'lucide-react';
import { Tutorial, TutorialPreview } from '../../lib/tutorial/tutorials';
import { m } from 'framer-motion';
import { animations } from '../../lib/common/motion';
import { useAnimation } from '../common/AnimationProvider';

interface TutorialCardProps {
  tutorial: Tutorial | TutorialPreview;
  onClick: (tutorialId: string) => void;
  isCompleted?: boolean;
}

const TutorialCard: React.FC<TutorialCardProps> = ({ tutorial, onClick, isCompleted = false }) => {
  const { prefersReducedMotion } = useAnimation();
  
  const cardVariants = {
    hover: {
      y: prefersReducedMotion ? 0 : -5,
      boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
      transition: { duration: 0.3 }
    },
    tap: {
      scale: prefersReducedMotion ? 1 : 0.98,
      transition: { duration: 0.1 }
    }
  };
  
  const iconVariants = {
    hover: {
      rotate: prefersReducedMotion ? 0 : [0, -10, 10, -5, 0],
      transition: { duration: 0.5 }
    }
  };

  return (
    <m.div 
      className="bg-white rounded-2xl shadow-lg cursor-pointer relative border border-gray-200 overflow-hidden"
      onClick={() => onClick(tutorial.id)}
      variants={{...cardVariants, ...animations.fadeIn}}
      whileHover="hover"
      whileTap="tap"
      initial="hidden"
      animate="visible"
    >
      {isCompleted && (
        <m.span
          className="absolute top-2 right-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full flex items-center z-10"
          variants={iconVariants}
          whileHover="hover"
        >
          <CheckCircle className="h-4 w-4 mr-1" /> Completed
        </m.span>
      )}
      
      {tutorial.introImageUrl && (
        <div className="relative h-44">
          <img 
            src={tutorial.introImageUrl} 
            alt="Tutorial cover" 
            className="w-full h-full object-cover"
          />
          {tutorial.isCodingTutorial && (
            <m.div
              className="absolute bottom-2 right-2 bg-black/70 text-white px-2 py-1 rounded-lg flex items-center text-xs"
              whileHover={{ scale: prefersReducedMotion ? 1 : 1.1 }}
            >
              <Code className="h-3 w-3 mr-1" /> Code Examples
            </m.div>
          )}
        </div>
      )}
      
      <div className="p-5">
        <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{tutorial.title}</h3>
        <p className="text-gray-600 text-sm mb-4 line-clamp-2">{tutorial.content.slice(0, 100)}...</p>
        
        {/* Bottom section */}
        <div className="flex items-center justify-between">
          {/* Difficulty badge */}
          <span className={`text-xs px-2 py-1 rounded-full ${
            tutorial.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
            tutorial.difficulty === 'intermediate' ? 'bg-blue-100 text-blue-800' :
            'bg-purple-100 text-purple-800'
          }`}>
            {(tutorial.difficulty || 'beginner').charAt(0).toUpperCase() + (tutorial.difficulty || 'beginner').slice(1)}
          </span>
          
          <span className="text-xs text-gray-500">{tutorial.estimatedMinutes} min</span>
        </div>
        
        {tutorial.resources && (tutorial.resources.webLinks.length > 0 || tutorial.resources.videos.length > 0) && (
          <div className="mt-4 flex flex-wrap gap-2">
            {tutorial.resources.webLinks.length > 0 && (
              <m.span 
                className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded"
                whileHover={{ y: -2 }}
              >
                {tutorial.resources.webLinks.length} Resources
              </m.span>
            )}
            {tutorial.resources.videos.length > 0 && (
              <m.span 
                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded"
                whileHover={{ y: -2 }}
              >
                {tutorial.resources.videos.length} Videos
              </m.span>
            )}
          </div>
        )}
      </div>
    </m.div>
  );
};

export default TutorialCard;