import katex from 'katex';

// Extracted from ReaderCanvas.tsx: safely render a LaTeX string to an HTML string via KaTeX,
// falling back to the raw string if rendering throws.
export const renderLatex = (latexStr: string): string => {
  try {
    return katex.renderToString(latexStr, { throwOnError: false, displayMode: true });
  } catch {
    return latexStr;
  }
};
