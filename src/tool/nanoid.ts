/**
 * Nano ID generator core logic — pure, framework-free, fully testable.
 */

export const URL_SAFE_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const DEFAULT_ALPHABET = URL_SAFE_ALPHABET;

export const DEFAULT_LENGTH = 21;
export const MIN_LENGTH = 6;
export const MAX_LENGTH = 128;
export const MIN_BATCH = 1;
export const MAX_BATCH = 250;
export const DEFAULT_BATCH = 10;

export const DEFAULT_ALPHABET_SIZE = DEFAULT_ALPHABET.length; // 64

export interface AlphabetValidation {
  valid: boolean;
  error: string | null;
}

export function validateAlphabet(alphabet: string): AlphabetValidation {
  if (typeof alphabet !== 'string' || alphabet.length < 16) {
    // Length check comes second so that duplicate detection is reported first
    // when both problems exist, matching user expectations for typo'd presets.
    const dupCheck = checkDuplicates(alphabet ?? '');
    if (dupCheck) return { valid: false, error: dupCheck };
    return {
      valid: false,
      error: 'Alphabet must contain at least 16 unique characters.',
    };
  }
  return checkDuplicates(alphabet)
    ? { valid: false, error: checkDuplicates(alphabet)! }
    : { valid: true, error: null };
}

function checkDuplicates(alphabet: string): string | null {
  if (typeof alphabet !== 'string') return null;
  const seen = new Set<string>();
  for (const ch of alphabet) {
    if (seen.has(ch)) {
      return `Duplicate character in alphabet: "${ch}"`;
    }
    seen.add(ch);
  }
  return null;
}

export function clampLength(length: number): number {
  if (Number.isNaN(length)) return DEFAULT_LENGTH;
  if (length === Number.POSITIVE_INFINITY) return MAX_LENGTH;
  if (length === Number.NEGATIVE_INFINITY) return MIN_LENGTH;
  if (!Number.isFinite(length)) return DEFAULT_LENGTH;
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, Math.round(length)));
}

/**
 * Deterministic seeded PRNG (mulberry32). Returns a function producing
 * floats in [0, 1). Same seed => same sequence across reruns.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface GenerateOptions {
  length?: number;
  alphabet?: string;
  /** Custom random source returning floats in [0, 1). */
  random?: () => number;
  /** Optional seed; when provided generation is deterministic. */
  seed?: number;
}

/**
 * Generates one Nano ID. Unbiased: alphabet size need not divide 256/2^32,
 * we rejection-sample unbiased indices from the provided random source.
 */
export function generateNanoId(options: GenerateOptions = {}): string {
  const length = clampLength(options.length ?? DEFAULT_LENGTH);
  const alphabet = options.alphabet ?? DEFAULT_ALPHABET;
  const validation = validateAlphabet(alphabet);
  if (!validation.valid) {
    throw new Error(validation.error ?? 'Invalid alphabet');
  }
  let random: () => number;
  if (options.seed !== undefined && options.seed !== null) {
    random = mulberry32(options.seed);
  } else if (options.random) {
    random = options.random;
  } else {
    random = Math.random;
  }

  const alphabetLength = alphabet.length;
  // Rejection sampling for unbiased indices using 32-bit values.
  const limit = Math.floor(0x100000000 / alphabetLength) * alphabetLength;
  let id = '';
  while (id.length < length) {
    const value = Math.floor(random() * 0x100000000) >>> 0;
    if (value >= limit) continue;
    id += alphabet[value % alphabetLength];
  }
  return id;
}

export function generateBatch(
  count: number,
  options: GenerateOptions & { incrementSeed?: boolean } = {}
): string[] {
  const batch = Math.min(MAX_BATCH, Math.max(MIN_BATCH, Math.round(count) || 1));
  const ids: string[] = [];
  let seed = options.seed;
  for (let i = 0; i < batch; i += 1) {
    const opts = { ...options };
    if (seed !== undefined && seed !== null) {
      opts.seed = seed;
      // Each ID in a seeded batch derives from a distinct seed so IDs differ.
      if (options.incrementSeed !== false) seed = (seed + 1) >>> 0;
    }
    ids.push(generateNanoId(opts));
  }
  return ids;
}

/**
 * Exact-ish collision probability for `count` ids drawn from a space of
 * `spaceSize` possibilities (birthday problem, Poisson approximation):
 *   P(at least one collision) ≈ 1 - e^(-count*(count-1)/(2*spaceSize))
 */
export function collisionProbability(
  alphabetSize: number,
  length: number,
  count: number
): number {
  if (alphabetSize <= 0 || length <= 0 || count < 2) return 0;
  const spaceSize = Math.pow(alphabetSize, length);
  const exponent = -(count * (count - 1)) / (2 * spaceSize);
  return 1 - Math.exp(exponent);
}

/**
 * Number of ids needed to reach `targetProbability` risk of one collision
 * (Poisson approximation, solved for n): n ≈ sqrt(2 * S * ln(1 / (1-p))).
 */
export function idsForCollisionProbability(
  alphabetSize: number,
  length: number,
  targetProbability: number
): number {
  if (alphabetSize <= 0 || length <= 0) return Infinity;
  if (targetProbability <= 0) return 0;
  if (targetProbability >= 1) return Infinity;
  const spaceSize = Math.pow(alphabetSize, length);
  const lnTerm = Math.log(1 / (1 - targetProbability));
  // Compute in log space to avoid floating-point overflow for huge spaces:
  // n = sqrt(2 * S * ln(1/(1-p))) = exp(0.5 * (ln 2S + lnTerm))
  const n = Math.exp(0.5 * (Math.log(2) + Math.log(spaceSize) + lnTerm));
  return Math.ceil(n);
}

/** Human-readable risk summary combining generation rate. */
export function collisionRiskSummary(
  alphabetSize: number,
  length: number,
  idsPerSecond: number,
  targetProbability = 0.01
): { idsNeeded: number; secondsNeeded: number } {
  const idsNeeded = idsForCollisionProbability(alphabetSize, length, targetProbability);
  const rate = idsPerSecond > 0 ? idsPerSecond : 1;
  const secondsNeeded = idsNeeded / rate;
  return { idsNeeded, secondsNeeded };
}
