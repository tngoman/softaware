# Englicode Platform Documentation

## Overview

**Englicode** is a gamified cognitive gym and crowdsourced dictionary built around a mathematically compressed dialect of English. It replaces culturally bloated systems of time, currency, and status with efficient metric protocols and tech-adjacent logic.

## What is Englicode?

Englicode transforms everyday communication into a real-time logic puzzle, forcing the brain to calculate, translate, and compress data before speaking. It's designed to stretch the mind, filter out passive communication, and build a community of fast-processing thinkers.

### The Three Core Pillars

#### 1. Cognitive Training Engine
An educational tool that breaks users out of ingrained Base-60 (clock time) and cultural biases, forcing them to learn universal metric logic like the Deca-Scale and Time Index. Through rapid-fire translation quizzes, users train their brains to parse syntax and math simultaneously.

#### 2. Open-Source Cipher
A living, breathing cryptographic dictionary governed by a strict community "Pull Request" system. Users who have proven their mathematical logic can submit and vote on new protocol terms. If the math holds and the community agrees, it becomes official Englicode canon.

#### 3. Proof-of-Logic Social Network
The platform gamifies cognitive flexibility. Users earn a verifiable Processing Speed rank (from Analog to Overclocked) by mastering quizzes and contributing high-integrity logic to the dictionary.

## Technology Stack

### Frontend (Client)
- **Framework**: React 19.2.4 with Vite 8.0.1
- **Routing**: React Router DOM 7.13.2
- **State Management**: Zustand 5.0.12
- **Styling**: Tailwind CSS 4.2.2
- **Animations**: Framer Motion 12.38.0
- **HTTP Client**: Axios 1.14.0

### Backend API
- **Base URL**: `/api`
- **Authentication**: JWT Bearer tokens stored in localStorage
- **OAuth Providers**: Google, Facebook

## Core Protocols

Englicode uses 8 mathematical protocols to compress communication:

1. **Time Index** - Universal digit for time units (1=Seconds, 2=Minutes, 3=Hours, 4=Days, 5=Weeks, 6=Months, 7=Years)
2. **Deca-Scale Protocol** - Time shortcuts via base-10 multiplication
3. **Clock Math** - Deca-Time & The Remainder
4. **Data-Deca Protocol** - Universal currency scaling
5. **Proximity Scale** - Replaces "soon," "later," "a while"
6. **Quantity Index** - Replaces "a few," "a lot," "tons"
7. **Percentage State** - Replaces "almost," "halfway," "done"
8. **Direction Protocol** - Metric compass with 10 sectors + 3D vertical

## User Ranks

Users progress through 5 tiers based on points earned:

| Tier | Title | Threshold | Abilities |
|------|-------|-----------|-----------|
| 0 | Analog | 0 | Read-only access |
| 1 | Read-Only | 100 pts | Core protocols learned |
| 2 | Dual-Core | 400 pts | Voting power unlocked |
| 3 | Overclocked | 900 pts | Can submit Pull Requests |
| 4 | Admin | 2,000 pts | Weighted voting, full access |

## Key Features

### Public Features
- **Home** - Interactive protocol demonstrations and translators
- **Protocols** - Complete reference documentation
- **Training Room** - Protocol-specific interactive training
- **Quiz** - Multi-protocol speed training with points
- **Index Browser** - Searchable dictionary of canon terms
- **Leaderboard** - Top users by points
- **Consensus Board** - Public view of Pull Requests
- **User Profiles** - Public user stats and ranks

### Admin Terminal
- **Dashboard** - Platform statistics overview
- **Dictionary Manager** - CRUD operations on canon terms
- **Pull Requests** - Approve/reject community submissions
- **Users Manager** - User administration

## Authentication Flow

1. User clicks OAuth provider (Google/Facebook)
2. Redirected to `/api/auth/{provider}`
3. OAuth callback returns to `/auth/callback`
4. JWT token stored in `localStorage` as `englicode_token`
5. Token attached to all API requests via Axios interceptor
6. 401 responses automatically clear token

## Admin Features

### Impersonation
Admins can impersonate any user:
- Original admin token stored as `englicode_admin_token`
- Impersonation token replaces `englicode_token`
- Stop impersonating restores admin token

### Dictionary Management
- Add/edit/delete canon terms
- Filter by category
- Search functionality
- Pagination (20 per page)

### Pull Request Management
- View by status (pending/approved/rejected)
- Approve (merge to canon)
- Reject with reason
- Track upvotes/downvotes

## Getting Started

### Development
```bash
cd /var/opt/englicode/client
npm install
npm run dev
```

### Build
```bash
npm run build
```

### Lint
```bash
npm run lint
```

## Project Structure

See [FILES.md](./FILES.md) for detailed file structure documentation.

## Design Patterns

See [PATTERNS.md](./PATTERNS.md) for architectural patterns and conventions.

## Data Fields

See [FIELDS.md](./FIELDS.md) for API data structures and field definitions.

## API Routes

See [ROUTES.md](./ROUTES.md) for complete API endpoint documentation.

## Recent Changes

See [CHANGES.md](./CHANGES.md) for version history and updates.

## Contributing

See [how_to_contribute.md](./how_to_contribute.md) for community contribution guidelines.

## License

Proprietary - All rights reserved

## Contact

For questions or support, contact the development team.
