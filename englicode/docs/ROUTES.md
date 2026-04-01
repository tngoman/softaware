# Englicode API Routes

## Base URL
All API endpoints are prefixed with `/api`

## Authentication

### OAuth Login
**Endpoint**: `GET /api/auth/{provider}`  
**Providers**: `google`, `facebook`  
**Description**: Initiates OAuth flow with provider  
**Response**: Redirects to provider's OAuth page

**Example**:
```
GET /api/auth/google
```

### OAuth Callback
**Endpoint**: `GET /api/auth/callback`  
**Description**: Handles OAuth redirect, creates/updates user, returns token  
**Query Parameters**:
- `code` - OAuth authorization code
- `state` - CSRF token

**Response**:
```javascript
{
  success: true,
  data: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    user: {
      id: 1,
      username: "user123",
      email: "user@example.com",
      rank_tier: 0,
      rank_title: "Analog",
      points: 0
    }
  }
}
```

### Admin Login
**Endpoint**: `POST /api/auth/admin/login`  
**Description**: Email/password login for admin users  
**Body**:
```javascript
{
  email: "admin@englicode.com",
  password: "securepassword"
}
```

**Response**:
```javascript
{
  success: true,
  data: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    user: { /* User object */ }
  }
}
```

### Get Current User
**Endpoint**: `GET /api/auth/me`  
**Auth**: Required (JWT Bearer token)  
**Description**: Returns current authenticated user

**Response**:
```javascript
{
  success: true,
  data: {
    id: 1,
    username: "user123",
    email: "user@example.com",
    rank_tier: 2,
    rank_title: "Dual-Core",
    points: 450
  }
}
```

### Impersonate User
**Endpoint**: `POST /api/auth/impersonate/{userId}`  
**Auth**: Required (Admin only)  
**Description**: Generate token to impersonate another user

**Response**:
```javascript
{
  success: true,
  data: {
    token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    user: { /* Impersonated user object */ }
  }
}
```

## Dictionary / Index

### Get Terms (Paginated)
**Endpoint**: `GET /api/index`  
**Auth**: Optional  
**Description**: Retrieve dictionary terms with filtering and pagination

**Query Parameters**:
- `page` (number, default: 1) - Page number
- `limit` (number, default: 20) - Items per page
- `category` (string, optional) - Filter by category
- `search` (string, optional) - Search term/meaning

**Response**:
```javascript
{
  success: true,
  data: {
    terms: [
      {
        id: 1,
        category: "time_and_systems",
        term: "1.5 2",
        meaning: "15 Minutes",
        the_leap: "1.5 × 10 = 15. Index 2 = Minutes.",
        created_at: "2024-01-01T00:00:00Z",
        updated_at: "2024-01-01T00:00:00Z"
      }
    ],
    total: 150,
    page: 1,
    limit: 20
  }
}
```

### Get Categories
**Endpoint**: `GET /api/index/categories`  
**Auth**: Optional  
**Description**: Get term count by category

**Response**:
```javascript
{
  success: true,
  data: [
    { category: "mathematical_protocols", count: 45 },
    { category: "time_and_systems", count: 62 },
    { category: "universal_currency", count: 43 }
  ]
}
```

### Create Term
**Endpoint**: `POST /api/index`  
**Auth**: Required (Admin only)  
**Description**: Add new term to canon

**Body**:
```javascript
{
  category: "time_and_systems",
  term: "2 4",
  meaning: "20 Days",
  the_leap: "2 × 10 = 20. Index 4 = Days."
}
```

**Response**:
```javascript
{
  success: true,
  data: {
    id: 151,
    category: "time_and_systems",
    term: "2 4",
    meaning: "20 Days",
    the_leap: "2 × 10 = 20. Index 4 = Days.",
    created_at: "2024-01-15T10:30:00Z",
    updated_at: "2024-01-15T10:30:00Z"
  }
}
```

### Update Term
**Endpoint**: `PUT /api/index/{id}`  
**Auth**: Required (Admin only)  
**Description**: Update existing term

**Body**:
```javascript
{
  category: "time_and_systems",
  term: "2 4",
  meaning: "20 Days",
  the_leap: "Updated explanation..."
}
```

**Response**:
```javascript
{
  success: true,
  message: "Term updated successfully"
}
```

### Delete Term
**Endpoint**: `DELETE /api/index/{id}`  
**Auth**: Required (Admin only)  
**Description**: Remove term from canon

**Response**:
```javascript
{
  success: true,
  message: "Term deleted successfully"
}
```

## Pull Requests

### Get Pull Requests (Paginated)
**Endpoint**: `GET /api/pull-requests`  
**Auth**: Optional (public can view)  
**Description**: Retrieve PRs with filtering

**Query Parameters**:
- `status` (string, default: 'pending') - 'pending' | 'approved' | 'rejected'
- `page` (number, default: 1)
- `limit` (number, default: 20)

