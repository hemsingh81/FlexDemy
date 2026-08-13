// Story 3.11/Task 2 (AD-6): every golden-file test's render-then-capture sequence must await
// document.fonts.ready before calling toMatchScreenshot() -- a screenshot taken before web fonts
// finish loading captures a fallback-font layout, making the comparison non-deterministic across
// runs/machines depending purely on network/cache timing. Shared here so this isn't repeated
// inline in every visual test file.
export const waitForFontsReady = async (): Promise<void> => {
  await document.fonts.ready;
};
