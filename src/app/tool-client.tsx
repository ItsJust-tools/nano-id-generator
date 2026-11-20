'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentType,
  type ReactNode,
} from 'react';
import { ToolShell, useTool, ImportExport } from '@itsjust/core';
import { compressToEncodedURIComponent, decompressFromEncodedURIComponent } from 'lz-string';
import {
  toolConfig,
  templateBaseVersion,
  ToolCanvas,
  ToolToolbar,
  ToolSidebar,
  regenerate as regenerateIds,
  setLength as applyLength,
  setAlphabet as applyAlphabet,
  setBatchSize as applyBatchSize,
  setSeedMode as applySeedMode,
} from '@/tool';
import { nanoidTool } from '@/tool/tool-definition';
import type { ToolState } from '@/tool/types';

export default function ToolClient() {
  const ToolShellCompat = ToolShell as unknown as ComponentType<Record<string, unknown>> & {
    Toolbar?: ComponentType<{ children?: ReactNode }>;
    Body?: ComponentType<{ children?: ReactNode }>;
    Sidebar?: ComponentType<{ children?: ReactNode }>;
    Canvas?: ComponentType<{ children?: ReactNode }>;
    StatusBar?: ComponentType<{ children?: ReactNode }>;
  };
  const canvasRef = useRef<HTMLDivElement>(null);
  const tool = useTool<ToolState>(nanoidTool, canvasRef);
  const setToolData = tool.state.setData;
  const showToast = tool.toast;
  const [isSharing, setIsSharing] = useState(false);
  const hasLoadedSharedState = useRef(false);
  const [sidebarOpen, setSidebarOpen] = useState<boolean>(
    () => typeof window !== 'undefined' && window.innerWidth > 768 && toolConfig.features.sidebar
  );

  const state = tool.state.data;

  useEffect(() => {
    document.title = toolConfig.name;
  }, []);

  useEffect(() => {
    if (hasLoadedSharedState.current) return;
    hasLoadedSharedState.current = true;
    const params = new URLSearchParams(window.location.search);
    const encodedState = params.get('state');
    if (!encodedState) return;
    try {
      const serialized = decompressFromEncodedURIComponent(encodedState);
      if (!serialized) throw new Error('Invalid shared URL');
      const parsed: unknown = JSON.parse(serialized);
      const deserialized = nanoidTool.deserialize(parsed);
      if (!deserialized.success) throw new Error(deserialized.error);
      setToolData(deserialized.data);
      showToast('Loaded state from shared URL', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to load shared URL';
      showToast(message, 'error');
    }
  }, [setToolData, showToast]);

  const handleShare = useCallback(async () => {
    setIsSharing(true);
    try {
      const serialized = nanoidTool.serialize(tool.state.data);
      const encodedState = compressToEncodedURIComponent(serialized);
      if (!encodedState) throw new Error('Failed to encode state for URL');
      const url = new URL(window.location.href);
      url.searchParams.set('state', encodedState);
      url.searchParams.set('tool', toolConfig.id);
      window.history.replaceState(null, '', url.toString());

      const shareUrl = url.toString();
      if (navigator.share) {
        try {
          await navigator.share({ title: toolConfig.name, url: shareUrl });
          showToast('Shared URL ready', 'success');
          return;
        } catch (error) {
          if (error instanceof Error && error.name === 'AbortError') return;
        }
      }
      await navigator.clipboard.writeText(shareUrl);
      showToast('Share URL copied to clipboard', 'success');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create share URL';
      showToast(message, 'error');
    } finally {
      setIsSharing(false);
    }
  }, [showToast, tool.state.data]);

  const handleRegenerate = useCallback(() => {
    setToolData((prev) => regenerateIds(prev));
  }, [setToolData]);

  const handleLengthChange = useCallback(
    (length: number) => {
      setToolData((prev) => applyLength(prev, length));
    },
    [setToolData]
  );

  const handleBatchSizeChange = useCallback(
    (batchSize: number) => {
      setToolData((prev) => applyBatchSize(prev, batchSize));
    },
    [setToolData]
  );

  const handleAlphabetChange = useCallback(
    (alphabet: string) => {
      setToolData((prev) => applyAlphabet(prev, alphabet));
    },
    [setToolData]
  );

  const handleSeedChange = useCallback(
    (useSeed: boolean, seed?: number) => {
      setToolData((prev) => applySeedMode(prev, useSeed, seed));
    },
    [setToolData]
  );

  const handleRateChange = useCallback(
    (rate: number) => {
      setToolData((prev) => ({ ...prev, generationRate: Math.max(0, rate) }));
    },
    [setToolData]
  );

  const toolbarContent = (
    <>
      <ToolToolbar />
      <ImportExport
        formats={tool.supportedFormats}
        onExport={tool.handleExport}
        onImport={tool.importFromFile}
        isImporting={tool.isImporting}
        onShare={handleShare}
        isSharing={isSharing}
      />
    </>
  );

  const sidebarContent = (
    <ToolSidebar
      state={state}
      onLengthChange={handleLengthChange}
      onBatchSizeChange={handleBatchSizeChange}
      onAlphabetChange={handleAlphabetChange}
      onSeedChange={handleSeedChange}
      onRateChange={handleRateChange}
    />
  );

  const canvasContent = (
    <ToolCanvas
      canvasRef={canvasRef}
      ids={state.ids}
      generation={state.generation}
      alphabet={state.alphabet}
      error={state.error}
      onRegenerate={handleRegenerate}
    />
  );

  const statusBarContent = useMemo(
    () => (
      <>
        <span
          className={`status-slot status-slot-state ${tool.state.isDirty ? 'status-unsaved' : 'status-saved'}`}
        >
          {tool.state.isDirty ? (
            <>
              <span className="status-saving-dot" />
              Unsaved
            </>
          ) : tool.state.lastSaved ? (
            <>Saved {tool.state.lastSaved}</>
          ) : (
            'Ready'
          )}
        </span>
        <span className="status-slot status-slot-ids">{state.ids.length} IDs</span>
        <span className="status-slot status-slot-length">
          len {state.length}
        </span>
        <span className="status-slot status-slot-tool-version">
          Tool v{toolConfig.version}
        </span>
        <span className="status-slot status-slot-template-version">
          Template v{templateBaseVersion}
        </span>
      </>
    ),
    [tool.state.isDirty, tool.state.lastSaved, state.ids.length, state.length]
  );

  const hasLegacySections = Boolean(
    ToolShellCompat.Toolbar &&
    ToolShellCompat.Body &&
    ToolShellCompat.Sidebar &&
    ToolShellCompat.Canvas &&
    ToolShellCompat.StatusBar
  );

  return (
    <ToolShellCompat
      config={toolConfig}
      actions={useMemo(() => tool.toolbarActions, [tool.toolbarActions])}
      sidebarOpen={sidebarOpen}
      onSidebarChange={setSidebarOpen}
      toolbar={toolbarContent}
      sidebar={sidebarContent}
      canvas={canvasContent}
      statusBar={statusBarContent}
    >
      {hasLegacySections
        ? (() => {
            const ToolbarSection = ToolShellCompat.Toolbar as ComponentType<{
              children?: ReactNode;
            }>;
            const BodySection = ToolShellCompat.Body as ComponentType<{ children?: ReactNode }>;
            const SidebarSection = ToolShellCompat.Sidebar as ComponentType<{
              children?: ReactNode;
            }>;
            const CanvasSection = ToolShellCompat.Canvas as ComponentType<{ children?: ReactNode }>;
            const StatusBarSection = ToolShellCompat.StatusBar as ComponentType<{
              children?: ReactNode;
            }>;
            return (
              <>
                <ToolbarSection>{toolbarContent}</ToolbarSection>
                <BodySection>
                  <SidebarSection>{sidebarContent}</SidebarSection>
                  <CanvasSection>{canvasContent}</CanvasSection>
                </BodySection>
                <StatusBarSection>{statusBarContent}</StatusBarSection>
              </>
            );
          })()
        : null}
    </ToolShellCompat>
  );
}
