'use client';

import { useCallback } from 'react';

export interface ToolCanvasProps {
  ids: string[];
  generation: number;
  alphabet: string;
  error: string | null;
  canvasRef?: React.RefObject<HTMLDivElement | null>;
  onRegenerate?: () => void;
}

export function ToolCanvas({
  ids,
  generation,
  alphabet,
  error,
  canvasRef,
  onRegenerate,
}: ToolCanvasProps) {
  const copyOne = useCallback((id: string) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(id);
    }
  }, []);

  const copyAll = useCallback(() => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(ids.join('\n'));
    }
  }, [ids]);

  return (
    <div
      ref={canvasRef}
      className="nanoid-canvas"
      role="application"
      aria-label="Nano ID canvas"
      data-generation={generation}
    >
      <div className="nanoid-header">
        <h2>Generated Nano IDs</h2>
        <div className="nanoid-actions">
          <button
            type="button"
            className="nanoid-btn nanoid-btn-primary"
            onClick={onRegenerate}
            aria-label="Regenerate IDs"
            title="Regenerate all IDs"
          >
            ↻ Regenerate
          </button>
          <button
            type="button"
            className="nanoid-btn"
            onClick={copyAll}
            aria-label="Copy all IDs"
            title="Copy all IDs to clipboard"
          >
            ⧉ Copy all
          </button>
        </div>
      </div>

      {error && (
        <div className="nanoid-error" role="alert">
          {error}
        </div>
      )}

      <ul className="nanoid-list">
        {ids.map((id, index) => (
          <li key={`${generation}-${index}-${id}`} className="nanoid-row">
            <code className="nanoid-id" title={id}>
              {id}
            </code>
            <button
              type="button"
              className="nanoid-btn nanoid-btn-copy"
              onClick={() => copyOne(id)}
              aria-label={`Copy ID ${index + 1}`}
              title="Copy to clipboard"
            >
              ⧉
            </button>
          </li>
        ))}
        {ids.length === 0 && (
          <li className="nanoid-empty">No IDs generated yet — hit Regenerate.</li>
        )}
      </ul>

      <p className="nanoid-hint">
        Alphabet ({alphabet.length} chars): <code>{alphabet}</code>
      </p>
    </div>
  );
}
