import { useRef, useEffect, useState } from 'react';
import { useStudioState } from '../../hooks/useStudioState';

const VIEWPORT_WIDTHS = { desktop: 1280, tablet: 768, mobile: 375 };

export default function StudioCanvas() {
  const { state, dispatch } = useStudioState();
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [hoveredElement, setHoveredElement] = useState<string | null>(null);

  const width = VIEWPORT_WIDTHS[state.viewport];
  const scale = state.zoom / 100;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const component = e.dataTransfer.getData('text/plain');
    if (component) {
      console.log('Dropped component:', component);
      // TODO: Add component to page
      alert(`Add ${component} component (not yet implemented)`);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  // Listen for messages from iframe for element selection
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'studio-select') {
        dispatch({ type: 'SELECT_COMPONENT', componentId: e.data.selector });
      }
      if (e.data?.type === 'studio-hover') {
        setHoveredElement(e.data.selector);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [dispatch]);

  // Build preview HTML for the current page
  const currentPageData = state.pages.find(p => p.id === state.currentPage);
  const previewHtml = currentPageData?.html_content || getPlaceholderHTML(state.site?.business_name);

  const srcDoc = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: system-ui, -apple-system, sans-serif; }
        [data-studio-id]:hover { outline: 2px solid rgba(99,102,241,0.5); outline-offset: -1px; cursor: pointer; }
        [data-studio-id].studio-selected { outline: 2px solid #6366f1; outline-offset: -1px; }
      </style>
      ${currentPageData?.css_content ? `<style>${currentPageData.css_content}</style>` : ''}
    </head>
    <body>
      ${previewHtml}
      <script>
        document.addEventListener('click', function(e) {
          const el = e.target.closest('[data-studio-id]');
          if (el) {
            e.preventDefault();
            e.stopPropagation();
            document.querySelectorAll('.studio-selected').forEach(s => s.classList.remove('studio-selected'));
            el.classList.add('studio-selected');
            window.parent.postMessage({ type: 'studio-select', selector: el.getAttribute('data-studio-id') }, '*');
          }
        });
        document.addEventListener('mouseover', function(e) {
          const el = e.target.closest('[data-studio-id]');
          if (el) {
            window.parent.postMessage({ type: 'studio-hover', selector: el.getAttribute('data-studio-id') }, '*');
          }
        });
      </script>
    </body>
    </html>
  `;

  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center overflow-auto relative"
      onDrop={handleDrop}
      onDragOver={handleDragOver}
    >
      {/* Grid overlay */}
      {state.showGrid && (
        <div className="absolute inset-0 pointer-events-none z-10 opacity-10"
          style={{
            backgroundImage: 'linear-gradient(rgba(99,102,241,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,0.3) 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
      )}

      {/* Canvas frame */}
      <div
        className="relative transition-all duration-200 ease-out shadow-2xl shadow-black/50"
        style={{
          width: `${width}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
        }}
      >
        {/* Viewport label */}
        <div className="absolute -top-6 left-0 text-[10px] text-gray-600">
          {state.viewport} — {width}px — {state.zoom}%
        </div>

        {/* Browser chrome */}
        <div className="bg-gray-800 rounded-t-lg px-3 py-1.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/60" />
            <div className="w-2.5 h-2.5 rounded-full bg-green-500/60" />
          </div>
          <div className="flex-1 bg-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-400 truncate">
            {state.site?.custom_domain || `${state.site?.business_name?.toLowerCase().replace(/\s+/g, '-')}.softaware.net.za`}
          </div>
        </div>

        {/* Iframe */}
        <iframe
          ref={iframeRef}
          srcDoc={srcDoc}
          className="w-full bg-white border-x border-b border-gray-800 rounded-b-lg"
          style={{ minHeight: '600px', height: '80vh' }}
          sandbox="allow-scripts"
          title="Site Preview"
        />
      </div>
    </div>
  );
}

function getPlaceholderHTML(businessName?: string): string {
  return `
    <div style="min-height: 100vh; display: flex; flex-direction: column; align-items: center; justify-content: center; background: linear-gradient(135deg, #1e1b4b 0%, #312e81 100%); color: white; padding: 2rem; text-align: center;">
      <div style="font-size: 3rem; font-weight: bold; margin-bottom: 1rem;">
        ${businessName || 'Your Site'}
      </div>
      <p style="font-size: 1.2rem; opacity: 0.7; max-width: 500px;">
        Start building by adding components from the sidebar, or ask your AI assistant to generate a page.
      </p>
      <div style="margin-top: 2rem; padding: 0.75rem 2rem; border: 2px solid rgba(255,255,255,0.3); border-radius: 0.5rem; font-size: 0.9rem; opacity: 0.5;">
        Drop components here
      </div>
    </div>
  `;
}
