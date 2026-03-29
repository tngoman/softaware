import { useState, useRef, useCallback, useEffect } from 'react';

interface SelectionBoxProps {
  /** Canvas container element ref */
  containerRef: React.RefObject<HTMLDivElement>;
  /** Called when selection completes with the bounding rect */
  onSelect: (rect: { x: number; y: number; width: number; height: number }) => void;
  /** Whether selection mode is active */
  active?: boolean;
  zoom?: number;
}

export default function SelectionBox({ containerRef, onSelect, active = true, zoom = 100 }: SelectionBoxProps) {
  const [dragging, setDragging] = useState(false);
  const [box, setBox] = useState({ startX: 0, startY: 0, endX: 0, endY: 0 });
  const scale = zoom / 100;

  const getRelativePos = useCallback((e: React.MouseEvent) => {
    const container = containerRef.current;
    if (!container) return { x: 0, y: 0 };
    const rect = container.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) / scale,
      y: (e.clientY - rect.top) / scale,
    };
  }, [containerRef, scale]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!active || e.button !== 0) return;
    // Only start if clicking directly on the overlay, not on content
    if (e.target !== e.currentTarget) return;
    const pos = getRelativePos(e);
    setDragging(true);
    setBox({ startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y });
  }, [active, getRelativePos]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging) return;
    const pos = getRelativePos(e);
    setBox(prev => ({ ...prev, endX: pos.x, endY: pos.y }));
  }, [dragging, getRelativePos]);

  const handleMouseUp = useCallback(() => {
    if (!dragging) return;
    setDragging(false);

    const x = Math.min(box.startX, box.endX);
    const y = Math.min(box.startY, box.endY);
    const width = Math.abs(box.endX - box.startX);
    const height = Math.abs(box.endY - box.startY);

    // Only fire selection if drag is meaningful (> 5px)
    if (width > 5 && height > 5) {
      onSelect({ x, y, width, height });
    }
  }, [dragging, box, onSelect]);

  if (!active) return null;

  const x = Math.min(box.startX, box.endX);
  const y = Math.min(box.startY, box.endY);
  const w = Math.abs(box.endX - box.startX);
  const h = Math.abs(box.endY - box.startY);

  return (
    <div
      className="absolute inset-0 z-20"
      style={{ cursor: 'crosshair' }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {dragging && w > 0 && h > 0 && (
        <>
          {/* Selection rectangle */}
          <div
            className="absolute border-2 border-indigo-400 bg-indigo-400/10 pointer-events-none"
            style={{
              left: `${x * scale}px`,
              top: `${y * scale}px`,
              width: `${w * scale}px`,
              height: `${h * scale}px`,
            }}
          />

          {/* Dimension label */}
          <div
            className="absolute bg-gray-900 text-[10px] text-indigo-400 px-1.5 py-0.5 rounded shadow pointer-events-none"
            style={{
              left: `${(x + w / 2) * scale - 20}px`,
              top: `${(y + h) * scale + 4}px`,
            }}
          >
            {Math.round(w)} × {Math.round(h)}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Resize handles for a selected element.
 * Shows 8 handles (corners + edges) around the selection.
 */
interface ResizeHandlesProps {
  rect: { x: number; y: number; width: number; height: number };
  onResize: (handle: string, dx: number, dy: number) => void;
  zoom?: number;
}

export function ResizeHandles({ rect, onResize, zoom = 100 }: ResizeHandlesProps) {
  const scale = zoom / 100;
  const HANDLE_SIZE = 8;

  const handles = [
    { id: 'nw', x: 0, y: 0, cursor: 'nw-resize' },
    { id: 'n', x: 0.5, y: 0, cursor: 'n-resize' },
    { id: 'ne', x: 1, y: 0, cursor: 'ne-resize' },
    { id: 'e', x: 1, y: 0.5, cursor: 'e-resize' },
    { id: 'se', x: 1, y: 1, cursor: 'se-resize' },
    { id: 's', x: 0.5, y: 1, cursor: 's-resize' },
    { id: 'sw', x: 0, y: 1, cursor: 'sw-resize' },
    { id: 'w', x: 0, y: 0.5, cursor: 'w-resize' },
  ];

  return (
    <>
      {/* Selection outline */}
      <div
        className="absolute border-2 border-indigo-500 pointer-events-none"
        style={{
          left: `${rect.x * scale}px`,
          top: `${rect.y * scale}px`,
          width: `${rect.width * scale}px`,
          height: `${rect.height * scale}px`,
        }}
      />

      {/* Handles */}
      {handles.map(h => (
        <div
          key={h.id}
          className="absolute bg-white border-2 border-indigo-500 rounded-sm"
          style={{
            left: `${(rect.x + rect.width * h.x) * scale - HANDLE_SIZE / 2}px`,
            top: `${(rect.y + rect.height * h.y) * scale - HANDLE_SIZE / 2}px`,
            width: `${HANDLE_SIZE}px`,
            height: `${HANDLE_SIZE}px`,
            cursor: h.cursor,
          }}
          onMouseDown={e => {
            e.stopPropagation();
            const startX = e.clientX;
            const startY = e.clientY;
            const handleMove = (ev: MouseEvent) => {
              onResize(h.id, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
            };
            const handleUp = () => {
              document.removeEventListener('mousemove', handleMove);
              document.removeEventListener('mouseup', handleUp);
            };
            document.addEventListener('mousemove', handleMove);
            document.addEventListener('mouseup', handleUp);
          }}
        />
      ))}
    </>
  );
}
