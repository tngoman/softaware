# Files Module Database Fields

## Overview

The Files module is **stateless** and does not use database tables. All SSH/SFTP connection details are provided per-request in the API payload.

**Version:** 1.3.0  
**Last Updated:** March 2026

---

## No Database Tables Required

Unlike most modules, the Files module does not persist any data to the database:

- **No connection storage**: SSH credentials are never stored
- **No session management**: Connections are ephemeral and pooled in-memory
- **No file metadata**: File information is retrieved directly from remote servers
- **No audit logs**: (Handled by general audit system, not Files-specific tables)

---

## Why No Database?

### Security
- Storing SSH credentials in database is a security risk
- Credentials should be provided just-in-time per request
- Reduces attack surface (no credential theft from DB)

### Flexibility
- Users can connect to any server without pre-configuration
- No need to manage connection profiles
- Supports dynamic, one-off operations

### Simplicity
- Stateless design is easier to scale
- No schema migrations needed
- No cleanup of stale connection records

---

## In-Memory Data Structures

### Connection Pool (Runtime Only)

The service maintains an in-memory connection pool:

```typescript
class SSHService {
  private connections: Map<string, Client> = new Map();
  
  // Key format: "username@host:port"
  // Value: Active ssh2-sftp-client instance
}
```

**Lifecycle:**
- Created: On first use
- Reused: While connection is alive
- Removed: When connection dies or times out
- Not persisted: Cleared on service restart

---

## Request Payload Schema

All connection details are provided in each request:

### SSHConfig Object
```typescript
interface SSHConfig {
  host: string;           // Hostname or IP
  port: number;           // Default: 22
  username: string;       // SSH username
  
  // Authentication (one required)
  password?: string;      // Plain password
  privateKey?: string;    // PEM-formatted private key
  passphrase?: string;    // For encrypted private key
}
```

### Example Request Payload
```json
{
  "sshConfig": {
    "host": "example.com",
    "port": 22,
    "username": "deploy",
    "privateKey": "-----BEGIN RSA PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
    "passphrase": "optional-key-password"
  },
  "path": "/var/www/html"
}
```

---

## Data Validation

### Zod Schemas

```typescript
const sshConfigSchema = z.object({
  host: z.string().min(1),
  port: z.number().int().min(1).max(65535).default(22),
  username: z.string().min(1),
  password: z.string().optional(),
  privateKey: z.string().optional(),
  passphrase: z.string().optional(),
});
```

**Constraints:**
- `host`: Required, min 1 character (hostname or IP)
- `port`: Integer between 1-65535 (default 22)
- `username`: Required, min 1 character
- `password` OR `privateKey`: At least one required
- `passphrase`: Optional, only used with encrypted private keys

---

## Response Data Types

### FileInfo Type

Returned by directory listing and file info endpoints:

```typescript
interface FileInfo {
  type: 'd' | '-' | 'l';    // directory, file, symlink
  name: string;              // File/directory name
  size: number;              // Size in bytes
  modifyTime: number;        // Unix timestamp (ms)
  accessTime: number;        // Unix timestamp (ms)
  rights: {
    user: string;            // e.g., "rwx", "rw-", "r--"
    group: string;           // Group permissions
    other: string;           // Other permissions
  };
}
```

**Example Response:**
```json
{
  "files": [
    {
      "type": "d",
      "name": "documents",
      "size": 4096,
      "modifyTime": 1709568000000,
      "accessTime": 1709568000000,
      "rights": {
        "user": "rwx",
        "group": "r-x",
        "other": "r-x"
      }
    },
    {
      "type": "-",
      "name": "config.json",
      "size": 2048,
      "modifyTime": 1709567000000,
      "accessTime": 1709567500000,
      "rights": {
        "user": "rw-",
        "group": "r--",
        "other": "r--"
      }
    }
  ]
}
```

---

## Integration with Other Modules

### Authentication
Files module uses standard authentication mechanisms:

**Users Table** (from Users module):
```sql
SELECT id, email FROM users WHERE id = ?;
```

**API Keys Table** (from ApiKeys module):
```sql
SELECT id, user_id FROM api_keys WHERE key = ? AND active = 1;
```

But SSH credentials themselves are NOT stored in any table.

---

### Audit Logging
File operations are logged in the general audit system:

**Audit Logs Table** (from Crosscutting/Infrastructure):
```sql
CREATE TABLE audit_logs (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36),
  action VARCHAR(100),     -- e.g., "files.read", "files.write"
  resource VARCHAR(255),   -- e.g., "/etc/config.json"
  details JSON,            -- { "host": "example.com", "operation": "read" }
  ip_address VARCHAR(45),
  created_at TIMESTAMP
);
```

**Example Audit Entry:**
```json
{
  "user_id": "u123",
  "action": "files.write",
  "resource": "/var/www/index.html",
  "details": {
    "host": "example.com",
    "port": 22,
    "username": "deploy",
    "file_size": 1024
  },
  "ip_address": "192.168.1.100",
  "created_at": "2026-03-04T10:30:00Z"
}
```

---

## Security Considerations

### Credential Handling

**DO:**
- ✅ Pass credentials in request body only
- ✅ Use HTTPS/TLS for all API requests
- ✅ Prefer SSH keys over passwords
- ✅ Use encrypted private keys with passphrases
- ✅ Validate all inputs with Zod schemas

