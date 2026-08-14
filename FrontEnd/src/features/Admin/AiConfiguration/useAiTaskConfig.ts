import { useCallback, useEffect, useRef } from 'react';
import * as aiConfigService from '../../../services/aiConfigService';
import { useAsync } from '../../../hooks/useAsync';

// The 7 AI Tasks routed through the AI Service Layer (New Course Wizard PRD FR-1/FR-27).
// `describeNotation` was added during the UX accessibility review -- screen-reader alt-text
// for KaTeX math/chemistry notation, a first-class budgeted task like the other 6.
export type AiTaskId =
  | 'extractStructure'
  | 'explainTopic'
  | 'rewriteExplanation'
  | 'generateExercise'
  | 'defineKeyword'
  | 'describeNotation'
  | 'embeddings';

export const AI_TASK_IDS: AiTaskId[] = [
  'extractStructure',
  'explainTopic',
  'rewriteExplanation',
  'generateExercise',
  'defineKeyword',
  'describeNotation',
  'embeddings',
];

// Closed vocabulary for provider/model selectors (AiTaskConfigRow.tsx, AC #1) -- `as const` +
// derived union types give a compile-time link between the dropdown options and the config
// shape below. The backend does NOT validate against a closed enum (PRD FR-2 -- a provider/model
// swap must never require a code change); this closed list is a frontend UX choice only (Story
// 1.5 Dev Notes).
export const AI_PROVIDERS = ['Groq', 'OpenRouter', 'Local'] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const AI_MODELS = [
  'llama-4-scout',
  'llama-4-maverick',
  'llama-3.1-8b-instant',
  'nomic-embed-text',
  'gpt-4o-mini',
  'claude-4-haiku',
  'text-embedding-3-small',
] as const;
export type AiModel = (typeof AI_MODELS)[number];

// Field names match the backend's real AiTaskConfigDto (BackEnd Application/AiConfig/AiConfigDto.cs,
// Story 1.5). currentSpend always returns 0 until Story 1.7/1.8 wire real AiTaskBudget tracking
// (AD-18) -- it is a real API field now, not mock data, hence the rename from Story 1.1's
// `mockSpend`. Expected consequence: the budget-warning UI (AiTaskConfigRow.tsx) goes quiet
// until Story 1.7/1.8 land, since currentSpend >= budgetThreshold never holds at 0.
export interface AiTaskConfig {
  taskId: AiTaskId;
  provider: AiProvider;
  model: AiModel;
  fallbackProvider: AiProvider;
  fallbackModel: AiModel;
  budgetThreshold: number;
  currentSpend: number;
}

export type AiTaskConfigPatch = Partial<
  Pick<AiTaskConfig, 'provider' | 'model' | 'fallbackProvider' | 'fallbackModel' | 'budgetThreshold'>
>;

interface UseAiTaskConfigResult {
  data: AiTaskConfig[];
  isLoading: boolean;
  error: string | null;
  updateTaskConfig: (taskId: AiTaskId, patch: AiTaskConfigPatch) => Promise<void>;
}

const isKnownTaskId = (taskId: string): taskId is AiTaskId => (AI_TASK_IDS as string[]).includes(taskId);

// Validates taskId against the closed AiTaskId union before casting -- a raw `as AiTaskConfig`
// would silently let an unrecognized taskId flow through and later render `undefined` from
// TASK_LABELS[task.taskId] (review finding, 2026-08-11 review).
const toAiTaskConfig = (dto: aiConfigService.AiTaskConfigDto): AiTaskConfig | null => {
  if (!isKnownTaskId(dto.taskId)) {
    // eslint-disable-next-line no-console
    console.warn(`useAiTaskConfig: ignoring unrecognized AI Task id "${dto.taskId}" from the server.`);
    return null;
  }
  // provider/model/fallbackProvider/fallbackModel are still a plain string->union cast here --
  // that's deliberate, matching this story's Dev Notes decision not to validate those against a
  // closed backend enum (FR-2). Only taskId (a genuinely fixed, closed set) is checked.
  return { ...dto, taskId: dto.taskId } as AiTaskConfig;
};

// Feature-local hook (AD-2). Story 1.5 live-wire: reads/writes the real ai-task-configs
// endpoints instead of Story 1.1's mock data, behind the exact same
// { data, isLoading, error } + updateTaskConfig shape (minus updateTaskConfig's return type,
// now Promise<void> instead of void -- a deliberate signature change, see Story 1.5 Dev Notes),
// so AiConfiguration.tsx never needs to change.
export const useAiTaskConfig = (): UseAiTaskConfigResult => {
  const { data, setData, isLoading, error } = useAsync<AiTaskConfig[]>(
    () =>
      aiConfigService
        .getAiTaskConfigs()
        .then((dtos) => dtos.map(toAiTaskConfig).filter((row): row is AiTaskConfig => row !== null)),
    [],
    [],
    (err) => (err instanceof Error ? err.message : 'Could not load AI Task configuration.')
  );
  // Kept in sync via the effect below (not read synchronously inside the same tick as a
  // setData call anywhere in this hook, so a plain effect-synced ref is safe here -- unlike
  // Story 1.3's TagManagement.tsx, nothing calls updateTaskConfig immediately after a setData
  // in the same synchronous chain).
  const dataRef = useRef<AiTaskConfig[]>(data);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  // Row-scoped: a save failure re-throws so the calling row (AiTaskConfigRow.tsx) can show its
  // own inline error, rather than being swallowed into this page-level `error` state (Story 1.5
  // AC #5 / Dev Notes).
  const updateTaskConfig = useCallback(async (taskId: AiTaskId, patch: AiTaskConfigPatch) => {
    const existing = dataRef.current.find((row) => row.taskId === taskId);
    if (!existing) {
      // Genuinely unreachable today (a row is only ever saved from its own rendered state, which
      // always has a matching entry in `data`) -- throwing instead of silently no-op'ing prevents
      // a false "Saved!" if that assumption is ever violated (review finding, 2026-08-11 review).
      throw new Error(`No loaded config found for AI Task "${taskId}".`);
    }

    const updated = await aiConfigService.updateAiTaskConfig(taskId, {
      provider: patch.provider ?? existing.provider,
      model: patch.model ?? existing.model,
      fallbackProvider: patch.fallbackProvider ?? existing.fallbackProvider,
      fallbackModel: patch.fallbackModel ?? existing.fallbackModel,
      budgetThreshold: patch.budgetThreshold ?? existing.budgetThreshold,
    });

    const mapped = toAiTaskConfig(updated);
    if (!mapped) {
      throw new Error(`The server returned an unrecognized AI Task id "${updated.taskId}".`);
    }

    setData((prev) => prev.map((row) => (row.taskId === taskId ? mapped : row)));
  }, []);

  return { data, isLoading, error, updateTaskConfig };
};
