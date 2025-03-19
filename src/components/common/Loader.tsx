import React from 'react';
import { motion } from 'framer-motion';

interface LoaderProps {
  variant?: 'fullPage' | 'inline' | 'neural' | 'pulse' | 'skeleton';
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  className?: string;
}

const Loader: React.FC<LoaderProps> = ({
  variant = 'pulse',
  size = 'md',
  text,
  className = '',
}) => {
  // Size mappings for different loader variants
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
  };

  // Text size mappings
  const textSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  // Basic spinner loader
  if (variant === 'inline') {
    return (
      <div className={`flex items-center justify-center ${className}`}>
        <div className={`animate-spin rounded-full border-b-2 border-indigo-600 ${sizeClasses[size]}`}></div>
        {text && <p className={`ml-3 ${textSizes[size]} text-indigo-600`}>{text}</p>}
      </div>
    );
  }

  // Full page loader
  if (variant === 'fullPage') {
    return (
      <div className="fixed inset-0 bg-gray-50 bg-opacity-90 flex items-center justify-center z-50 backdrop-blur-sm">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            className={`mx-auto border-t-4 border-b-4 border-indigo-500 rounded-full ${sizeClasses[size]}`}
          />
          {text && (
            <motion.p 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.3 }}
              className="mt-4 text-indigo-700 font-medium"
            >
              {text}
            </motion.p>
          )}
        </div>
      </div>
    );
  }

  // AI Neural Network Animation
  if (variant === 'neural') {
    const nodeCount = 6;
    const nodes = Array.from({ length: nodeCount });
    
    return (
      <div className={`flex flex-col items-center ${className}`}>
        <div className="relative">
          {nodes.map((_, i) => (
            <motion.div
              key={i}
              className={`absolute rounded-full bg-indigo-500 ${i % 2 === 0 ? 'bg-indigo-500' : 'bg-purple-500'}`}
              initial={{ scale: 0.5, opacity: 0.3 }}
              animate={{
                scale: [0.5, 1, 0.5],
                opacity: [0.3, 0.8, 0.3],
                x: Math.sin(i / nodes.length * Math.PI * 2) * 20,
                y: Math.cos(i / nodes.length * Math.PI * 2) * 20,
              }}
              transition={{
                duration: 3,
                repeat: Infinity,
                delay: i * 0.2,
                repeatType: "reverse"
              }}
              style={{
                width: size === 'sm' ? 8 : size === 'md' ? 12 : 16,
                height: size === 'sm' ? 8 : size === 'md' ? 12 : 16,
                top: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
                left: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
              }}
            />
          ))}
          <motion.div
            className="rounded-full bg-indigo-600 z-10 absolute"
            style={{
              width: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
              height: size === 'sm' ? 16 : size === 'md' ? 24 : 32,
              top: size === 'sm' ? 12 : size === 'md' ? 18 : 24,
              left: size === 'sm' ? 12 : size === 'md' ? 18 : 24,
            }}
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          />
        </div>
        {text && <p className={`mt-12 ${textSizes[size]} text-indigo-700`}>{text}</p>}
      </div>
    );
  }

  // Pulse Animation (default)
  if (variant === 'pulse') {
    return (
      <div className={`flex flex-col items-center justify-center ${className}`}>
        <div className="relative">
          <motion.div
            className="absolute inset-0 rounded-full bg-indigo-500 opacity-30"
            animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0.1, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <motion.div
            className={`rounded-full bg-indigo-600 ${sizeClasses[size]} flex items-center justify-center`}
          >
            <svg
              className="w-1/2 h-1/2 text-white"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 10V3L4 14h7v7l9-11h-7z"
              />
            </svg>
          </motion.div>
        </div>
        {text && <p className={`mt-4 ${textSizes[size]} text-indigo-700`}>{text}</p>}
      </div>
    );
  }

  // Skeleton loader (for content placeholders)
  if (variant === 'skeleton') {
    return (
      <div className={`animate-pulse ${className}`}>
        <div className="h-2.5 bg-gray-200 rounded-full w-3/4 mb-2.5"></div>
        <div className="h-2.5 bg-gray-200 rounded-full w-full mb-2.5"></div>
        <div className="h-2.5 bg-gray-200 rounded-full w-5/6 mb-2.5"></div>
        <div className="h-2.5 bg-gray-200 rounded-full w-2/3"></div>
      </div>
    );
  }

  // Default fallback
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`animate-spin rounded-full border-b-2 border-indigo-600 ${sizeClasses[size]}`}></div>
    </div>
  );
};

export default Loader;