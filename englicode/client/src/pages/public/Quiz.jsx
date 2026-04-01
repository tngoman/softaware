import { useState, useCallback, useEffect, useRef } from 'react';
import api from '../../lib/api';
import useAuthStore from '../../stores/authStore';

/* readable rank badge colours */
const rankColours = {
  0: 'var(--text-secondary)',
  1: 'var(--info)',
  2: 'var(--accent)',
  3: 'var(--warning)',
  4: 'var(--danger)',
};

export default function Quiz() {
  const { user } = useAuthStore();
  const [state, setState] = useState('idle'); // idle | loading | question | answered | error
  const [question, setQuestion] = useState(null);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);
  const [streak, setStreak] = useState(0);
  const [totalPoints, setTotalPoints] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef(null);
  const startTimeRef = useRef(null);
  const [elapsed, setElapsed] = useState(0);

  /* ─── Fetch next question ─── */
  const fetchQuestion = useCallback(async () => {
    setState('loading');
    setAnswer('');
    setResult(null);
    try {
      const r = await api.get('/quiz/question');
      setQuestion(r.data.data);
      setState('question');
      startTimeRef.current = Date.now();
      setElapsed(0);
      /* start timer */
      timerRef.current = setInterval(() => {
        setElapsed(((Date.now() - startTimeRef.current) / 1000).toFixed(1));
      }, 100);
    } catch {
      setState('error');
    }
  }, []);

  /* cleanup */
  useEffect(() => () => clearInterval(timerRef.current), []);

  /* ─── Submit answer ─── */
  const submit = async () => {
    if (!answer.trim() || submitting) return;
    setSubmitting(true);
    clearInterval(timerRef.current);
    const timeTakenSeconds = parseFloat(((Date.now() - startTimeRef.current) / 1000).toFixed(2));

    try {
      const r = await api.post('/quiz/answer', {
        answer: answer.trim(),
        validAnswers: question.validAnswers,
        timeTakenSeconds,
      });

      const d = r.data.data;
      // Normalise response for the UI
      d._correct = d.isCorrect;
      d._points = d.pointsEarned || 0;
      d._validAnswer = question.validAnswers?.[0] || '';
      setResult(d);
      setState('answered');

      if (d.isCorrect) {
        setStreak((s) => s + 1);
        setTotalPoints((p) => p + d._points);
      } else {
        setStreak(0);
      }
    } catch {
      setState('error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') submit();
  };

  /* ─── Render states ─── */
  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Quiz</h1>
        <p className="text-base" style={{ color: 'var(--text-secondary)' }}>
          Train your brain across all Englicode protocols — time, currency, status, direction.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex items-center gap-5 mb-6 p-4 rounded-xl" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        <div className="text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Streak: </span>
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{streak}</span>
        </div>
        <div className="text-sm">
          <span style={{ color: 'var(--text-secondary)' }}>Session pts: </span>
          <span className="font-bold" style={{ color: 'var(--accent)' }}>{totalPoints}</span>
        </div>
        {user && (
          <div className="text-sm">
            <span style={{ color: 'var(--text-secondary)' }}>Rank: </span>
            <span className="font-bold" style={{ color: rankColours[user.rank_tier] || 'var(--accent)' }}>{user.rank_title}</span>
          </div>
        )}
      </div>

      {/* ─── Idle state ─── */}
      {state === 'idle' && (
        <div className="text-center py-20">
          <div className="text-5xl mb-5">⚡</div>
          <h2 className="text-2xl font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Ready to train?</h2>
          <p className="text-base mb-6 max-w-sm mx-auto" style={{ color: 'var(--text-secondary)' }}>
            You'll get questions from random Englicode protocols. Speed matters — faster answers earn bonus points.
          </p>
          {!user && (
            <p className="text-sm mb-6" style={{ color: 'var(--warning)' }}>
              Sign in to save your score and earn rank points.
            </p>
          )}
          <button onClick={fetchQuestion} className="btn btn-primary" style={{ fontSize: '15px', padding: '0.7rem 2rem' }}>
            Start Quiz
          </button>
        </div>
      )}

      {/* ─── Loading ─── */}
      {state === 'loading' && (
        <div className="text-center py-20 text-base animate-pulse" style={{ color: 'var(--text-secondary)' }}>
          Generating question…
        </div>
      )}

      {/* ─── Question ─── */}
      {state === 'question' && question && (
        <div className="rounded-xl p-6" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-5">
            <span className="text-xs font-semibold uppercase tracking-wider px-2.5 py-1 rounded-full" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
              {question.label || 'Englicode'}
            </span>
            <span className="text-lg font-mono font-bold" style={{ color: 'var(--accent)' }}>{elapsed}s</span>
          </div>

          <h2 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>{question.prompt}</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>Format: {question.expectedFormat}</p>

          <div className="flex gap-2">
            <input
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              disabled={submitting}
              placeholder="Your answer…"
              style={{ flex: 1 }}
            />
            <button onClick={submit} disabled={submitting} className="btn btn-primary">
              {submitting ? 'Checking…' : 'Submit'}
            </button>
          </div>
        </div>
      )}

      {/* ─── Answered ─── */}
      {state === 'answered' && result && (
        <div className="flex flex-col gap-4">
          <div
            className="rounded-xl p-6"
            style={{
              background: result._correct ? 'var(--accent-dim)' : 'rgba(224,16,58,0.06)',
              border: `1px solid ${result._correct ? 'var(--accent)' : 'var(--danger)'}`,
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <span className="text-3xl">{result._correct ? '✓' : '✗'}</span>
              <span className="text-xl font-bold" style={{ color: result._correct ? 'var(--accent)' : 'var(--danger)' }}>
                {result._correct ? 'Correct!' : 'Incorrect'}
              </span>
            </div>

            {!result._correct && result._validAnswer && (
              <div className="text-base mb-3" style={{ color: 'var(--text-secondary)' }}>
                Correct answer: <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{result._validAnswer}</span>
              </div>
            )}

            <div className="text-base" style={{ color: 'var(--text-secondary)' }}>
              Points earned: <span className="font-bold" style={{ color: 'var(--accent)' }}>+{result._points}</span>
            </div>

            {result.totalPoints !== undefined && (
              <div className="mt-1 text-base" style={{ color: 'var(--text-secondary)' }}>
                Total points: <span className="font-bold" style={{ color: 'var(--accent)' }}>{result.totalPoints.toLocaleString()}</span>
              </div>
            )}
          </div>

          <button onClick={fetchQuestion} className="btn btn-ghost w-full" style={{ fontSize: '15px', padding: '0.7rem' }}>
            Next Question →
          </button>
        </div>
      )}

      {/* ─── Error ─── */}
      {state === 'error' && (
        <div className="text-center py-20">
          <div className="text-base mb-5" style={{ color: 'var(--danger)' }}>Something went wrong. Please try again.</div>
          <button onClick={fetchQuestion} className="btn btn-ghost">Retry</button>
        </div>
      )}
    </div>
  );
}
