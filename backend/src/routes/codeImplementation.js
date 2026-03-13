import { Router } from 'express';
import { z } from 'zod';
import { requireApiKey } from '../middleware/apiKey.js';
import { promises as fs } from 'fs';
import path from 'path';
const router = Router();
// Base directory for code access
const CODE_BASE_DIR = '/var/www/code';
// API key middleware
router.use(requireApiKey);
/**
 * Implementation Request Schema
 */
const ImplementationRequestSchema = z.object({
    request: z.string().min(10).max(5000),
    application: z.string().optional(), // e.g., "silulumanzi"
    module: z.string().optional(), // e.g., "Requisitions"
    provider: z.enum(['softaware', 'openai', 'groq', 'ollama']).optional(),
});
/**
 * POST /api/code-implementation/generate
 *
 * Generate implementation plan for a feature/bugfix request
 *
 * Body:
 *   - request: What to implement (e.g., "Add archive endpoint for requisitions")
 *   - application: (optional) Target application under /var/www/code
 *   - module: (optional) Specific module (helps narrow search)
 *   - provider: (optional) AI provider to use
 *
 * Returns:
 *   - plan: Implementation steps
 *   - files: Files to modify/create
 *   - code: Code snippets
 */
router.post('/generate', async (req, res, next) => {
    try {
        const body = ImplementationRequestSchema.parse(req.body);
        // Step 1: Analyze request to extract intent
        const intent = await analyzeIntent(body.request, body.provider);
        // Step 2: Find relevant documentation
        const docs = await findRelevantDocs(body.application || 'silulumanzi', intent.module || body.module);
        // Step 3: Find similar implementations
        const examples = await findSimilarImplementations(body.application || 'silulumanzi', intent.action);
        // Step 4: Generate implementation plan
        const plan = await generateImplementationPlan(body.request, docs, examples, body.provider);
        res.json({
            success: true,
            intent,
            plan,
        });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/code-implementation/analyze
 *
 * Analyze a request to extract intent (module, action type, etc.)
 */
router.post('/analyze', async (req, res, next) => {
    try {
        const { request, provider } = z.object({
            request: z.string(),
            provider: z.string().optional(),
        }).parse(req.body);
        const intent = await analyzeIntent(request, provider);
        res.json({ success: true, intent });
    }
    catch (error) {
        next(error);
    }
});
/**
 * POST /api/code-implementation/docs
 *
 * Search for relevant documentation for a module
 */
router.post('/docs', async (req, res, next) => {
    try {
        const { application, module } = z.object({
            application: z.string().default('silulumanzi'),
            module: z.string().optional(),
        }).parse(req.body);
        const docs = await findRelevantDocs(application, module);
        res.json({ success: true, docs });
    }
    catch (error) {
        next(error);
    }
});
// ============================================================================
// Helper Functions
// ============================================================================
/**
 * Analyze user's request to extract intent
 */
async function analyzeIntent(request, provider) {
    const systemPrompt = `You are a code analysis assistant. Extract the intent from implementation requests.

Respond ONLY with valid JSON in this exact format:
{
  "type": "new_feature" | "bug_fix" | "enhancement" | "refactor",
  "module": "ModuleName or null if unclear",
  "action": "brief description of action",
  "keywords": ["relevant", "search", "terms"]
}`;
    const userPrompt = `Analyze this implementation request and extract intent:

"${request}"

Respond with JSON only.`;
    const aiResponse = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ], provider, { temperature: 0.3, maxTokens: 300 });
    // Extract JSON from response
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('AI did not return valid JSON');
    }
    return JSON.parse(jsonMatch[0]);
}
/**
 * Find relevant documentation for a module
 */
async function findRelevantDocs(application, module) {
    const docs = [];
    if (!module) {
        // List available modules in documents/
        const docsPath = path.join(CODE_BASE_DIR, application, 'documents');
        try {
            const modules = await fs.readdir(docsPath, { withFileTypes: true });
            return modules
                .filter(m => m.isDirectory() && !m.name.startsWith('.'))
                .map(m => ({
                file: `documents/${m.name}/`,
                content: '',
                type: 'directory_listing',
            }));
        }
        catch {
            return [];
        }
    }
    // Read specific module documentation
    const docTypes = ['README.md', 'PATTERNS.md', 'ROUTES.md', 'FILES.md'];
    const basePath = path.join(CODE_BASE_DIR, application, 'documents', module);
    for (const docType of docTypes) {
        const docPath = path.join(basePath, docType);
        try {
            const content = await fs.readFile(docPath, 'utf-8');
            // Limit content to prevent token overflow
            const truncated = content.slice(0, 15000);
            docs.push({
                file: `documents/${module}/${docType}`,
                content: truncated,
                type: docType.replace('.md', '').toLowerCase(),
            });
        }
        catch {
            // File doesn't exist, skip
        }
    }
    return docs;
}
/**
 * Find similar implementations by searching code
 */
