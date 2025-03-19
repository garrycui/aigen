import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { X, ArrowRight, ArrowLeft, Check, Bot, BookOpen, Heart, Users, LayoutDashboard, Target } from 'lucide-react';

interface TourStep {
  title: string;
  description: string;
  elementSelector: string;
  position: 'top' | 'bottom' | 'left' | 'right';
  icon?: React.ReactNode;
  isNavItem?: boolean;
}

interface TourGuideProps {
  onComplete: () => void;
  onSkip: () => void;
  isOpen: boolean;
}

interface HighlightRect {
  top: number;
  left: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
  x: number;
  y: number;
}

const TourGuide: React.FC<TourGuideProps> = ({ onComplete, onSkip, isOpen }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [highlight, setHighlight] = useState<HighlightRect | null>(null);
  const [overlayOpacity, setOverlayOpacity] = useState(0);
  const [elementNotFound, setElementNotFound] = useState(false);

  // Updated tour steps with more robust selectors
  const tourSteps: TourStep[] = [
    {
      title: 'Welcome to your AI journey!',
      description: "Let's explore all the amazing features we've built to help you thrive in the age of AI. Ready for a quick tour?",
      elementSelector: 'h1', // Simplified selector that will find the first h1 on the page
      position: 'bottom',
      icon: <LayoutDashboard className="h-5 w-5 text-indigo-600" />
    },
    {
      title: 'AI Companion',
      description: "Your friendly AI sidekick! Ask questions, get advice, or just chat about your day. It's like having a tech genius in your pocket.",
      elementSelector: 'nav a[href="/assistant"]',
      position: 'bottom',
      icon: <Bot className="h-5 w-5 text-indigo-600" />,
      isNavItem: true
    },
    {
      title: 'Tutorials Library',
      description: "Learning made fun! Explore personalized tutorials that match your style and goals. No boring stuff, promise.",
      elementSelector: 'nav a[href="/tutorials"]',
      position: 'bottom',
      icon: <BookOpen className="h-5 w-5 text-blue-600" />,
      isNavItem: true
    },
    {
      title: 'Mind Tracker',
      description: "Your digital wellness buddy! Track how AI affects your well-being and get tips to keep your tech-life balance just right.",
      elementSelector: 'nav a[href="/mind"]',
      position: 'bottom',
      icon: <Heart className="h-5 w-5 text-purple-600" />,
      isNavItem: true
    },
    {
      title: 'Community Hub',
      description: "You're not alone on this journey! Connect with fellow travelers, share stories, and learn from others adapting to the AI revolution.",
      elementSelector: 'nav a[href="/forum"]',
      position: 'bottom',
      icon: <Users className="h-5 w-5 text-green-600" />,
      isNavItem: true
    },
    {
      title: 'Your Progress Dashboard',
      description: "This is mission control! Track your completion rate, achievements, tutorials, and mind tracking all in one place.",
      elementSelector: '.grid-cols-1.md\\:grid-cols-2.lg\\:grid-cols-4.gap-6',
      position: 'bottom',
      icon: <Target className="h-5 w-5 text-indigo-600" />
    },
    {
      title: 'Recommended Tutorials',
      description: "Hand-picked just for you! These tutorials match your learning style and goals. Click on any that catch your eye to start learning!",
      elementSelector: 'tutorials-section',  // This is now just an identifier, not a real CSS selector
      position: 'top',
      icon: <BookOpen className="h-5 w-5 text-blue-600" />
    },
    {
      title: 'Set Your Learning Goals',
      description: "Click here to create personalized learning goals. We'll use these to build a custom learning path just for you!",
      elementSelector: 'learning-goals-link', // This is now just an identifier, not a real CSS selector
      position: 'left', // Changed to left for better visibility
      icon: <Target className="h-5 w-5 text-green-600" />
    }
  ];

  // Completely rewritten element finder with special cases for our problematic elements
  const findElement = (selector: string): Element | null => {
    // Handle special cases first
    if (selector === 'tutorials-section') {
      // Find tutorial section by content rather than selector
      // Look for all h2 elements
      const headings = Array.from(document.querySelectorAll('h2'));
      
      // Find the heading with "Recommended" text
      for (const heading of headings) {
        if (heading.textContent?.includes('Recommended')) {
          // Find the closest section or div that contains this heading
          const section = heading.closest('.bg-white.rounded-lg.shadow-md') || 
                        heading.closest('div[class*="bg-white"]') ||
                        heading.parentElement?.parentElement;
          
          // Return the section if found, otherwise the heading itself
          return section || heading;
        }
      }
      
      // Fallback: try to find a section with tutorials
      return document.querySelector('.bg-white.rounded-lg.shadow-md p-6');
    }
    
    if (selector === 'learning-goals-link') {
      // First try: direct link selector
      let learningGoalsLink = document.querySelector('a[href="/learning-goals"]');
      
      if (!learningGoalsLink) {
        // Second try: find by text content
        const allLinks = Array.from(document.querySelectorAll('a'));
        learningGoalsLink = allLinks.find(link => 
          link.textContent?.includes('Learning Goals') || 
          link.textContent?.includes('Set Learning Goals')
        ) || null;
      }
      
      return learningGoalsLink;
    }
    
    // For the first step (Welcome), look for any h1 in the main container
    if (selector === 'h1') {
      const h1Elements = document.querySelectorAll('h1');
      if (h1Elements.length > 0) {
        // Find the one that's about AI Adaptation Journey
        for (const h1 of h1Elements) {
          if (h1.textContent?.includes('AI') || h1.textContent?.includes('Journey')) {
            return h1;
          }
        }
        // If no specific match, return the first h1
        return h1Elements[0];
      }
    }
    
    // Regular selector handling for other steps
    try {
      return document.querySelector(selector);
    } catch (error) {
      console.error(`Invalid selector: ${selector}`);
      return null;
    }
  };

  // Improved highlight effect with better zoom handling
  useEffect(() => {
    if (!isOpen) {
      setOverlayOpacity(0);
      setElementNotFound(false);
      return;
    }
    
    setOverlayOpacity(0.7);
    
    // Check if currentStep is within bounds
    if (currentStep >= 0 && currentStep < tourSteps.length) {
      const currentTourStep = tourSteps[currentStep];
      const element = findElement(currentTourStep.elementSelector);
      
      if (element) {
        setElementNotFound(false);
        
        // Calculate element position relative to the document
        const rect = element.getBoundingClientRect();
        const scrollY = window.scrollY || document.documentElement.scrollTop;
        const scrollX = window.scrollX || document.documentElement.scrollLeft;
        
        // Set highlight with scroll-adjusted coordinates
        setHighlight({
          top: rect.top + scrollY,
          left: rect.left + scrollX,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom + scrollY,
          right: rect.right + scrollX,
          x: rect.x,
          y: rect.y
        });
        
        // Make sure the element is in view
        const windowHeight = window.innerHeight;
        const elementTop = rect.top;
        const elementBottom = rect.bottom;
        
        // Special handling for "Set Your Learning Goals" step
        if (currentTourStep.elementSelector === 'learning-goals-link') {
          // If element is partially out of view, scroll to make it visible with more space
          if (elementBottom > windowHeight - 250 || elementTop < 250) {
            const targetScroll = (rect.top + scrollY) - (windowHeight / 2);
            window.scrollTo({
              top: Math.max(0, targetScroll),
              behavior: 'smooth'
            });
          }
        } 
        // Default scrolling behavior for other steps
        else if (elementTop < 0 || elementBottom > windowHeight) {
          // Scroll to make the element centered in viewport when possible
          const targetScrollY = scrollY + elementTop - (windowHeight / 2) + (rect.height / 2);
          window.scrollTo({
            top: Math.max(0, targetScrollY),
            behavior: 'smooth'
          });
        }
      } else {
        // Handle case when element is not found
        setElementNotFound(true);
        console.error(`Element not found for step ${currentStep}: ${currentTourStep.elementSelector}`);
      }
    }
  }, [currentStep, isOpen]); // Remove tourSteps from dependencies - it's static

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    setOverlayOpacity(0);
    onComplete();
  };

  const handleSkip = () => {
    setOverlayOpacity(0);
    onSkip();
  };

  if (!isOpen) return null;

  const step = tourSteps[currentStep];
  
  // Improved tooltip positioning logic
  const getTooltipPosition = (): React.CSSProperties => {
    if (!highlight || elementNotFound) {
      // Default position for when element isn't found
      return {
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)'
      };
    }
    
    // Get viewport dimensions
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    const scrollY = window.scrollY || document.documentElement.scrollTop;
    
    // Fixed dimensions for tooltip
    const tooltipWidth = 350;
    const tooltipHeight = 250;
    
    // Position calculation based on step type
    const step = tourSteps[currentStep];
    
    // Special positioning for our problematic steps
    if (step.elementSelector === 'tutorials-section') {
      // Calculate position relative to the viewport
      const elementViewportTop = highlight.top - scrollY;
      
      // Position above the section with fixed offset
      return {
        position: 'fixed',
        top: `${Math.max(20, elementViewportTop - tooltipHeight - 20)}px`,
        left: `${Math.min(viewportWidth - tooltipWidth - 20, Math.max(20, highlight.left))}px`,
      };
    }
    
    if (step.elementSelector === 'learning-goals-link') {
      // Calculate position relative to the viewport
      const elementViewportTop = highlight.top - scrollY;
      const elementViewportLeft = highlight.left;
      
      // Check if element is in the bottom part of the screen
      const isNearBottom = elementViewportTop > viewportHeight * 0.6;
      
      // If near bottom of viewport, position tooltip above the element with larger offset
      // Otherwise position to the left with vertical centering
      if (isNearBottom) {
        return {
          position: 'fixed',
          top: `${Math.max(20, elementViewportTop - tooltipHeight - 40)}px`,
          left: `${Math.min(viewportWidth - tooltipWidth - 20, Math.max(20, elementViewportLeft))}px`,
        };
      } else {
        return {
          position: 'fixed',
          top: `${Math.max(20, Math.min(viewportHeight - tooltipHeight - 20, elementViewportTop - 100))}px`,
          left: `${Math.max(20, elementViewportLeft - tooltipWidth - 20)}px`,
        };
      }
    }
    
    // Standard positioning for other steps
    const elementViewportTop = highlight.top - scrollY;
    const elementViewportLeft = highlight.left;
    const elementWidth = highlight.width;
    const elementHeight = highlight.height;
    
    switch (step.position) {
      case 'top':
        return {
          position: 'fixed',
          top: `${Math.max(20, elementViewportTop - tooltipHeight - 20)}px`,
          left: `${Math.min(viewportWidth - tooltipWidth - 20, Math.max(20, elementViewportLeft + (elementWidth / 2) - (tooltipWidth / 2)))}px`,
        };
      case 'bottom':
        return {
          position: 'fixed',
          top: `${Math.min(viewportHeight - tooltipHeight - 20, elementViewportTop + elementHeight + 20)}px`,
          left: `${Math.min(viewportWidth - tooltipWidth - 20, Math.max(20, elementViewportLeft + (elementWidth / 2) - (tooltipWidth / 2)))}px`,
        };
      case 'left':
        return {
          position: 'fixed',
          top: `${Math.min(viewportHeight - tooltipHeight - 20, Math.max(20, elementViewportTop + (elementHeight / 2) - (tooltipHeight / 2)))}px`,
          left: `${Math.max(20, elementViewportLeft - tooltipWidth - 20)}px`,
        };
      case 'right':
        return {
          position: 'fixed',
          top: `${Math.min(viewportHeight - tooltipHeight - 20, Math.max(20, elementViewportTop + (elementHeight / 2) - (tooltipHeight / 2)))}px`,
          left: `${Math.min(viewportWidth - tooltipWidth - 20, elementViewportLeft + elementWidth + 20)}px`,
        };
      default:
        return {
          position: 'fixed',
          top: `${Math.min(viewportHeight - tooltipHeight - 20, elementViewportTop + elementHeight + 20)}px`,
          left: `${Math.min(viewportWidth - tooltipWidth - 20, Math.max(20, elementViewportLeft))}px`,
        };
    }
  };

  // Updated learning goals focused final step
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <>
      {/* Overlay */}
      <div 
        className="fixed inset-0 bg-black pointer-events-none transition-opacity duration-300 z-40"
        style={{ opacity: overlayOpacity }}
      />
      
      {/* Highlight element */}
      {highlight && !elementNotFound && (
        <div
          className="fixed rounded-lg box-content shadow-[0_0_0_9999px_rgba(0,0,0,0.7)] z-50 pointer-events-none transition-all duration-300"
          style={{
            top: `${highlight.top - window.scrollY}px`,
            left: `${highlight.left}px`,
            width: `${highlight.width}px`,
            height: `${highlight.height}px`,
          }}
        />
      )}
      
      {/* Tooltip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="fixed z-50 bg-white shadow-lg rounded-lg p-6 w-[350px]"
        style={getTooltipPosition()}
      >
        <button 
          className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600"
          onClick={handleSkip}
        >
          <X size={18} />
        </button>
        
        <div className="flex items-center mb-3">
          {step.icon || <Target className="h-5 w-5 text-indigo-600 mr-2" />}
          <h3 className="text-lg font-bold text-gray-800 ml-2">{step.title}</h3>
        </div>
        
        <p className="text-sm text-gray-600 mb-5">{step.description}</p>
        
        {isLastStep && (
          <div className="mb-4 bg-indigo-50 p-3 rounded-md">
            <p className="text-sm text-indigo-600 font-medium">
              You're all set! Click the "Set Learning Goals" link to start customizing your learning journey.
            </p>
          </div>
        )}
        
        <div className="flex items-center justify-between mt-4">
          <div className="flex space-x-1">
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full ${
                  currentStep === index ? 'bg-indigo-600' : 'bg-gray-300'
                }`}
              />
            ))}
          </div>
          
          <div className="flex space-x-2">
            {currentStep > 0 && (
              <button
                className="flex items-center p-2 text-gray-500 hover:text-gray-700"
                onClick={handlePrev}
              >
                <ArrowLeft size={16} className="mr-1" />
                Back
              </button>
            )}
            
            {currentStep < tourSteps.length - 1 ? (
              <button
                className="flex items-center p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                onClick={handleNext}
              >
                Next
                <ArrowRight size={16} className="ml-1" />
              </button>
            ) : (
              <button
                className="flex items-center p-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                onClick={handleComplete}
              >
                Got It!
                <Check size={16} className="ml-1" />
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default TourGuide;