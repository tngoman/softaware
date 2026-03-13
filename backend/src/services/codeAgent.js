import fs from 'fs/promises';
import path from 'path';
import { aiProviderManager } from './ai/AIProviderManager.js';
const ALLOWED_DIRECTORIES = ['/var/www/code'];
export class CodeAgentService {
    systemPrompt = `You are a code editing assistant. You receive instructions to modify code files.
Your responses should be in JSON format with the following structure:
{
  "plan": "Brief explanation of what you will do",
  "changes": [
    {
      "file": "relative/path/to/file.ext",
      "action": "create" | "modify" | "delete",
      "content": "full file content for create/modify, omit for delete"
    }
  ]
}

Rules:
- Always provide complete file contents, never use placeholders like "...rest of code..."
- Only suggest changes that are safe and follow best practices
- Validate syntax before suggesting changes
- For modifications, include the entire file content`;
    async executeInstruction(request) {
        // Validate directory
        const fullPath = path.resolve(request.directory);
        const isAllowed = ALLOWED_DIRECTORIES.some(dir => fullPath.startsWith(dir));
        if (!isAllowed) {
            throw new Error(`Directory '${request.directory}' is not in allowed directories`);
        }
        // Check if directory exists
        try {
            await fs.access(fullPath);
        }
        catch {
            throw new Error(`Directory '${request.directory}' does not exist`);
        }
        // Read context files if specified
        let contextFiles = '';
        if (request.files && request.files.length > 0) {
            contextFiles = await this.readContextFiles(fullPath, request.files);
        }
        // Prepare messages for AI
        const messages = [
            { role: 'system', content: this.systemPrompt },
            {
                role: 'user',
                content: `Directory: ${request.directory}\n\nInstruction: ${request.instruction}\n\n${contextFiles ? `Current files:\n${contextFiles}\n\n` : ''}Please provide the changes in JSON format.`
            },
        ];
        // Get AI response
        const provider = aiProviderManager.getProvider(request.provider);
        const aiResponse = await provider.chat(messages, {
            model: request.model,
            temperature: 0.3,
            maxTokens: 8000,
        });
        // Parse AI response
        let changes;
        try {
            const jsonMatch = aiResponse.content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No valid JSON found in AI response');
            }
            changes = JSON.parse(jsonMatch[0]);
        }
        catch (error) {
            throw new Error(`Failed to parse AI response: ${error}`);
        }
        // Execute changes
        const executedChanges = [];
        for (const change of changes.changes || []) {
            const filePath = path.join(fullPath, change.file);
            // Security check - ensure file is within allowed directory
            if (!filePath.startsWith(fullPath)) {
                console.warn(`Skipping unsafe file path: ${change.file}`);
                continue;
            }
            switch (change.action) {
                case 'create':
                case 'modify':
                    await fs.mkdir(path.dirname(filePath), { recursive: true });
                    await fs.writeFile(filePath, change.content, 'utf-8');
                    executedChanges.push({
                        file: change.file,
                        action: change.action,
                    });
                    break;
                case 'delete':
                    try {
                        await fs.unlink(filePath);
                        executedChanges.push({
                            file: change.file,
                            action: 'deleted',
                        });
                    }
                    catch {
                        // File doesn't exist, ignore
                    }
                    break;
            }
        }
        return {
            success: true,
            changes: executedChanges,
            message: changes.plan || 'Changes executed successfully',
            aiResponse: aiResponse.content,
        };
    }
    async readContextFiles(baseDir, files) {
        const contents = [];
        for (const file of files) {
            const filePath = path.join(baseDir, file);
            try {
                const content = await fs.readFile(filePath, 'utf-8');
                contents.push(`File: ${file}\n\`\`\`\n${content}\n\`\`\``);
            }
            catch (error) {
                contents.push(`File: ${file}\n(File not found or unreadable)`);
            }
        }
        return contents.join('\n\n');
    }
    async listFiles(directory) {
        const fullPath = path.resolve(directory);
        const isAllowed = ALLOWED_DIRECTORIES.some(dir => fullPath.startsWith(dir));
        if (!isAllowed) {
            throw new Error(`Directory '${directory}' is not in allowed directories`);
        }
        return this.readDirRecursive(fullPath, fullPath);
    }
    async readDirRecursive(dir, baseDir) {
        const files = [];
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            const relativePath = path.relative(baseDir, fullPath);
            if (entry.isDirectory()) {
                if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    const subFiles = await this.readDirRecursive(fullPath, baseDir);
                    files.push(...subFiles);
                }
            }
            else {
                files.push(relativePath);
            }
        }
        return files;
    }
}
export const codeAgentService = new CodeAgentService();
