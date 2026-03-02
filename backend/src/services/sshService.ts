import Client from 'ssh2-sftp-client';

export interface SSHConfig {
  host: string;
  port: number;
  username: string;
  password?: string;
  privateKey?: string;
  passphrase?: string;
}

export interface FileInfo {
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
}

export class SSHService {
  private connections: Map<string, Client> = new Map();

  /**
   * Create a unique connection key from SSH config
   */
  private getConnectionKey(config: SSHConfig): string {
    return `${config.username}@${config.host}:${config.port}`;
  }

  /**
   * Get or create an SSH connection
   */
  private async getConnection(config: SSHConfig): Promise<Client> {
    const key = this.getConnectionKey(config);

    // Reuse existing connection if available
    if (this.connections.has(key)) {
      const client = this.connections.get(key)!;
      try {
        // Test if connection is still alive
        await client.list('/');
        return client;
      } catch (error) {
        // Connection is dead, remove it
        this.connections.delete(key);
      }
    }

    // Create new connection
    const client = new Client();
    const connectConfig: any = {
      host: config.host,
      port: config.port,
      username: config.username,
    };

    // Use password or private key for authentication
    if (config.password) {
      connectConfig.password = config.password;
    } else if (config.privateKey) {
      connectConfig.privateKey = config.privateKey;
      if (config.passphrase) {
        connectConfig.passphrase = config.passphrase;
      }
    } else {
      throw new Error('Either password or private key is required for SSH authentication');
    }

    await client.connect(connectConfig);
    this.connections.set(key, client);

    return client;
  }

  /**
   * List files in a directory
   */
  async listDirectory(config: SSHConfig, path: string = '/'): Promise<FileInfo[]> {
    const client = await this.getConnection(config);
    const files = await client.list(path);

    return files.map(file => ({
      type: file.type as any,
      name: file.name,
      size: file.size,
      modifyTime: file.modifyTime,
      accessTime: file.accessTime,
      rights: {
        user: file.rights.user,
        group: file.rights.group,
        other: file.rights.other,
      },
    }));
  }

  /**
   * Read a file's content
   */
  async readFile(config: SSHConfig, path: string): Promise<string> {
    const client = await this.getConnection(config);
    const buffer = await client.get(path);
    return buffer.toString('utf-8');
  }

  /**
   * Write content to a file
   */
  async writeFile(config: SSHConfig, path: string, content: string): Promise<void> {
    const client = await this.getConnection(config);

    // Ensure directory exists
    const dir = path.substring(0, path.lastIndexOf('/'));
    try {
      await client.mkdir(dir, true);
    } catch (error) {
      // Directory might already exist, ignore error
    }

    await client.put(Buffer.from(content, 'utf-8'), path);
  }

  /**
   * Delete a file or directory
   */
  async deleteFile(config: SSHConfig, path: string): Promise<void> {
    const client = await this.getConnection(config);

    const stat = await client.exists(path);
    if (stat === 'd') {
      await client.rmdir(path, true); // Recursive delete for directories
    } else {
      await client.delete(path);
    }
  }

  /**
   * Create a directory
   */
  async createDirectory(config: SSHConfig, path: string): Promise<void> {
    const client = await this.getConnection(config);
    await client.mkdir(path, true);
  }

  /**
   * Move/rename a file or directory
   */
  async moveFile(config: SSHConfig, oldPath: string, newPath: string): Promise<void> {
    const client = await this.getConnection(config);
    await client.rename(oldPath, newPath);
  }

  /**
   * Get file stats
   */
  async getFileInfo(config: SSHConfig, path: string): Promise<FileInfo> {
    const client = await this.getConnection(config);
    const stats = await client.stat(path);

    return {
      type: stats.isDirectory ? 'd' : '-',
      name: path.split('/').pop() || '',
      size: stats.size,
      modifyTime: stats.modifyTime,
      accessTime: stats.accessTime,
      rights: {
        user: stats.mode.toString(8).slice(-3),
        group: '',
        other: '',
      },
    };
  }

  /**
   * Execute a shell command (optional, for advanced use)
   */
  async executeCommand(config: SSHConfig, command: string): Promise<string> {
    const Client = (await import('ssh2')).Client;
    const conn = new Client();

    return new Promise((resolve, reject) => {
      const output: string[] = [];

      conn.on('ready', () => {
        conn.exec(command, (err: any, stream: any) => {
          if (err) return reject(err);

          stream
            .on('close', (code: number) => {
              conn.end();
              resolve(output.join('\n'));
            })
            .on('data', (data: Buffer) => {
              output.push(data.toString());
            })
            .stderr.on('data', (data: Buffer) => {
              output.push(data.toString());
            });
        });
      }).on('error', reject).connect({
        host: config.host,
        port: config.port,
        username: config.username,
        password: config.password,
        privateKey: config.privateKey,
        passphrase: config.passphrase,
      });
    });
  }

  /**
   * Close a specific connection
   */
  async disconnect(config: SSHConfig): Promise<void> {
    const key = this.getConnectionKey(config);
    const client = this.connections.get(key);

    if (client) {
      await client.end();
      this.connections.delete(key);
    }
  }

  /**
   * Close all connections
   */
  async disconnectAll(): Promise<void> {
    const disconnectPromises = Array.from(this.connections.values()).map(client =>
      client.end().catch(err => console.error('Error closing SSH connection:', err))
    );

    await Promise.all(disconnectPromises);
    this.connections.clear();
  }

  /**
   * Test connection
   */
  async testConnection(config: SSHConfig): Promise<boolean> {
    try {
      const client = await this.getConnection(config);
      await client.list('/');
      return true;
    } catch (error) {
      console.error('SSH connection test failed:', error);
      return false;
    }
  }
}

// Export singleton instance
export const sshService = new SSHService();
