import { useState } from 'react';
import PracticeExercise from './PracticeExercise';

function ClockMathCalculator() {
  const [hour, setHour] = useState(13);
  const [minutes, setMinutes] = useState(52);
  const [mode, setMode] = useState('deca');

  const decaTime = (minutes / 10).toFixed(1);
  const nextHour = hour + 1;
  const remainder = 60 - minutes;

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
      <h3 className="text-lg font-bold tracking-wider text-[var(--accent)] mb-4">Clock Math Calculator</h3>
      
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Hour (24h format)</label>
          <input
            type="number"
            min="0"
            max="23"
            value={hour}
            onChange={(e) => setHour(Number(e.target.value))}
            className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Minutes</label>
          <input
            type="number"
            min="0"
            max="59"
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg font-mono"
          />
        </div>
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Mode</label>
        <div className="flex gap-2">
          <button
            onClick={() => setMode('deca')}
            className="flex-1 px-4 py-2 rounded-md font-medium transition-all cursor-pointer border-2"
            style={mode === 'deca'
              ? { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
              : { background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
            }
          >
            Deca-Time
          </button>
          <button
            onClick={() => setMode('remainder')}
            className="flex-1 px-4 py-2 rounded-md font-medium transition-all cursor-pointer border-2"
            style={mode === 'remainder'
              ? { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
              : { background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
            }
          >
            Remainder
          </button>
        </div>
      </div>

      {mode === 'deca' ? (
        <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-5">
          <h4 className="text-base font-bold text-[var(--accent)] mb-4">Deca-Time</h4>
          
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Formula</div>
              <div className="text-lg font-mono font-bold text-[var(--accent)]">{minutes} ÷ 10 = {decaTime}</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Englicode Term</div>
              <div className="text-3xl font-mono font-bold text-[var(--accent)]">{hour} {decaTime}</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Explanation</div>
              <div className="text-sm text-[var(--text-primary)]">
                The hour is {hour}:00. {minutes} minutes divided by 10 is {decaTime}.
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-5">
          <h4 className="text-base font-bold text-[var(--accent)] mb-4">The Remainder</h4>
          
          <div className="space-y-3">
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Formula</div>
              <div className="text-lg font-mono font-bold text-[var(--accent)]">60 - {minutes} = {remainder}</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Englicode Term</div>
              <div className="text-3xl font-mono font-bold text-[var(--accent)]">{remainder} to {nextHour}</div>
            </div>

            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">Explanation</div>
              <div className="text-sm text-[var(--text-primary)]">
                There are {remainder} minutes remaining until the {nextHour}th hour.
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ClockMathTraining() {
  const examples = [
    { 
      deca: '13 5.2', 
      remainder: '8 to 14', 
      standard: '1:52 PM',
      explanation: 'Afternoon time expressed two ways'
    },
    { 
      deca: '9 3.0', 
      remainder: '30 to 10', 
      standard: '9:30 AM',
      explanation: 'Morning half-hour mark'
    },
    { 
      deca: '18 4.5', 
      remainder: '15 to 19', 
      standard: '6:45 PM',
      explanation: 'Evening quarter-to time'
    },
    { 
      deca: '23 1.5', 
      remainder: '45 to 0', 
      standard: '11:15 PM',
      explanation: 'Late night quarter-past'
    },
  ];

  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 3: Clock Math
        </h2>
        
        <p className="text-sm text-[var(--text-primary)] mb-6 leading-relaxed">
          Traditional clocks are subjective. Englicode forces you to either compress the minutes into a decimal 
          or state the mathematical remainder until the next hour.
        </p>

        <ClockMathCalculator />
      </section>

      {/* Examples */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Real-World Examples
        </h2>
        
        <div className="space-y-4">
          {examples.map((ex, idx) => (
            <div key={idx} className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
              <div className="grid md:grid-cols-2 gap-3 mb-2">
                <div>
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Deca-Time</div>
                  <div className="font-mono text-[var(--accent)] font-bold text-lg">{ex.deca}</div>
                </div>
                <div>
                  <div className="text-xs text-[var(--text-secondary)] mb-1">Remainder</div>
                  <div className="font-mono text-[var(--accent)] font-bold text-lg">{ex.remainder}</div>
                </div>
              </div>
              <div className="text-sm text-[var(--text-primary)] mb-1">{ex.standard}</div>
              <div className="text-xs text-[var(--text-secondary)] italic">{ex.explanation}</div>
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
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Eliminates AM/PM Confusion</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              24-hour format is universal. No more "is that morning or evening?"
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Mathematical Precision</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Deca-Time uses decimals for exact timing. Remainder gives you countdown precision.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Context Flexibility</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Choose Deca-Time for precision or Remainder for urgency. Both are valid.
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
          Convert these times to Englicode:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem="Convert 2:30 PM to Deca-Time"
            hint="Hour is 14, minutes ÷ 10"
            answer="14 3.0"
          />

          <PracticeExercise
            problem="Convert 9:45 AM to Remainder"
            hint="How many minutes until 10:00?"
            answer="15 to 10"
          />

          <PracticeExercise
            problem="Convert 6:20 PM to Deca-Time"
            hint="Hour is 18, 20 ÷ 10"
            answer="18 2.0"
          />

          <PracticeExercise
            problem="Convert 11:40 PM to Remainder"
            hint="Minutes until midnight (0:00)"
            answer="20 to 0"
          />
        </div>
      </section>
    </div>
  );
}
