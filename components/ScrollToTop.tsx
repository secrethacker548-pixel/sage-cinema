'use client';

import { ArrowUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';
import { useScroll } from '../lib/hooks/useScroll';

export default function ScrollToTop() {
  const isVisible = useScroll(480);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.button
          type="button"
          className="scroll-top-button"
          initial={{ opacity: 0, y: 18, scale: 0.86 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 18, scale: 0.86 }}
          whileHover={{ y: -4 }}
          whileTap={{ scale: 0.94 }}
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          aria-label="Scroll to top"
        >
          <ArrowUp size={17} />
          <span>Top</span>
        </motion.button>
      )}
    </AnimatePresence>
  );
}
