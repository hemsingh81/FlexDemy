import katex from 'katex';
// Side-effect import registering the mhchem extension (\ce{...} chemistry notation) -- ships
// inside the already-installed katex package, no new dependency. Not imported anywhere else in
// this codebase yet, so chemistry notation was unsupported before this story.
import 'katex/contrib/mhchem';

// Escapes the handful of characters that matter inside dangerouslySetInnerHTML's target.
const escapeHtml = (raw: string): string =>
  raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Mirrors DrilldownPanel.tsx/ReaderCanvas.tsx's existing katex.renderToString call pattern
// (same options), kept local to this feature rather than retrofitting those two files -- that
// consolidation is a separate, unrelated cleanup, out of scope here.
export const renderNotation = (notation: string): string => {
  try {
    return katex.renderToString(notation, { throwOnError: false, displayMode: true });
  } catch {
    // `throwOnError: false` suppresses most parse errors, but KaTeX/mhchem can still throw on
    // some malformed input -- notation is tutor-editable free text rendered via
    // dangerouslySetInnerHTML, so the raw fallback must be escaped, not injected verbatim.
    return escapeHtml(notation);
  }
};
