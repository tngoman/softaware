# Backend User Roles - Required Changes

## Problem
The workflow dialog and buttons don't show because the backend doesn't return user roles.

## Required Backend Changes at updates.softaware.co.za

### 1. Database - Add role column to users table

```sql
-- Add role column if it doesn't exist
ALTER TABLE users ADD COLUMN role VARCHAR(50) DEFAULT 'viewer';

-- Update existing users with roles
UPDATE users SET role = 'admin' WHERE username = 'your_admin_username';
UPDATE users SET role = 'client_manager' WHERE username = 'client_user';
UPDATE users SET role = 'qa_specialist' WHERE username = 'qa_user';
UPDATE users SET role = 'developer' WHERE username = 'dev_user';

-- Add constraint
ALTER TABLE users ADD CONSTRAINT role_check 
  CHECK(role IN ('admin', 'client_manager', 'qa_specialist', 'developer', 'deployer', 'viewer'));
```

### 2. API - Return role in login response

**File**: `/api/login` endpoint

**Current Response**:
```json
{
  "success": true,
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "full_name": "John Doe"
  }
}
```

**Required Response**:
```json
{
  "success": true,
  "token": "abc123...",
  "user": {
    "id": 1,
    "username": "john",
    "email": "john@example.com",
    "full_name": "John Doe",
    "role": "developer"
  }
}
```

### 3. API - Return role in users list

**File**: `/api/users` endpoint (GET)

**Required Response**:
```json
{
  "users": [
    {
      "id": 1,
      "username": "john",
      "email": "john@example.com",
      "is_admin": 1,
      "role": "developer",
      "created_at": "2025-01-01 10:00:00"
    }
  ]
}
```

### 4. API - Accept role in user create/update

**File**: `/api/users` endpoint (POST/PUT)

**Request**:
```json
{
  "username": "newuser",
  "email": "newuser@example.com",
  "password": "password123",
  "is_admin": 0,
  "role": "developer"
}
```

## Quick Fix for Testing

If you just want to test the workflow immediately:

```sql
-- Set your current user to a workflow role
UPDATE users SET role = 'client_manager' WHERE id = YOUR_USER_ID;
```

Then update the backend login endpoint to include `role` in the response:

```php
// In your login.php or wherever login is handled
$userData = [
    'id' => $user['id'],
    'username' => $user['username'],
    'email' => $user['email'],
    'full_name' => $user['full_name'],
    'role' => $user['role'] ?? 'viewer'  // ADD THIS LINE
];

echo json_encode([
    'success' => true,
    'token' => $token,
    'user' => $userData
]);
```

After making these changes, logout and login again in the app.

## Role Descriptions

| Role | Description | Workflow Permissions |
|------|-------------|---------------------|
| `admin` | Full system access | Can assign to anyone, bypass workflow |
| `client_manager` | Client intake | Can only send tasks to QA Specialist |
| `qa_specialist` | Quality review | Can assign to Developer (with module) or back to Client Manager |
| `developer` | Development work | Can only submit back to QA Specialist |
| `deployer` | Deployment | Can deploy updates |
| `viewer` | Read-only | Cannot assign tasks |
