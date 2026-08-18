import { useState } from 'react';
import { useSiteSettings } from '../../../context/SiteSettingsContext';
import { useToast } from '../../../context/ToastContext';
import * as settingsService from '../../../services/settingsService';
import type { SettingDto, TypographyApplyResultDto } from '../../../services/settingsService';

interface UseApplyTypographyResult {
  isApplying: boolean;
  error: string | null;
  // Takes the specific apply call (applyTypography vs. applyTypographyCombination -- the two
  // callers hit different endpoints with different arguments) and a success-toast message (the
  // two callers word it differently too) -- everything else in the shape is identical and lives
  // here once. Returns the result on success, null on failure (caller decides what to do next,
  // e.g. TypographyComposer.tsx refreshing its own open history panel only on success).
  apply: (call: () => Promise<TypographyApplyResultDto>, successMessage: string) => Promise<TypographyApplyResultDto | null>;
  // Lets a caller discard a previous failure's error banner without making another apply call --
  // e.g. TypographyComposer.tsx's own Reset button, which previously cleared its local saveError
  // directly before this hook existed.
  clearError: () => void;
}

// Code-review patch (2026-08-18): extracted from TypographyComposer.tsx's handleSave and
// AppearanceSection.tsx's handleApplyCombo, which independently duplicated the exact same
// try/call/onApplied-twice/refetchSiteSettings/toast/catch-SettingsError/finally shape.
export const useApplyTypography = (onApplied: (updated: SettingDto) => void): UseApplyTypographyResult => {
  const { refetch: refetchSiteSettings } = useSiteSettings();
  const { showToast } = useToast();
  const [isApplying, setIsApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apply = async (
    call: () => Promise<TypographyApplyResultDto>,
    successMessage: string
  ): Promise<TypographyApplyResultDto | null> => {
    setIsApplying(true);
    setError(null);
    try {
      const result = await call();
      onApplied(result.font);
      onApplied(result.fontSize);
      // Updates the saving admin's own session immediately -- NFR-1 only requires this for *other*
      // users on their next page load.
      refetchSiteSettings();
      showToast({ message: successMessage, variant: 'success' });
      return result;
    } catch (e) {
      setError(e instanceof settingsService.SettingsError ? e.message : 'Something went wrong. Please try again.');
      return null;
    } finally {
      setIsApplying(false);
    }
  };

  const clearError = () => setError(null);

  return { isApplying, error, apply, clearError };
};
