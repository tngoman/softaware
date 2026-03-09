# Files Module Patterns

## Common Use Cases

### 1. Basic Connection and File Read

```typescript
// Define SSH config
const sshConfig = {
  host: 'example.com',
  port: 22,
  username: 'deploy',
  privateKey: process.env.SSH_PRIVATE_KEY
};

// Test connection first
async function testAndRead(path: string) {
  // Test connection
  const testResponse = await fetch('/api/files/test', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(sshConfig)
  });
  
  const { success } = await testResponse.json();
  if (!success) {
    throw new Error('SSH connection failed');
  }
  
  // Read file
  const readResponse = await fetch('/api/files/read', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path
    })
  });
  
  const { content } = await readResponse.json();
  return content;
}
```

### 2. Directory Browsing

```typescript
// List directory contents recursively
async function browseDirectory(basePath: string, depth = 0) {
  const response = await fetch('/api/files/list', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: basePath
    })
  });
  
  const { files } = await response.json();
  
  // Group by type
  const directories = files.filter(f => f.type === 'd');
  const regularFiles = files.filter(f => f.type === '-');
  const symlinks = files.filter(f => f.type === 'l');
  
  console.log(`\n${'  '.repeat(depth)}${basePath}/`);
  console.log(`${'  '.repeat(depth)}  Directories: ${directories.length}`);
  console.log(`${'  '.repeat(depth)}  Files: ${regularFiles.length}`);
  console.log(`${'  '.repeat(depth)}  Symlinks: ${symlinks.length}`);
  
  // Recurse into directories (limit depth)
  if (depth < 2) {
    for (const dir of directories) {
      if (dir.name !== '.' && dir.name !== '..') {
        await browseDirectory(
          `${basePath}/${dir.name}`,
          depth + 1
        );
      }
    }
  }
  
  return { files, directories, regularFiles, symlinks };
}
```

### 3. File Upload/Write Pattern

```typescript
// Upload local file to remote server
async function uploadFile(localPath: string, remotePath: string) {
  const fs = require('fs');
  
  // Read local file
  const content = fs.readFileSync(localPath, 'utf8');
  
  // Write to remote
  const response = await fetch('/api/files/write', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: remotePath,
      content
    })
  });
  
  const result = await response.json();
  
  if (result.success) {
    console.log(`Uploaded ${localPath} → ${remotePath}`);
  }
  
  return result;
}

// Upload multiple files
async function uploadMultiple(fileMap: Record<string, string>) {
  const results = [];
  
  for (const [localPath, remotePath] of Object.entries(fileMap)) {
    try {
      const result = await uploadFile(localPath, remotePath);
      results.push({ local: localPath, remote: remotePath, success: true });
    } catch (error) {
      results.push({ 
        local: localPath, 
        remote: remotePath, 
        success: false, 
        error: error.message 
      });
    }
  }
  
  return results;
}
```

### 4. Configuration File Management

```typescript
// Read, modify, and write config file
async function updateConfig(configPath: string, updates: Record<string, any>) {
  // Read current config
  const readResponse = await fetch('/api/files/read', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ sshConfig, path: configPath })
  });
  
  const { content } = await readResponse.json();
  
  // Parse config (assuming JSON)
  let config = JSON.parse(content);
  
  // Apply updates
  config = { ...config, ...updates };
  
  // Write back
  const writeResponse = await fetch('/api/files/write', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: configPath,
      content: JSON.stringify(config, null, 2)
    })
  });
  
  return await writeResponse.json();
}

// Usage
await updateConfig('/etc/app/config.json', {
  debug: false,
  port: 3000,
  logLevel: 'info'
});
```

### 5. Backup and Restore

```typescript
// Create backup of file before modifying
async function safeUpdate(filePath: string, newContent: string) {
  const backupPath = `${filePath}.backup.${Date.now()}`;
  
  try {
    // Read original
    const readResponse = await fetch('/api/files/read', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sshConfig, path: filePath })
    });
    
    const { content: originalContent } = await readResponse.json();
    
    // Create backup
    await fetch('/api/files/write', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sshConfig,
        path: backupPath,
        content: originalContent
      })
    });
    
    console.log(`Backup created: ${backupPath}`);
    
    // Write new content
    await fetch('/api/files/write', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sshConfig,
        path: filePath,
        content: newContent
      })
    });
    
    return { success: true, backup: backupPath };
    
  } catch (error) {
    console.error('Update failed, backup available at:', backupPath);
    throw error;
  }
}
```

### 6. Remote Command Execution

