# Englicode Data Fields

## Data Structures and API Response Formats

This document defines all data structures used in the Englicode platform, including API responses, database models, and component props.

## Authentication

### User Object
```javascript
{
  id: number,                    // Unique user ID
  username: string,              // Display name
  email: string,                 // Email address
  avatar_url: string | null,     // Profile picture URL
  oauth_provider: string,        // 'google' | 'facebook'
  oauth_id: string,              // Provider's user ID
  rank_tier: number,             // 0-4 (Analog to Admin)
  rank_title: string,            // 'Analog' | 'Read-Only' | 'Dual-Core' | 'Overclocked' | 'Admin'
  points: number,                // Total XP earned
  created_at: string,            // ISO 8601 timestamp
  updated_at: string             // ISO 8601 timestamp
}
```

### Auth Store State
```javascript
{
  user: User | null,             // Current user object
  token: string | null,          // JWT token
  loading: boolean,              // Initial load state
  error: string | null,          // Error message
  impersonating: boolean         // Admin impersonation flag
}
```

### Login Response
```javascript
{
  success: boolean,
  data: {
    token: string,               // JWT token
    user: User                   // User object
  }
}
```

## Dictionary / Index

### Term Object
```javascript
{
  id: number,                    // Unique term ID
  category: string,              // 'mathematical_protocols' | 'time_and_systems' | 'universal_currency'
  term: string,                  // The Englicode term (e.g., "1.5 2")
  meaning: string,               // Plain English translation (e.g., "15 Minutes")
  the_leap: string,              // Logical explanation
  created_at: string,            // ISO 8601 timestamp
  updated_at: string             // ISO 8601 timestamp
}
```

### Index Response (Paginated)
```javascript
{
  success: boolean,
  data: {
    terms: Term[],               // Array of term objects
    total: number,               // Total count (for pagination)
    page: number,                // Current page
    limit: number                // Items per page
  }
}
```

### Category Summary
```javascript
{
  category: string,              // Category name
  count: number                  // Number of terms in category
}
```

### Categories Response
```javascript
{
  success: boolean,
  data: CategorySummary[]        // Array of category summaries
}
```

## Pull Requests

### Pull Request Object
```javascript
{
  id: number,                    // Unique PR ID
  author_id: number,             // User ID of submitter
  author_username: string,       // Username of submitter
  category: string,              // Proposed category
  proposed_term: string,         // Proposed Englicode term
  proposed_meaning: string,      // Proposed translation
  proposed_leap: string,         // Proposed explanation
  status: string,                // 'pending' | 'approved' | 'rejected'
  upvotes: number,               // Community upvote count
  downvotes: number,             // Community downvote count
  created_at: string,            // ISO 8601 timestamp
  updated_at: string,            // ISO 8601 timestamp
  reviewed_at: string | null,    // ISO 8601 timestamp
  reviewed_by: number | null     // Admin user ID
}
```

### Pull Requests Response (Paginated)
```javascript
{
  success: boolean,
  data: {
    pullRequests: PullRequest[], // Array of PR objects
    total: number,               // Total count
    page: number,                // Current page
    limit: number                // Items per page
  }
}
```

### PR Action Response
```javascript
{
  success: boolean,
  message: string                // Confirmation message
}
```

## Quiz

### Question Object
```javascript
{
  prompt: string,                // Question text (e.g., "Translate: 15 Minutes")
  expectedFormat: string,        // Format hint (e.g., "[Value] [Index]")
  validAnswers: string[],        // Array of acceptable answers (e.g., ["1.5 2", "15 2"])
  label: string                  // Protocol name (e.g., "Deca-Scale")
}
```

### Question Response
```javascript
{
  success: boolean,
  data: Question                 // Question object
}
```

### Answer Submission
```javascript
{
  answer: string,                // User's answer
  validAnswers: string[],        // Valid answers from question
  timeTakenSeconds: number       // Time to answer (for bonus points)
}
```

