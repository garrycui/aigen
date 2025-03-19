import { useState, useEffect } from 'react';
import { useInView } from 'react-intersection-observer';
import { MotionProps, Variant } from 'framer-motion';

/**
 * Hook to check if user prefers reduced motion
 */
export const usePrefersReducedMotion = (): boolean => {
  const [prefersReducedMotion, setPrefersReducedMotion] = useState<boolean>(false);
  
  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mediaQuery.matches);
    
    const listener = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    
    mediaQuery.addEventListener('change', listener);
    return () => mediaQuery.removeEventListener('change', listener);
  }, []);

  return prefersReducedMotion;
};

/**
 * Hook to animate elements when they come into view
 */
export const useAnimateInView = (threshold = 0.1, triggerOnce = true) => {
  const [ref, inView] = useInView({
    threshold,
    triggerOnce,
  });

  return { ref, inView };
};

/**
 * Predefined animation variants for common animations
 */
export const animations = {
  fadeIn: {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.5 } },
  },
  fadeInUp: {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  },
  fadeInRight: {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
  },
  fadeInLeft: {
    hidden: { opacity: 0, x: 20 },
    visible: { opacity: 1, x: 0, transition: { duration: 0.5 } },
  },
  scale: {
    hidden: { opacity: 0, scale: 0.8 },
    visible: { opacity: 1, scale: 1, transition: { duration: 0.5 } },
  },
  staggerChildren: {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  },
};

/**
 * Get motion props based on animation preference
 */
export const getMotionProps = (
  animationVariant: { hidden: Variant; visible: Variant },
  prefersReducedMotion: boolean
): MotionProps => {
  if (prefersReducedMotion) {
    return {
      initial: { opacity: 1 },
      animate: { opacity: 1 },
    };
  }
  
  return {
    initial: 'hidden',
    animate: 'visible',
    variants: animationVariant,
  };
};

/**
 * Create stagger animation for child elements
 */
export const createStaggerAnimation = (
  childAnimationVariant: { hidden: Variant; visible: Variant },
  staggerDelay = 0.1
) => {
  return {
    container: {
      hidden: { opacity: 1 },
      visible: {
        opacity: 1,
        transition: {
          staggerChildren: staggerDelay,
        },
      },
    },
    item: childAnimationVariant,
  };
};
