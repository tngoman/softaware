import { useState } from 'react';

export default function PracticeExercise({ problem, hint, answer }) {
  const [revealed, setRevealed] = useState(false);

  return (
    <div className="bg-[var(--bg-tertiary)] p-4 rounded">
      <div className="font-mono text-[var(--accent)] font-bold mb-2 text-lg">{problem}</div>
      <div className="text-xs text-[var(--text-secondary)] mb-3">
        Hint: {hint}
      </div>
      {revealed ? (
        <div className="text-sm text-[var(--text-primary)] font-medium">
          Answer: {answer}
        </div>
      ) : (
        <button
          onClick={() => setRevealed(true)}
          className="text-xs font-medium px-3 py-1.5 rounded-md border transition-colors cursor-pointer"
          style={{ 
            background: 'var(--bg-primary)', 
            color: 'var(--accent)', 
            borderColor: 'var(--accent)' 
          }}
        >
          Reveal Answer
        </button>
      )}
    </div>
  );
}
