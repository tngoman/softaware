import { useState, useRef, useCallback, useEffect } from 'react';
import {
  ArrowsPointingOutIcon, ScissorsIcon,
  AdjustmentsHorizontalIcon, ArrowUturnLeftIcon,
  ArrowDownTrayIcon, XMarkIcon,
  SwatchIcon,
} from '@heroicons/react/24/outline';

interface StudioImageEditorProps {
  src: string;
  onSave: (dataUrl: string) => void;
  onClose: () => void;
}

type EditorTool = 'crop' | 'resize' | 'filters' | 'adjust';

interface CropState {
  x: number; y: number; w: number; h: number;
}

interface Adjustments {
  brightness: number;
  contrast: number;
  saturation: number;
  blur: number;
  grayscale: number;
  sepia: number;
  hueRotate: number;
}

const DEFAULT_ADJ: Adjustments = {
  brightness: 100, contrast: 100, saturation: 100,
  blur: 0, grayscale: 0, sepia: 0, hueRotate: 0,
};

const FILTERS = [
  { name: 'None', adj: DEFAULT_ADJ },
  { name: 'Warm', adj: { ...DEFAULT_ADJ, saturation: 120, sepia: 20, brightness: 105 } },
  { name: 'Cool', adj: { ...DEFAULT_ADJ, saturation: 90, hueRotate: 15, brightness: 102 } },
  { name: 'B&W', adj: { ...DEFAULT_ADJ, grayscale: 100 } },
  { name: 'Vivid', adj: { ...DEFAULT_ADJ, saturation: 140, contrast: 115 } },
  { name: 'Aged', adj: { ...DEFAULT_ADJ, sepia: 50, contrast: 90, brightness: 95 } },
  { name: 'Moody', adj: { ...DEFAULT_ADJ, contrast: 120, brightness: 90, saturation: 80 } },
  { name: 'Soft', adj: { ...DEFAULT_ADJ, blur: 1, brightness: 105, contrast: 90 } },
];

