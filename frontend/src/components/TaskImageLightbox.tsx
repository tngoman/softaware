import React, { useState, useEffect, useCallback } from 'react';
import {
  XMarkIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ArrowDownTrayIcon,
} from '@heroicons/react/24/outline';

export interface LightboxImage {
  url: string;
  name?: string;
}

interface TaskImageLightboxProps {
  images: LightboxImage[];
  initialIndex: number;
  onClose: () => void;
}

export default function TaskImageLightbox({ images, initialIndex, onClose }: TaskImageLightboxProps) {
  const [index, setIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const hasPrev = index > 0;
  const hasNext = index < images.length - 1;

  const goPrev = useCallback(() => {
    if (hasPrev) { setIndex(i => i - 1); setZoom(1); setPosition({ x: 0, y: 0 }); }
  }, [hasPrev]);

  const goNext = useCallback(() => {
    if (hasNext) { setIndex(i => i + 1); setZoom(1); setPosition({ x: 0, y: 0 }); }
  }, [hasNext]);

  const toggleZoom = useCallback(() => {
    if (zoom > 1) { setZoom(1); setPosition({ x: 0, y: 0 }); } else { setZoom(2); }
  }, [zoom]);

  // Keyboard navigation
  useEffect(() => {
    const handle = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape': onClose(); break;
        case 'ArrowLeft': goPrev(); break;
        case 'ArrowRight': goNext(); break;
        case '+': case '=': setZoom(z => Math.min(z + 0.5, 5)); break;
        case '-': setZoom(z => { const nz = Math.max(z - 0.5, 1); if (nz === 1) setPosition({ x: 0, y: 0 }); return nz; }); break;
      }
    };
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [onClose, goPrev, goNext]);

  const current = images[index];
  if (!current) return null;

  // Pan handling
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging || zoom <= 1) return;
    setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setDragging(false);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.25 : 0.25;
    setZoom(z => {
      const nz = Math.min(Math.max(z + delta, 1), 5);
      if (nz === 1) setPosition({ x: 0, y: 0 });
      return nz;
    });
  };

  const handleDownload = () => {
    const a = document.createElement('a');
    a.href = current.url;
    a.download = current.name || 'image';
    a.target = '_blank';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <div className="min-w-0 flex-1">
          {current.name && (
            <p className="text-sm font-medium truncate text-gray-200">{current.name}</p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 tabular-nums">
            {index + 1} / {images.length}
          </span>
          <button onClick={toggleZoom}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title={zoom > 1 ? 'Reset zoom' : 'Zoom in'}>
            {zoom > 1 ? <ArrowsPointingInIcon className="w-5 h-5" /> : <ArrowsPointingOutIcon className="w-5 h-5" />}
          </button>
          <button onClick={handleDownload}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title="Download">
            <ArrowDownTrayIcon className="w-5 h-5" />
          </button>
          <button onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors"
            title="Close (Esc)">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Image container */}
      <div
        className="flex-1 flex items-center justify-center overflow-hidden relative select-none"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        style={{ cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'default' }}
      >
        <img
          src={current.url}
          alt={current.name || 'Image'}
          className="max-w-full max-h-full object-contain transition-transform duration-150"
          style={{ transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})` }}
          draggable={false}
          onDoubleClick={toggleZoom}
        />

        {/* Prev button */}
        {hasPrev && (
          <button onClick={goPrev}
            className="absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
            <ChevronLeftIcon className="w-6 h-6" />
          </button>
        )}

        {/* Next button */}
        {hasNext && (
          <button onClick={goNext}
            className="absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 hover:bg-black/70 rounded-full text-white transition-colors">
            <ChevronRightIcon className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Thumbnail strip (if multiple images) */}
      {images.length > 1 && (
        <div className="flex items-center justify-center gap-2 px-4 py-3 overflow-x-auto">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => { setIndex(i); setZoom(1); setPosition({ x: 0, y: 0 }); }}
              className={`flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border-2 transition-all ${
                i === index ? 'border-white ring-1 ring-white/50' : 'border-transparent opacity-50 hover:opacity-80'
              }`}
            >
              <img src={img.url} alt="" className="w-full h-full object-cover" loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