### Answer Response
```javascript
{
  success: boolean,
  data: {
    isCorrect: boolean,          // Whether answer was correct
    pointsEarned: number,        // Points awarded (speed bonus included)
    totalPoints: number,         // User's new total points
    correctAnswer: string,       // First valid answer (for display)
    newRank: {                   // If rank changed
      tier: number,
      title: string
    } | null
  }
}
```

## Leaderboard

### Leaderboard Entry
```javascript
{
  position: number,              // Rank position (1-based)
  user_id: number,               // User ID
  username: string,              // Display name
  avatar_url: string | null,     // Profile picture
  points: number,                // Total points
  rank_tier: number,             // Current tier
  rank_title: string             // Current rank title
}
```

### Leaderboard Response
```javascript
{
  success: boolean,
  data: LeaderboardEntry[]       // Array of entries
}
```

## User Profile

### Profile Response
```javascript
{
  success: boolean,
  data: {
    user: User,                  // User object
    stats: {
      totalQuizzes: number,      // Quizzes completed
      correctAnswers: number,    // Correct answer count
      accuracy: number,          // Percentage (0-100)
      averageSpeed: number,      // Average seconds per answer
      contributedTerms: number,  // Approved PRs
      pendingPRs: number         // Pending PRs
    }
  }
}
```

## Dashboard Statistics

### Dashboard Stats Response
```javascript
{
  success: boolean,
  data: {
    totalTerms: number,          // Total canon terms
    totalUsers: number,          // Total registered users
    pendingPRs: number,          // Pending pull requests
    categories: CategorySummary[], // Category breakdown
    topUsers: LeaderboardEntry[] // Top 5 users
  }
}
```

## Training Components

### Training Module Props
```javascript
{
  // No props - self-contained interactive components
}
```

### Training State (Internal)
```javascript
{
  examples: Array<{
    input: string,               // Example input
    output: string,              // Expected output
    explanation: string          // How to calculate
  }>,
  userInput: string,             // Current user input
  feedback: string | null        // Validation feedback
}
```

## Settings

### Theme Setting
```javascript
{
  theme: 'dark' | 'light'        // Stored in localStorage as 'englicode_theme'
}
```

### Settings Response
```javascript
{
  success: boolean,
  data: {
    theme: string,               // Current theme
    notifications: boolean,      // Email notifications enabled
    publicProfile: boolean       // Profile visible to others
  }
}
```

## Error Responses

### Standard Error Format
```javascript
{
  success: false,
  error: string,                 // Error type
  message: string                // Human-readable message
}
```

### Common Error Codes
- `401` - Unauthorized (invalid/missing token)
- `403` - Forbidden (insufficient rank)
- `404` - Not Found
- `422` - Validation Error
- `500` - Internal Server Error

## Pagination Parameters

### Query Parameters
```javascript
{
  page: number,                  // Page number (1-based)
  limit: number,                 // Items per page (default: 20)
  search: string,                // Search query (optional)
  category: string,              // Filter by category (optional)
  status: string                 // Filter by status (optional)
}
```

## Rank Tiers

### Rank Configuration
```javascript
const RANKS = [
  { tier: 0, title: 'Analog',      threshold: 0,    color: 'var(--text-secondary)', icon: '○' },
  { tier: 1, title: 'Read-Only',   threshold: 100,  color: 'var(--info)',           icon: '◇' },
  { tier: 2, title: 'Dual-Core',   threshold: 400,  color: 'var(--accent)',         icon: '◆' },
  { tier: 3, title: 'Overclocked', threshold: 900,  color: 'var(--warning)',        icon: '⬡' },
  { tier: 4, title: 'Admin',       threshold: 2000, color: 'var(--danger)',         icon: '⬢' }
];
```

## Protocol Categories

### Category Enum
```javascript
const CATEGORIES = [
  'mathematical_protocols',      // Core math-based protocols
  'time_and_systems',            // Time-related protocols
  'universal_currency'           // Currency and scaling protocols
];
```

## Time Index

### Time Unit Mapping
```javascript
const TIME_INDEX = {
  1: 'Seconds',
  2: 'Minutes',
  3: 'Hours',
  4: 'Days',
  5: 'Weeks',
  6: 'Months',
  7: 'Years'
};
```

