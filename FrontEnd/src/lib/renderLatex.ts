import katex from 'katex';

// Story 9.2: relocated from features/CoursePlayer/renderLatex.ts -- domain-agnostic (no
// course/page knowledge), and now has real consumers in two feature folders (CoursePlayer's
// InlineDrilldownDetail.tsx/SentenceCard.tsx, and this story's own Math block rendering), so it
// graduates out of a single feature folder per this project's own convention.
//
// Safely renders a LaTeX string to an HTML string via KaTeX, falling back to the raw string if
// rendering throws.
export const renderLatex = (latexStr: string): string => {
  try {
    return katex.renderToString(latexStr, { throwOnError: false, displayMode: true });
  } catch {
    return latexStr;
  }
};
