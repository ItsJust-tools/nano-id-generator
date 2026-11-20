import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ReactNode } from 'react';
import ToolClient from '@/app/tool-client';
import ToolClientWrapper from '@/app/tool-client-wrapper';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

vi.mock('next/dynamic', () => ({
  default: () => () => <div data-testid="dynamic-tool-client">dynamic-tool-client</div>,
}));

const mockSetData = vi.fn();
const mockToast = vi.fn();
const mockHandleExport = vi.fn();
const mockImport = vi.fn();
const mockToolbarActions = { canUndo: true, canRedo: true, onUndo: vi.fn(), onRedo: vi.fn() };

const mockStateData = {
  ids: ['AAAAAAAAAAAAAAAAAAAAAA', 'BBBBBBBBBBBBBBBBBBBBBB'],
  length: 21,
  batchSize: 2,
  alphabet: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_',
  alphabetPreset: 'url-safe',
  seed: null,
  useSeed: false,
  generationRate: 1000,
  error: null,
  generation: 1,
};

vi.mock('@itsjust/core', () => ({
  ToolShell: ({ toolbar, sidebar, canvas, statusBar }: Record<string, unknown>) => (
    <div>
      <div>{toolbar as ReactNode}</div>
      <div>{sidebar as ReactNode}</div>
      <div>{canvas as ReactNode}</div>
      <div>{statusBar as ReactNode}</div>
    </div>
  ),
  ImportExport: ({ onShare }: { onShare?: () => void }) => (
    <button type="button" onClick={onShare}>
      trigger-share
    </button>
  ),
  useTool: () => ({
    state: {
      data: mockStateData,
      setData: mockSetData,
      isDirty: false,
      lastSaved: 'just now',
    },
    toast: mockToast,
    supportedFormats: ['json'],
    handleExport: mockHandleExport,
    importFromFile: mockImport,
    isImporting: false,
    toolbarActions: mockToolbarActions,
  }),
}));

vi.mock('@/tool', () => ({
  toolConfig: {
    id: 'tool-1795161888',
    name: 'Nano ID Generator',
    version: '1.0.0',
    features: { sidebar: true },
    theme: { brand: 'Nano ID Generator' },
  },
  templateBaseVersion: '1.4.0',
  ToolCanvas: ({ ids, generation }: { ids: string[]; generation: number }) => (
    <div>
      canvas:gen{generation}:{ids.join(',')}
    </div>
  ),
  ToolToolbar: () => <div>toolbar</div>,
  ToolSidebar: ({ state }: { state: typeof mockStateData }) => (
    <div>sidebar:{state.alphabetPreset}</div>
  ),
  regenerate: (s: typeof mockStateData) => ({ ...s, generation: s.generation + 1 }),
  setLength: (s: typeof mockStateData, _l: number) => s,
  setAlphabet: (s: typeof mockStateData, _a: string) => s,
  setBatchSize: (s: typeof mockStateData, _b: number) => s,
  setSeedMode: (s: typeof mockStateData, _u: boolean, _seed?: number) => s,
}));

vi.mock('@/tool/tool-definition', async (importOriginal) => {
  const original = await importOriginal<typeof import('@/tool/tool-definition')>();
  return {
    ...original,
    nanoidTool: {
      serialize: (state: unknown) => JSON.stringify(state),
      deserialize: () => ({ success: true, data: { ...mockStateData, generation: 9 } }),
    },
  };
});

describe('app client and help page', () => {
  beforeEach(() => {
    mockSetData.mockReset();
    mockToast.mockReset();
    Object.defineProperty(navigator, 'clipboard', {
      writable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
    Object.defineProperty(navigator, 'share', {
      writable: true,
      value: vi.fn().mockResolvedValue(undefined),
    });
    window.history.replaceState(null, '', 'http://localhost:3000/');
  });

  it('renders dynamic tool client wrapper', () => {
    render(<ToolClientWrapper />);
    expect(screen.getByTestId('dynamic-tool-client')).toBeInTheDocument();
  });

  it('renders generated ids in canvas', () => {
    render(<ToolClient />);
    expect(screen.getByText(/canvas:gen1:/)).toBeInTheDocument();
  });

  it('handles share flow in tool client', async () => {
    render(<ToolClient />);
    expect(screen.getByText('toolbar')).toBeInTheDocument();
    fireEvent.click(screen.getByText('trigger-share'));
    await vi.waitFor(() => expect(mockToast).toHaveBeenCalled());
  });
});
