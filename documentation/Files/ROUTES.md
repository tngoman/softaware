# Files Module Routes

## Overview

All routes for remote file management via SSH/SFTP.

**Base Path**: `/api/files`

**Authentication**: All routes require API key or auth token

---

## Connection Testing

### POST `/api/files/test`
**Purpose**: Test SSH connection validity

**Request Body**:
```typescript
{
  host: string; // min 1 char
  port?: number; // 1-65535, default 22
  username: string; // min 1 char
  password?: string; // Either password or privateKey required
  privateKey?: string;
  passphrase?: string; // If privateKey is encrypted
}
```

**Response**:
```typescript
{
  success: boolean;
  message: string; // "Connection successful" or "Connection failed"
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/test \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "host": "example.com",
    "port": 22,
    "username": "user",
    "password": "secret"
  }'
```

---

## File Listing

### GET `/api/files/list`
### POST `/api/files/list`
**Purpose**: List files and directories

**Request Body**:
```typescript
{
  sshConfig: {
    host: string;
    port?: number; // default 22
    username: string;
    password?: string;
    privateKey?: string;
    passphrase?: string;
  };
  path?: string; // default "/"
}
```

**Response**:
```typescript
{
  files: Array<{
    type: 'd' | '-' | 'l'; // directory, file, symlink
    name: string;
    size: number; // bytes
    modifyTime: number; // Unix timestamp (ms)
    accessTime: number; // Unix timestamp (ms)
    rights: {
      user: string; // e.g., "rwx"
      group: string;
      other: string;
    };
  }>;
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/list \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": {
      "host": "example.com",
      "username": "user",
      "password": "secret"
    },
    "path": "/var/www"
  }'
```

---

## File Reading

### GET `/api/files/read`
### POST `/api/files/read`
**Purpose**: Read file contents

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  path: string; // min 1 char
}
```

**Response**:
```typescript
{
  path: string;
  content: string; // File contents as string
}
```

**Notes**:
- Binary files may not be properly decoded
- Large files are read entirely into memory
- Consider file size before reading

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/read \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "path": "/etc/nginx/nginx.conf"
  }'
```

---

## File Writing

### POST `/api/files/write`
**Purpose**: Write content to a file (creates or overwrites)

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  path: string; // min 1 char
  content: string;
}
```

**Response**:
```typescript
{
  success: true;
  path: string;
  message: "File written successfully";
}
```

**Notes**:
- Creates parent directories if they don't exist
- Overwrites existing files without warning
- Content is written as UTF-8

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/write \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "path": "/home/user/test.txt",
    "content": "Hello World"
  }'
```

---

## File Deletion

### DELETE `/api/files/delete`
### POST `/api/files/delete`
**Purpose**: Delete a file or directory

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  path: string; // min 1 char
}
```

**Response**:
```typescript
{
  success: true;
  path: string;
  message: "File deleted successfully";
}
```

**Notes**:
- Deletes directories recursively
- No confirmation or undo
- Fails if permissions insufficient

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/delete \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "path": "/tmp/old-file.txt"
  }'
```

---

## Directory Creation

### POST `/api/files/mkdir`
**Purpose**: Create a directory

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  path: string; // min 1 char
}
```

**Response**:
```typescript
{
  success: true;
  path: string;
  message: "Directory created successfully";
}
```

**Notes**:
- Creates parent directories recursively (like `mkdir -p`)
- No error if directory already exists
- Sets default permissions

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/mkdir \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "path": "/home/user/new/nested/dir"
  }'
```

---

## File Moving/Renaming

### POST `/api/files/move`
**Purpose**: Move or rename a file/directory

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  oldPath: string; // min 1 char
  newPath: string; // min 1 char
}
```

**Response**:
```typescript
{
  success: true;
  oldPath: string;
  newPath: string;
  message: "File moved successfully";
}
```

**Notes**:
- Can move across directories
- Can rename in place
- Overwrites destination if it exists
- Atomic operation on same filesystem

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/move \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "oldPath": "/tmp/file.txt",
    "newPath": "/home/user/file.txt"
  }'
```

