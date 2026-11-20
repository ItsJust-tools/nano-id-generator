import { describe, it, expect } from 'vitest';
import {
  generateNanoId,
  generateBatch,
  validateAlphabet,
  clampLength,
  mulberry32,
  collisionProbability,
  idsForCollisionProbability,
  collisionRiskSummary,
  URL_SAFE_ALPHABET,
  DEFAULT_LENGTH,
  MIN_LENGTH,
  MAX_LENGTH,
  MAX_BATCH,
  DEFAULT_ALPHABET_SIZE,
} from '@/tool/nanoid';

const URL_SAFE_RE = /^[A-Za-z0-9_-]+$/;

describe('generateNanoId defaults', () => {
  it('produces a 21-character URL-safe string by default', () => {
    const id = generateNanoId();
    expect(id).toHaveLength(21);
    expect(id).toMatch(URL_SAFE_RE);
  });

  it('contains only alphabet characters', () => {
    for (let i = 0; i < 50; i += 1) {
      const id = generateNanoId();
      for (const ch of id) {
        expect(URL_SAFE_ALPHABET).toContain(ch);
      }
    }
  });

  it('respects custom alphabet membership', () => {
    const alphabet = 'abcdef0123456789!@#$%^&*()';
    const id = generateNanoId({ alphabet, length: 30 });
    for (const ch of id) {
      expect(alphabet).toContain(ch);
    }
  });

  it('throws on invalid alphabet', () => {
    expect(() => generateNanoId({ alphabet: 'aab' })).toThrow(/Duplicate/);
    expect(() => generateNanoId({ alphabet: 'short' })).toThrow(/16 unique/);
  });
});

describe('custom length clamping', () => {
  it('respects custom length within bounds', () => {
    expect(generateNanoId({ length: 10 })).toHaveLength(10);
    expect(generateNanoId({ length: 64 })).toHaveLength(64);
  });

  it('clamps below MIN_LENGTH', () => {
    expect(generateNanoId({ length: 1 })).toHaveLength(MIN_LENGTH);
    expect(generateNanoId({ length: -5 })).toHaveLength(MIN_LENGTH);
  });

  it('clamps above MAX_LENGTH', () => {
    expect(generateNanoId({ length: 1000 })).toHaveLength(MAX_LENGTH);
  });

  it('falls back to default on NaN/Infinity', () => {
    expect(generateNanoId({ length: Number.NaN })).toHaveLength(DEFAULT_LENGTH);
    expect(clampLength(Number.POSITIVE_INFINITY)).toBe(MAX_LENGTH);
    expect(clampLength(10.7)).toBe(11);
  });

  it('length slider bounds are sensible', () => {
    expect(MIN_LENGTH).toBeLessThan(DEFAULT_LENGTH);
    expect(DEFAULT_LENGTH).toBeLessThan(MAX_LENGTH);
  });
});

describe('alphabet validation', () => {
  it('accepts the URL-safe preset', () => {
    const result = validateAlphabet(URL_SAFE_ALPHABET);
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('rejects duplicate characters with a clear error naming the char', () => {
    const result = validateAlphabet('abcdefghijklmnopqrsst');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Duplicate');
    expect(result.error).toContain('"s"');
  });

  it('rejects too-short alphabets', () => {
    const result = validateAlphabet('abcd');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('16 unique');
  });

  it('accepts 16 unique chars', () => {
    expect(validateAlphabet('abcdefghijklmnop').valid).toBe(true);
  });
});

describe('seeded deterministic generation', () => {
  it('is deterministic across reruns with the same seed', () => {
    const a = generateNanoId({ seed: 1234, length: 21 });
    const b = generateNanoId({ seed: 1234, length: 21 });
    expect(a).toBe(b);
  });

  it('differs across different seeds', () => {
    const a = generateNanoId({ seed: 1, length: 21 });
    const b = generateNanoId({ seed: 2, length: 21 });
    expect(a).not.toBe(b);
  });

  it('mulberry32 produces reproducible sequences', () => {
    const r1 = mulberry32(42);
    const r2 = mulberry32(42);
    const seq1 = [r1(), r1(), r1()];
    const seq2 = [r2(), r2(), r2()];
    expect(seq1).toEqual(seq2);
    for (const v of seq1) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('uses a provided random function', () => {
    const id = generateNanoId({ random: () => 0.1, length: 8 });
    // 0.1 * 2^32 = 429496729.6 -> floor 429496729; 429496729 % 64 = 25 -> 'Z'... just check validity + determinism
    expect(id).toHaveLength(8);
    const id2 = generateNanoId({ random: () => 0.1, length: 8 });
    expect(id2).toBe(id);
  });
});

describe('batch generation', () => {
  it('generates requested count', () => {
    expect(generateBatch(5)).toHaveLength(5);
    expect(generateBatch(1)).toHaveLength(1);
  });

  it('clamps batch count to MAX_BATCH', () => {
    expect(generateBatch(5000).length).toBeLessThanOrEqual(MAX_BATCH);
  });

  it('seeded batches use distinct seeds so ids differ', () => {
    const ids = generateBatch(10, { seed: 7 });
    expect(new Set(ids).size).toBe(10);
  });

  it('seeded batch is reproducible', () => {
    const a = generateBatch(5, { seed: 99 });
    const b = generateBatch(5, { seed: 99 });
    expect(a).toEqual(b);
  });
});

describe('collision math', () => {
  it('zero probability for fewer than 2 ids', () => {
    expect(collisionProbability(64, 21, 0)).toBe(0);
    expect(collisionProbability(64, 21, 1)).toBe(0);
  });

  it('grows with count', () => {
    const small = collisionProbability(64, 21, 1e6);
    const big = collisionProbability(64, 21, 1e12);
    expect(big).toBeGreaterThan(small);
    expect(small).toBeGreaterThanOrEqual(0);
    expect(small).toBeLessThanOrEqual(1);
  });

  it('64^21 ≈ 2^126 — 1% risk needs a huge number of ids', () => {
    const n = idsForCollisionProbability(DEFAULT_ALPHABET_SIZE, DEFAULT_LENGTH, 0.01);
    // sqrt(2 * 64^21 * ln(1/0.99)) ≈ 1.3e18 (log-space exact)
    expect(n).toBeGreaterThan(1e18);
    expect(n).toBeLessThan(1.4e19);
    expect(Number.isFinite(n)).toBe(true);
  });

  it('shorter ids need fewer ids for same risk', () => {
    const n21 = idsForCollisionProbability(64, 21, 0.01);
    const n8 = idsForCollisionProbability(64, 8, 0.01);
    expect(n8).toBeLessThan(n21);
  });

  it('collision risk summary handles rate', () => {
    const s = collisionRiskSummary(64, 8, 1000, 0.5);
    expect(Number.isFinite(s.idsNeeded)).toBe(true);
    expect(s.secondsNeeded).toBeGreaterThan(0);
    expect(s.secondsNeeded).toBeCloseTo(s.idsNeeded / 1000, 5);
  });
});