**Response**:
```javascript
{
  success: true,
  data: {
    pullRequests: [
      {
        id: 1,
        author_id: 5,
        author_username: "user123",
        category: "mathematical_protocols",
        proposed_term: "0.9 1",
        proposed_meaning: "High Confidence",
        proposed_leap: "90% probability. Approaching absolute truth.",
        status: "pending",
        upvotes: 12,
        downvotes: 2,
        created_at: "2024-01-10T14:20:00Z",
        updated_at: "2024-01-10T14:20:00Z",
        reviewed_at: null,
        reviewed_by: null
      }
    ],
    total: 8,
    page: 1,
    limit: 20
  }
}
```

### Create Pull Request
**Endpoint**: `POST /api/pull-requests`  
**Auth**: Required (Rank >= Overclocked)  
**Description**: Submit new protocol term for review

**Body**:
```javascript
{
  category: "mathematical_protocols",
  proposed_term: "0.5 1",
  proposed_meaning: "The Coin Toss",
  proposed_leap: "Perfect mathematical uncertainty. Equal chance of True or False."
}
```

**Response**:
```javascript
{
  success: true,
  data: {
    id: 9,
    author_id: 5,
    status: "pending",
    upvotes: 0,
    downvotes: 0,
    created_at: "2024-01-15T11:00:00Z"
  }
}
```

### Vote on Pull Request
**Endpoint**: `POST /api/pull-requests/{id}/vote`  
**Auth**: Required (Rank >= Dual-Core)  
**Description**: Upvote or downvote a PR

**Body**:
```javascript
{
  vote: "up" // or "down"
}
```

**Response**:
```javascript
{
  success: true,
  data: {
    upvotes: 13,
    downvotes: 2
  }
}
```

### Approve Pull Request
**Endpoint**: `POST /api/pull-requests/{id}/approve`  
**Auth**: Required (Admin only)  
**Description**: Merge PR to canon dictionary

**Response**:
```javascript
{
  success: true,
  message: "Pull request approved and merged to canon"
}
```

### Reject Pull Request
**Endpoint**: `POST /api/pull-requests/{id}/reject`  
**Auth**: Required (Admin only)  
**Description**: Reject PR with reason

**Body**:
```javascript
{
  reason: "Logic is flawed. Does not follow Deca-Scale rules."
}
```

**Response**:
```javascript
{
  success: true,
  message: "Pull request rejected"
}
```

## Quiz

### Get Random Question
**Endpoint**: `GET /api/quiz/question`  
**Auth**: Optional  
**Description**: Generate random protocol question

**Response**:
```javascript
{
  success: true,
  data: {
    prompt: "Translate to Englicode: 15 Minutes",
    expectedFormat: "[Value] [Index]",
    validAnswers: ["1.5 2", "15 2"],
    label: "Deca-Scale Protocol"
  }
}
```

### Submit Answer
**Endpoint**: `POST /api/quiz/answer`  
**Auth**: Optional (points only saved if authenticated)  
**Description**: Check answer and award points

**Body**:
```javascript
{
  answer: "1.5 2",
  validAnswers: ["1.5 2", "15 2"],
  timeTakenSeconds: 3.2
}
```

**Response**:
```javascript
{
  success: true,
  data: {
    isCorrect: true,
    pointsEarned: 12, // Base 10 + speed bonus
    totalPoints: 462,
    correctAnswer: "1.5 2",
    newRank: null // or { tier: 2, title: "Dual-Core" } if rank changed
  }
}
```

## Leaderboard

### Get Top Users
**Endpoint**: `GET /api/leaderboard`  
**Auth**: Optional  
**Description**: Retrieve ranked users by points

**Query Parameters**:
- `limit` (number, default: 10) - Number of users to return

**Response**:
```javascript
{
  success: true,
  data: [
    {
      position: 1,
      user_id: 7,
      username: "speedmaster",
      avatar_url: "https://...",
      points: 2450,
      rank_tier: 4,
      rank_title: "Admin"
    },
    {
      position: 2,
      user_id: 12,
      username: "logicpro",
      avatar_url: null,
      points: 1820,
      rank_tier: 3,
      rank_title: "Overclocked"
    }
  ]
}
```

## User Profile

### Get User Profile
**Endpoint**: `GET /api/users/{username}`  
**Auth**: Optional  
**Description**: Retrieve public user profile and stats

**Response**:
```javascript
{
  success: true,
  data: {
    user: {
      id: 5,
      username: "user123",
      avatar_url: "https://...",
      rank_tier: 2,
      rank_title: "Dual-Core",
      points: 450,
      created_at: "2024-01-01T00:00:00Z"
    },
    stats: {
      totalQuizzes: 87,
      correctAnswers: 72,
      accuracy: 82.76,
      averageSpeed: 4.3,
      contributedTerms: 3,
      pendingPRs: 1
    }
  }
}
```

