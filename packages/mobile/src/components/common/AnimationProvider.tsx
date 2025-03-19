import React from 'react';
import { Platform } from 'react-native';
import { usePrefersReducedMotion } from '@shared/common/motion';

type AnimationProviderProps = {
  children: React.ReactNode;
};

export const AnimationContext = React.createContext({
  prefersReducedMotion: false,
});

export const AnimationProvider: React.FC<AnimationProviderProps> = ({ children }) => {
  // On mobile, we'll use the platform settings to determine animation preferences
  const prefersReducedMotion = Platform.OS === 'ios' 
    ? Boolean(require('react-native').AccessibilityInfo.isReduceMotionEnabled?.())
    : false;

  return (
    <AnimationContext.Provider value={{ prefersReducedMotion }}>
      {children}
    </AnimationContext.Provider>
  );
};

export const useAnimation = () => {
  return React.useContext(AnimationContext);
};