import { useState } from 'react';
import PracticeExercise from './PracticeExercise';

function QuantityCalculator() {
  const [value, setValue] = useState(3);
  const [scale, setScale] = useState(1);

  const scales = [
    { id: 0, label: 'Ones', example: '1-9' },
    { id: 1, label: 'Tens', example: '10-90' },
    { id: 2, label: 'Hundreds', example: '100-900' },
    { id: 3, label: 'Thousands', example: '1K-9K' },
    { id: 4, label: 'Ten-Thousands', example: '10K-90K' },
    { id: 5, label: 'Hundred-Thousands', example: '100K-900K' },
    { id: 6, label: 'Millions', example: '1M-9M' },
  ];

  const currentScale = scales.find(s => s.id === scale);
  const result = value * Math.pow(10, scale);
  const formattedResult = result.toLocaleString();

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
      <h3 className="text-lg font-bold tracking-wider text-[var(--accent)] mb-4">Quantity Calculator</h3>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Value</label>
        <input
          type="number"
          step="0.1"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg font-mono"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Scale (Order of Magnitude)</label>
        <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
          {scales.map((s) => (
            <button
              key={s.id}
              onClick={() => setScale(s.id)}
              className="px-3 py-2 rounded-md font-mono font-bold transition-all cursor-pointer border-2"
              style={scale === s.id
                ? { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
                : { background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
              }
            >
              {s.id}
            </button>
          ))}
        </div>
        <div className="mt-2 text-xs text-[var(--text-secondary)]">
          Selected: {currentScale?.label} ({currentScale?.example})
        </div>
      </div>

      <div className="mb-6 p-4 bg-[var(--bg-tertiary)] border border-[var(--accent)]/30 rounded-lg text-center">
        <div className="text-sm text-[var(--text-secondary)] mb-1">Englicode Term</div>
        <div className="text-3xl font-mono font-bold text-[var(--accent)] mb-2">{value} {scale}</div>
      </div>

      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-5">
        <h4 className="text-base font-bold text-[var(--accent)] mb-4">The Calculation</h4>
        
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Formula</div>
            <div className="text-lg font-mono font-bold text-[var(--accent)]">{value} × 10^{scale}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Result</div>
            <div className="text-2xl font-bold text-[var(--accent)]">~{formattedResult}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Scale</div>
            <div className="text-sm text-[var(--text-primary)]">{currentScale?.label}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function QuantityTraining() {
  const examples = [
    { syntax: '3 1', scale: 'Tens', value: '~30', context: 'There were like 3 1 people at the meetup.' },
    { syntax: '5 2', scale: 'Hundreds', value: '500', context: 'We\'ve got 5 2 units in stock.' },
    { syntax: '2 3', scale: 'Thousands', value: '2,000', context: 'The concert had 2 3 attendees.' },
    { syntax: '1.5 4', scale: 'Ten-Thousands', value: '15,000', context: 'The stadium holds 1.5 4 fans.' },
    { syntax: '3 6', scale: 'Millions', value: '3,000,000', context: 'The city has a population of 3 6.' },
  ];

  const comparisons = [
    { vague: 'A few', englicode: '0-1 Scale', meaning: '1-10 items' },
    { vague: 'Several', englicode: '1 Scale', meaning: '~10-90 items' },
    { vague: 'A lot', englicode: '2 Scale', meaning: '~100-900 items' },
    { vague: 'Tons', englicode: '3 Scale', meaning: '~1,000-9,000 items' },
    { vague: 'Massive amounts', englicode: '4-6 Scale', meaning: '10K-Millions' },
  ];

  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 6: The Quantity Index
        </h2>
        
        <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
          Rule: <code className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)] font-mono">[Value] [Scale]</code>
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          Port the Data-Deca scale to physical counts. Eliminates vague words like "several" or "massive amounts."
          The scale tells you the order of magnitude.
        </p>

        <QuantityCalculator />
      </section>

      {/* Examples */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Real-World Examples
        </h2>
        
        <div className="space-y-4">
          {examples.map((ex, idx) => (
            <div key={idx} className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold text-lg">{ex.syntax}</span>
                <span className="text-[var(--text-secondary)] text-sm">→ {ex.value} ({ex.scale})</span>
              </div>
              <blockquote className="text-xs text-[var(--text-secondary)] italic">"{ex.context}"</blockquote>
            </div>
          ))}
        </div>
      </section>

      {/* Vague vs Precise */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Vague Language vs Englicode
        </h2>
        
        <div className="space-y-3">
          {comparisons.map((comp, idx) => (
            <div key={idx} className="bg-[var(--bg-tertiary)] rounded p-4 grid md:grid-cols-3 gap-4 items-center">
              <div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">Vague English</div>
                <div className="text-base font-medium text-[var(--text-primary)]">"{comp.vague}"</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">Englicode</div>
                <div className="font-mono text-[var(--accent)] font-bold text-lg">{comp.englicode}</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-secondary)] mb-1">Actual Meaning</div>
                <div className="text-sm text-[var(--text-primary)]">{comp.meaning}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Why This Works */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Why This Protocol Works
        </h2>
        
        <div className="space-y-4">
          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Order of Magnitude</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              You're not being precise — you're giving the scale. "3 1" vs "3 3" instantly tells you if it's dozens or thousands.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Standardizes Guesstimation</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Everyone estimates differently. This protocol creates a shared framework for approximation.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Works for Any Countable Thing</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              People, items, files, followers, views — anything you can count uses the same system.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Mirrors Data-Deca</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Same logic as Protocol 4 (currency). Once you learn one, you know both.
            </p>
          </div>
        </div>
      </section>

      {/* Practice Exercises */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Practice Exercises
        </h2>
        
        <div className="text-sm text-[var(--text-secondary)] mb-4">
          Calculate these Quantity Index values:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem="4 2"
            hint="4 × 10^2 (hundreds)"
            answer="400"
          />

          <PracticeExercise
            problem="2.5 3"
            hint="2.5 × 10^3 (thousands)"
            answer="2,500"
          />

          <PracticeExercise
            problem="6 1"
            hint="6 × 10^1 (tens)"
            answer="60"
          />

          <PracticeExercise
            problem="1.8 4"
            hint="1.8 × 10^4 (ten-thousands)"
            answer="18,000"
          />
        </div>
      </section>
    </div>
  );
}
