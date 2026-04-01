import { useState } from 'react';
import PracticeExercise from './PracticeExercise';

function CurrencyCalculator() {
  const [value, setValue] = useState(5);
  const [scale, setScale] = useState(3);

  const scales = [
    { id: 1, label: 'Tens', zeros: '0', example: '10' },
    { id: 2, label: 'Hundreds', zeros: '00', example: '100' },
    { id: 3, label: 'Kilos', zeros: '000', example: '1,000' },
    { id: 4, label: 'Deca-K', zeros: '0000', example: '10,000' },
    { id: 5, label: 'Hecto-K', zeros: '00000', example: '100,000' },
    { id: 6, label: 'Megs', zeros: '000000', example: '1,000,000' },
  ];

  const currentScale = scales.find(s => s.id === scale);
  const result = value * Math.pow(10, scale);
  const formattedResult = result.toLocaleString();

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
      <h3 className="text-lg font-bold tracking-wider text-[var(--accent)] mb-4">Currency Calculator</h3>
      
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
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Scale (Power of 10)</label>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
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
          Selected: {currentScale?.label} ({currentScale?.zeros})
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
            <div className="text-2xl font-bold text-[var(--accent)]">{formattedResult}</div>
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

export default function DataDecaTraining() {
  const examples = [
    { syntax: '4 1', scale: 'Tens', value: '40', context: 'That ticket cost me a 4 1.' },
    { syntax: '1.5 2', scale: 'Hundreds', value: '150', context: 'Dinner out is usually a 1.5 2.' },
    { syntax: '5 3', scale: 'Kilos', value: '5,000', context: 'A new laptop is going to be at least a 5 3.' },
    { syntax: '2.5 4', scale: 'Deca-K', value: '25,000', context: 'The car is listed at 2.5 4.' },
    { syntax: '3.5 6', scale: 'Megs', value: '3,500,000', context: 'They\'re selling that property for a 3.5 6.' },
  ];

  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 4: The Data-Deca Protocol
        </h2>
        
        <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
          Rule: <code className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)] font-mono">[Value] [Power of 10]</code>
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          Money completely transcends local economies (Dollars, Rands, Euros). The second digit represents the data storage scale (number of zeros).
        </p>

        <CurrencyCalculator />
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

      {/* Why This Works */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Why This Protocol Works
        </h2>
        
        <div className="space-y-4">
          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Currency-Agnostic</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Works across all currencies. No need to specify dollars, euros, or yen.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Order of Magnitude</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Instantly communicates scale. "5 3" vs "5 6" tells you if it's thousands or millions.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Mental Math</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Powers of 10 are easy to calculate. Just count the zeros.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Data Storage Parallel</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Uses the same scale as data storage (KB, MB, GB), making it intuitive for tech-minded people.
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
          Calculate these Data-Deca values:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem="7 2"
            hint="7 × 10^2 (hundreds)"
            answer="700"
          />

          <PracticeExercise
            problem="2.5 3"
            hint="2.5 × 10^3 (thousands)"
            answer="2,500"
          />

          <PracticeExercise
            problem="8 4"
            hint="8 × 10^4 (ten-thousands)"
            answer="80,000"
          />

          <PracticeExercise
            problem="1.2 6"
            hint="1.2 × 10^6 (millions)"
            answer="1,200,000"
          />
        </div>
      </section>
    </div>
  );
}
