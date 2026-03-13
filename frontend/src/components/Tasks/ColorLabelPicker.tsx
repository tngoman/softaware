import React, { useState, useRef, useEffect } from 'react';

const COLORS = [
  { value: null, label: 'None', bg: 'bg-white border-gray-300', dot: 'bg-gray-300' },
  { value: 'red', label: 'Red', bg: 'bg-red-50 border-red-300', dot: 'bg-red-500' },
  { value: 'orange', label: 'Orange', bg: 'bg-orange-50 border-orange-300', dot: 'bg-orange-500' },
  { value: 'yellow', label: 'Yellow', bg: 'bg-yellow-50 border-yellow-300', dot: 'bg-yellow-500' },
  { value: 'green', label: 'Green', bg: 'bg-green-50 border-green-300', dot: 'bg-green-500' },
  { value: 'blue', label: 'Blue', bg: 'bg-blue-50 border-blue-300', dot: 'bg-blue-500' },
  { value: 'purple', label: 'Purple', bg: 'bg-purple-50 border-purple-300', dot: 'bg-purple-500' },
  { value: 'pink', label: 'Pink', bg: 'bg-pink-50 border-pink-300', dot: 'bg-pink-500' },
];

interface ColorLabelPickerProps {
  value: string | null;
  onChange: (color: string | null) => void;
}

const ColorLabelPicker: React.FC<ColorLabelPickerProps> = ({ value, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = COLORS.find(c => c.value === value) || COLORS[0];

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className={`w-5 h-5 rounded-full border-2 ${current.dot} hover:ring-2 ring-offset-1 ring-gray-300 transition-all`}
        title={`Label: ${current.label}`}
      />
      {open && (
        <div className="absolute z-50 top-7 left-0 bg-white rounded-lg shadow-lg border p-2 flex gap-1.5">
          {COLORS.map(c => (
            <button
              key={c.value || 'none'}
              onClick={() => { onChange(c.value); setOpen(false); }}
              className={`w-6 h-6 rounded-full border-2 ${c.dot} hover:scale-110 transition-transform ${value === c.value ? 'ring-2 ring-offset-1 ring-indigo-400' : ''}`}
              title={c.label}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ColorLabelPicker;
export { COLORS };
