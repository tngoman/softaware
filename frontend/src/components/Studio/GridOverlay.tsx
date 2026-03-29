/**
 * GridOverlay — visual snap-to-grid overlay for the Studio canvas.
 * Renders CSS-based grid lines + optional ruler markings.
 */

interface GridOverlayProps {
  gridSize?: number;
  showRulers?: boolean;
  zoom?: number;
  visible?: boolean;
}

export default function GridOverlay({ gridSize = 20, showRulers = true, zoom = 100, visible = true }: GridOverlayProps) {
  if (!visible) return null;

  const scale = zoom / 100;
  const scaledGrid = gridSize * scale;

  return (
    <div className="absolute inset-0 pointer-events-none z-10">
      {/* Grid lines */}
      <div
        className="absolute inset-0 opacity-[0.06]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)
          `,
          backgroundSize: `${scaledGrid}px ${scaledGrid}px`,
        }}
      />

      {/* Major grid lines (every 5 cells) */}
      <div
        className="absolute inset-0 opacity-[0.12]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(99,102,241,1) 1px, transparent 1px),
            linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)
          `,
          backgroundSize: `${scaledGrid * 5}px ${scaledGrid * 5}px`,
        }}
      />

      {/* Top ruler */}
      {showRulers && (
        <>
          <div className="absolute top-0 left-0 right-0 h-4 bg-gray-900/80 border-b border-gray-800 flex items-end">
            {Array.from({ length: Math.ceil(2000 / (scaledGrid * 5)) }, (_, i) => (
              <span
                key={i}
                className="absolute text-[8px] text-gray-600 font-mono"
                style={{ left: `${i * scaledGrid * 5}px` }}
              >
                {Math.round(i * gridSize * 5)}
              </span>
            ))}
          </div>

          {/* Left ruler */}
          <div className="absolute top-4 left-0 bottom-0 w-4 bg-gray-900/80 border-r border-gray-800">
            {Array.from({ length: Math.ceil(2000 / (scaledGrid * 5)) }, (_, i) => (
              <span
                key={i}
                className="absolute text-[8px] text-gray-600 font-mono"
                style={{
                  top: `${i * scaledGrid * 5}px`,
                  writingMode: 'vertical-rl',
                  transform: 'rotate(180deg)',
                }}
              >
                {Math.round(i * gridSize * 5)}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
