import PracticeExercise from './PracticeExercise';

export default function TimeIndexTraining() {
  const timeUnits = [
    { id: 1, label: 'Seconds', example: 'Give me a 1 Index — right now!' },
    { id: 2, label: 'Minutes', example: 'I need a 2 Index to finish this.' },
    { id: 3, label: 'Hours', example: 'It\'ll take a 3 Index to complete.' },
    { id: 4, label: 'Days', example: 'The delivery is in a 4 Index.' },
    { id: 5, label: 'Weeks', example: 'We\'ll settle this in a 5 Index.' },
    { id: 6, label: 'Months', example: 'The project timeline is a 6 Index.' },
    { id: 7, label: 'Years', example: 'That\'s a 7 Index commitment.' },
  ];

  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 1: The Time Index
        </h2>
        
        <p className="text-sm text-[var(--text-primary)] mb-6 leading-relaxed">
          We assign a permanent, universal digit to standard units of time, scaling from smallest to largest. 
          This acts as the mathematical lock for all time-based rules.
        </p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {timeUnits.map((t) => (
            <div key={t.id} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-3 flex items-center gap-3">
              <span className="text-[var(--accent)] font-mono font-bold text-lg">{t.id}</span>
              <span className="text-xs tracking-wider text-[var(--text-secondary)] uppercase">{t.label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Examples */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Usage Examples
        </h2>
        
        <div className="space-y-4">
          {timeUnits.map((t) => (
            <div key={t.id} className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
              <div className="flex items-center gap-3 mb-2">
                <span className="font-mono text-[var(--accent)] font-bold text-lg">{t.id} Index</span>
                <span className="text-[var(--text-secondary)] text-sm">→ {t.label}</span>
              </div>
              <blockquote className="text-xs text-[var(--text-secondary)] italic">"{t.example}"</blockquote>
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
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Universal Standard</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Every time unit gets one permanent number. No confusion, no context needed.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Replaces Vague Language</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              "Soon," "later," and "a while" mean different things to different people. The Time Index is precise.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Foundation for Other Protocols</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              The Time Index is the building block for Deca-Scale, Proximity, and other time-based protocols.
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
          Identify the time unit for each index:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem="What is 3 Index?"
            hint="Think about the middle of the scale"
            answer="Hours"
          />

          <PracticeExercise
            problem="What is 5 Index?"
            hint="Longer than days, shorter than months"
            answer="Weeks"
          />

          <PracticeExercise
            problem="What is 2 Index?"
            hint="60 of these make an hour"
            answer="Minutes"
          />

          <PracticeExercise
            problem="What is 6 Index?"
            hint="12 of these make a year"
            answer="Months"
          />
        </div>
      </section>
    </div>
  );
}
