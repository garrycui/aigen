import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
  children: React.ReactNode;
  transition?: 'fade' | 'slide' | 'scale' | 'none';
  duration?: number;
}

const transitions = {
  fade: {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
  },
  slide: {
    initial: { x: 20, opacity: 0 },
    animate: { x: 0, opacity: 1 },
    exit: { x: -20, opacity: 0 },
  },
  scale: {
    initial: { scale: 0.95, opacity: 0 },
    animate: { scale: 1, opacity: 1 },
    exit: { scale: 0.98, opacity: 0 },
  },
  none: {
    initial: {},
    animate: {},
    exit: {},
  },
};

const PageTransition: React.FC<PageTransitionProps> = ({
  children,
  transition = 'fade',
  duration = 0.3,
}) => {
  const location = useLocation();
  const { initial, animate, exit } = transitions[transition];

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={location.pathname}
        initial={initial}
        animate={animate}
        exit={exit}
        transition={{ duration: duration, ease: "easeInOut" }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

export default PageTransition;