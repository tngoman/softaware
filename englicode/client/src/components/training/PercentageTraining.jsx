import { useState } from 'react';
import PracticeExercise from './PracticeExercise';

function MentalMathTutor() {
  const [value, setValue] = useState(58);
  const [anchor, setAnchor] = useState(50);

  const anchors = [10, 20, 25, 50];

  const getRuleName = () => {
    switch (anchor) {
      case 50: return 'The Double-Up Rule';
      case 25: return 'The Quadruple Rule';
      case 20: return 'The Quint Rule';
      case 10: return 'The Decimal Shift';
      default: return '';
    }
  };

  const getMultiplier = () => {
    switch (anchor) {
      case 50: return 2;
      case 25: return 4;
      case 20: return 5;
      case 10: return 10;
      default: return 1;
    }
  };

  const getExplanation = () => {
    const multiplier = getMultiplier();
    const result = value * multiplier;
    
    switch (anchor) {
      case 50:
        return {
          logic: `50 × 2 = 100`,
          hack: 'If you double the bottom, you just double the top.',
          calculation: `${value} × 2 = ${result}`,
          result: `${result}%`
        };
      case 25:
        return {
          logic: `25 × 4 = 100`,
          hack: 'If you quadruple the bottom, you quadruple the top.',
          calculation: `${value} × 4 = ${result}`,
          result: `${result}%`
        };
      case 20:
        return {
          logic: `20 × 5 = 100`,
          hack: 'If you multiply the bottom by 5, multiply the top by 5.',
          calculation: `${value} × 5 = ${result}`,
          result: `${result}%`
        };
      case 10:
        return {
          logic: `10 × 10 = 100`,
          hack: 'Just add a zero to the top number.',
          calculation: `${value} × 10 = ${result}`,
          result: `${result}%`
        };
      default:
        return { logic: '', hack: '', calculation: '', result: '' };
    }
  };

  const explanation = getExplanation();

  return (
    <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
      <h3 className="text-lg font-bold tracking-wider text-[var(--accent)] mb-4">Mental Math Tutor</h3>
      
      {/* Interactive Inputs */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Value (Current)</label>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(Number(e.target.value))}
          className="w-full px-4 py-2 rounded-md border border-[var(--border)] bg-[var(--bg-primary)] text-[var(--text-primary)] text-lg font-mono"
        />
      </div>

      <div className="mb-6">
        <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">Anchor</label>
        <div className="flex gap-2">
          {anchors.map((a) => (
            <button
              key={a}
              onClick={() => setAnchor(a)}
              className="flex-1 px-4 py-2 rounded-md font-mono font-bold text-lg transition-all cursor-pointer border-2"
              style={anchor === a
                ? { background: 'var(--accent)', color: 'var(--bg-primary)', borderColor: 'var(--accent)' }
                : { background: 'var(--bg-primary)', color: 'var(--text-secondary)', borderColor: 'var(--border)' }
              }
            >
              {a}
            </button>
          ))}
        </div>
      </div>

      {/* Output Display */}
      <div className="mb-6 p-4 bg-[var(--bg-tertiary)] border border-[var(--accent)]/30 rounded-lg text-center">
        <div className="text-sm text-[var(--text-secondary)] mb-1">Englicode Term</div>
        <div className="text-3xl font-mono font-bold text-[var(--accent)]">{value} {anchor}</div>
      </div>

      {/* The Cheat Code Breakdown */}
      <div className="bg-[var(--bg-primary)] border border-[var(--border)] rounded-lg p-5">
        <h4 className="text-base font-bold text-[var(--accent)] mb-4">The Mental Shortcut: {getRuleName()}</h4>
        
        <div className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">The Logic</div>
            <div className="text-sm text-[var(--text-primary)]">{explanation.logic}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">The Hack</div>
            <div className="text-sm text-[var(--text-primary)]">{explanation.hack}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">The Calculation</div>
            <div className="text-lg font-mono font-bold text-[var(--accent)]">{explanation.calculation}</div>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-1">The Result</div>
            <div className="text-2xl font-bold text-[var(--accent)]">{explanation.result}</div>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-[var(--text-secondary)] italic">
        Because the Anchor is {anchor}, the math becomes a simple {getRuleName().toLowerCase().replace('the ', '')} exercise.
      </div>
    </div>
  );
}