### Update User Profile
**Endpoint**: `PUT /api/users/me`  
**Auth**: Required  
**Description**: Update own profile

**Body**:
```javascript
{
  username: "newusername",
  avatar_url: "https://..."
}
```

**Response**:
```javascript
{
  success: true,
  message: "Profile updated successfully"
}
```

## Settings

### Get User Settings
**Endpoint**: `GET /api/settings`  
**Auth**: Required  
**Description**: Retrieve user preferences

**Response**:
```javascript
{
  success: true,
  data: {
    theme: "dark",
    notifications: true,
    publicProfile: true
  }
}
```

### Update Settings
**Endpoint**: `PUT /api/settings`  
**Auth**: Required  
**Description**: Update user preferences

**Body**:
```javascript
{
  theme: "light",
  notifications: false,
  publicProfile: true
}
```

**Response**:
```javascript
{
  success: true,
  message: "Settings updated successfully"
}
```

## Admin - Users

### Get All Users (Paginated)
**Endpoint**: `GET /api/admin/users`  
**Auth**: Required (Admin only)  
**Description**: Retrieve all users with admin details

**Query Parameters**:
- `page` (number, default: 1)
- `limit` (number, default: 20)
- `search` (string, optional) - Search username/email

**Response**:
```javascript
{
  success: true,
  data: {
    users: [
      {
        id: 1,
        username: "user123",
        email: "user@example.com",
        rank_tier: 2,
        rank_title: "Dual-Core",
        points: 450,
        oauth_provider: "google",
        created_at: "2024-01-01T00:00:00Z",
        last_login: "2024-01-15T10:30:00Z"
      }
    ],
    total: 234,
    page: 1,
    limit: 20
  }
}
```

### Update User
**Endpoint**: `PUT /api/admin/users/{id}`  
**Auth**: Required (Admin only)  
**Description**: Update user details (rank, points, etc.)

**Body**:
```javascript
{
  rank_tier: 3,
  points: 1000
}
```

**Response**:
```javascript
{
  success: true,
  message: "User updated successfully"
}
```

### Delete User
**Endpoint**: `DELETE /api/admin/users/{id}`  
**Auth**: Required (Admin only)  
**Description**: Permanently delete user

**Response**:
```javascript
{
  success: true,
  message: "User deleted successfully"
}
```

## Admin - Dashboard

### Get Dashboard Stats
**Endpoint**: `GET /api/admin/dashboard`  
**Auth**: Required (Admin only)  
**Description**: Platform-wide statistics

**Response**:
```javascript
{
  success: true,
  data: {
    totalTerms: 150,
    totalUsers: 234,
    pendingPRs: 8,
    categories: [
      { category: "mathematical_protocols", count: 45 },
      { category: "time_and_systems", count: 62 },
      { category: "universal_currency", count: 43 }
    ],
    topUsers: [
      {
        position: 1,
        username: "speedmaster",
        points: 2450,
        rank_title: "Admin"
      }
    ]
  }
}
```

## Error Responses

All endpoints may return error responses in this format:

### 400 Bad Request
```javascript
{
  success: false,
  error: "VALIDATION_ERROR",
  message: "Invalid input data"
}
```

### 401 Unauthorized
```javascript
{
  success: false,
  error: "UNAUTHORIZED",
  message: "Authentication required"
}
```

### 403 Forbidden
```javascript
{
  success: false,
  error: "FORBIDDEN",
  message: "Insufficient rank to perform this action"
}
```

### 404 Not Found
```javascript
{
  success: false,
  error: "NOT_FOUND",
  message: "Resource not found"
}
```

### 422 Unprocessable Entity
```javascript
{
  success: false,
  error: "VALIDATION_ERROR",
  message: "Term already exists in dictionary"
}
```

### 500 Internal Server Error
```javascript
{
  success: false,
  error: "INTERNAL_ERROR",
  message: "An unexpected error occurred"
}
```

## Rate Limiting

- **Quiz endpoints**: 60 requests per minute per IP
- **Vote endpoints**: 10 requests per minute per user
- **Admin endpoints**: 120 requests per minute per admin

## Authentication Headers

All authenticated requests must include:
```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

## CORS

API accepts requests from:
- Same origin (production)
- `http://localhost:5173` (development)

## Versioning

Current API version: `v1` (implicit, no version prefix required)

Future versions will use: `/api/v2/...`

## Webhooks (Future)

Planned webhook events:
- `pr.approved` - Pull request merged to canon
- `user.rank_up` - User achieved new rank
- `term.created` - New term added to dictionary

## WebSocket (Future)

Planned real-time features:
- Live leaderboard updates
- Real-time PR voting
- Quiz multiplayer mode
