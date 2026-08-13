import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {configDefaults} from 'vitest/config';
import {playwright} from '@vitest/browser-playwright';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
    test: {
      // Story 3.11/Task 1 (AD-6): two Vitest projects from one CLI invocation -- the existing
      // jsdom suite left completely untouched (every other test file in this codebase keeps
      // running exactly as it does today), plus a new browser-mode project scoped only to this
      // story's own golden-file screenshot tests, via @vitest/browser-playwright + real Chromium.
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'jsdom',
            globals: true,
            setupFiles: ['./src/vitest.setup.ts'],
            // Story 3.11/Task 1: without this, Vitest's default include pattern would also pick up
            // the browser-mode golden-file suite below and try to run it under jsdom -- where
            // `vitest/browser`'s `page` import doesn't exist -- failing the whole unit run.
            // Code-review fix (Blind Hunter, Medium): spread the built-in defaults rather than
            // replacing them outright, so dist/coverage/cypress/etc. stay excluded too.
            exclude: [...configDefaults.exclude, 'tests/**/__screenshots__/**'],
          },
        },
        {
          extends: true,
          test: {
            name: 'visual',
            include: ['tests/**/__screenshots__/**/*.test.{ts,tsx}'],
            globals: true,
            // Code-review fix (Blind Hunter, Critical): loads katex.min.css so KaTeX's
            // screen-reader-only MathML annotation is actually hidden in these baselines, matching
            // production (where src/main.tsx pulls it in via src/index.css) -- see
            // tests/support/visualTestSetup.ts for the full explanation.
            setupFiles: ['./tests/support/visualTestSetup.ts'],
            browser: {
              enabled: true,
              provider: playwright(),
              instances: [{browser: 'chromium'}],
              headless: true,
              screenshotFailures: false,
            },
          },
        },
      ],
    },
  };
});