---

## File Information

### POST `/api/files/info`
**Purpose**: Get detailed file metadata

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  path: string; // min 1 char
}
```

**Response**:
```typescript
{
  path: string;
  info: {
    type: 'd' | '-' | 'l';
    name: string;
    size: number;
    modifyTime: number;
    accessTime: number;
    rights: {
      user: string;
      group: string;
      other: string;
    };
    owner?: number; // UID
    group?: number; // GID
  };
}
```

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/info \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "path": "/etc/hosts"
  }'
```

---

## Command Execution

### POST `/api/files/execute`
**Purpose**: Execute a shell command on remote server

**Request Body**:
```typescript
{
  sshConfig: SSHConfig;
  command: string; // min 1 char
}
```

**Response**:
```typescript
{
  command: string;
  output: string; // stdout + stderr
}
```

**Notes**:
- Commands run in user's shell environment
- No interactive commands (use non-interactive flags)
- Output is truncated at 1MB
- Long-running commands may timeout
- Security risk: validate commands carefully

**Example**:
```bash
curl -X POST http://localhost:3000/api/files/execute \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "sshConfig": { ... },
    "command": "df -h"
  }'
```

---

## Error Responses

All routes may return these errors:

### 400 Bad Request
```typescript
{
  error: string;
  details?: any; // Zod validation errors
}
```

**Common causes**:
- Invalid SSH config structure
- Missing required fields
- Invalid path format

### 401 Unauthorized
```typescript
{
  error: "Authentication required"
}
```

### 403 Forbidden
```typescript
{
  error: "Permission denied"
}
```

**Causes**:
- Insufficient file permissions on remote server
- SSH user lacks access

### 500 Internal Server Error
```typescript
{
  error: string;
  details?: string;
}
```

**Common causes**:
- SSH connection failed
- Network timeout
- File operation error
- Remote command error

### 502 Bad Gateway
```typescript
{
  error: "SSH connection error: <details>"
}
```

**Causes**:
- Cannot connect to remote host
- Authentication failed
- Network unreachable

---

## SSH Config Object

Used in all routes except `/test`:

```typescript
interface SSHConfig {
  host: string; // Hostname or IP
  port?: number; // Default 22
  username: string; // SSH username
  
  // Authentication (one required)
  password?: string; // Plain password
  privateKey?: string; // PEM-formatted private key
  passphrase?: string; // For encrypted private key
}
```

### Authentication Methods

**Password**:
```typescript
{
  "host": "example.com",
  "username": "user",
  "password": "secret"
}
```

**Private Key (unencrypted)**:
```typescript
{
  "host": "example.com",
  "username": "user",
  "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n..."
}
```

**Private Key (encrypted)**:
```typescript
{
  "host": "example.com",
  "username": "user",
  "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...",
  "passphrase": "keypassword"
}
```

---

## Rate Limiting

- 60 requests per minute per API key
- Command execution: 10 per minute
- Connection tests: 20 per minute

---

## Best Practices

1. **Use SSH keys** instead of passwords for better security
2. **Test connections** first with `/test` endpoint
3. **Check file info** before operations with `/info`
4. **Handle large files** carefully - reading loads entire file into memory
5. **Validate paths** on client side to avoid errors
6. **Use absolute paths** to avoid ambiguity
7. **Limit command execution** - potential security risk
8. **Close connections** - service pools connections but limits exist
9. **Error handling** - always check response status
10. **Audit logging** - all operations are logged

---

## Security Notes

- **Never log or store SSH credentials**
- **Validate all user input** before passing to SSH operations
- **Restrict command execution** to trusted users only
- **Use read-only accounts** when possible
- **Monitor file operations** for suspicious activity
- **Implement IP whitelisting** for sensitive servers
- **Rotate SSH keys** regularly
- **Use strong passwords** or key passphrases
