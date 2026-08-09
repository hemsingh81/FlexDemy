import { useEffect, RefObject } from 'react';

// Cross-feature shared hook (ARCHITECTURE-SPINE.md AD-3 hooks/ convention).
// Closes any popover/dropdown when the user clicks outside it or presses Escape.
export const useClickOutside = (ref: RefObject<HTMLElement | null>, onOutside: () => void, isActive: boolean) => {
  useEffect(() => {
    if (!isActive) return;

    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onOutside();
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isActive, onOutside, ref]);
};
