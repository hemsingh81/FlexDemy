import React, { useMemo } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Spinner } from '../../../ui/Spinner';
import { Alert } from '../../../ui/Alert';
import { useSettings } from './useSettings';
import { useAsync } from '../../../hooks/useAsync';
import * as settingsService from '../../../services/settingsService';
import { formatDate } from './utils';
import { AppearanceSection } from './AppearanceSection';
import type {
  SettingDto,
  FontPairingDefinitionDto,
  FontSizeDefinitionDto,
  TypographyCombinationDefinitionDto,
} from '../../../services/settingsService';

// Admin -> Settings sub-tab (AdminSettings PRD FR-4/FR-5, backend AD-25/AD-27).
//
// Presented as an Appearance/theme picker rather than a list of raw Setting rows: a theme (backend
// TypographyCombinationDefinition) bundles a font pairing + a text scale, and each card previews
// itself in its own real fonts at its own real scale, so choosing one is a visual decision rather
// than a slug-matching one. Everything an admin doesn't need in order to make that choice --
// setting keys, actor ids, timestamps, independent font-vs-size control, change history -- lives
// under one Advanced disclosure instead of on the primary surface. The theme grid, Advanced
// composer, per-Setting history list, and shared apply logic live in their own files alongside this
// one (AppearanceSection.tsx, TypographyComposer.tsx, ThemeCard.tsx, ChangeHistory.tsx,
// useApplyTypography.ts) -- this file is just their orchestrator plus the generic per-KeyType
// fallback rendering for every other Setting.
//
// Preview NEVER touches document.documentElement -- only a successful Apply does, and only
// SiteSettingsContext (never a component) touches document.documentElement (AD-8).

// The API returns each catalog in insertion order, which is arbitrary from a reader's point of
// view -- font sizes arrived as 100%, 90%, 140%, 125%, 112%, and themes in whatever order they were
// seeded. Both get a deliberate order here rather than server-side, since this is presentation, not
// data: sizes ascend numerically (a scale picker that doesn't run small-to-large is just hard to
// use), and themes sort by label with Default pinned first as the baseline everything else varies
// from. parseFloat handles the "112%" form by ignoring the trailing unit.
const bySizeAscending = (a: FontSizeDefinitionDto, b: FontSizeDefinitionDto) =>
  parseFloat(a.rootFontScale) - parseFloat(b.rootFontScale);

const byThemeLabel = (a: TypographyCombinationDefinitionDto, b: TypographyCombinationDefinitionDto) => {
  if (a.slug === 'default') return -1;
  if (b.slug === 'default') return 1;
  return a.label.localeCompare(b.label);
};

const groupByKeyType = (settings: SettingDto[]): Map<string, SettingDto[]> => {
  const groups = new Map<string, SettingDto[]>();
  for (const setting of settings) {
    const existing = groups.get(setting.keyType);
    if (existing) {
      existing.push(setting);
    } else {
      groups.set(setting.keyType, [setting]);
    }
  }
  return groups;
};

export const Settings: React.FC = () => {
  const { data: settings, setData: setSettings, isLoading, error } = useSettings();
  const { data: fontPairings, error: fontPairingsError } = useAsync<FontPairingDefinitionDto[]>(settingsService.getFontPairings, [], []);
  const { data: fontSizes, error: fontSizesError } = useAsync<FontSizeDefinitionDto[]>(settingsService.getFontSizes, [], []);
  const { data: combinations, error: combinationsError } = useAsync<TypographyCombinationDefinitionDto[]>(
    settingsService.getTypographyCombinations,
    [],
    [],
  );
  const groups = useMemo(() => groupByKeyType(settings), [settings]);
  // Sorted copies -- never sort the arrays from useAsync in place, which would mutate its cached
  // state and make the ordering depend on how many times this component happened to render.
  const sortedSizes = useMemo(() => [...fontSizes].sort(bySizeAscending), [fontSizes]);
  const sortedCombinations = useMemo(() => [...combinations].sort(byThemeLabel), [combinations]);

  const fontSetting = settings.find((s) => s.keyType === 'Font');
  const fontSizeSetting = settings.find((s) => s.keyType === 'FontSize');
  // "Both exist" gates what renders AND what's removed from the generic loop as one single decision
  // -- if only one of Font/FontSize is ever present (partial seed, a fixture, a future migration
  // mid-flight), that lone row falls back to the generic per-KeyType rendering below instead of
  // silently disappearing from the page.
  const showAppearanceSection = Boolean(fontSetting && fontSizeSetting);
  const otherGroups = new Map<string, SettingDto[]>(groups);
  if (showAppearanceSection) {
    otherGroups.delete('Font');
    otherGroups.delete('FontSize');
  }

  const handleApplied = (updated: SettingDto) => {
    setSettings((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[#5E6A79]">
        <Spinner size="lg" className="mr-2" />
        <span className="text-sm">Loading settings...</span>
      </div>
    );
  }

  if (error) {
    return <Alert>{error}</Alert>;
  }

  return (
    <div className="space-y-6">
      {showAppearanceSection && fontSetting && fontSizeSetting && (
        <AppearanceSection
          fontSetting={fontSetting}
          fontSizeSetting={fontSizeSetting}
          pairings={fontPairings}
          pairingsError={fontPairingsError}
          sizes={sortedSizes}
          sizesError={fontSizesError}
          combinations={sortedCombinations}
          combinationsError={combinationsError}
          onApplied={handleApplied}
        />
      )}
      {Array.from(otherGroups.entries()).map(([keyType, keyTypeSettings]) => (
        <section
          key={keyType}
          data-testid={`settings-${keyType.toLowerCase()}-section`}
          className="bg-white border border-[#E1DED4] rounded-2xl p-8 shadow-xs"
        >
          <div className="flex items-center gap-2.5 mb-4">
            <SlidersHorizontal className="w-5 h-5 text-[#BA5012]" aria-hidden="true" />
            <h3 className="font-serif text-xl font-bold text-[#142030]">{keyType}</h3>
          </div>
          <div className="space-y-3">
            {keyTypeSettings.map((setting) => (
              <div key={setting.id} className="p-3 rounded-xl border border-[#E1DED4] bg-white">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#142030] truncate">{setting.key}</p>
                    <p className="text-[10px] text-[#5E6A79] mt-0.5">Value: {setting.value}</p>
                    <p className="text-[10px] text-[#5E6A79]">
                      {/* A never-edited seeded row has null updatedAt/updatedBy -- fall back to
                          createdAt/createdBy so this never renders blank (Story 6.1). */}
                      Last changed {formatDate(setting.updatedAt ?? setting.createdAt)}
                      {(setting.updatedBy ?? setting.createdBy) ? ` by ${setting.updatedBy ?? setting.createdBy}` : ''}
                    </p>
                  </div>
                  <span
                    className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shrink-0 ${
                      setting.isActive ? 'bg-[#179765]/10 text-[#179765] border border-[#179765]/20' : 'bg-[#143358] text-white'
                    }`}
                  >
                    {setting.isActive ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
};
