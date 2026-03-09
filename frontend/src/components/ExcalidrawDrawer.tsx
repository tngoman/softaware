import React, { useState, useRef, useCallback, useEffect } from 'react';
import { XMarkIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';

/**
 * ExcalidrawDrawer — Full-screen Excalidraw editor overlay.
 *
 * On "Save as Comment" it:
 *   1. Exports the canvas to PNG via Excalidraw's exportToBlob
 *   2. Converts the blob to a base64 data-URL
 *   3. Also serialises the Excalidraw scene JSON (so drawings can be re-opened)
 *   4. Calls `onSave` with { imageBase64, sceneJson, fileName }
 */

interface ExcalidrawDrawerProps {
  open: boolean;
  onClose: () => void;
  /** Called with the exported drawing artefacts */
  onSave: (payload: {
    imageBase64: string;      // data:image/png;base64,...
    sceneJson: string;        // JSON string of the Excalidraw scene
    fileName: string;
  }) => Promise<void> | void;
  /** Optional initial scene data (for re-opening a previous drawing) */
  initialData?: any;
  taskTitle?: string;
}

const ExcalidrawDrawer: React.FC<ExcalidrawDrawerProps> = ({
  open,
  onClose,
  onSave,
  initialData,
  taskTitle,
}) => {
  const [Comp, setComp] = useState<any>(null);
  const [exportFn, setExportFn] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [readyToRender, setReadyToRender] = useState(false);
  const excalidrawApiRef = useRef<any>(null);
  const loadedRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Lazy-load Excalidraw only when drawer opens
  React.useEffect(() => {
    if (!open || loadedRef.current) return;
    loadedRef.current = true;

    // Load the CSS
    import('@excalidraw/excalidraw/index.css' as any).catch(() => {
      // Fallback: inject a link tag if the CSS import fails
      const existing = document.querySelector('link[data-excalidraw-css]');
      if (!existing) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.setAttribute('data-excalidraw-css', '');
        // The CSS is bundled in the excalidraw chunk
        link.href = '';
        // Don't worry if this fails - the dynamic import above likely included it
      }
    });

    import('@excalidraw/excalidraw').then((mod) => {
      setComp(() => mod.Excalidraw);
      setExportFn(() => mod.exportToBlob);
    });
  }, [open]);

  // Wait for the container to have real pixel dimensions before mounting Excalidraw.
  // Without this, Excalidraw's bootstrapCanvas reads 0×0 or absurdly large sizes
  // and hits the "Canvas exceeds max size" error.
  useEffect(() => {
    if (!open || !Comp) {
      setReadyToRender(false);
      return;
    }
    // Two rAFs + a short timeout guarantees the fixed overlay has been laid out
    let cancelled = false;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          if (!cancelled) setReadyToRender(true);
        }, 50);
      });
    });
    return () => { cancelled = true; };
  }, [open, Comp]);

  const handleSave = useCallback(async () => {
    if (!excalidrawApiRef.current || !exportFn) return;
    setSaving(true);

    try {
      const api = excalidrawApiRef.current;
      const elements = api.getSceneElements();
      const appState = api.getAppState();
      const files = api.getFiles();

      if (!elements || elements.length === 0) {
        setSaving(false);
        return;
      }

      // Export to PNG blob
      const blob = await exportFn({
        elements,
        appState: {
          ...appState,
          exportWithDarkMode: false,
          exportBackground: true,
        },
        files,
        mimeType: 'image/png',
        quality: 0.95,
      });

      // Convert blob → base64 data URL
      const imageBase64: string = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });

      // Serialise the scene for future re-opening
      const sceneJson = JSON.stringify({
        elements,
        appState: {
          viewBackgroundColor: appState.viewBackgroundColor,
          gridSize: appState.gridSize,
        },
        files,
      });

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const fileName = `drawing-${timestamp}.png`;

      await onSave({ imageBase64, sceneJson, fileName });
    } catch (err) {
      console.error('Excalidraw export error:', err);
    } finally {
      setSaving(false);
    }
  }, [exportFn, onSave]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      style={{ isolation: 'isolate' }}
      onClick={e => e.stopPropagation()}
      onPointerDown={e => e.stopPropagation()}
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Header toolbar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-gray-50 shrink-0">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Drawing {taskTitle ? `— ${taskTitle}` : ''}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSave}
            disabled={saving || !Comp}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-medium bg-picton-blue text-white rounded-lg hover:bg-picton-blue/90 disabled:opacity-50"
          >
            <ArrowDownTrayIcon className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save as Comment'}
          </button>
          <button
            onClick={onClose}
            className="p-1.5 rounded hover:bg-gray-200"
            title="Close"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Excalidraw canvas — container with explicit dimensions */}
      <div
        ref={containerRef}
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          minHeight: 0,
          width: '100%',
        }}
      >
        {readyToRender ? (
          <div style={{ width: '100%', height: '100%' }}>
            {/* Hide the Library button via CSS — no UIOptions prop exists for it */}
            <style>{`.excalidraw .sidebar-trigger, .excalidraw .library-button, .excalidraw [aria-label="Library"], .excalidraw .default-sidebar-trigger { display: none !important; }`}</style>
            <Comp
              excalidrawAPI={(api: any) => { excalidrawApiRef.current = api; }}
              initialData={initialData || undefined}
              UIOptions={{
                canvasActions: {
                  saveToActiveFile: false,
                  loadScene: false,
                  export: false,
                },
                tools: { image: false },
              }}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center h-full text-gray-400">
            Loading drawing editor…
          </div>
        )}
      </div>
    </div>
  );
};

export default ExcalidrawDrawer;
