'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { HTMLMotionProps, Variants } from 'framer-motion';
import * as React from 'react';

/**
 * Семантические обёртки над Framer Motion для использования по всему проекту.
 * Цель — единый набор готовых анимаций, чтобы не дублировать варианты в каждом компоненте.
 */

const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.2, ease: 'easeOut' } },
  exit: { opacity: 0, y: -4, transition: { duration: 0.15, ease: 'easeIn' } },
};

const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0, transition: { duration: 0.15 } },
};

const slideRight: Variants = {
  hidden: { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, x: 12, transition: { duration: 0.15 } },
};

/** Базовый блок, появляющийся плавно снизу. Заменяет обычный <div>. */
export function MotionBlock({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeInUp}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Простое появление с фейдом — для модалок, тостов, overlay-элементов. */
export function MotionFade({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={fadeIn}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Появление справа — для шагов wizard, переключения экранов. */
export function MotionSlide({ children, ...props }: HTMLMotionProps<'div'>) {
  return (
    <motion.div
      initial="hidden"
      animate="visible"
      exit="exit"
      variants={slideRight}
      {...props}
    >
      {children}
    </motion.div>
  );
}

/** Обёртка для условного рендера с анимацией размонтирования. */
export { AnimatePresence };

/** Доступ к чистому motion, если нужен сложный кастомный случай. */
export { motion };
