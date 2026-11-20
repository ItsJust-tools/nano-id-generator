'use client';

import { useMemo } from 'react';
import type { ToolState } from '../types';
import {
  URL_SAFE_ALPHABET,
  DEFAULT_ALPHABET_SIZE,
  collisionProbability,
  idsForCollisionProbability,
} from '../nanoid';

interface ToolSidebarProps {
  state: ToolState;
  onLengthChange?: (length: number) => void;
  onBatchSizeChange?: (batchSize: number) => void;
  onAlphabetChange?: (alphabet: string) => void;
  onSeedChange?: (useSeed: boolean, seed?: number) => void;
  onRateChange?: (rate: number) => void;
}

const TARGET_PROBABILITY = 0.01;

function formatBigNumber(n: number): string {
  if (!Number.isFinite(n)) return '∞';
  if (n >= 1e12) return n.toExponential(2).replace('e+', ' × 10^');
  return Math.round(n).toLocaleString();
}

export function ToolSidebar({
  state,
  onLengthChange,
  onBatchSizeChange,
  onAlphabetChange,
  onSeedChange,
  onRateChange,
}: ToolSidebarProps) {
  const alphabetSize = state.alphabet.length;
  const stats = useMemo(
    () => ({
      spaceSize: Math.pow(alphabetSize, state.length),
      idsToOnePercent: idsForCollisionProbability(alphabetSize, state.length, TARGET_PROBABILITY),
    }),
    [alphabetSize, state.length]
  );

  return (
    <div className="nanoid-sidebar">
      <div className="sidebar-section">
        <h3>Generation</h3>
        <label className="sidebar-field">
          <span>Length ({state.length})</span>
          <input
            type="range"
            min={6}
            max={128}
            value={state.length}
            onChange={(e) => onLengthChange?.(Number(e.target.value))}
            aria-label="ID length"
          />
        </label>
        <label className="sidebar-field">
          <span>Batch size</span>
          <input
            type="number"
            min={1}
            max={250}
            value={state.batchSize}
            onChange={(e) => onBatchSizeChange?.(Number(e.target.value))}
            aria-label="Batch size"
          />
        </label>
        <label className="sidebar-field">
          <span>Seed (deterministic)</span>
          <input
            type="number"
            value={state.seed ?? 1}
            disabled={!state.useSeed}
            onChange={(e) => onSeedChange?.(true, Number(e.target.value) >>> 0)}
            aria-label="Seed"
          />
        </label>
        <label className="sidebar-check">
          <input
            type="checkbox"
            checked={state.useSeed}
            onChange={(e) => onSeedChange?.(e.target.checked, state.seed ?? 1)}
            aria-label="Use seeded PRNG"
          />
          <span>Use seeded PRNG</span>
        </label>
      </div>

      <div className="sidebar-section">
        <h3>Alphabet ({alphabetSize} chars)</h3>
        <textarea
          className="sidebar-alphabet-input"
          value={state.alphabet}
          rows={3}
          onChange={(e) => onAlphabetChange?.(e.target.value)}
          aria-label="Custom alphabet"
          spellCheck={false}
        />
        <button
          type="button"
          className="sidebar-btn"
          onClick={() => onAlphabetChange?.(URL_SAFE_ALPHABET)}
          aria-label="Restore URL-safe alphabet"
        >
          Reset to URL-safe preset
        </button>
        {state.error && (
          <p className="sidebar-error" role="alert">
            {state.error}
          </p>
        )}
      </div>

      <div className="sidebar-section">
        <h3>Collision estimates</h3>
        <label className="sidebar-field">
          <span>Generation rate (ids/sec)</span>
          <input
            type="number"
            min={0}
            value={state.generationRate}
            onChange={(e) => onRateChange?.(Number(e.target.value))}
            aria-label="Generation rate"
          />
        </label>
        <dl className="stats-list">
          <div className="stat-row">
            <dt>ID space</dt>
            <dd>{formatBigNumber(Math.pow(alphabetSize, state.length))}</dd>
          </div>
          <div className="stat-row">
            <dt>Collision risk / day</dt>
            <dd>
              {Math.min(1, Math.max(0, collisionProbability(
                alphabetSize,
                state.length,
                Math.round(state.generationRate * 86400)
              ))).toExponential(3)}
            </dd>
          </div>
          <div className="stat-row">
            <dt>IDs to reach 1% risk</dt>
            <dd>{formatBigNumber(stats.idsToOnePercent)}</dd>
          </div>
          <div className="stat-row">
            <dt>Alphabet preset</dt>
            <dd>{state.alphabetPreset === 'url-safe' ? 'URL-safe' : 'Custom'}</dd>
          </div>
        </dl>
      </div>

      <div className="sidebar-section">
        <h3>Nano ID vs UUID</h3>
        <p className="sidebar-help-text">
          Nano IDs pack randomness into fewer characters: a 21-char Nano ID drawn from a
          64-char alphabet has about the same collision resistance as a UUID v4
          (122 bits), but is roughly 30% shorter and URL-safe by default. UUIDs are
          standardized and fixed-format; Nano IDs let you trade length against entropy
          and choose your own alphabet.
        </p>
      </div>
    </div>
  );
}