function ExampleCard({ value, anchor, context, description }) {
  const getMultiplier = () => {
    switch (anchor) {
      case 50: return 2;
      case 25: return 4;
      case 20: return 5;
      case 10: return 10;
      default: return 1;
    }
  };

  const result = value * getMultiplier();

  return (
    <div className="bg-[var(--bg-tertiary)] border-l-4 border-[var(--accent)] p-4 rounded">
      <div className="flex items-center gap-3 mb-2">
        <span className="font-mono text-[var(--accent)] font-bold text-lg">{value} {anchor}</span>
        <span className="text-[var(--text-secondary)] text-sm">→ {result}%</span>
      </div>
      <div className="text-sm text-[var(--text-primary)] mb-1">{description}</div>
      <blockquote className="text-xs text-[var(--text-secondary)] italic">"{context}"</blockquote>
    </div>
  );
}

export default function PercentageTraining() {
  return (
    <div className="space-y-8">
      {/* Protocol Overview */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-2xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Protocol 7: The Percentage State
        </h2>
        
        <div className="mb-6">
          <div className="text-sm text-[var(--text-primary)] mb-3 leading-relaxed">
            The Englicode Status Protocol uses <code className="px-2 py-0.5 bg-[var(--bg-tertiary)] rounded text-[var(--accent)] font-mono">[Current] [Anchor]</code> to express percentages without saying the word "percent."
          </div>
          <div className="text-sm text-[var(--text-secondary)] leading-relaxed">
            Instead of saying "58 out of 50" or "116%", you simply say <strong className="text-[var(--accent)] font-mono">58 50</strong>. 
            The listener instantly knows you're above 100% because the first number is larger than the anchor.
          </div>
        </div>

        {/* Mental Math Tutor */}
        <MentalMathTutor />
      </section>

      {/* Real-World Examples */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Real-World Examples
        </h2>
        
        <div className="space-y-4">
          <ExampleCard
            value={58}
            anchor={50}
            context="The project is 58 50 complete."
            description="Project is at 116% of the original scope — you've exceeded expectations."
          />
          
          <ExampleCard
            value={23}
            anchor={50}
            context="Battery is 23 50."
            description="Battery is at 46% — less than half charged."
          />
          
          <ExampleCard
            value={75}
            anchor={100}
            context="The download is 75 100."
            description="Download is 75% complete — three-quarters done."
          />
          
          <ExampleCard
            value={18}
            anchor={20}
            context="We're at 18 20 capacity."
            description="At 90% capacity — nearly full."
          />
          
          <ExampleCard
            value={7}
            anchor={10}
            context="Coffee cup is 7 10."
            description="Cup is 70% full."
          />
          
          <ExampleCard
            value={22}
            anchor={25}
            context="The tank is 22 25."
            description="Tank is at 88% — almost full."
          />
        </div>
      </section>

      {/* Practice Exercises */}
      <section className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6">
        <h2 className="text-xl font-bold tracking-wider text-[var(--accent)] mb-4 border-b border-[var(--border)] pb-3">
          Practice Exercises
        </h2>
        
        <div className="text-sm text-[var(--text-secondary)] mb-4">
          Try calculating these in your head using the mental shortcuts:
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          <PracticeExercise
            problem="35 50"
            hint="Use the Double-Up Rule"
            answer="35 × 2 = 70%"
          />

          <PracticeExercise
            problem="8 10"
            hint="Use the Decimal Shift"
            answer="8 × 10 = 80%"
          />

          <PracticeExercise
            problem="19 25"
            hint="Use the Quadruple Rule"
            answer="19 × 4 = 76%"
          />

          <PracticeExercise
            problem="16 20"
            hint="Use the Quint Rule"
            answer="16 × 5 = 80%"
          />
        </div>
      </section>
    </div>
  );
}
