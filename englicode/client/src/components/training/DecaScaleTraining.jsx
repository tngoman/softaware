import { useState } from 'react';
import PracticeExercise from './PracticeExercise';

function DecaCalculator() {
  const [multiplier, setMultiplier] = useState(1.5);
  const [timeIndex, setTimeIndex] = useState(2);

  const timeUnits = [
    { id: 1, label: 'Seconds' },
    { id: 2, label: 'Minutes' },
    { id: 3, label: 'Hours' },
    { id: 4, label: 'Days' },
    { id: 5, label: 'Weeks' },
    { id: 6, label: 'Months' },
    { id: 7, label: 'Years' },
  ];

  const result = multiplier * 10;
  const unit = timeUnits.find(u => u.id === timeIndex)?.label || '';

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
      <h3 className="text-lg font-bold tracking-wider text-[var(--accent)] mb-4">Deca-Scale Calculator</h3>
      
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Multiplier</label>
        <input
          type="number"
          step="0.1"
          value={multiplier}
          onChange={(e) => setMultiplier(Number(e.target.value))}
          className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg font-mono"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Time Index</label>
        <div className="grid grid-cols-7 gap-2">
          {timeUnits.map((t) => (
            <button
              key={t.id}
              onClick={() => setTimeIndex(t.id)}
              className="px-3 py-2 rounded-md font-mono font-bold transition-all cursor-pointer border-2"
              style={timeIndex === t.id
                ? { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
                : { background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
              }
            >
              {t.id}
            </button>
          ))}
        </div>
      </div>

      <div className="mb-6 p-4 bg-[var(--bg-tertiary)] border border-[var(--accent)]/30 rounded-lg text-center">
        <div className="text-sm text-[var(--text-secondary)] mb-1">Englicode Term</div>
        <div className="text-3xl font-mono font-bold text-[var(--accent)] mb-2">{multiplier} {timeIndex}</div>
      </div>

      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-5">
        <h4 className="text-base font-bold text-[var(--accent)] mb-4">The Calculation</h4>
        
        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Formula</div>
            <div className="text-lg font-mono font-bold text-[var(--accent)]">{multiplier} × 10 = {result}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Result</div>
            <div className="text-2xl font-bold text-[var(--accent)]">{result} {unit}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function DecaScaleTraining() {
  const examples = [
    { syntax: '1.5 2', calculation: '1.5 × 10 = 15 Minutes', context: 'I\'ll be there in a 1.5 2.' },
    { syntax: '3 2', calculation: '3 × 10 = 30 Minutes', context: 'Give me a 3 2, I need to finish this.' },
    { syntax: '2 4', calculation: '2 × 10 = 20 Days', context: 'The project is due in a 2 4.' },
    { syntax: '4.5 3', calculation: '4.5 × 10 = 45 Hours', context: 'The marathon is a 4.5 3 event.' },
    { syntax: '1 5', calculation: '1 × 10 = 10 Weeks', context: 'Training takes about a 1 5.' },
  ];

  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 2: The Deca-Scale Protocol
        </h2>
        
        <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
          Rule: <code className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)] font-mono">[Multiplier of 10] [Time Index]</code>
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          Instead of standard time chunks, the first number acts as a base-10 multiplier for the chosen Time Index.
        </p>

        <DecaCalculator />
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
                <span className="text-[var(--text-secondary)] text-sm">→ {ex.calculation}</span>
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
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Base-10 Simplicity</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Multiplying by 10 is instant mental math. No complex calculations needed.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Flexible Precision</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Use decimals for exact timing: 1.5 2 is more precise than "about 15 minutes."
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Compression</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Two numbers replace entire phrases. "3 2" is faster than "thirty minutes."
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
          Calculate these Deca-Scale values:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem="2.5 3"
            hint="Multiply by 10, then check the time unit"
            answer="2.5 × 10 = 25 Hours"
          />

          <PracticeExercise
            problem="4 2"
            hint="What's 4 × 10?"
            answer="4 × 10 = 40 Minutes"
          />

          <PracticeExercise
            problem="1.2 5"
            hint="Decimal times 10"
            answer="1.2 × 10 = 12 Weeks"
          />

          <PracticeExercise
            problem="6 4"
            hint="Simple multiplication by 10"
            answer="6 × 10 = 60 Days"
          />
        </div>
      </section>
    </div>
  );
}
