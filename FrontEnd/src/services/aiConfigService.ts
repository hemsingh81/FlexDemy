// Real-backend AI Task config calls (Story 1.5, live-wiring Story 1.1's AI Configuration UI).
// Same `get`/`write` + fetch pattern as services/masterDataService.ts -- this project has no
// shared HTTP client wrapper, each service file is self-contained. Every route is
// Master-only server-side (FeatureKeys.AiConfigManage), matching Story 1.1's Master-only
// ai-configuration sub-tab.
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// Field names/casing mirror the backend's AiTaskConfigDto exactly (BackEnd
// Application/AiConfig/AiConfigDto.cs). currentSpend always returns 0 until Story 1.7/1.8 wire
// real AiTaskBudget tracking -- see useAiTaskConfig.ts's header comment.
export interface AiTaskConfigDto {
  taskId: string;
  provider: string;
  model: string;
  fallbackProvider: string;
  fallbackModel: string;
  budgetThreshold: number;
  currentSpend: number;
}

export interface UpdateAiTaskConfigRequest {
  provider: string;
  model: string;
  fallbackProvider: string;
  fallbackModel: string;
  budgetThreshold: number;
}

export class AiConfigError extends Error {}

const get = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new AiConfigError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new AiConfigError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

const write = async <T>(path: string, method: 'POST' | 'PUT', body: unknown): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${getToken()}`,
      },
      body: JSON.stringify(body),
    });
  } catch (e) {
    throw new AiConfigError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new AiConfigError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const getAiTaskConfigs = (): Promise<AiTaskConfigDto[]> => get('/api/v1/ai-task-configs');

export const updateAiTaskConfig = (taskId: string, data: UpdateAiTaskConfigRequest): Promise<AiTaskConfigDto> =>
  write(`/api/v1/ai-task-configs/${encodeURIComponent(taskId)}`, 'PUT', data);
