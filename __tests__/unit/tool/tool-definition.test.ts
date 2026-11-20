import { describe, it, expect } from 'vitest';
import {
  nanoidTool,
  nanoidToolInitialState,
  createInitialState,
  isToolState,
  normalizeState,
  regenerate,
  setLength,
  setAlphabet,
  setBatchSize,
  setSeedMode,
  deterministicIds,
} from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';
import { URL_SAFE_ALPHABET, MAX_LENGTH, MIN_LENGTH, MAX_BATCH, DEFAULT_BATCH } from '@/tool/nanoid';

function makeState(overrides: Partial<ToolState> = {}): ToolState {
  return { ...createInitialState(), ...overrides };
}

describe('initial state', () => {
  it('has 21-char url-safe ids', () => {
    expect(nanoidToolInitialState.length).toBe(21);
    for (const id of nanoidToolInitialState.ids) {
      expect(id).toHaveLength(21);
      expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it('has default batch size', () => {
    expect(nanoidToolInitialState.batchSize).toBe(DEFAULT_BATCH);
  });

  it('createInitialState returns fresh ids each call', () => {
    const a = createInitialState();
    const b = createInitialState();
    expect(a.ids).not.toEqual(b.ids);
    expect(a.generation).toBe(0);
  });
});

describe('regenerate', () => {
  it('produces new ids matching length and count and bumps generation', () => {
    const state = makeState({ length: 12, batchSize: 5 });
    const next = regenerate(state);
    expect(next.ids).toHaveLength(5);
    next.ids.forEach((id) => expect(id).toHaveLength(12));
    expect(next.generation).toBe(state.generation + 1);
    expect(next.ids).not.toEqual(state.ids);
  });

  it('respects seeded deterministic regeneration', () => {
    const state = makeState({ useSeed: true, seed: 42, length: 21, batchSize: 3 });
    const a = regenerate(state);
    const b = regenerate(state);
    expect(a.ids).toEqual(b.ids);
  });

  it('different seeds give different ids', () => {
    const a = regenerate(makeState({ useSeed: true, seed: 1 }));
    const b = regenerate(makeState({ useSeed: true, seed: 2 }));
    expect(a.ids).not.toEqual(b.ids);
  });

  it('sets error and keeps ids when alphabet invalid', () => {
    const state = makeState({ alphabet: 'aabbcc', error: null });
    const next = regenerate(state);
    expect(next.error).toContain('Duplicate');
  });
});

describe('setLength clamping', () => {
  it('clamps into [MIN, MAX]', () => {
    expect(setLength(makeState(), 3).length).toBe(MIN_LENGTH);
    expect(setLength(makeState(), 9999).length).toBe(MAX_LENGTH);
    expect(setLength(makeState(), 33).length).toBe(33);
  });

  it('clamps NaN to default', () => {
    const next = setLength(makeState(), Number.NaN);
    expect(next.length).toBe(21);
  });
});

describe('setAlphabet', () => {
  it('accepts url-safe preset and marks preset', () => {
    const next = setAlphabet(makeState({ alphabetPreset: 'custom' }), URL_SAFE_ALPHABET);
    expect(next.alphabetPreset).toBe('url-safe');
    expect(next.error).toBeNull();
  });

  it('rejects duplicates with clear error and keeps old alphabet', () => {
    const state = makeState();
    const next = setAlphabet(state, URL_SAFE_ALPHABET + 'A');
    expect(next.error).toContain('Duplicate');
    expect(next.alphabet).toBe(state.alphabet);
    expect(next.alphabetPreset).toBe('custom');
  });

  it('accepts custom valid alphabet', () => {
    const custom = '0123456789abcdef!@#$%^&*()';
    const next = setAlphabet(makeState(), custom);
    expect(next.alphabet).toBe(custom);
    expect(next.alphabetPreset).toBe('custom');
    expect(next.error).toBeNull();
  });
});

describe('setBatchSize clamping', () => {
  it('clamps into [1, MAX_BATCH]', () => {
    expect(setBatchSize(makeState(), 0).batchSize).toBe(1);
    expect(setBatchSize(makeState(), -10).batchSize).toBe(1);
    expect(setBatchSize(makeState(), 10000).batchSize).toBe(MAX_BATCH);
    expect(setBatchSize(makeState(), 25).batchSize).toBe(25);
  });
});

describe('setSeedMode', () => {
  it('stores seed when enabled, clears when disabled', () => {
    expect(setSeedMode(makeState(), true, 7).seed).toBe(7);
    expect(setSeedMode(makeState(), true, 7).useSeed).toBe(true);
    const off = setSeedMode(makeState({ seed: 7, useSeed: true }), false);
    expect(off.useSeed).toBe(false);
    expect(off.seed).toBeNull();
  });

  it('defaults seed to previous or 1', () => {
    expect(setSeedMode(makeState({ seed: null }), true).seed).toBe(1);
    expect(setSeedMode(makeState({ seed: null }), true, undefined).seed).toBe(1);
  });
});

describe('deterministicIds', () => {
  it('same state + seed yields identical ids across reruns', () => {
    const state = makeState({ useSeed: true, seed: 123 });
    const a = deterministicIds(state, 4);
    const b = deterministicIds(state, 4);
    expect(a).toEqual(b);
  });
});

describe('serialize / deserialize', () => {
  it('round-trips state', () => {
    const state = makeState({ length: 30, batchSize: 4, generation: 5 });
    const json = nanoidTool.serialize(state);
    const result = nanoidTool.deserialize(JSON.parse(json));
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(30);
    expect(result.data.batchSize).toBe(4);
    expect(result.data.generation).toBe(5);
  });

  it('rejects null / non-object / wrong shapes', () => {
    expect(nanoidTool.deserialize(null).success).toBe(false);
    expect(nanoidTool.deserialize('string').success).toBe(false);
    expect(nanoidTool.deserialize({ ids: 'not-array' }).success).toBe(false);
    expect(nanoidTool.deserialize({ ...makeState(), ids: [42] }).success).toBe(false);
    expect(nanoidTool.deserialize({ ...makeState(), alphabetPreset: 'bogus' }).success).toBe(false);
    expect(nanoidTool.deserialize({ ...makeState(), seed: 'x' }).success).toBe(false);
  });

  it('normalizes out-of-range numbers on deserialize', () => {
    const raw = { ...makeState(), length: 5000, batchSize: -3 };
    const result = nanoidTool.deserialize(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.length).toBe(MAX_LENGTH);
    expect(result.data.batchSize).toBe(1);
  });

  it('propagates alphabet validation error on deserialize', () => {
    const raw = { ...makeState(), alphabet: 'zzyy' };
    const result = nanoidTool.deserialize(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.error).toContain('Duplicate');
  });

  it('regenerates ids whose length mismatches state.length', () => {
    const state = makeState({ length: 10, batchSize: 2 });
    const raw = { ...state, ids: ['short', 'also-short'] };
    const result = nanoidTool.deserialize(raw);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.ids.every((id) => id.length === 10)).toBe(true);
  });

  it('isToolState discriminates correctly', () => {
    expect(isToolState(makeState())).toBe(true);
    expect(isToolState(null)).toBe(false);
    expect(isToolState({})).toBe(false);
  });
});

describe('normalizeState', () => {
  it('returns null for invalid payloads', () => {
    expect(normalizeState('junk')).toBeNull();
    expect(normalizeState(undefined)).toBeNull();
    expect(normalizeState(42)).toBeNull();
  });

  it('keeps valid state intact', () => {
    const state = makeState();
    const out = normalizeState({ ...state });
    expect(out).not.toBeNull();
    expect(out?.alphabetPreset).toBe('url-safe');
  });
});
