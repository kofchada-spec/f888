import { motion, AnimatePresence } from 'framer-motion';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

const pageVariants = {
  initial: { 
    opacity: 0, 
    y: 10
  },
  enter: { 
    opacity: 1, 
    y: 0
  },
  exit: { 
    opacity: 0, 
    y: -10
  }
};

const pageTransition = {
  duration: 0.3,
  ease: "easeInOut" as const
};

export const PageTransition = ({ children, className = '' }: PageTransitionProps) => {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
      transition={pageTransition}
      className={className}
    >
      {children}
    </motion.div>
  );
};

export const PageTransitionWrapper = ({ children }: { children: ReactNode }) => {
  return (
    <AnimatePresence mode="wait">
      {children}
    </AnimatePresence>
  );
};
