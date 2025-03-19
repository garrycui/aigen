
import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Award, Zap, Star, CheckCircle } from 'lucide-react';
import Confetti from 'react-confetti';

interface TutorialCelebrationProps {
  isVisible: boolean;
  onDismiss: () => void;
  score: number;
}

const TutorialCelebration: React.FC<TutorialCelebrationProps> = ({
  isVisible,
  onDismiss,
  score
}) => {
  const [windowSize, setWindowSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  
  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };
    
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  
  return (
    <AnimatePresence>
      {isVisible && (
        <>
          <Confetti
            width={windowSize.width}
            height={windowSize.height}
            recycle={false}
            numberOfPieces={200}
            gravity={0.15}
          />
          
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center">
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4 relative overflow-hidden"
            >
              {/* Stars animation */}
              <motion.div className="absolute top-4 right-4"
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
              >
                <Star className="h-6 w-6 text-yellow-400 fill-yellow-400" />
              </motion.div>
              
              <motion.div className="absolute bottom-4 left-4"
                animate={{ rotate: -360 }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              >
                <Star className="h-5 w-5 text-yellow-400 fill-yellow-400" />
              </motion.div>
              
              {/* Main content */}
              <div className="text-center">
                <motion.div 
                  initial={{ y: -20 }}
                  animate={{ y: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                  className="mb-6 flex justify-center"
                >
                  <div className="relative">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                      }}
                      transition={{ 
                        duration: 2,
                        repeat: Infinity,
                        repeatType: "reverse" 
                      }}
                      className="absolute inset-0 bg-indigo-100 rounded-full scale-125"
                    />
                    <Award className="h-20 w-20 text-indigo-600 relative z-10" />
                    <motion.div
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.5, duration: 0.5 }}
                      className="absolute -right-1 -top-1 bg-green-500 rounded-full p-1"
                    >
                      <CheckCircle className="h-5 w-5 text-white" />
                    </motion.div>
                  </div>
                </motion.div>
                
                <motion.h2
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="text-2xl font-bold text-gray-900 mb-2"
                >
                  Congratulations!
                </motion.h2>
                
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="text-gray-600 mb-4"
                >
                  You've successfully completed this tutorial with a score of {Math.round(score)}%
                </motion.p>
                
                <motion.div 
                  className="flex items-center justify-center gap-1 text-indigo-600 font-medium mb-6"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                >
                  <Zap className="h-4 w-4" />
                  <span>Knowledge unlocked!</span>
                  <Zap className="h-4 w-4" />
                </motion.div>
                
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.8 }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={onDismiss}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
                >
                  Continue Learning
                </motion.button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TutorialCelebration;