async function findSimilarImplementations(application, action) {
    const examples = [];
    // Extract keywords from action
    const keywords = action
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 3 && !['endpoint', 'feature', 'function'].includes(w));
    if (keywords.length === 0)
        return [];
    // Search for similar code (use first keyword)
    const searchPath = path.join(CODE_BASE_DIR, application);
    const searchKeyword = keywords[0];
    try {
        // Use ripgrep to search
        const { exec } = await import('child_process');
        const { promisify } = await import('util');
        const execAsync = promisify(exec);
        const rgCommand = `rg --json -i --max-count 2 --context 10 --glob '*.php' --glob '*.ts' --glob '*.js' '${searchKeyword}' '${searchPath}'`;
        const { stdout } = await execAsync(rgCommand, {
            maxBuffer: 5 * 1024 * 1024,
            timeout: 10000,
        }).catch(() => ({ stdout: '' }));
        // Parse results
        const lines = stdout.split('\n').filter(l => l);
        for (const line of lines.slice(0, 10)) {
            try {
                const json = JSON.parse(line);
                if (json.type === 'match') {
                    const relativePath = json.data.path.text.slice(CODE_BASE_DIR.length + 1);
                    examples.push({
                        file: relativePath,
                        snippet: json.data.lines.text.slice(0, 500),
                        lineNumber: json.data.line_number,
                    });
                }
            }
            catch {
                // Skip invalid JSON
            }
        }
    }
    catch {
        // Search failed, return empty
    }
    return examples.slice(0, 5); // Limit to 5 examples
}
/**
 * Generate implementation plan using AI
 */
async function generateImplementationPlan(request, docs, examples, provider) {
    const systemPrompt = `You are a code implementation assistant. Generate precise, step-by-step implementation plans.

Rules:
1. Follow existing architectural patterns EXACTLY
2. Use same naming conventions found in documentation
3. Match code style from examples
4. Provide complete code (never use placeholders like "...rest of code...")
5. Include file paths, line numbers, and all necessary imports

Output JSON format:
{
  "summary": "Brief description of implementation",
  "estimatedTime": "20-30 minutes",
  "filesAffected": ["file1.php", "file2.js"],
  "steps": [
    {
      "number": 1,
      "title": "Add method to controller",
      "file": "path/to/file.php",
      "action": "add" | "modify" | "delete",
      "location": "After line 123" or "Before method xyz()",
      "code": "complete code to add/change",
      "explanation": "Why this change is needed"
    }
  ],
  "testing": "How to test the implementation",
  "documentation": "What documentation to update"
}`;
    // Build context from docs
    let docsContext = '';
    for (const doc of docs) {
        docsContext += `\n\n--- ${doc.file} (${doc.type}) ---\n${doc.content.slice(0, 3000)}`;
    }
    // Build context from examples
    let examplesContext = '';
    if (examples.length > 0) {
        examplesContext = '\n\nSIMILAR IMPLEMENTATIONS:\n';
        for (const ex of examples) {
            examplesContext += `\nFile: ${ex.file} (line ${ex.lineNumber})\n${ex.snippet}\n`;
        }
    }
    const userPrompt = `Implementation Request: "${request}"

EXISTING PATTERNS (from documentation):${docsContext}${examplesContext}

Generate a detailed implementation plan in JSON format.`;
    const aiResponse = await callAI([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
    ], provider, { temperature: 0.4, maxTokens: 4000 });
    // Extract JSON
    const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
        throw new Error('AI did not return valid JSON plan');
    }
    return JSON.parse(jsonMatch[0]);
}
/**
 * Call AI endpoint
 */
async function callAI(messages, provider = 'softaware', options = {}) {
    const response = await fetch('http://localhost:8787/ai/api/chat', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-API-Key': process.env.INTERNAL_API_KEY || 'internal-system-key',
        },
        body: JSON.stringify({
            provider,
            messages,
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000,
        }),
    });
    if (!response.ok) {
        throw new Error(`AI API error: ${response.status}`);
    }
    const data = await response.json();
    return data.choices[0].message.content;
}
export { router as codeImplementationRouter };
