// Story 3.11 code-review fix (Blind Hunter, Critical): the browser-mode test harness never loads
// the app's real stylesheet (src/index.css, only pulled in transitively via src/main.tsx, which
// Vitest's browser harness never runs), so KaTeX's screen-reader-only MathML annotation
// (`.katex-mathml`, hidden via katex.min.css's own clip-path/absolute-position rules) rendered
// visibly in every math/chemistry baseline -- a garbled, unstyled duplicate of the real typeset
// formula. Importing KaTeX's own stylesheet directly here (not the whole app's index.css, which
// also pulls in Tailwind and would defeat scoping this suite's baselines to just what these
// components render) hides that annotation exactly as production does.
import 'katex/dist/katex.min.css';
