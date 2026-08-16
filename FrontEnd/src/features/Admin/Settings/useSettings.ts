import { getSettings, type SettingDto } from '../../../services/settingsService';
import { useAsync } from '../../../hooks/useAsync';

// Read-only for Story 6.1 -- Apply/mutation is Story 6.2 scope, so this hook is a thin useAsync
// wrapper (AD-1's { data, isLoading, error } shape) with no extra mutation machinery, unlike
// useAiTaskConfig.ts's dataRef/updateTaskConfig pattern.
export const useSettings = () => useAsync<SettingDto[]>(getSettings, [], []);