**DON'T:**
- ❌ Store credentials in database
- ❌ Log credentials (redacted in logs)
- ❌ Pass credentials in URL query params
- ❌ Cache credentials beyond request scope
- ❌ Share credentials between users

### Input Sanitization

```typescript
// Path validation
function validatePath(path: string): void {
  // Prevent directory traversal
  if (path.includes('..')) {
    throw new Error('Invalid path: directory traversal not allowed');
  }
  
  // Ensure absolute path
  if (!path.startsWith('/')) {
    throw new Error('Path must be absolute');
  }
}

// Command sanitization
function sanitizeCommand(command: string): string {
  // Remove dangerous characters
  return command.replace(/[;&|`$()]/g, '');
}
```

---

## Performance Considerations

### Connection Pooling Benefits

| Scenario | Without Pool | With Pool | Improvement |
|----------|-------------|-----------|-------------|
| First request | 800ms | 800ms | - |
| Subsequent requests (same host) | 800ms | 50ms | **94% faster** |
| 10 sequential operations | 8000ms | 1300ms | **84% faster** |

### Memory Usage

| Component | Memory | Notes |
|-----------|--------|-------|
| Per connection | ~2-5MB | Includes buffers |
| Connection pool | ~50MB max | With 10 connections |
| File operations | Variable | Depends on file size |

### Limits

- Max connections per host: 10 (configurable)
- Connection TTL: 5 minutes
- Command timeout: 60 seconds
- Max output size: 1MB

---

## Data Flow Diagram

```
┌──────────┐
│  Client  │
└────┬─────┘
     │ POST /api/files/read { sshConfig, path }
     ▼
┌──────────────┐
│  files.ts    │ (Route Handler)
│  - Validate  │
│  - Auth      │
└────┬─────────┘
     │
     ▼
┌───────────────┐
│ sshService.ts │
│  - Pool check │
│  - Connect    │
│  - Execute    │
└────┬──────────┘
     │
     ▼
┌──────────────┐
│ Remote       │
│ SSH Server   │
└──────────────┘
```

**Data never touches database** - flows directly from client → backend → remote server → client.

---

## Configuration Parameters

### Optional Environment Variables

```bash
# Connection settings
SSH_CONNECTION_TIMEOUT=30000     # Connection timeout (ms)
SSH_MAX_CONNECTIONS=10           # Max connections per host
SSH_CONNECTION_TTL=300000        # Connection TTL (ms)
SSH_IDLE_TIMEOUT=60000           # Idle timeout (ms)

# Operation limits
SSH_COMMAND_TIMEOUT=60000        # Command execution timeout (ms)
SSH_MAX_OUTPUT_SIZE=1048576      # Max command output (1MB)
SSH_MAX_FILE_SIZE=104857600      # Max file size for read (100MB)

# Performance
SSH_KEEP_ALIVE_INTERVAL=10000    # Keep-alive interval (ms)
SSH_READY_TIMEOUT=20000          # Ready timeout (ms)
```

**Defaults:** Sensible defaults are provided if not configured.

---

## Comparison with Database-Backed Alternatives

### Files Module (Current - Stateless)

**Pros:**
- ✅ No database overhead
- ✅ Supports any server without setup
- ✅ No credentials stored
- ✅ Easy to scale horizontally

**Cons:**
- ❌ No connection history
- ❌ No saved connection profiles
- ❌ Credentials required each time

### Hypothetical Database-Backed Alternative

**Schema:**
```sql
CREATE TABLE ssh_connections (
  id VARCHAR(36) PRIMARY KEY,
  user_id VARCHAR(36) NOT NULL,
  name VARCHAR(255),              -- "Production Server"
  host VARCHAR(255) NOT NULL,
  port INT DEFAULT 22,
  username VARCHAR(100),
  encrypted_password TEXT,        -- AES encrypted
  encrypted_private_key TEXT,     -- AES encrypted
  created_at TIMESTAMP
);
```

**Pros:**
- ✅ Save connection profiles
- ✅ No need to re-enter credentials
- ✅ Connection history

**Cons:**
- ❌ Security risk (credentials in DB)
- ❌ More complex encryption/decryption
- ❌ Schema migrations needed
- ❌ Cleanup required for stale connections

**Decision:** Current stateless approach preferred for security and simplicity.

---

## Future Considerations

### If Database Were Added

Potential use cases for database integration:

1. **Connection Profiles**
   - Save frequently-used servers
   - Store connection nicknames
   - Quick reconnection

2. **Usage Analytics**
   - Track file operation metrics
   - Monitor server access patterns
   - Generate usage reports

3. **Access Control**
   - Team-level connection sharing
   - Permission-based access
   - Approval workflows

**Status:** Not currently planned. Would require careful security design.

---

## Summary

The Files module is intentionally designed as a **stateless, database-free** module for maximum security and flexibility. All connection details are ephemeral and never persisted.

This approach:
- ✅ Eliminates credential storage security risks
- ✅ Simplifies scaling and deployment
- ✅ Provides maximum flexibility
- ✅ Reduces maintenance overhead

For integration with other modules, the Files module relies on:
- **Users module** for authentication
- **Audit module** for operation logging
- **API Keys module** for API authentication

But **no Files-specific database tables exist or are needed**.
