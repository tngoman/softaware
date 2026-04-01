import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

const decaScale = [
  { digit: '1', value: '10' },
  { digit: '2', value: '100' },
  { digit: '3', value: '1,000' },
  { digit: '4', value: '10,000' },
  { digit: '5', value: '100,000' },
  { digit: '6', value: '1,000,000' },
];

const timeIndex = [
  { digit: '1', unit: 'Hours' },
  { digit: '2', unit: 'Minutes' },
  { digit: '3', unit: 'Seconds' },
  { digit: '4', unit: 'Days' },
  { digit: '5', unit: 'Weeks' },
  { digit: '6', unit: 'Months' },
  { digit: '7', unit: 'Years' },
];

function ScaleModal({ open, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
      {/* Panel */}
      <div
        className="relative bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg max-w-lg w-full max-h-[80vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-lg leading-none cursor-pointer bg-transparent border-none"
        >
          ✕
        </button>

        <h3 className="text-base font-bold mb-1">Englicode Scales</h3>
        <p className="text-sm mb-5" style={{ color: 'var(--text-secondary)' }}>
          Five lookup tables power all Englicode shorthand.
        </p>

        {/* Deca-Scale */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Deca-Scale — Magnitude</div>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            The digit tells you how many zeros to append. "5 3" → 5 followed by 3 zeros → 5,000.
          </p>
          <div className="grid grid-cols-6 gap-2">
            {decaScale.map((d) => (
              <div key={d.digit} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-2 text-center">
                <div className="text-base font-bold" style={{ color: 'var(--accent)' }}>{d.digit}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{d.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Time Index */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Time Index — Units</div>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            In time expressions, the second digit maps to a unit. "2 4" → quantity 2 (×10 = 20) + unit 4 (Days) → 20 Days.
          </p>
          <div className="grid grid-cols-7 gap-2">
            {timeIndex.map((t) => (
              <div key={t.digit} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-2 text-center">
                <div className="text-base font-bold" style={{ color: 'var(--accent)' }}>{t.digit}</div>
                <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{t.unit}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Proximity Scale */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Proximity Scale — Urgency</div>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Replaces vague words like "soon" or "later." Syntax: <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>[Urgency] Index</span>
          </p>
          <div className="space-y-1.5">
            {[
              { code: '1 Index', meaning: 'Seconds — doing it now' },
              { code: '3 Index', meaning: 'Hours — sometime today' },
              { code: '5 Index', meaning: 'Weeks — don\'t hold your breath' },
            ].map((p) => (
              <div key={p.code} className="flex items-center gap-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2">
                <span className="text-sm font-mono font-bold whitespace-nowrap" style={{ color: 'var(--accent)' }}>{p.code}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{p.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Quantity Index */}
        <div className="mb-5">
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Quantity Index — Volume</div>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Replaces "a few," "a lot," "tons." Syntax: <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>[Value] [Scale]</span>
          </p>
          <div className="space-y-1.5">
            {[
              { code: '3 1', meaning: '30ish (tens)' },
              { code: '5 2', meaning: '500 (hundreds)' },
              { code: '2 3', meaning: '2,000 (thousands)' },
            ].map((q) => (
              <div key={q.code} className="flex items-center gap-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2">
                <span className="text-sm font-mono font-bold whitespace-nowrap" style={{ color: 'var(--accent)' }}>{q.code}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{q.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Percentage State */}
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Percentage State — Status</div>
          <p className="text-sm mb-3 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Replaces "almost," "halfway," "finished." Syntax: <span className="font-mono font-semibold" style={{ color: 'var(--accent)' }}>[Progress] 100</span>
          </p>
          <div className="space-y-1.5">
            {[
              { code: '0 100', meaning: 'Empty / not started' },
              { code: '45 100', meaning: 'About halfway' },
              { code: '90 100', meaning: 'Nearly done' },
            ].map((s) => (
              <div key={s.code} className="flex items-center gap-3 bg-[var(--bg-primary)] border border-[var(--border)] rounded px-3 py-2">
                <span className="text-sm font-mono font-bold whitespace-nowrap" style={{ color: 'var(--accent)' }}>{s.code}</span>
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{s.meaning}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-[var(--border)] text-center">
          <Link
            to="/protocols"
            className="text-sm font-semibold no-underline"
            style={{ color: 'var(--accent)' }}
            onClick={onClose}
          >
            Full protocol reference →
          </Link>
        </div>
      </div>
    </div>
  );
}

const pillars = [
  {
    icon: '⚡',
    title: 'Cognitive Training Engine',
    desc: 'Rapid-fire translation quizzes that force your brain to parse syntax and math simultaneously. Break free from Base-60 thinking.',
  },
  {
    icon: '◆',
    title: 'Open-Source Cipher',
    desc: 'A living dictionary governed by community Pull Requests. Submit new protocol terms, vote on proposals. If the math holds, it becomes canon.',
  },
  {
    icon: '○',
    title: 'Proof-of-Logic Network',
    desc: 'Earn a verifiable Processing Speed rank — from Analog to Overclocked. A digital flex for your cognitive bandwidth.',
  },
];

const ranks = [
  { tier: 0, title: 'Analog',      desc: 'New account. Read-only.',           threshold: null,  color: 'var(--text-secondary)', icon: '○' },
  { tier: 1, title: 'Read-Only',   desc: '100 pts — core protocols learned.',  threshold: 100,   color: 'var(--info)',           icon: '◇' },
  { tier: 2, title: 'Dual-Core',   desc: '400 pts — voting power unlocked.',   threshold: 400,   color: 'var(--accent)',         icon: '◆' },
  { tier: 3, title: 'Overclocked', desc: '900 pts — can submit PRs.',          threshold: 900,   color: 'var(--warning)',        icon: '⬡' },
  { tier: 4, title: 'Admin',       desc: '2,000 pts — weighted voting.',       threshold: 2000,  color: 'var(--danger)',         icon: '⬢' },
];

export default function Home() {
  const [scaleOpen, setScaleOpen] = useState(false);
  const [tVal, setTVal] = useState('1.5');
  const [bwCurrent, setBwCurrent] = useState('20');
  const [bwAnchor, setBwAnchor] = useState('40');
  const [dirSector, setDirSector] = useState('0');
  const [dirVertical, setDirVertical] = useState('0');

  const rawSector = parseFloat(dirSector) || 0;
  const needleDeg = ((rawSector * 36) % 360 + 360) % 360;
  const directionLabel = (() => {
    const d = needleDeg;
    const v = parseFloat(dirVertical) || 0;
    let horiz;
    if (d < 18 || d >= 342) horiz = 'Dead Ahead';
    else if (d < 90)  horiz = 'Front-Right quadrant';
    else if (d < 108) horiz = 'Hard Right (East)';
    else if (d < 162) horiz = 'Right-Rear quadrant';
    else if (d < 198) horiz = 'Dead Behind';
    else if (d < 252) horiz = 'Rear-Left quadrant';
    else if (d < 270) horiz = 'Hard Left (West)';
    else              horiz = 'Front-Left quadrant';
    let vert = '';
    if      (v >= 5)  vert = ', Zenith (directly above)';
    else if (v > 0)   vert = `, elevated ${v}/5`;
    else if (v <= -5) vert = ', Nadir (directly below)';
    else if (v < 0)   vert = `, depressed ${Math.abs(v)}/5`;
    return `${horiz}${vert} — ${d.toFixed(0)}° from forward`;
  })();

  return (
    <div>
      {/* ─── Hero ─── */}
      <section className="py-24 px-1">
        <div className="max-w-3xl mx-auto text-center">
          <div className="text-xs font-semibold tracking-widest mb-4 uppercase" style={{ color: 'var(--accent)' }}>
            Cognitive Gym & Crowdsourced Dictionary
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-wide leading-tight mb-6 w-full text-balance">
            <span className="block md:mb-1">Think in <span className="text-[var(--accent)]">compressed logic</span>.</span>
            <span className="block">Train your brain to <span className="text-[var(--accent)]">decode faster</span>.</span>
          </h1>
          <p className="text-base leading-relaxed mb-10 max-w-xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
            Englicode replaces culturally bloated systems of time, currency, and status
            with mathematically compressed protocols. Learn the cipher. Prove your processing speed.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <Link to="/protocols" className="btn btn-primary no-underline">Read Protocols</Link>
            <Link to="/quiz" className="btn btn-ghost no-underline">Start Quiz</Link>
            <Link to="/dictionary" className="btn btn-ghost no-underline">Browse Dictionary</Link>
          </div>
        </div>
      </section>

      {/* ─── Example ─── */}
      <section className="py-12 px-5 border-t border-[var(--border)]">
        <div className="max-w-3xl mx-auto">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
            <div className="text-xs font-semibold uppercase tracking-wider mb-5" style={{ color: 'var(--text-secondary)' }}>
              Quick Translation
            </div>

            {/* Side-by-side sentence */}
            <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-4 items-center mb-6">
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--border)]">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>Standard English</div>
                <div className="text-base leading-relaxed" style={{ color: 'var(--text-primary)' }}>
                  "The budget is <span className="underline decoration-[var(--text-secondary)/40]">five thousand</span>, due in <span className="underline decoration-[var(--text-secondary)/40]">twenty days</span>. The report is <span className="underline decoration-[var(--text-secondary)/40]">almost finished</span>."
                </div>
              </div>
              <div className="hidden md:flex items-center text-[var(--accent)] text-xl">→</div>
              <div className="bg-[var(--bg-primary)] rounded-lg p-4 border border-[var(--accent)]/30">
                <div className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Englicode</div>
                <div className="text-base leading-relaxed" style={{ color: 'var(--accent)' }}>
                  "The budget is a <span className="font-bold">5 3</span>, due in a <span className="font-bold">2 4</span>. The report is <span className="font-bold">90 100</span>."
                </div>
              </div>
            </div>

            {/* Term breakdown */}
            <div className="text-xs font-semibold uppercase tracking-wider mb-3 mt-2" style={{ color: 'var(--text-secondary)' }}>
              Breakdown
            </div>
            <div className="grid grid-cols-3 gap-3">
              {[
                { from: 'Five Thousand', to: '5 3', leap: '5 followed by 3 zeros = 5,000. Currency-neutral.' },
                { from: 'Twenty Days', to: '2 4', leap: '"2" = quantity (×10 = 20). "4" = days.', hasScale: true },
                { from: 'Almost Finished', to: '90 100', leap: 'Progress out of 100. Like a loading bar.' },
              ].map((t) => (
                <div key={t.to} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-4 text-center">
                  <div className="text-xs line-through mb-1" style={{ color: 'var(--text-secondary)' }}>{t.from}</div>
                  <div className="text-base font-bold mb-1.5" style={{ color: 'var(--accent)' }}>{t.to}</div>
                  <div className="text-sm leading-snug" style={{ color: 'var(--text-secondary)' }}>
                    {t.leap}  {t.hasScale && (
                      <button
                        onClick={() => setScaleOpen(true)}
                        className="mx-auto mt-2 text-xs cursor-pointer bg-transparent border-none p-0"
                        style={{ color: 'var(--accent)' }}
                      >
                        View scale ↗
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── Universal Translator ─── */}
      <section className="py-16 px-5 border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px flex-1 max-w-16 bg-[var(--accent)]/30" />
            <h2 className="text-xs tracking-[0.3em] text-[var(--accent)] uppercase font-bold">
              Englicode Translator v1.0
            </h2>
            <div className="h-px flex-1 max-w-16 bg-[var(--accent)]/30" />
          </div>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Type any number. Watch it scale across time, currency, and status — instantly.
          </p>

          {/* Input */}
          <div className="flex justify-center mb-8">
            <div className="relative w-full max-w-xs">
              <input
                type="text"
                inputMode="decimal"
                value={tVal}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || /^\d*\.?\d*$/.test(v)) setTVal(v);
                }}
                placeholder="Enter Value (e.g. 1.5)"
                className="w-full text-center text-2xl font-mono font-bold tracking-wider py-4 px-6 rounded-lg bg-[var(--bg-secondary)] border border-[var(--accent)]/40 text-[var(--accent)] placeholder:text-[var(--text-secondary)]/40 placeholder:text-base placeholder:font-normal outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_30px_rgba(0,212,170,0.15)]"
              />
              <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 px-2 text-xs font-semibold uppercase tracking-wider" style={{ background: 'var(--bg-primary)', color: 'var(--text-secondary)' }}>
                Input
              </div>
            </div>
          </div>

          {/* Result Grid */}
          {(() => {
            const n = parseFloat(tVal) || 0;
            const fmt = (v) => v % 1 === 0 ? v.toLocaleString() : v.toLocaleString(undefined, { maximumFractionDigits: 1 });

            const timeRows = [
              { label: 'Seconds', code: `${tVal} 1`, real: `${fmt(n * 10)} seconds` },
              { label: 'Minutes', code: `${tVal} 2`, real: `${fmt(n * 10)} minutes` },
              { label: 'Hours', code: `${tVal} 3`, real: `${fmt(n * 10)} hours` },
              { label: 'Days', code: `${tVal} 4`, real: `${fmt(n * 10)} days` },
            ];
            const currRows = [
              { label: 'Base (×10)', code: `${tVal} 1`, real: `${fmt(n * 10)} units` },
              { label: 'Kilo (×10³)', code: `${tVal} 3`, real: `${fmt(n * 1000)} units` },
              { label: 'Mega (×10⁶)', code: `${tVal} 6`, real: `${fmt(n * 1000000)} units` },
              { label: 'Giga (×10⁹)', code: `${tVal} 9`, real: `${fmt(n * 1000000000)} units` },
            ];
            const pct = n;
            const urgLabel = n <= 1 ? 'Immediate' : n <= 3 ? 'Short-term' : n <= 5 ? 'Mid-range' : 'Long-term';
            const loadLabel = n <= 2 ? 'Minimal' : n <= 5 ? 'Moderate' : n <= 8 ? 'Heavy' : 'Overload';

            return (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Time Card */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">⏱</span>
                      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
                        Time (Deca-Scale)
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {timeRows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                        <div>
                          <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>{r.code}</span>
                          <span className="text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>({r.label})</span>
                        </div>
                        <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{r.real}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Currency Card */}
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-secondary)]">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">◈</span>
                      <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
                        Currency (Data-Deca)
                      </span>
                    </div>
                  </div>
                  <div className="p-4 space-y-2">
                    {currRows.map((r) => (
                      <div key={r.label} className="flex items-center justify-between gap-2 py-1.5 px-3 rounded bg-[var(--bg-primary)] border border-[var(--border)]">
                        <div>
                          <span className="text-sm font-mono font-bold" style={{ color: 'var(--accent)' }}>{r.code}</span>
                          <span className="text-xs ml-1.5" style={{ color: 'var(--text-secondary)' }}>({r.label})</span>
                        </div>
                        <span className="text-sm font-mono" style={{ color: 'var(--text-primary)' }}>{r.real}</span>
                      </div>
                    ))}
                  </div>
                </div>

                  {/* Status Card removed per request */}
              </div>
            );
          })()}

          {/* Share link hint */}
            <div className="mt-6 text-center">
            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              <span className="text-[var(--accent)]">⟡</span> Try different values: <span className="font-mono text-[var(--accent)]">5.5</span> → 55 minutes · <span className="font-mono text-[var(--accent)]">1.8</span> → 18 minutes · <span className="font-mono text-[var(--accent)]">3</span> → 3,000 units
            </div>
          </div>
        </div>
      </section>

      {/* ─── Status Protocol ─── */}
      <section className="py-16 px-5 border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px flex-1 max-w-16 bg-[var(--accent)]/30" />
            <h2 className="text-base font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>
              Status Protocol
            </h2>
            <div className="h-px flex-1 max-w-16 bg-[var(--accent)]/30" />
          </div>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Replace "almost done" with exact numbers. <span className="font-mono text-[var(--accent)]">20 40</span> means 20 out of 40 — instantly shows you're at 50%.
          </p>

          {(() => {
            const cur = parseFloat(bwCurrent) || 0;
            const anc = parseFloat(bwAnchor) || 100;
            const ratio = anc === 0 ? 0 : (cur / anc) * 100;
            const headroom = Math.max(0, anc - cur);
            const isOverload = ratio > 100;
            const isFull = ratio === 100;

            // Color logic from Gemini's spec
            let gaugeColor, statusLabel, statusColor, glowColor;
            if (ratio <= 20) {
              gaugeColor = '#38bdf8'; statusLabel = 'IDLE'; statusColor = '#38bdf8'; glowColor = 'rgba(56,189,248,0.3)';
            } else if (ratio <= 85) {
              gaugeColor = 'var(--accent)'; statusLabel = 'OPTIMAL'; statusColor = 'var(--accent)'; glowColor = 'rgba(0,212,170,0.3)';
            } else if (ratio <= 99) {
              gaugeColor = '#f59e0b'; statusLabel = 'WARNING'; statusColor = '#f59e0b'; glowColor = 'rgba(245,158,11,0.3)';
            } else if (ratio === 100) {
              gaugeColor = '#f59e0b'; statusLabel = 'MAX CAPACITY'; statusColor = '#f59e0b'; glowColor = 'rgba(245,158,11,0.4)';
            } else {
              gaugeColor = 'var(--danger)'; statusLabel = 'OVERLOAD'; statusColor = 'var(--danger)'; glowColor = 'rgba(239,68,68,0.4)';
            }

            return (
              <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
                {/* Dual Inputs */}
                <div className="p-6 border-b border-[var(--border)]">
                  <div className="flex items-center justify-center gap-4">
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bwCurrent}
                        onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setBwCurrent(e.target.value); }}
                        className="w-28 text-center text-2xl font-mono font-bold py-3 px-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_20px_rgba(0,212,170,0.1)]"
                      />
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 bg-[var(--bg-secondary)] text-[8px] text-[var(--text-secondary)] tracking-widest uppercase">Current</div>
                    </div>
                    <div className="text-xl text-[var(--text-secondary)] font-mono">/</div>
                    <div className="relative">
                      <input
                        type="text"
                        inputMode="decimal"
                        value={bwAnchor}
                        onChange={(e) => { if (e.target.value === '' || /^\d*\.?\d*$/.test(e.target.value)) setBwAnchor(e.target.value); }}
                        className="w-28 text-center text-2xl font-mono font-bold py-3 px-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_20px_rgba(0,212,170,0.1)]"
                      />
                      <div className="absolute -top-2 left-1/2 -translate-x-1/2 px-1.5 bg-[var(--bg-secondary)] text-[8px] text-[var(--text-secondary)] tracking-widest uppercase">Anchor</div>
                    </div>
                  </div>
                  {/* Englicode syntax readout */}
                  <div className="text-center mt-4">
                    <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Englicode: </span>
                    <span className="text-sm font-mono font-bold text-[var(--accent)]">{bwCurrent || '0'} {bwAnchor || '100'}</span>
                  </div>
                </div>

                {/* Gauge */}
                <div className="p-6">
                  {/* Status badge */}
                  <div className="flex items-center justify-between mb-4">
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Status Gauge</div>
                    <motion.div
                      className="text-xs font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                      style={{ color: statusColor, background: `color-mix(in srgb, ${statusColor} 15%, transparent)`, border: `1px solid color-mix(in srgb, ${statusColor} 30%, transparent)` }}
                      animate={isOverload ? { scale: [1, 1.05, 1], x: [0, -2, 2, -2, 0] } : {}}
                      transition={isOverload ? { duration: 0.4, repeat: Infinity, repeatDelay: 1 } : {}}
                    >
                      {statusLabel}
                    </motion.div>
                  </div>

                  {/* Progress bar */}
                  <div className="relative w-full h-6 rounded-full bg-[var(--bg-primary)] border border-[var(--border)] overflow-hidden mb-4">
                    {/* Scale markers */}
                    {[25, 50, 75].map((mark) => (
                      <div key={mark} className="absolute top-0 bottom-0 w-px bg-[var(--border)]" style={{ left: `${mark}%` }} />
                    ))}
                    {/* Fill */}
                    <motion.div
                      className="absolute top-0 left-0 h-full rounded-full"
                      animate={{
                        width: `${Math.min(ratio, 100)}%`,
                        backgroundColor: gaugeColor,
                        boxShadow: `0 0 ${isOverload ? 25 : 12}px ${glowColor}`,
                      }}
                      transition={{ type: 'spring', stiffness: 120, damping: 20 }}
                    />
                    {/* Percentage label inside bar */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <motion.span
                        className="text-xs font-mono font-bold mix-blend-difference text-white"
                        animate={isOverload ? { opacity: [1, 0.4, 1] } : { opacity: 1 }}
                        transition={isOverload ? { duration: 0.6, repeat: Infinity } : {}}
                      >
                        {ratio.toFixed(1)}%
                      </motion.span>
                    </div>
                  </div>

                  {/* Metrics row */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Capacity</div>
                      <div className="text-lg font-mono font-bold" style={{ color: statusColor }}>{ratio.toFixed(1)}%</div>
                    </div>
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Headroom</div>
                      <div className={`text-lg font-mono font-bold ${headroom > 0 ? 'text-[var(--accent)]' : 'text-[var(--danger)]'}`}>{headroom}</div>
                    </div>
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
                      <div className="text-xs font-semibold uppercase tracking-wider mb-1" style={{ color: 'var(--text-secondary)' }}>Magnitude</div>
                      <div className="text-lg font-mono font-bold text-[var(--text-primary)]">{(cur / (anc || 1)).toFixed(2)}</div>
                    </div>
                  </div>

                  {/* Conversational readout */}
                  <div className="mt-4 px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)]">
                    <div className="text-xs font-semibold uppercase tracking-wider mb-1.5" style={{ color: 'var(--text-secondary)' }}>Translation</div>
                    <p className="text-sm leading-relaxed font-mono" style={{ color: 'var(--text-primary)' }}>
                      {isOverload ? (
                        <>Status is at <span className="font-bold text-[var(--danger)]">{ratio.toFixed(1)}% Capacity</span>. System is <span className="text-[var(--danger)] font-bold">{(cur - anc).toFixed(1)} units over limit</span>. Critical overload.</>
                      ) : isFull ? (
                        <>Status is at <span className="font-bold" style={{ color: statusColor }}>Maximum Capacity</span>. Zero headroom remaining. <span style={{ color: statusColor }}>{bwCurrent} {bwAnchor}</span> = fully loaded.</>
                      ) : (
                        <>Status is at <span className="font-bold" style={{ color: statusColor }}>Magnitude {(cur / (anc || 1)).toFixed(2)}</span> ({ratio.toFixed(1)}% Capacity). System has <span className="text-[var(--accent)] font-bold">{headroom} units</span> of headroom.</>
                      )}
                    </p>
                  </div>

                  {/* Quick presets */}
                  <div className="mt-4 flex items-center justify-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Try:</span>
                    {[
                      { label: '20 / 100', c: '20', a: '100' },
                      { label: '20 / 40', c: '20', a: '40' },
                      { label: '15 / 60', c: '15', a: '60' },
                      { label: '40 / 40', c: '40', a: '40' },
                      { label: '45 / 40', c: '45', a: '40' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => { setBwCurrent(p.c); setBwAnchor(p.a); }}
                        className={`text-xs font-mono px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                          bwCurrent === p.c && bwAnchor === p.a
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)] bg-transparent'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })()}
        </div>
      </section>

      {/* ─── Direction Protocol ─── */}
      <section className="py-16 px-5 border-t border-[var(--border)]">
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-center gap-3 mb-2">
            <div className="h-px flex-1 max-w-16 bg-[var(--accent)]/30" />
            <h2 className="text-base font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>Direction Protocol</h2>
            <div className="h-px flex-1 max-w-16 bg-[var(--accent)]/30" />
          </div>
          <p className="text-center text-sm mb-8" style={{ color: 'var(--text-secondary)' }}>
            Replace clock faces with a 10-sector metric circle. Sector × 36 = degrees.{' '}
            <span className="font-mono text-[var(--accent)]">2.5 Index</span> = 90° (Hard Right, replaces "3 o'clock").
          </p>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg overflow-hidden">
            {/* Inputs */}
            <div className="p-6 border-b border-[var(--border)]">
              <div className="flex items-end justify-center gap-6 flex-wrap">
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Sector (0–10)</div>
                  <input
                    type="text" inputMode="decimal" value={dirSector}
                    onChange={(e) => { if (e.target.value === '' || /^-?\d*\.?\d*$/.test(e.target.value)) setDirSector(e.target.value); }}
                    className="w-28 text-center text-2xl font-mono font-bold py-3 px-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_20px_rgba(0,212,170,0.1)]"
                  />
                </div>
                <div className="flex flex-col items-center gap-2">
                  <div className="text-[8px] font-semibold uppercase tracking-widest" style={{ color: 'var(--text-secondary)' }}>Vertical (−5 to +5)</div>
                  <input
                    type="text" inputMode="decimal" value={dirVertical}
                    onChange={(e) => { if (e.target.value === '' || /^-?\d*\.?\d*$/.test(e.target.value)) setDirVertical(e.target.value); }}
                    className="w-28 text-center text-2xl font-mono font-bold py-3 px-4 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-secondary)] outline-none transition-all focus:border-[var(--accent)] focus:shadow-[0_0_20px_rgba(0,212,170,0.1)]"
                  />
                </div>
              </div>
              <div className="text-center mt-4">
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Englicode: </span>
                <span className="text-sm font-mono font-bold text-[var(--accent)]">
                  {dirSector || '0'}{dirVertical !== '' && dirVertical !== '0' ? ` ${dirVertical}` : ''} Index
                </span>
              </div>
            </div>

            {/* Compass + data */}
            <div className="p-6">
              <div className="flex flex-col md:flex-row items-center gap-8">
                {/* Compass ring */}
                <div className="relative w-48 h-48 flex-shrink-0">
                  <svg viewBox="0 0 200 200" className="absolute inset-0 w-full h-full">
                    <circle cx="100" cy="100" r="90" fill="none" stroke="var(--border)" strokeWidth="1.5" />
                    <circle cx="100" cy="100" r="58" fill="none" stroke="var(--border)" strokeWidth="0.5" strokeDasharray="3 6" />
                    {Array.from({ length: 10 }, (_, i) => {
                      const ang = (i * 36 - 90) * (Math.PI / 180);
                      return <line key={i}
                        x1={100 + 80 * Math.cos(ang)} y1={100 + 80 * Math.sin(ang)}
                        x2={100 + 90 * Math.cos(ang)} y2={100 + 90 * Math.sin(ang)}
                        stroke="var(--text-muted)" strokeWidth="1.5"
                      />;
                    })}
                    {[0, 2.5, 5, 7.5].map((s) => {
                      const ang = (s * 36 - 90) * (Math.PI / 180);
                      return <text key={s}
                        x={100 + 68 * Math.cos(ang)} y={100 + 68 * Math.sin(ang)}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize="12" fill="var(--accent)" fontFamily="monospace" fontWeight="bold"
                      >{s}</text>;
                    })}
                    {[1, 2, 3, 4, 6, 7, 8, 9].map((s) => {
                      const ang = (s * 36 - 90) * (Math.PI / 180);
                      return <text key={s}
                        x={100 + 68 * Math.cos(ang)} y={100 + 68 * Math.sin(ang)}
                        textAnchor="middle" dominantBaseline="central"
                        fontSize="9" fill="var(--text-muted)" fontFamily="monospace"
                      >{s}</text>;
                    })}
                  </svg>
                  {/* Rotating needle */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    animate={{ rotate: needleDeg }}
                    transition={{ type: 'spring', stiffness: 80, damping: 12 }}
                    style={{ transformOrigin: '50% 50%' }}
                  >
                    <div className="absolute" style={{ left: '50%', bottom: '50%', width: '2px', height: '32%', background: 'var(--accent)', transform: 'translateX(-50%)', borderRadius: '2px 2px 0 0' }} />
                    <div className="absolute" style={{ left: 'calc(50% - 5px)', bottom: 'calc(50% + 32%)', width: 0, height: 0, borderLeft: '5px solid transparent', borderRight: '5px solid transparent', borderBottom: '10px solid var(--accent)' }} />
                    <div className="absolute" style={{ left: '50%', top: '50%', width: '2px', height: '18%', background: 'var(--text-muted)', transform: 'translateX(-50%)', opacity: 0.4 }} />
                  </motion.div>
                  {/* Center dot */}
                  <div className="absolute left-1/2 top-1/2 w-3 h-3 rounded-full z-10" style={{ transform: 'translate(-50%, -50%)', background: 'var(--bg-secondary)', border: '2px solid var(--text-secondary)' }} />
                </div>

                {/* Data cards */}
                <div className="flex-1 w-full">
                  <div className="grid grid-cols-2 gap-3 mb-4">
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
                      <div className="text-[8px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Degrees</div>
                      <div className="text-lg font-mono font-bold" style={{ color: 'var(--accent)' }}>{needleDeg.toFixed(1)}°</div>
                    </div> 
                    <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-3 text-center">
                      <div className="text-[8px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--text-secondary)' }}>Cardinal</div>
                      <div className="text-lg font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{(() => { const d = needleDeg; if (d < 22.5 || d >= 337.5) return 'N'; if (d < 67.5) return 'NE'; if (d < 112.5) return 'E'; if (d < 157.5) return 'SE'; if (d < 202.5) return 'S'; if (d < 247.5) return 'SW'; if (d < 292.5) return 'W'; return 'NW'; })()}</div>
                    </div> 
                  </div>
                  <div className="px-4 py-3 rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] mb-4">
                    <div className="text-[8px] font-semibold uppercase tracking-widest mb-1.5" style={{ color: 'var(--text-secondary)' }}>Translation</div>
                    <p className="text-sm leading-relaxed font-mono" style={{ color: 'var(--text-primary)' }}>{directionLabel}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Try:</span>
                    {[
                      { label: '0', s: '0', v: '0' },
                      { label: '2.5', s: '2.5', v: '0' },
                      { label: '5', s: '5', v: '0' },
                      { label: '7.5', s: '7.5', v: '0' },
                      { label: '0 5', s: '0', v: '5' },
                      { label: '2.5 -2', s: '2.5', v: '-2' },
                    ].map((p) => (
                      <button
                        key={p.label}
                        onClick={() => { setDirSector(p.s); setDirVertical(p.v); }}
                        className={`text-xs font-mono px-2.5 py-1 rounded-full border cursor-pointer transition-all ${
                          dirSector === p.s && dirVertical === p.v
                            ? 'border-[var(--accent)] text-[var(--accent)] bg-[var(--accent)]/10'
                            : 'border-[var(--border)] text-[var(--text-secondary)] hover:border-[var(--accent)]/50 hover:text-[var(--text-primary)] bg-transparent'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Three Pillars ─── */}
      <section className="py-16 px-5 border-t border-[var(--border)]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-center text-base font-bold uppercase tracking-widest mb-10" style={{ color: 'var(--text-secondary)' }}>
            The Three Core Pillars
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {pillars.map((p) => (
              <div
                key={p.title}
                className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6"
              >
                <div className="text-2xl mb-3">{p.icon}</div>
                <h3 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{p.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {p.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Rank System ─── */}
      <section className="py-16 px-5 border-t border-[var(--border)]">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-base font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-secondary)' }}>
            Processing Speed Tiers
          </h2>
          <p className="text-center text-sm mb-10" style={{ color: 'var(--text-secondary)' }}>
            Earn XP through quizzes and contributions. Unlock abilities as you rank up.
          </p>

          {/* Vertical progression */}
          <div className="relative">
            {/* Connector line */}
            <div className="absolute left-1/2 top-0 bottom-0 w-px bg-[var(--border)] hidden md:block" style={{ transform: 'translateX(-50%)' }} />

            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {ranks.map((r, i) => (
                <div
                  key={r.tier}
                  className="relative flex flex-col items-center text-center group"
                >
                  {/* Glow ring + icon */}
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl mb-3 border-2 transition-all duration-300 group-hover:scale-110"
                    style={{
                      borderColor: r.color,
                      background: `color-mix(in srgb, ${r.color} 8%, transparent)`,
                      boxShadow: `0 0 20px color-mix(in srgb, ${r.color} 20%, transparent)`,
                    }}
                  >
                    {r.icon}
                  </div>

                  {/* Tier badge */}
                  <div
                    className="text-xs font-bold tracking-widest uppercase px-2 py-0.5 rounded-full mb-1.5"
                    style={{
                      color: r.color,
                      background: `color-mix(in srgb, ${r.color} 12%, transparent)`,
                      border: `1px solid color-mix(in srgb, ${r.color} 25%, transparent)`,
                    }}
                  >
                    Tier {r.tier}
                  </div>

                  {/* Title */}
                  <div className="text-base font-bold mb-1" style={{ color: r.color }}>
                    {r.title}
                  </div>

                  {/* Description */}
                  <div className="text-sm leading-tight max-w-[120px] mx-auto" style={{ color: 'var(--text-secondary)' }}>
                    {r.desc}
                  </div>

                  {/* Arrow connector (mobile) */}
                  {i < ranks.length - 1 && (
                    <div className="text-[var(--border)] text-lg mt-3 md:hidden">▼</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── CTA ─── */}
      <section className="py-16 px-5 border-t border-[var(--border)]">
        <div className="max-w-xl mx-auto text-center">
          <h2 className="text-2xl font-bold mb-3">
            Ready to upgrade your <span style={{ color: 'var(--accent)' }}>bandwidth</span>?
          </h2>
          <p className="text-base mb-6" style={{ color: 'var(--text-secondary)' }}>
            Join with Google or Facebook. Start decoding immediately.
          </p>
          <div className="flex items-center justify-center gap-3">
            <a href="/api/auth/google" className="btn btn-primary no-underline">Sign in with Google</a>
            <a href="/api/auth/facebook" className="btn btn-ghost no-underline">Sign in with Facebook</a>
          </div>
        </div>
      </section>
      <ScaleModal open={scaleOpen} onClose={() => setScaleOpen(false)} />
    </div>
  );
}