## Deca-Scale

### Scale Mapping
```javascript
const DECA_SCALE = {
  1: 10,        // Tens
  2: 100,       // Hundreds
  3: 1000,      // Thousands (Kilo)
  4: 10000,     // Ten Thousands
  5: 100000,    // Hundred Thousands
  6: 1000000,   // Millions (Mega)
  7: 10000000,  // Ten Millions
  8: 100000000, // Hundred Millions
  9: 1000000000 // Billions (Giga)
};
```

## Direction Protocol

### Sector to Degrees
```javascript
const sectorToDegrees = (sector) => (sector * 36) % 360;
```

### Vertical Scale
```javascript
const VERTICAL_SCALE = {
  5: 'Zenith (directly above)',
  0: 'Level (same plane)',
  '-5': 'Nadir (directly below)'
};
```

## Status Protocol (Bandwidth)

### Status Calculation
```javascript
{
  current: number,               // Current value
  anchor: number,                // Maximum/target value
  ratio: number,                 // (current / anchor) * 100
  headroom: number,              // anchor - current
  status: string                 // 'IDLE' | 'OPTIMAL' | 'WARNING' | 'MAX CAPACITY' | 'OVERLOAD'
}
```

### Status Thresholds
```javascript
const STATUS_THRESHOLDS = {
  IDLE: { max: 20, color: '#38bdf8' },
  OPTIMAL: { max: 85, color: 'var(--accent)' },
  WARNING: { max: 99, color: '#f59e0b' },
  MAX_CAPACITY: { max: 100, color: '#f59e0b' },
  OVERLOAD: { min: 100, color: 'var(--danger)' }
};
```

## Local Storage Keys

### Storage Schema
```javascript
{
  'englicode_token': string,           // JWT token
  'englicode_admin_token': string,     // Admin token during impersonation
  'englicode_theme': 'dark' | 'light'  // Theme preference
}
```

## Component State Patterns

### Loading State
```javascript
{
  loading: boolean,              // Data fetch in progress
  error: string | null,          // Error message
  data: any | null               // Fetched data
}
```

### Form State
```javascript
{
  form: {
    [field: string]: string      // Form field values
  },
  errors: {
    [field: string]: string      // Validation errors
  },
  submitting: boolean            // Submit in progress
}
```

### Modal State
```javascript
{
  modal: 'add' | 'edit' | null,  // Modal type
  editingItem: any | null,       // Item being edited
  form: object                   // Form data
}
```

## Validation Rules

### Term Validation
```javascript
{
  term: {
    required: true,
    minLength: 1,
    maxLength: 50
  },
  meaning: {
    required: true,
    minLength: 1,
    maxLength: 200
  },
  the_leap: {
    required: true,
    minLength: 10,
    maxLength: 1000
  }
}
```

### User Validation
```javascript
{
  username: {
    required: true,
    minLength: 3,
    maxLength: 30,
    pattern: /^[a-zA-Z0-9_-]+$/
  },
  email: {
    required: true,
    pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  }
}
```

## Field Naming Conventions

- **Database fields**: snake_case (e.g., `created_at`, `rank_tier`)
- **JavaScript objects**: camelCase (e.g., `createdAt`, `rankTier`)
- **API responses**: snake_case (matches database)
- **Component props**: camelCase
- **CSS classes**: kebab-case
- **CSS variables**: kebab-case with `--` prefix

## Type Coercion

### String to Number
```javascript
const points = parseInt(user.points, 10);
const ratio = parseFloat(value);
```

### Date Formatting
```javascript
const date = new Date(timestamp);
const formatted = date.toLocaleDateString();
const iso = date.toISOString();
```

## Null Handling

### Optional Chaining
```javascript
const avatar = user?.avatar_url || '/default-avatar.png';
const count = data?.terms?.length ?? 0;
```

### Nullish Coalescing
```javascript
const points = user.points ?? 0;
const theme = localStorage.getItem('theme') ?? 'dark';
```