export default function StudioImageEditor({ src, onSave, onClose }: StudioImageEditorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [tool, setTool] = useState<EditorTool>('adjust');
  const [adj, setAdj] = useState<Adjustments>(DEFAULT_ADJ);
  const [history, setHistory] = useState<Adjustments[]>([DEFAULT_ADJ]);
  const [historyIdx, setHistoryIdx] = useState(0);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });
  const [resizeW, setResizeW] = useState(0);
  const [resizeH, setResizeH] = useState(0);
  const [keepRatio, setKeepRatio] = useState(true);
  const [cropState, setCropState] = useState<CropState | null>(null);

  // Load image
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imgRef.current = img;
      setImgSize({ w: img.naturalWidth, h: img.naturalHeight });
      setResizeW(img.naturalWidth);
      setResizeH(img.naturalHeight);
      renderCanvas(img, DEFAULT_ADJ);
    };
    img.src = src;
  }, [src]);

  const buildFilterString = (a: Adjustments) =>
    `brightness(${a.brightness}%) contrast(${a.contrast}%) saturate(${a.saturation}%) blur(${a.blur}px) grayscale(${a.grayscale}%) sepia(${a.sepia}%) hue-rotate(${a.hueRotate}deg)`;

  const renderCanvas = useCallback((img: HTMLImageElement, a: Adjustments) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.filter = buildFilterString(a);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);
  }, []);

  useEffect(() => {
    if (imgRef.current) renderCanvas(imgRef.current, adj);
  }, [adj, renderCanvas]);

  const pushAdj = (newAdj: Adjustments) => {
    const newHistory = history.slice(0, historyIdx + 1);
    newHistory.push(newAdj);
    setHistory(newHistory);
    setHistoryIdx(newHistory.length - 1);
    setAdj(newAdj);
  };

  const updateAdj = (key: keyof Adjustments, value: number) => {
    pushAdj({ ...adj, [key]: value });
  };

  const undo = () => {
    if (historyIdx > 0) {
      setHistoryIdx(historyIdx - 1);
      setAdj(history[historyIdx - 1]);
    }
  };

  const reset = () => {
    pushAdj(DEFAULT_ADJ);
  };

  const applyFilter = (filter: typeof FILTERS[0]) => {
    pushAdj(filter.adj);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // If resizing, create a new canvas
    if (resizeW !== imgSize.w || resizeH !== imgSize.h) {
      const outCanvas = document.createElement('canvas');
      outCanvas.width = resizeW;
      outCanvas.height = resizeH;
      const ctx = outCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(canvas, 0, 0, resizeW, resizeH);
        onSave(outCanvas.toDataURL('image/png'));
        return;
      }
    }

    onSave(canvas.toDataURL('image/png'));
  };

  const handleResizeW = (w: number) => {
    setResizeW(w);
    if (keepRatio && imgSize.w > 0) {
      setResizeH(Math.round((w / imgSize.w) * imgSize.h));
    }
  };

  const handleResizeH = (h: number) => {
    setResizeH(h);
    if (keepRatio && imgSize.h > 0) {
      setResizeW(Math.round((h / imgSize.h) * imgSize.w));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-[900px] max-w-[95vw] max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-gray-800">
          <span className="text-sm font-medium">Image Editor</span>
          <div className="flex items-center gap-2">
            <button onClick={undo} disabled={historyIdx <= 0} className="p-1 text-gray-400 hover:text-white disabled:opacity-30">
              <ArrowUturnLeftIcon className="w-4 h-4" />
            </button>
            <button onClick={reset} className="px-2 py-0.5 text-[10px] text-gray-400 hover:text-white">Reset</button>
            <div className="w-px h-4 bg-gray-700" />
            <button onClick={handleSave} className="px-3 py-1 bg-indigo-600 hover:bg-indigo-500 rounded text-xs font-medium">
              <ArrowDownTrayIcon className="w-3.5 h-3.5 inline mr-1" /> Save
            </button>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-white">
              <XMarkIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar tools */}
          <div className="w-48 border-r border-gray-800 overflow-y-auto p-2 shrink-0">
            {/* Tool tabs */}
            <div className="grid grid-cols-2 gap-1 mb-3">
              {[
                { key: 'adjust' as EditorTool, icon: AdjustmentsHorizontalIcon, label: 'Adjust' },
                { key: 'filters' as EditorTool, icon: SwatchIcon, label: 'Filters' },
                { key: 'resize' as EditorTool, icon: ArrowsPointingOutIcon, label: 'Resize' },
                { key: 'crop' as EditorTool, icon: ScissorsIcon, label: 'Crop' },
              ].map(t => (
                <button
                  key={t.key}
                  onClick={() => setTool(t.key)}
                  className={`flex flex-col items-center p-1.5 rounded text-[10px] ${
                    tool === t.key ? 'bg-indigo-600/20 text-indigo-400' : 'text-gray-500 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <t.icon className="w-4 h-4 mb-0.5" />
                  {t.label}
                </button>
              ))}
            </div>

            {/* Adjust panel */}
            {tool === 'adjust' && (
              <div className="space-y-2">
                {(
                  [
                    ['brightness', 'Brightness', 0, 200],
                    ['contrast', 'Contrast', 0, 200],
                    ['saturation', 'Saturation', 0, 200],
                    ['blur', 'Blur', 0, 20],
                    ['hueRotate', 'Hue', 0, 360],
                  ] as [keyof Adjustments, string, number, number][]
                ).map(([key, label, min, max]) => (
                  <div key={key}>
                    <div className="flex justify-between text-[10px] text-gray-500">
                      <span>{label}</span>
                      <span>{adj[key]}{key === 'hueRotate' ? '°' : key === 'blur' ? 'px' : '%'}</span>
                    </div>
                    <input
                      type="range"
                      min={min} max={max}
                      value={adj[key]}
                      onChange={e => updateAdj(key, Number(e.target.value))}
                      className="w-full h-1.5 rounded appearance-none cursor-pointer bg-gray-700"
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Filters panel */}
            {tool === 'filters' && (
              <div className="grid grid-cols-2 gap-1">
                {FILTERS.map(f => (
                  <button
                    key={f.name}
                    onClick={() => applyFilter(f)}
                    className="p-1.5 bg-gray-800 border border-gray-700 rounded text-[10px] text-gray-400 hover:border-indigo-500 hover:text-white"
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}

            {/* Resize panel */}
            {tool === 'resize' && (
              <div className="space-y-2">
                <div>
                  <span className="text-[10px] text-gray-500">Original: {imgSize.w}×{imgSize.h}</span>
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Width</label>
                  <input
                    type="number"
                    value={resizeW}
                    onChange={e => handleResizeW(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Height</label>
                  <input
                    type="number"
                    value={resizeH}
                    onChange={e => handleResizeH(Number(e.target.value))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 focus:outline-none"
                  />
                </div>
                <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={keepRatio}
                    onChange={e => setKeepRatio(e.target.checked)}
                    className="rounded border-gray-600"
                  />
                  Lock aspect ratio
                </label>
              </div>
            )}

            {/* Crop placeholder */}
            {tool === 'crop' && (
              <div className="text-center py-4">
                <ScissorsIcon className="w-8 h-8 text-gray-700 mx-auto mb-2" />
                <p className="text-[10px] text-gray-500">Drag on the image to select a crop region</p>
              </div>
            )}
          </div>

          {/* Canvas area */}
          <div className="flex-1 flex items-center justify-center bg-gray-950 overflow-auto p-4">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-full object-contain shadow-2xl shadow-black/30"
              style={{ imageRendering: 'auto' }}
            />
          </div>
        </div>

        {/* Footer info */}
        <div className="px-4 py-1.5 border-t border-gray-800 flex items-center justify-between text-[10px] text-gray-600">
          <span>{imgSize.w}×{imgSize.h}px</span>
          <span>Output: {resizeW}×{resizeH}px</span>
        </div>
      </div>
    </div>
  );
}
