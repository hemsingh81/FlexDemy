// Real-backend AI usage/cost calls (Story 1.7, live-wiring Story 1.2's Usage & Cost dashboard).
// Same `get`/`write` + fetch pattern as services/aiConfigService.ts -- this project has no
// shared HTTP client wrapper, each service file is self-contained. Master-only server-side
// (FeatureKeys.AiConfigManage), matching the same ai-configuration sub-tab as aiConfigService.ts.
import { getToken } from './authService';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8080';

// Field names/casing mirror the backend's AiUsageEntryDto exactly (BackEnd
// Application/AiUsage/AiUsageDto.cs). `date` is a "yyyy-MM-dd" string (System.Text.Json's
// default DateOnly serialization) -- no client-side parsing/reformatting needed.
export interface AiUsageEntryDto {
  taskId: string;
  date: string;
  cost: number;
  isFallbackServed: boolean;
}

export class AiUsageError extends Error {}

const get = async <T>(path: string): Promise<T> => {
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
  } catch (e) {
    throw new AiUsageError('Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    const problem = await response.json().catch(() => null);
    throw new AiUsageError(problem?.detail || 'Something went wrong. Please try again.');
  }

  return response.json();
};

export const getUsage = (range: 'last7' | 'last30' | 'all'): Promise<AiUsageEntryDto[]> =>
  get(`/api/v1/ai-usage?range=${range}`);
