import { createInitialState } from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

/**
 * Deterministic test state (seeded so ids are stable across runs).
 * Lives in a test helper module so tests can import a concrete ToolState
 * without executing random generation.
 */
export function makeToolStateForTest(): ToolState {
  return createInitialState();
}

