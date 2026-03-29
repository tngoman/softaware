import { useState, useCallback } from 'react';
import { SwatchIcon, EyeDropperIcon, ClipboardIcon } from '@heroicons/react/24/outline';

interface StudioColorPickerProps {
  value: string;
  onChange: (color: string) => void;
  showPalette?: boolean;
}

const PRESET_PALETTES = [
  { name: 'Vibrant', colors: ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6'] },
  { name: 'Neutral', colors: ['#111827', '#374151', '#6b7280', '#9ca3af', '#d1d5db', '#f9fafb'] },
  { name: 'Warm', colors: ['#dc2626', '#ea580c', '#d97706', '#ca8a04', '#65a30d', '#16a34a'] },
  { name: 'Cool', colors: ['#0284c7', '#0891b2', '#0d9488', '#059669', '#4f46e5', '#7c3aed'] },
  { name: 'Pastel', colors: ['#fecaca', '#fed7aa', '#fde68a', '#bbf7d0', '#bfdbfe', '#e9d5ff'] },
  { name: 'Earth', colors: ['#78350f', '#92400e', '#854d0e', '#365314', '#1e3a5f', '#4a1d96'] },
];

function hexToHsl(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, Math.round(l * 100)];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;
  return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
}

function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(255 * color).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum = (hex: string) => {
    const rgb = [hex.slice(1, 3), hex.slice(3, 5), hex.slice(5, 7)]
      .map(c => { const v = parseInt(c, 16) / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  };
  const l1 = lum(hex1), l2 = lum(hex2);
  const lighter = Math.max(l1, l2), darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

type PickerTab = 'picker' | 'palettes' | 'contrast';

export default function StudioColorPicker({ value, onChange, showPalette = true }: StudioColorPickerProps) {
  const [tab, setTab] = useState<PickerTab>('picker');
  const [hsl, setHsl] = useState<[number, number, number]>(() => hexToHsl(value || '#6366f1'));
  const [hexInput, setHexInput] = useState(value || '#6366f1');
  const [contrastBg, setContrastBg] = useState('#ffffff');
  const [savedColors, setSavedColors] = useState<string[]>([]);

  const updateColor = useCallback((h: number, s: number, l: number) => {
    setHsl([h, s, l]);
    const hex = hslToHex(h, s, l);
    setHexInput(hex);
    onChange(hex);
  }, [onChange]);

  const handleHexInput = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9a-fA-F]{6}$/.test(hex)) {
      const [h, s, l] = hexToHsl(hex);
      setHsl([h, s, l]);
      onChange(hex);
    }
  };

  const saveColor = () => {
    if (!savedColors.includes(hexInput)) {
      setSavedColors(prev => [hexInput, ...prev].slice(0, 12));
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(hexInput);
  };

  const ratio = getContrastRatio(hexInput, contrastBg);
  const passesAA = ratio >= 4.5;
  const passesAAA = ratio >= 7;

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-xl p-3 w-64">
      {/* Tabs */}
      <div className="flex border-b border-gray-800 mb-3">
        {(['picker', 'palettes', 'contrast'] as PickerTab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-1 text-[10px] font-medium capitalize ${
              tab === t ? 'text-indigo-400 border-b border-indigo-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'picker' && (
        <div className="space-y-3">
          {/* Color preview */}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-lg border border-gray-700" style={{ backgroundColor: hexInput }} />
            <div className="flex-1">
              <input
                type="text"
                value={hexInput}
                onChange={e => handleHexInput(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-200 font-mono focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <button onClick={copyToClipboard} className="p-1 text-gray-500 hover:text-white" title="Copy">
              <ClipboardIcon className="w-4 h-4" />
            </button>
          </div>

          {/* HSL Sliders */}
          <div className="space-y-2">
            <div>
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>Hue</span><span>{hsl[0]}°</span>
              </div>
              <input
                type="range" min={0} max={360} value={hsl[0]}
                onChange={e => updateColor(Number(e.target.value), hsl[1], hsl[2])}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>Saturation</span><span>{hsl[1]}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={hsl[1]}
                onChange={e => updateColor(hsl[0], Number(e.target.value), hsl[2])}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700"
              />
            </div>
            <div>
              <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                <span>Lightness</span><span>{hsl[2]}%</span>
              </div>
              <input
                type="range" min={0} max={100} value={hsl[2]}
                onChange={e => updateColor(hsl[0], hsl[1], Number(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer bg-gray-700"
              />
            </div>
          </div>

          {/* Native color input fallback */}
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={hexInput}
              onChange={e => handleHexInput(e.target.value)}
              className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
            />
            <span className="text-[10px] text-gray-500">System picker</span>
            <button onClick={saveColor} className="ml-auto px-2 py-0.5 text-[10px] bg-gray-800 border border-gray-700 rounded hover:border-indigo-500 text-gray-400">
              Save
            </button>
          </div>

          {/* Saved colors */}
          {savedColors.length > 0 && (
            <div>
              <span className="text-[10px] text-gray-500 block mb-1">Saved</span>
              <div className="flex flex-wrap gap-1">
                {savedColors.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => handleHexInput(c)}
                    className="w-5 h-5 rounded border border-gray-700 hover:scale-110 transition-transform"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'palettes' && showPalette && (
        <div className="space-y-3">
          {PRESET_PALETTES.map(palette => (
            <div key={palette.name}>
              <span className="text-[10px] text-gray-500 block mb-1">{palette.name}</span>
              <div className="flex gap-1">
                {palette.colors.map(c => (
                  <button
                    key={c}
                    onClick={() => handleHexInput(c)}
                    className={`flex-1 h-6 rounded transition-transform hover:scale-110 ${
                      hexInput === c ? 'ring-2 ring-white ring-offset-1 ring-offset-gray-900' : ''
                    }`}
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === 'contrast' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded border border-gray-700" style={{ backgroundColor: hexInput }} />
            <span className="text-[10px] text-gray-500">on</span>
            <div className="flex items-center gap-1 flex-1">
              <div className="w-8 h-8 rounded border border-gray-700" style={{ backgroundColor: contrastBg }} />
              <input
                type="text"
                value={contrastBg}
                onChange={e => setContrastBg(e.target.value)}
                className="flex-1 bg-gray-800 border border-gray-700 rounded px-2 py-0.5 text-[10px] text-gray-200 font-mono focus:outline-none"
              />
            </div>
          </div>

          {/* Preview */}
          <div className="rounded-lg p-3 text-center" style={{ backgroundColor: contrastBg, color: hexInput }}>
            <p className="text-lg font-bold">Aa</p>
            <p className="text-xs">Sample text</p>
          </div>

          {/* Ratio */}
          <div className="text-center">
            <span className="text-2xl font-bold">{ratio.toFixed(2)}</span>
            <span className="text-[10px] text-gray-500 ml-1">:1</span>
          </div>

          <div className="flex gap-2 text-[10px]">
            <div className={`flex-1 text-center p-1.5 rounded ${passesAA ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              AA {passesAA ? '✓' : '✗'}
            </div>
            <div className={`flex-1 text-center p-1.5 rounded ${passesAAA ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
              AAA {passesAAA ? '✓' : '✗'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
