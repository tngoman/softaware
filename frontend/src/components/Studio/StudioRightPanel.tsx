import { useState } from 'react';
import { useStudioState } from '../../hooks/useStudioState';

type PropsTab = 'layout' | 'typography' | 'colors' | 'spacing' | 'effects';

const PROP_TABS: { key: PropsTab; label: string }[] = [
  { key: 'layout', label: 'Layout' },
  { key: 'typography', label: 'Type' },
  { key: 'colors', label: 'Colors' },
  { key: 'spacing', label: 'Space' },
  { key: 'effects', label: 'Effects' },
];

export default function StudioRightPanel() {
  const { state } = useStudioState();
  const [tab, setTab] = useState<PropsTab>('layout');

  if (!state.selectedComponent) {
    return (
      <div className="p-4 text-center">
        <p className="text-xs text-gray-500 mt-8">Select an element on the canvas to edit its properties</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Element info */}
      <div className="px-3 py-2 border-b border-gray-800 shrink-0">
        <p className="text-xs text-gray-400">Selected</p>
        <p className="text-sm font-medium text-indigo-400 truncate">{state.selectedComponent}</p>
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-gray-800 shrink-0">
        {PROP_TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-[10px] font-medium transition-colors ${
              tab === t.key ? 'text-indigo-400 border-b border-indigo-400' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {tab === 'layout' && <LayoutProps />}
        {tab === 'typography' && <TypographyProps />}
        {tab === 'colors' && <ColorProps />}
        {tab === 'spacing' && <SpacingProps />}
        {tab === 'effects' && <EffectsProps />}
      </div>
    </div>
  );
}

function PropField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-[10px] text-gray-500 uppercase tracking-wide block mb-1">{label}</label>
      {children}
    </div>
  );
}

function PropInput({ placeholder, defaultValue }: { placeholder?: string; defaultValue?: string }) {
  return (
    <input
      type="text"
      placeholder={placeholder}
      defaultValue={defaultValue}
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
    />
  );
}

function PropSelect({ options, defaultValue }: { options: string[]; defaultValue?: string }) {
  return (
    <select
      defaultValue={defaultValue}
      className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-xs text-gray-300 focus:border-indigo-500 focus:outline-none"
    >
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function LayoutProps() {
  return (
    <>
      <PropField label="Display">
        <PropSelect options={['block', 'flex', 'grid', 'inline', 'inline-flex', 'none']} defaultValue="block" />
      </PropField>
      <PropField label="Position">
        <PropSelect options={['static', 'relative', 'absolute', 'fixed', 'sticky']} defaultValue="static" />
      </PropField>
      <div className="grid grid-cols-2 gap-2">
        <PropField label="Width"><PropInput placeholder="auto" /></PropField>
        <PropField label="Height"><PropInput placeholder="auto" /></PropField>
      </div>
      <PropField label="Flex Direction">
        <PropSelect options={['row', 'column', 'row-reverse', 'column-reverse']} />
      </PropField>
      <PropField label="Align Items">
        <PropSelect options={['stretch', 'start', 'center', 'end', 'baseline']} />
      </PropField>
      <PropField label="Justify Content">
        <PropSelect options={['start', 'center', 'end', 'space-between', 'space-around', 'space-evenly']} />
      </PropField>
      <PropField label="Gap"><PropInput placeholder="0px" /></PropField>
      <PropField label="Overflow">
        <PropSelect options={['visible', 'hidden', 'scroll', 'auto']} />
      </PropField>
    </>
  );
}

function TypographyProps() {
  return (
    <>
      <PropField label="Font Family">
        <PropSelect options={['Inter', 'Roboto', 'Poppins', 'Open Sans', 'Montserrat', 'Playfair Display', 'monospace']} />
      </PropField>
      <div className="grid grid-cols-2 gap-2">
        <PropField label="Size"><PropInput placeholder="16px" /></PropField>
        <PropField label="Weight">
          <PropSelect options={['100', '200', '300', '400', '500', '600', '700', '800', '900']} defaultValue="400" />
        </PropField>
      </div>
      <PropField label="Line Height"><PropInput placeholder="1.5" /></PropField>
      <PropField label="Letter Spacing"><PropInput placeholder="0px" /></PropField>
      <PropField label="Text Align">
        <PropSelect options={['left', 'center', 'right', 'justify']} />
      </PropField>
      <PropField label="Text Transform">
        <PropSelect options={['none', 'uppercase', 'lowercase', 'capitalize']} />
      </PropField>
      <PropField label="Text Decoration">
        <PropSelect options={['none', 'underline', 'line-through', 'overline']} />
      </PropField>
    </>
  );
}

function ColorProps() {
  return (
    <>
      <PropField label="Text Color">
        <div className="flex items-center gap-2">
          <input type="color" defaultValue="#ffffff" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
          <PropInput placeholder="#ffffff" defaultValue="#ffffff" />
        </div>
      </PropField>
      <PropField label="Background">
        <div className="flex items-center gap-2">
          <input type="color" defaultValue="#000000" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
          <PropInput placeholder="transparent" />
        </div>
      </PropField>
      <PropField label="Border Color">
        <div className="flex items-center gap-2">
          <input type="color" defaultValue="#333333" className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
          <PropInput placeholder="#333333" />
        </div>
      </PropField>
      <PropField label="Opacity"><PropInput placeholder="1" defaultValue="1" /></PropField>
    </>
  );
}

function SpacingProps() {
  return (
    <>
      <PropField label="Margin">
        <div className="grid grid-cols-4 gap-1">
          <PropInput placeholder="T" />
          <PropInput placeholder="R" />
          <PropInput placeholder="B" />
          <PropInput placeholder="L" />
        </div>
      </PropField>
      <PropField label="Padding">
        <div className="grid grid-cols-4 gap-1">
          <PropInput placeholder="T" />
          <PropInput placeholder="R" />
          <PropInput placeholder="B" />
          <PropInput placeholder="L" />
        </div>
      </PropField>
      <PropField label="Border Width"><PropInput placeholder="0px" /></PropField>
      <PropField label="Border Style">
        <PropSelect options={['none', 'solid', 'dashed', 'dotted', 'double']} />
      </PropField>
      <PropField label="Border Radius"><PropInput placeholder="0px" /></PropField>
    </>
  );
}

function EffectsProps() {
  return (
    <>
      <PropField label="Box Shadow"><PropInput placeholder="none" /></PropField>
      <PropField label="Text Shadow"><PropInput placeholder="none" /></PropField>
      <PropField label="Transition"><PropInput placeholder="all 0.2s ease" /></PropField>
      <PropField label="Transform"><PropInput placeholder="none" /></PropField>
      <PropField label="Filter"><PropInput placeholder="none" /></PropField>
      <PropField label="Cursor">
        <PropSelect options={['default', 'pointer', 'text', 'move', 'not-allowed', 'grab']} />
      </PropField>
      <PropField label="Z-Index"><PropInput placeholder="auto" /></PropField>
    </>
  );
}
