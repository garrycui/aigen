
import React from 'react';
import { usePrefersReducedMotion } from '@shared/lib/common/motion';
import { LazyMotion, domAnimation } from 'framer-motion';

type AnimationProviderProps = {
  children: React.ReactNode;
};

export const AnimationContext = React.createContext({
  prefersReducedMotion: false,
});

export const AnimationProvider: React.FC<AnimationProviderProps> = ({ children }) => {
  const prefersReducedMotion = usePrefersReducedMotion();

  return (
    <AnimationContext.Provider value={{ prefersReducedMotion }}>
      <LazyMotion features={domAnimation}>
        {children}
      </LazyMotion>
    </AnimationContext.Provider>
  );
};

export const useAnimation = () => {
  return React.useContext(AnimationContext);
};