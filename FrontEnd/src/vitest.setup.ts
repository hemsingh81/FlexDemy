import '@testing-library/jest-dom/vitest';

// jsdom implements no layout engine, so Element.prototype.scrollIntoView does not exist at all --
// calling it throws "is not a function" rather than being a harmless no-op. Any component that
// keeps a selection visible in a scroll region (SlashMenuList's highlighted option, and any future
// list that follows it) would otherwise crash every test that renders it, for a reason that has
// nothing to do with the behaviour under test.
//
// Stubbed globally here rather than guarded at each call site: `el.scrollIntoView?.()` in product
// code would be defending against a browser gap that does not exist -- every real browser has had
// this since forever. The behaviour it stands in for is asserted in the real-Chromium `visual`
// project instead, where scrolling actually happens.
if (typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = function scrollIntoView() {
    /* no-op: jsdom has no layout */
  };
}
