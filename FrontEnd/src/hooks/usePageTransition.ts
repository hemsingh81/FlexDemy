import { useEffect, useRef, useState } from 'react';

// Fade duration for each phase (out, then in) -- PageTransition.tsx's `duration-[100ms]` class
// must stay in sync with this value. ~100ms out + ~100ms in keeps the whole crossfade well
// under a quarter second so a screen change reads as smooth polish, not sluggish navigation.
export const PAGE_TRANSITION_FADE_MS = 100;

interface PageTransitionState<T> {
  displayedKey: string;
  displayedContent: T;
  isVisible: boolean;
}

// Cross-feature shared hook (ARCHITECTURE-SPINE.md AD-3 hooks/ convention, same spirit as
// useClickOutside). Drives a two-phase CSS crossfade for "whichever tab is active" UI --
// App.tsx's <main> and AdminPanel.tsx's sub-tab body both used to render a flat
// `{activeTab === 'x' && <X/>}` sequence, where switching tabs synchronously unmounted the old
// component and mounted the new one in the very same render. That gives the browser no
// before/after state to animate between -- it reads as a flicker (the newly-mounted
// component's own data-fetch-on-mount loading state / different layout height flashing in with
// zero visual continuity from what was on screen a moment ago).
//
// Fix: keep a `displayedKey`/`displayedContent` pair in state that trails the incoming
// `key`/`content` by one fade cycle instead of swapping in the same render. On a key change:
// 1. Fade the CURRENTLY displayed content out (isVisible -> false; PageTransition.tsx plays the
//    actual CSS opacity transition over PAGE_TRANSITION_FADE_MS).
// 2. Once that's had time to finish, swap to the new content while still invisible.
// 3. Flip visible again next frame.
//
// Step 3 is deliberately "next frame", not "same tick as the swap" -- flipping both the DOM
// content and the opacity class in one render gives the browser nothing to transition from (the
// classic React-transition footgun). This is the same "mount hidden, then flip visible on the
// next frame" split Navbar.tsx's dropdowns use (isMenuOpen vs the opacity-0/opacity-100 classes)
// to make a CSS transition actually play.
export function usePageTransition<T>(key: string, content: T): PageTransitionState<T> {
  const [displayedKey, setDisplayedKey] = useState(key);
  // Starts true: the very first render should show its content immediately, not fade in from
  // nothing.
  const [isVisible, setIsVisible] = useState(true);

  // The committed/displayed content -- what render() should actually show. Kept in a ref
  // (rather than state) so it can be read during the fade-out window without an extra render.
  // Only ever written while `key === displayedKey` (i.e. no transition pending), so it always
  // mirrors the latest content for whichever key is currently on screen -- props on the active
  // tab can keep changing (e.g. callbacks closing over fresher data) independent of the tab
  // itself changing.
  const contentRef = useRef(content);
  if (key === displayedKey) {
    contentRef.current = content;
  }

  // The latest incoming key/content, refreshed every render regardless of whether a transition
  // is pending. Read imperatively by the swap timeout below so a rapid re-click while already
  // fading out swaps in to the freshest target instead of whatever content was passed the
  // instant the fade-out started.
  const pendingRef = useRef({ key, content });
  pendingRef.current = { key, content };

  useEffect(() => {
    // Deliberately depends on `key` alone (see effect body for why displayedKey/content are
    // read via closure/ref instead of listed here): the swap step below calls
    // setDisplayedKey(key) once the fade-out finishes, and if that were allowed to re-trigger
    // this effect, the "key === displayedKey" branch below would immediately force isVisible
    // back to true, skipping the next-frame fade-in this hook exists to produce.
    if (key === displayedKey) {
      // Either the initial mount, or `key` flipped back to what's already displayed before an
      // in-flight fade-out's swap timer fired (rapid back-and-forth clicks) -- the cleanup
      // below (from the previous effect run) already cancelled that pending swap. Make sure
      // the content ends up fully visible again rather than stuck at opacity-0.
      setIsVisible(true);
      return;
    }

    setIsVisible(false);

    const rafIds: number[] = [];
    const swapTimeout = setTimeout(() => {
      const latest = pendingRef.current;
      contentRef.current = latest.content;
      setDisplayedKey(latest.key);
      // Two nested rAFs, not one: the first lets the browser commit the just-swapped
      // opacity-0 DOM; only the second flips the class to opacity-100, so the transition has a
      // real starting state to animate from instead of collapsing to a no-op.
      const raf1 = requestAnimationFrame(() => {
        const raf2 = requestAnimationFrame(() => setIsVisible(true));
        rafIds.push(raf2);
      });
      rafIds.push(raf1);
    }, PAGE_TRANSITION_FADE_MS);

    return () => {
      clearTimeout(swapTimeout);
      rafIds.forEach((id) => cancelAnimationFrame(id));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- displayedKey/content intentionally
    // excluded; see the comment at the top of this effect.
  }, [key]);

  return { displayedKey, displayedContent: contentRef.current, isVisible };
}
