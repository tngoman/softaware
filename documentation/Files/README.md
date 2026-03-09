# Files Module Documentation

## Overview

The Files module provides SSH/SFTP-based remote file management capabilities. It allows authenticated users to interact with files and directories on remote servers through a secure connection.

## Purpose

- Enable remote file operations via SSH/SFTP
- Provide secure file reading, writing, and manipulation
- Support directory traversal and management
- Execute remote commands on connected servers
- Maintain persistent SSH connections for efficiency

## Key Components

### Routes
- **Files Router** (`routes/files.ts`): All file operation endpoints

### Services
- **SSH Service** (`services/sshService.ts`): Core SSH/SFTP connection management and file operations

### Features
- Connection pooling and reuse
- Support for password and private key authentication
- File and directory CRUD operations
- Remote command execution
- File metadata retrieval

## Integration Points

- **Authentication**: Requires valid API key or auth token
- **Audit Module**: Logs all file operations
- **Security**: Input validation with Zod schemas
- **Error Handling**: Structured error responses

## Related Documentation

- [Routes](ROUTES.md) - Detailed route specifications
- [Patterns](PATTERNS.md) - Common usage patterns
- [Changes](CHANGES.md) - Version history and updates

## Quick Start

```typescript
// Test SSH connection
POST /api/files/test
{
  "host": "example.com",
  "port": 22,
  "username": "user",
  "password": "pass"
}

// List files
POST /api/files/list
{
  "sshConfig": {
    "host": "example.com",
    "port": 22,
    "username": "user",
    "password": "pass"
  },
  "path": "/home/user"
}

// Read file
POST /api/files/read
{
  "sshConfig": { ... },
  "path": "/home/user/file.txt"
}
```

## Security Considerations

- SSH credentials are never stored
- Connections are ephemeral and pooled per request
- All paths are validated before operations
- Support for SSH key authentication recommended over passwords
- Command execution is restricted to authenticated users

## Configuration

No special environment variables required. SSH connections are configured per-request using the `sshConfig` object.

## Connection Management

The service maintains a connection pool for efficiency:
- Connections are reused when possible
- Dead connections are automatically removed
- Connection key format: `username@host:port`
- Connections timeout after inactivity
