import PracticeExercise from './PracticeExercise';

export default function ProximityTraining() {
  const proximityLevels = [
    { 
      index: '1', 
      unit: 'Seconds', 
      urgency: 'Immediate',
      example: 'I\'m on it, give me a 1 Index.',
      context: 'Right now, this instant'
    },
    { 
      index: '2', 
      unit: 'Minutes', 
      urgency: 'Very Soon',
      example: 'I\'ll respond in a 2 Index.',
      context: 'Within the next few minutes'
    },
    { 
      index: '3', 
      unit: 'Hours', 
      urgency: 'Today',
      example: 'I\'ll have that report in a 3 Index.',
      context: 'Sometime today, within hours'
    },
    { 
      index: '4', 
      unit: 'Days', 
      urgency: 'This Week',
      example: 'The package arrives in a 4 Index.',
      context: 'Within the next few days'
    },
    { 
      index: '5', 
      unit: 'Weeks', 
      urgency: 'This Month',
      example: 'We\'ll settle the invoice in a 5 Index.',
      context: 'Don\'t expect it immediately'
    },
    { 
      index: '6', 
      unit: 'Months', 
      urgency: 'This Quarter',
      example: 'The project launches in a 6 Index.',
      context: 'Several months away'
    },
    { 
      index: '7', 
      unit: 'Years', 
      urgency: 'Long Term',
      example: 'We\'ll revisit this in a 7 Index.',
      context: 'Years down the line'
    },
  ];

  const comparisons = [
    { vague: 'Soon', englicode: '2 Index', meaning: 'Minutes' },
    { vague: 'Later', englicode: '3 Index', meaning: 'Hours' },
    { vague: 'In a bit', englicode: '2-3 Index', meaning: 'Minutes to Hours' },
    { vague: 'A while', englicode: '4-5 Index', meaning: 'Days to Weeks' },
    { vague: 'Eventually', englicode: '6-7 Index', meaning: 'Months to Years' },
    { vague: 'Someday', englicode: '7 Index', meaning: 'Years' },
  ];

  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 5: The Proximity Scale
        </h2>
        
        <p className="text-sm text-[var(--text-primary)] mb-4 leading-relaxed">
          Rule: <code className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)] font-mono">[n] Index</code>
        </p>
        <p className="text-sm text-[var(--text-secondary)] mb-6 leading-relaxed">
          Vague time words are the enemy of logic. We use the Time Index (1–7) as a standalone urgency level.
          This replaces "soon," "later," and "a while" with precise time scales.
        </p>

        <div className="grid md:grid-cols-2 gap-3">
          {proximityLevels.map((level) => (
            <div key={level.index} className="bg-[var(--bg-primary)] border border-[var(--border)] rounded p-4">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-[var(--accent)] font-mono font-bold text-2xl">{level.index}</span>
                <div>
                  <div className="text-sm font-bold text-[var(--text-primary)]">{level.unit}</div>
                  <div className="text-xs text-[var(--text-secondary)]">{level.urgency}</div>
                </div>
              </div>
              <div className="text-xs text-[var(--text-secondary)] mb-2">{level.context}</div>
              <blockquote className="text-xs text-[var(--text-secondary)] italic border-l-2 border-[var(--accent)] pl-2">
                "{level.example}"
              </blockquote>
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

      {/* Real-World Scenarios */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Real-World Scenarios
        </h2>
        
        <div className="space-y-4">
          <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <div className="font-bold text-[var(--text-primary)] mb-2">Work Deadline</div>
            <div className="text-sm text-[var(--text-secondary)] mb-2">
              Instead of: "I'll get that to you soon"
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              Say: "I'll get that to you in a <span className="font-mono text-[var(--accent)] font-bold">3 Index</span>" (hours)
            </div>
          </div>

          <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <div className="font-bold text-[var(--text-primary)] mb-2">Meeting Someone</div>
            <div className="text-sm text-[var(--text-secondary)] mb-2">
              Instead of: "I'll be there in a bit"
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              Say: "I'll be there in a <span className="font-mono text-[var(--accent)] font-bold">2 Index</span>" (minutes)
            </div>
          </div>

          <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <div className="font-bold text-[var(--text-primary)] mb-2">Project Timeline</div>
            <div className="text-sm text-[var(--text-secondary)] mb-2">
              Instead of: "We'll launch eventually"
            </div>
            <div className="text-sm text-[var(--text-primary)]">
              Say: "We'll launch in a <span className="font-mono text-[var(--accent)] font-bold">6 Index</span>" (months)
            </div>
          </div>
        </div>
      </section>

      {/* Why This Works */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Why This Protocol Works
        </h2>
        
        <div className="space-y-4">
          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Eliminates Ambiguity</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              "Soon" means different things to different people. "2 Index" is universally understood as minutes.
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Sets Clear Expectations</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Both parties know exactly what timeframe to expect. No more "I thought you meant today!"
            </p>
          </div>

          <div className="bg-[var(--bg-primary)] border-l-4 border-[var(--accent)] p-4 rounded">
            <h3 className="text-sm font-bold text-[var(--text-primary)] mb-2">Builds on Time Index</h3>
            <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
              Uses the same 1-7 scale you already learned. No new system to memorize.
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
          Replace vague language with Proximity Scale:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem='Replace: "I\'ll call you soon"'
            hint="Think about minutes or hours"
            answer='"I\'ll call you in a 2 Index" (minutes) or "3 Index" (hours)'
          />

          <PracticeExercise
            problem='Replace: "The package arrives in a while"'
            hint="Days or weeks?"
            answer='"The package arrives in a 4 Index" (days) or "5 Index" (weeks)'
          />

          <PracticeExercise
            problem='Replace: "We\'ll launch eventually"'
            hint="Long-term timeframe"
            answer='"We\'ll launch in a 6 Index" (months) or "7 Index" (years)'
          />

          <PracticeExercise
            problem='Replace: "Give me a sec"'
            hint="Immediate action"
            answer='"Give me a 1 Index" (seconds)'
          />
        </div>
      </section>
    </div>
  );
}
