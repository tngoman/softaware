import { useParams, useNavigate, useLocation } from 'react-router-dom';

const SHORTCUT_MAP = { '/privacy': 'privacy', '/terms': 'terms' };

const sections = [
  {
    id: 'disclaimer',
    title: 'Platform Disclaimer',
    items: [
      {
        heading: '1. Not for Critical Communication',
        body: 'Englicode is a gamified cognitive training tool and experimental constructed dialect. It is designed strictly for logic puzzles, social communication, and entertainment. Under no circumstances should Englicode be used for emergency, medical, financial, or safety-critical communications.',
      },
      {
        heading: '2. No Liability for Miscommunication',
        body: 'The platform relies on user-generated consensus for protocol definitions and scaling expressions. We make no guarantees regarding the accuracy, safety, or universal comprehension of the language. Englicode and its creators are not liable for any damages, financial losses, missed deadlines, or personal injury resulting from miscommunications, translation errors, or the real-world application of the language.',
      },
      {
        heading: '3. The Safety Override',
        body: 'Users are strictly prohibited from submitting, testing, or defining terms related to medical dosages, chemical compounds, or emergency services. Any such content will be immediately purged by the Automated Linter or platform administrators.',
      },
    ],
  },
  {
    id: 'terms',
    title: 'Terms of Service',
    items: [
      {
        heading: '1. Acceptance of Terms',
        body: 'By accessing Englicode, creating an account, or submitting to the Consensus Board, you agree to abide by these Terms of Service.',
      },
      {
        heading: '2. The Englicode Protocol Rules',
        body: 'Users participating in the Consensus Board or submitting "Pull Requests" for new protocol terms must adhere to the foundational mathematical laws of the language (e.g., The Deca-Scale, The Time Index). Submissions that attempt to break these logic locks or introduce culturally isolated terms will be rejected.',
      },
      {
        heading: '3. User-Generated Content and Licensing',
        body: 'When you submit a new term, definition, or "Leap" to the Consensus Board, you grant Englicode a perpetual, irrevocable, worldwide, royalty-free license to use, modify, publish, and distribute that content as part of the official Englicode Dictionary.',
      },
      {
        heading: '4. Rank and Permissions (Processing Speed)',
        body: 'User ranks (e.g., Analog, Dual-Core, Overclocked) and associated platform permissions (voting and submitting rights) are earned solely through platform participation and algorithmically verified logic quizzes. Englicode reserves the right to adjust scoring algorithms, reset ranks, or revoke voting permissions at any time if automated abuse, spam, or manipulation is detected.',
      },
      {
        heading: '5. Account Termination',
        body: 'We reserve the right to suspend or terminate any account immediately and without notice if a user repeatedly submits prohibited content (medical/emergency terms), utilizes bot networks to manipulate the Consensus Board votes, or violates any other provision of these Terms.',
      },
      {
        heading: '6. "As-Is" Platform',
        body: 'The Englicode platform, the quizzes, and the dictionary are provided on an "as-is" and "as-available" basis. We do not warrant that the platform will be uninterrupted, error-free, or entirely secure.',
      },
    ],
  },
  {
    id: 'privacy',
    title: 'Privacy Policy',
    items: [
      {
        heading: '1. Information We Collect',
        body: null,
        list: [
          ['Account Information', 'When you register, we collect your email address, username, and password credential data.'],
          ['Performance Data', 'We track your quiz scores, completion times, and translation accuracy to calculate your public "Processing Speed" rank.'],
          ['Community Data', 'We log your upvotes, downvotes, and dictionary submissions on the Consensus Board.'],
          ['Technical Data', 'Standard diagnostic data including IP addresses, browser types, and device identifiers necessary to maintain session security and platform stability.'],
        ],
      },
      {
        heading: '2. How We Use Your Information',
        body: null,
        list: [
          [null, 'To operate the Dual-Layer Quiz Evaluator and calculate your global rank.'],
          [null, 'To populate your shareable public profile (displaying your Username, Rank Tier, and approved Dictionary Pull Requests).'],
          [null, 'To secure the Consensus Board against automated bot voting by verifying user authentication and historical logic accuracy.'],
          [null, 'To communicate platform updates or changes to the core dictionary.'],
        ],
      },
      {
        heading: '3. Publicly Shared Data',
        body: 'Your Englicode username, current Processing Speed rank, and the specific dictionary terms you have successfully merged into the platform are public by default to facilitate the social and competitive nature of the system. Your email address and raw quiz failures remain private.',
      },
      {
        heading: '4. Data Sharing and Protection',
        body: 'We do not sell your personal data to third parties. Data may be shared with trusted third-party service providers (such as cloud hosting and database infrastructure) strictly for the purpose of operating the platform.',
      },
      {
        heading: '5. Cookies and Local Storage',
        body: 'Englicode uses cookies and browser local storage to maintain your authenticated session, save your dark/light mode UI preferences, and cache the global dictionary locally to reduce server ping times during translation.',
      },
      {
        heading: '6. Account Deletion',
        body: 'You may request the deletion of your account at any time via the user dashboard. Upon deletion, your personal identifiable information will be removed. However, any protocol terms you successfully merged into the public Englicode Dictionary via the Consensus Board will remain part of the open-source language, anonymized from your deleted profile.',
      },
    ],
  },
];

export default function Legal() {
  const { section } = useParams();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Support shortcut routes like /privacy → privacy, /terms → terms
  const resolved = SHORTCUT_MAP[pathname] || section;
  const active = sections.find((s) => s.id === resolved)?.id || 'disclaimer';
  const current = sections.find((s) => s.id === active);

  return (
    <div className="max-w-4xl mx-auto px-5 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-xl font-bold tracking-wider mb-1">
          <span className="text-[var(--accent)]">§</span> Legal
        </h1>
        <p className="text-sm text-[var(--text-secondary)] tracking-wider">
          Disclaimer, Terms of Service, and Privacy Policy.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto">
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => navigate(`/legal/${s.id}`)}
            className={`px-4 py-2 rounded text-xs tracking-widest uppercase whitespace-nowrap cursor-pointer transition-colors ${
              active === s.id
                ? 'bg-[var(--accent-dim)] text-[var(--accent)]'
                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            {s.title}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border)] rounded-lg p-6 md:p-8">
        <h2 className="text-sm font-bold tracking-wider text-[var(--accent)] mb-6">
          {current.title}
        </h2>

        <div className="space-y-6">
          {current.items.map((item, idx) => (
            <div key={idx}>
              <h3 className="text-xs font-bold tracking-wider mb-2">{item.heading}</h3>

              {item.body && (
                <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                  {item.body}
                </p>
              )}

              {item.list && (
                <ul className="space-y-2 mt-1">
                  {item.list.map(([label, text], i) => (
                    <li key={i} className="text-sm text-[var(--text-secondary)] leading-relaxed pl-4 relative before:content-['›'] before:absolute before:left-0 before:text-[var(--accent)]">
                      {label && (
                        <span className="text-[var(--text-primary)] font-bold">{label}: </span>
                      )}
                      {text}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Footer note */}
      <div className="mt-6 text-center text-xs text-[var(--text-secondary)] tracking-wider">
        Last updated: March 2026. This platform is strictly for logic-training and social communication.
      </div>
    </div>
  );
}
