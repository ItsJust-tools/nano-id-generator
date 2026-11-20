import type { Tool, DeserializeResult } from '@itsjust/core';
import toolConfig from './tool.config';
import type { ToolState, AlphabetPreset } from './types';
import {
  DEFAULT_ALPHABET,
  DEFAULT_LENGTH,
  DEFAULT_BATCH,
  clampLength,
  generateNanoId,
  generateBatch,
  validateAlphabet,
  MIN_LENGTH,
  MAX_LENGTH,
  MIN_BATCH,
  MAX_BATCH,
} from './nanoid';

export function createInitialState(): ToolState {
  return {
    ids: generateBatch(DEFAULT_BATCH, {
      length: DEFAULT_LENGTH,
      alphabet: DEFAULT_ALPHABET,
    }),
    length: DEFAULT_LENGTH,
    batchSize: DEFAULT_BATCH,
    alphabet: DEFAULT_ALPHABET,
    alphabetPreset: 'url-safe',
    seed: null,
    useSeed: false,
    generationRate: 1000,
    error: null,
    generation: 0,
  };
}

export const nanoidToolInitialState: ToolState = createInitialState();

function clampBatch(batchSize: number): number {
  if (!Number.isFinite(batchSize)) return DEFAULT_BATCH;
  return Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.round(batchSize) || 1));
}

function clampRate(rate: number): number {
  if (!Number.isFinite(rate) || rate < 0) return 0;
  return rate;
}

function isAlphabetPreset(value: unknown): value is AlphabetPreset {
  return value === 'url-safe' || value === 'custom';
}

export function isToolState(value: unknown): value is ToolState {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Partial<ToolState>;
  return (
    Array.isArray(v.ids) &&
    v.ids.every((id) => typeof id === 'string') &&
    typeof v.length === 'number' &&
    typeof v.batchSize === 'number' &&
    typeof v.alphabet === 'string' &&
    isAlphabetPreset(v.alphabetPreset) &&
    (v.seed === null || typeof v.seed === 'number') &&
    typeof v.useSeed === 'boolean' &&
    typeof v.generationRate === 'number' &&
    (v.error === null || typeof v.error === 'string') &&
    typeof v.generation === 'number'
  );
}

/** Normalize a candidate state: clamp numbers, validate alphabet, regenerate if needed. */
export function normalizeState(value: unknown): ToolState | null {
  const base = isToolState(value) ? value : null;
  if (!base) return null;
  const length = clampLength(base.length);
  const batchSize = clampBatch(base.batchSize);
  const alphabet = base.alphabet || DEFAULT_ALPHABET;
  const validation = validateAlphabet(alphabet);
  const alphabetPreset: AlphabetPreset =
    base.alphabetPreset === 'custom' && validation.valid ? 'custom' : base.alphabetPreset;
  const seed = base.useSeed && base.seed !== null ? base.seed >>> 0 : null;
  const ids = base.ids.filter((id) => typeof id === 'string');
  const needsRegeneration =
    ids.length !== batchSize ||
    validation.error !== base.error ||
    (ids.length > 0 && ids.some((id) => id.length !== length));
  const presetInvalid = isAlphabetPreset(base.alphabetPreset)
    ? base.alphabetPreset === 'url-safe'
    : true;
  const errorValue = validation.error;
  const normalized: ToolState = {
    ids: errorValue || needsRegeneration
      ? generateBatch(
          errorValue ? 1 : batchSize,
          errorValue
            ? { length, alphabet: DEFAULT_ALPHABET, random: Math.random }
            : { length, alphabet, random: Math.random }
        )
      : ids,
    length,
    batchSize,
    alphabet: errorValue ? DEFAULT_ALPHABET : alphabet,
    alphabetPreset: presetInvalid ? 'url-safe' : 'custom',
    seed,
    useSeed: base.useSeed,
    generationRate: clampRate(base.generationRate),
    error: errorValue,
    generation: base.generation,
  };
  return normalized;
}

export const nanoidTool: Tool<ToolState> = {
  id: toolConfig.id,
  name: toolConfig.name,
  version: toolConfig.version,
  config: toolConfig,
  initialState: nanoidToolInitialState,
  serialize: (state) => JSON.stringify(state),
  deserialize: (data): DeserializeResult<ToolState> => {
    try {
      const normalized = normalizeState(data);
      if (normalized) return { success: true, data: normalized };
      return { success: false, error: 'Invalid data format: expected valid Nano ID state' };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Deserialization error';
      return { success: false, error: `Failed to deserialize state: ${message}` };
    }
  },
  exporters: [
    { format: 'png', loader: () => import('./exporters/png') },
    { format: 'jpeg', loader: () => import('./exporters/jpeg') },
    { format: 'webp', loader: () => import('./exporters/webp') },
    { format: 'pdf', loader: () => import('./exporters/pdf') },
  ],
};

/** Regenerate IDs for the given state. Not part of the Tool contract. */
export function regenerate(state: ToolState): ToolState {
  const validation = validateAlphabet(state.alphabet);
  if (!validation.valid) {
    return { ...state, error: validation.error };
  }
  const length = clampLength(state.length);
  const batchSize = clampBatch(state.batchSize);
  const ids = generateBatch(batchSize, {
    length,
    alphabet: state.alphabet,
    seed: state.useSeed && state.seed !== null ? state.seed : undefined,
    random: state.useSeed && state.seed !== null ? undefined : Math.random,
  });
  return {
    ...state,
    ids,
    length,
    batchSize,
    error: null,
    generation: state.generation + 1,
  };
}

/** Set a new length, clamped. */
export function setLength(state: ToolState, length: number): ToolState {
  return { ...state, length: clampLength(length) };
}

/** Set the alphabet; rejects duplicates with a clear error, keeps previous on failure. */
export function setAlphabet(state: ToolState, alphabet: string): ToolState {
  const validation = validateAlphabet(alphabet);
  if (!validation.valid) {
    return { ...state, error: validation.error, alphabetPreset: 'custom' };
  }
  return {
    ...state,
    alphabet,
    error: null,
    alphabetPreset: alphabet === DEFAULT_ALPHABET ? 'url-safe' : 'custom',
  };
}

/** Set batch size, clamped. */
export function setBatchSize(state: ToolState, batchSize: number): ToolState {
  return { ...state, batchSize: clampBatch(batchSize) };
}

/** Toggle seeded deterministic generation. */
export function setSeedMode(state: ToolState, useSeed: boolean, seed?: number): ToolState {
  return {
    ...state,
    useSeed,
    seed: useSeed ? ((seed ?? state.seed ?? 1) >>> 0) : null,
  };
}

/** Convenience for deterministic reruns: same seed yields identical ids. */
export function deterministicIds(state: ToolState, count?: number): string[] {
  return generateBatch(count ?? state.batchSize, {
    length: state.length,
    alphabet: state.alphabet,
    seed: state.seed ?? 42,
  });
}

export { MIN_LENGTH, MAX_LENGTH, MIN_BATCH, MAX_BATCH, DEFAULT_LENGTH, DEFAULT_BATCH };