```typescript
// Execute series of commands
async function deployApplication() {
  const commands = [
    'cd /var/www/app',
    'git pull origin main',
    'npm install --production',
    'pm2 restart app'
  ];
  
  for (const command of commands) {
    console.log(`Executing: ${command}`);
    
    const response = await fetch('/api/files/execute', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        sshConfig,
        command
      })
    });
    
    const { output } = await response.json();
    console.log(output);
  }
}

// Get system information
async function getSystemInfo() {
  const commands = {
    diskSpace: 'df -h',
    memory: 'free -h',
    uptime: 'uptime',
    processes: 'ps aux | head -10',
    network: 'netstat -tuln | grep LISTEN'
  };
  
  const info: Record<string, string> = {};
  
  for (const [key, command] of Object.entries(commands)) {
    const response = await fetch('/api/files/execute', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ sshConfig, command })
    });
    
    const { output } = await response.json();
    info[key] = output;
  }
  
  return info;
}
```

### 7. File Search and Filter

```typescript
// Find files matching pattern
async function findFiles(basePath: string, pattern: RegExp) {
  const response = await fetch('/api/files/list', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: basePath
    })
  });
  
  const { files } = await response.json();
  
  return files.filter(file => pattern.test(file.name));
}

// Find all log files
const logFiles = await findFiles('/var/log', /\.log$/);

// Find large files (> 10MB)
const largeFiles = files.filter(f => f.size > 10 * 1024 * 1024);

// Find recently modified (last 24 hours)
const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
const recentFiles = files.filter(f => f.modifyTime > oneDayAgo);
```

### 8. Directory Synchronization

```typescript
// Sync directory structure
async function syncDirectory(localDir: string, remoteDir: string) {
  const fs = require('fs');
  const path = require('path');
  
  // Ensure remote directory exists
  await fetch('/api/files/mkdir', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: remoteDir
    })
  });
  
  // Get local files
  const localFiles = fs.readdirSync(localDir);
  
  // Upload each file
  for (const file of localFiles) {
    const localPath = path.join(localDir, file);
    const remotePath = `${remoteDir}/${file}`;
    
    const stat = fs.statSync(localPath);
    
    if (stat.isFile()) {
      const content = fs.readFileSync(localPath, 'utf8');
      
      await fetch('/api/files/write', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sshConfig,
          path: remotePath,
          content
        })
      });
      
      console.log(`Synced: ${file}`);
    } else if (stat.isDirectory()) {
      // Recurse
      await syncDirectory(localPath, remotePath);
    }
  }
}
```

### 9. Error Handling and Retry

```typescript
// Robust file operation with retries
async function robustFileOperation<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  delay = 1000
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.error(`Attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) {
        throw error;
      }
      
      // Exponential backoff
      await new Promise(resolve => 
        setTimeout(resolve, delay * Math.pow(2, attempt - 1))
      );
    }
  }
  
  throw new Error('All retries exhausted');
}

// Usage
const content = await robustFileOperation(
  () => fetch('/api/files/read', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: '/etc/config.json'
    })
  }).then(r => r.json())
);
```

### 10. File Permission Management

```typescript
// Check and display file permissions
async function checkPermissions(filePath: string) {
  const response = await fetch('/api/files/info', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      path: filePath
    })
  });
  
  const { info } = await response.json();
  
  const permissions = {
    user: info.rights.user,
    group: info.rights.group,
    other: info.rights.other,
    readable: info.rights.user.includes('r'),
    writable: info.rights.user.includes('w'),
    executable: info.rights.user.includes('x')
  };
  
  console.log(`Permissions for ${filePath}:`, permissions);
  return permissions;
}

// Change permissions using execute
async function chmod(filePath: string, mode: string) {
  const response = await fetch('/api/files/execute', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sshConfig,
      command: `chmod ${mode} ${filePath}`
    })
  });
  
  return await response.json();
}
```

---

## Best Practices

### Connection Management
- Test connections before operations
- Reuse sshConfig across multiple requests
- Handle connection failures gracefully
- Implement connection pooling on client side

### Security
- Use private keys instead of passwords
- Never log credentials
- Validate paths to prevent traversal attacks
- Limit command execution to trusted operations
- Use read-only accounts when write access isn't needed

### Error Handling
- Always check response status
- Implement retry logic for transient failures
- Create backups before modifying files
- Log all file operations for audit trail

### Performance
- Batch operations when possible
- Use directory listing instead of multiple info calls
- Consider file size before reading
- Stream large files if possible (future enhancement)

### File Operations
- Use absolute paths to avoid ambiguity
- Create parent directories before writing
- Check file existence before operations
- Validate file contents after critical writes
- Use atomic operations when available
