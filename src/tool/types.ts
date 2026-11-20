export type AlphabetPreset = 'url-safe' | 'custom';

export interface ToolState {
  /** Current generated IDs (batch). */
  ids: string[];
  /** ID length, clamped between MIN_LENGTH and MAX_LENGTH. */
  length: number;
  /** Number of IDs to generate per batch, clamped 1..MAX_BATCH. */
  batchSize: number;
  /** Alphabet characters used for generation. */
  alphabet: string;
  /** Whether the alphabet is the URL-safe preset or user-customized. */
  alphabetPreset: AlphabetPreset;
  /** Optional seed for deterministic generation; null = random. */
  seed: number | null;
  /** Use seeded PRNG instead of Math.random. */
  useSeed: boolean;
  /** IDs per second used for collision risk estimates. */
  generationRate: number;
  /** Last validation error for the alphabet, if any. */
  error: string | null;
  /** Monotonic counter bumped on every regeneration (UI feedback hook). */
  generation: number;
}
