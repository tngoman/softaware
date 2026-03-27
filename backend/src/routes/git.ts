import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireAuth } from '../middleware/auth.js';
import { requireDeveloper } from '../middleware/requireDeveloper.js';
import { getGitHubToken } from '../services/credentialVault.js';

const router = Router();
const execAsync = promisify(exec);

// Git repository location
const GIT_DIR = '/var/www/code/silulumanzi';

// The ONLY branch that write operations are allowed on
const ALLOWED_BRANCH = 'Bugfix';

// Execute timeout (10 seconds for reads, 30s for network ops)
const EXEC_TIMEOUT = 10000;
const NETWORK_TIMEOUT = 30000;

// Authentication + developer role middleware
router.use(requireAuth, requireDeveloper);

/**
 * Execute git command safely (local operations only — no network)
 */
async function execGit(command: string, timeout = EXEC_TIMEOUT): Promise<string> {
  try {
    const { stdout } = await execAsync(command, {
      cwd: GIT_DIR,
      timeout,
      maxBuffer: 1024 * 1024 * 10 // 10MB
    });
    return stdout.trim();
  } catch (error: any) {
    if (error.code === 128) {
      throw new Error('NOT_A_GIT_REPO');
    }
    throw error;
  }
}

/**
 * Execute a git command that requires network access (fetch / pull / push).
 *
 * Injects the GitHub PAT from the credential vault as a one-shot
 * credential helper so the token is never persisted in git config.
 * The token itself travels through the `__GIT_CRED_TOKEN` env var
 * so it does not appear in the process command line.
 */
async function execGitNetwork(command: string): Promise<{ stdout: string; stderr: string }> {
  const token = await getGitHubToken();

  const env: Record<string, string> = {
    ...(process.env as Record<string, string>),
    GIT_TERMINAL_PROMPT: '0',   // never hang waiting for user input
  };

  let cmd = command;
  if (token) {
    env.__GIT_CRED_TOKEN = token;
    // One-shot credential helper: reads the token from the inherited env
    const helper =
      "credential.helper=!f(){ echo username=x-access-token; echo password=$__GIT_CRED_TOKEN; };f";
    cmd = command.replace(/^git /, `git -c '${helper}' `);
  }

  return execAsync(cmd, {
    cwd: GIT_DIR,
    timeout: NETWORK_TIMEOUT,
    maxBuffer: 1024 * 1024 * 10,
    env,
  });
}

/**
 * Get current branch name
 */
async function getCurrentBranch(): Promise<string> {
  return execGit('git rev-parse --abbrev-ref HEAD');
}

/**
 * Enforce that write operations only run on the allowed branch.
 * Returns an error response object if blocked, or null if OK.
 */
async function enforceBranch(res: Response): Promise<boolean> {
  const current = await getCurrentBranch();
  if (current !== ALLOWED_BRANCH) {
    res.status(403).json({
      success: false,
      error: 'BRANCH_RESTRICTED',
      message: `Write operations are only allowed on the "${ALLOWED_BRANCH}" branch. You are currently on "${current}". Please switch to "${ALLOWED_BRANCH}" first.`,
      currentBranch: current,
      allowedBranch: ALLOWED_BRANCH,
    });
    return false;
  }
  return true;
}

/**
 * Validate and sanitize commit hash
 */
function sanitizeHash(hash: string): string {
  if (!/^[a-f0-9]{7,40}$/i.test(hash)) {
    throw new Error('INVALID_HASH');
  }
  return hash;
}

/**
 * Validate and sanitize file path
 */
function sanitizePath(filePath: string): string {
  if (!filePath) return '';
  
  // Prevent directory traversal
  if (filePath.includes('..') || filePath.startsWith('/')) {
    throw new Error('INVALID_PATH');
  }
  
  return filePath;
}

/**
 * GET /api/code/git/branches
 * List all branches (local and remote)
 */
router.get('/branches', async (req: Request, res: Response) => {
  try {
    const [currentBranch, localBranches, remoteBranches] = await Promise.all([
      execGit('git rev-parse --abbrev-ref HEAD'),
      execGit('git branch --format="%(refname:short)|%(objectname:short)|%(upstream:short)|%(upstream:track)"'),
      execGit('git branch -r --format="%(refname:short)|%(objectname:short)"').catch(() => '')
    ]);

    // Parse local branches
    const local = localBranches.split('\n').filter(Boolean).map(line => {
      const [name, hash, upstream, track] = line.split('|');
      const trackMatch = track?.match(/ahead (\d+)|behind (\d+)/g);
      let ahead = 0;
      let behind = 0;
      
      if (trackMatch) {
        trackMatch.forEach(m => {
          if (m.includes('ahead')) ahead = parseInt(m.match(/\d+/)?.[0] || '0');
          if (m.includes('behind')) behind = parseInt(m.match(/\d+/)?.[0] || '0');
        });
      }

      return {
        name,
        hash,
        current: name === currentBranch,
        upstream: upstream || null,
        ahead,
        behind
      };
    });

    // Parse remote branches
    const remote = remoteBranches ? remoteBranches.split('\n').filter(Boolean).map(line => {
      const [name, hash] = line.split('|');
      return { name, hash };
    }) : [];

    res.json({
      current: currentBranch,
      local,
      remote,
      total: {
        local: local.length,
        remote: remote.length
      }
    });
  } catch (error: any) {
    console.error('[Git API] Error listing branches:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }

    res.status(500).json({
      error: 'BRANCH_LIST_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/status
 * Get detailed working tree status
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const [statusOutput, branch, ahead, behind] = await Promise.all([
      execGit('git status --porcelain=v1'),
      execGit('git rev-parse --abbrev-ref HEAD'),
      execGit('git rev-list --count @{upstream}..HEAD').catch(() => '0'),
      execGit('git rev-list --count HEAD..@{upstream}').catch(() => '0')
    ]);

    const files = statusOutput.split('\n').filter(Boolean).map(line => {
      const status = line.substring(0, 2);
      const path = line.substring(3);
      
      // Parse git status codes
      const staged = status[0] !== ' ' && status[0] !== '?';
      const unstaged = status[1] !== ' ';
      
      let type = 'unknown';
      if (status.includes('M')) type = 'modified';
      else if (status.includes('A')) type = 'added';
      else if (status.includes('D')) type = 'deleted';
      else if (status.includes('R')) type = 'renamed';
      else if (status.includes('C')) type = 'copied';
      else if (status.includes('?')) type = 'untracked';
      
      return { path, type, staged, unstaged, status };
    });

    res.json({
      branch,
      ahead: parseInt(ahead),
      behind: parseInt(behind),
      clean: files.length === 0,
      files,
      summary: {
        total: files.length,
        staged: files.filter(f => f.staged).length,
        unstaged: files.filter(f => f.unstaged).length,
        untracked: files.filter(f => f.type === 'untracked').length
      }
    });
  } catch (error: any) {
    console.error('[Git API] Error getting status:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }

    res.status(500).json({
      error: 'STATUS_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/code/git/checkout
 * Switch to any local branch.
 * Write operations (commit, push, pull, etc.) are still restricted to the
 * ALLOWED_BRANCH via enforceBranch — but browsing any branch is allowed.
 * Body: { branch: string }
 */
router.post('/checkout', async (req: Request, res: Response) => {
  try {
    const branch = req.body?.branch;
    
    if (!branch || typeof branch !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'INVALID_BRANCH',
        message: 'Branch name is required'
      });
    }

    // Sanitize branch name
    if (!/^[a-zA-Z0-9._/-]+$/.test(branch)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_BRANCH_NAME',
        message: 'Branch name contains invalid characters'
      });
    }

    // Verify the branch actually exists locally
    const localBranches = await execGit('git branch --format="%(refname:short)"');
    const branchList = localBranches.split('\n').filter(Boolean);
    if (!branchList.includes(branch)) {
      return res.status(404).json({
        success: false,
        error: 'BRANCH_NOT_FOUND',
        message: `Branch "${branch}" does not exist locally. Available: ${branchList.join(', ')}`,
      });
    }

    // Check for uncommitted changes
    const statusOutput = await execGit('git status --porcelain');
    if (statusOutput) {
      return res.status(400).json({
        success: false,
        error: 'UNCOMMITTED_CHANGES',
        message: 'Repository has uncommitted changes. Stash or commit them first.'
      });
    }

    await execGit(`git checkout ${branch}`);

    const newBranch = await execGit('git rev-parse --abbrev-ref HEAD');

    res.json({
      success: true,
      branch: newBranch,
      message: `Switched to branch '${branch}'`
    });
  } catch (error: any) {
    console.error('[Git API] Error checking out branch:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        success: false,
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }

    res.status(500).json({
      success: false,
      error: 'CHECKOUT_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/info
 * Get basic repository information
 */
router.get('/info', async (req: Request, res: Response) => {
  try {
    const [branch, lastCommitRaw, remote, countStr, statusRaw] = await Promise.all([
      execGit('git rev-parse --abbrev-ref HEAD'),
      execGit('git log -1 --format="%H|%h|%s|%an|%ae|%aI|%at"'),
      execGit('git config --get remote.origin.url').catch(() => ''),
      execGit('git rev-list --count HEAD'),
      execGit('git status --porcelain').catch(() => '')
    ]);

    const [hash, shortHash, message, author, email, date, timestampStr] = lastCommitRaw.split('|');
    const totalCommits = parseInt(countStr);
    const status = statusRaw ? 'dirty' : 'clean';

    res.json({
      branch,
      lastCommit: {
        hash,
        shortHash,
        message,
        author,
        email,
        date,
        timestamp: parseInt(timestampStr)
      },
      remote: remote || null,
      totalCommits,
      status
    });
  } catch (error: any) {
    console.error('[Git API] Error getting repo info:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }
    
    res.status(500).json({
      error: 'GIT_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/log
 * Get commit history
 * Query params: limit (default 20, max 100), path (optional)
 */
router.get('/log', async (req: Request, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const filePath = sanitizePath(req.query.path as string || '');

    let command = `git log -n ${limit} --format="%H|%h|%s|%an|%ae|%aI|%at"`;
    if (filePath) {
      command += ` -- "${filePath}"`;
    }

    const output = await execGit(command);
    
    const commits = output.split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, message, author, email, date, timestampStr] = line.split('|');
      return {
        hash,
        shortHash,
        message,
        author,
        email,
        date,
        timestamp: parseInt(timestampStr)
      };
    });

    // Check if there are more commits
    const totalCountCommand = filePath 
      ? `git rev-list --count HEAD -- "${filePath}"`
      : 'git rev-list --count HEAD';
    const totalCountStr = await execGit(totalCountCommand);
    const totalCount = parseInt(totalCountStr);
    const hasMore = totalCount > limit;

    res.json({
      commits,
      limit,
      path: filePath || null,
      hasMore
    });
  } catch (error: any) {
    console.error('[Git API] Error getting log:', error);
    
    if (error.message === 'INVALID_PATH') {
      return res.status(400).json({
        error: 'INVALID_PATH',
        message: 'Invalid file path provided'
      });
    }
    
    res.status(500).json({
      error: 'GIT_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/commit/:hash
 * Get detailed information for a specific commit
 */
router.get('/commit/:hash', async (req: Request, res: Response) => {
  try {
    const hash = sanitizeHash(req.params.hash);

    // Get commit metadata first
    const metadataRaw = await execGit(
      `git show --format="%H|%h|%s|%an|%ae|%aI|%at" -s ${hash}`
    );
    const [fullHash, shortHash, subject, author, email, date, timestampStr] = metadataRaw.split('|');

    // Get full commit message (body)
    const fullMessageRaw = await execGit(
      `git log -1 --format="%B" ${hash}`
    );
    const fullMessage = fullMessageRaw.trim();

    // Get file changes
    const fileChangesRaw = await execGit(
      `git show --name-status --format="" ${hash}`
    );
    const fileLines = fileChangesRaw.split('\n').filter(Boolean);
    let messageEndIndex = fileLines.length;

    // Parse file changes
    const files: Array<{ path: string; status: string }> = [];
    for (const line of fileLines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      
      const match = trimmed.match(/^([AMDRC])\s+(.+)$/);
      if (match) {
        const statusCode = match[1];
        const filePath = match[2];
        const statusMap: Record<string, string> = {
          'A': 'added',
          'M': 'modified',
          'D': 'deleted',
          'R': 'renamed',
          'C': 'copied'
        };
        files.push({
          path: filePath,
          status: statusMap[statusCode] || 'unknown'
        });
      }
    }

    // Get stats
    const statsOutput = await execGit(`git show --stat --format="" ${hash}`);
    const statsLines = statsOutput.split('\n').filter(Boolean);
    const lastLine = statsLines[statsLines.length - 1];
    
    let additions = 0;
    let deletions = 0;
    const statsMatch = lastLine.match(/(\d+) insertion.*?(\d+) deletion/);
    if (statsMatch) {
      additions = parseInt(statsMatch[1]);
      deletions = parseInt(statsMatch[2]);
    } else if (lastLine.includes('insertion')) {
      const addMatch = lastLine.match(/(\d+) insertion/);
      if (addMatch) additions = parseInt(addMatch[1]);
    } else if (lastLine.includes('deletion')) {
      const delMatch = lastLine.match(/(\d+) deletion/);
      if (delMatch) deletions = parseInt(delMatch[1]);
    }

    res.json({
      hash: fullHash,
      shortHash,
      message: fullMessage.trim(),
      author,
      email,
      date,
      timestamp: parseInt(timestampStr),
      files,
      stats: {
        filesChanged: files.length,
        additions,
        deletions
      }
    });
  } catch (error: any) {
    console.error('[Git API] Error getting commit:', error);
    
    if (error.message === 'INVALID_HASH') {
      return res.status(400).json({
        error: 'INVALID_HASH',
        message: 'Invalid commit hash format'
      });
    }
    
    if (error.code === 128) {
      return res.status(404).json({
        error: 'COMMIT_NOT_FOUND',
        message: 'Commit not found'
      });
    }
    
    res.status(500).json({
      error: 'GIT_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/history
 * Get commit history for a specific file
 * Query params: path (required)
 */
router.get('/history', async (req: Request, res: Response) => {
  try {
    const filePath = sanitizePath(req.query.path as string);
    
    if (!filePath) {
      return res.status(400).json({
        error: 'PATH_REQUIRED',
        message: 'Path query parameter is required'
      });
    }

    const output = await execGit(
      `git log --follow --format="%H|%h|%s|%an|%ae|%aI|%at" -- "${filePath}"`
    );

    if (!output) {
      return res.json({
        path: filePath,
        commits: []
      });
    }

    const commits = output.split('\n').filter(Boolean).map(line => {
      const [hash, shortHash, message, author, email, date, timestampStr] = line.split('|');
      return {
        hash,
        shortHash,
        message,
        author,
        email,
        date,
        timestamp: parseInt(timestampStr)
      };
    });

    res.json({
      path: filePath,
      commits
    });
  } catch (error: any) {
    console.error('[Git API] Error getting file history:', error);
    
    if (error.message === 'INVALID_PATH') {
      return res.status(400).json({
        error: 'INVALID_PATH',
        message: 'Invalid file path provided'
      });
    }
    
    res.status(500).json({
      error: 'GIT_ERROR',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/diff
 * Get diff for unstaged or staged changes
 * Query params: staged (boolean), file (string, optional)
 */
router.get('/diff', async (req: Request, res: Response) => {
  try {
    const staged = req.query.staged === 'true';
    const file = req.query.file ? sanitizePath(req.query.file as string) : '';
    
    const command = staged 
      ? `git diff --cached ${file}` 
      : `git diff ${file}`;

    const diff = await execGit(command);

    res.json({
      diff: diff || '',
      staged,
      file: file || null,
      hasChanges: diff.length > 0
    });
  } catch (error: any) {
    console.error('[Git API] Error getting diff:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }

    res.status(500).json({
      error: 'DIFF_FAILED',
      message: error.message
    });
  }
});

/**
 * GET /api/code/git/tags
 * List all tags
 */
router.get('/tags', async (req: Request, res: Response) => {
  try {
    const tagsOutput = await execGit('git tag -l --format="%(refname:short)|%(objectname:short)|%(creatordate:iso8601)|%(subject)"');
    
    const tags = tagsOutput.split('\n').filter(Boolean).map(line => {
      const [name, hash, date, message] = line.split('|');
      return { name, hash, date, message: message || '' };
    });

    res.json({
      tags,
      total: tags.length
    });
  } catch (error: any) {
    console.error('[Git API] Error listing tags:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }

    res.status(500).json({
      error: 'TAG_LIST_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/code/git/pull
 * Pull latest changes from remote repository
 */
router.post('/pull', async (req: Request, res: Response) => {
  try {
    // Enforce Bugfix branch
    if (!(await enforceBranch(res))) return;

    // Check for uncommitted changes first
    const statusOutput = await execGit('git status --porcelain');
    if (statusOutput) {
      return res.status(400).json({
        success: false,
        error: 'UNCOMMITTED_CHANGES',
        message: 'Repository has uncommitted changes. Cannot pull.'
      });
    }

    // Always pull from origin/Bugfix
    const remote = 'origin';
    const branch = ALLOWED_BRANCH;

    // Execute git pull with GitHub PAT from credential vault
    const { stdout, stderr } = await execGitNetwork(`git pull ${remote} ${branch}`);

    // Check for merge conflicts
    const hasConflicts = stderr?.includes('CONFLICT') || stdout?.includes('CONFLICT');
    if (hasConflicts) {
      // Get list of conflicted files
      const conflictFiles = await execGit('git diff --name-only --diff-filter=U').catch(() => '');
      return res.json({
        success: false,
        error: 'MERGE_CONFLICT',
        message: 'Pull resulted in merge conflicts that need to be resolved.',
        conflictFiles: conflictFiles ? conflictFiles.split('\n').filter(Boolean) : [],
        output: (stdout + '\n' + (stderr || '')).trim()
      });
    }

    // Parse git pull output for stats
    const statsMatch = stdout.match(/(\d+) files? changed(?:, (\d+) insertions?\(\+\))?(?:, (\d+) deletions?\(-\))?/);
    const isUpToDate = stdout.includes('Already up to date') || stdout.includes('Already up-to-date');

    res.json({
      success: true,
      filesChanged: statsMatch ? parseInt(statsMatch[1]) : 0,
      insertions: statsMatch && statsMatch[2] ? parseInt(statsMatch[2]) : 0,
      deletions: statsMatch && statsMatch[3] ? parseInt(statsMatch[3]) : 0,
      message: isUpToDate ? 'Already up to date.' : 'Pull successful',
      output: stdout.trim()
    });
  } catch (error: any) {
    console.error('[Git API] Error pulling changes:', error);
    
    if (error.message === 'NOT_A_GIT_REPO') {
      return res.status(500).json({
        success: false,
        error: 'NOT_A_GIT_REPO',
        message: 'Directory is not a git repository'
      });
    }

    // Check if error output indicates merge conflict
    if (error.stderr?.includes('CONFLICT') || error.stdout?.includes('CONFLICT')) {
      const conflictFiles = await execGit('git diff --name-only --diff-filter=U').catch(() => '');
      return res.status(409).json({
        success: false,
        error: 'MERGE_CONFLICT',
        message: 'Pull resulted in merge conflicts.',
        conflictFiles: conflictFiles ? conflictFiles.split('\n').filter(Boolean) : [],
        output: ((error.stdout || '') + '\n' + (error.stderr || '')).trim()
      });
    }

    res.status(500).json({
      success: false,
      error: 'PULL_FAILED',
      message: error.message,
      stderr: error.stderr || ''
    });
  }
});

/**
 * POST /api/code/git/fetch
 * Fetch latest refs from remote (no merge)
 */
router.post('/fetch', async (req: Request, res: Response) => {
  try {
    // Fetch with GitHub PAT from credential vault
    const { stdout } = await execGitNetwork('git fetch origin --prune');

    res.json({
      success: true,
      message: 'Fetch complete',
      output: stdout.trim()
    });
  } catch (error: any) {
    console.error('[Git API] Error fetching:', error);
    res.status(500).json({
      success: false,
      error: 'FETCH_FAILED',
      message: error.message
    });
  }
});

/**
 * POST /api/code/git/stage
 * Stage files for commit
 * Body: { files?: string[] }  — if omitted, stages everything (git add -A)
 */
router.post('/stage', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    const files: string[] | undefined = req.body?.files;

    if (files && Array.isArray(files) && files.length > 0) {
      // Validate each path
      for (const f of files) {
        sanitizePath(f);
      }
      const quoted = files.map(f => `"${f}"`).join(' ');
      await execGit(`git add ${quoted}`);
    } else {
      await execGit('git add -A');
    }

    // Return updated status
    const statusOutput = await execGit('git status --porcelain');
    const staged = statusOutput.split('\n').filter(Boolean).filter(l => l[0] !== ' ' && l[0] !== '?');

    res.json({
      success: true,
      message: `Staged ${staged.length} file(s)`,
      stagedCount: staged.length,
    });
  } catch (error: any) {
    console.error('[Git API] Error staging:', error);
    res.status(500).json({ success: false, error: 'STAGE_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/unstage
 * Unstage files (git reset HEAD)
 * Body: { files?: string[] }
 */
router.post('/unstage', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    const files: string[] | undefined = req.body?.files;

    if (files && Array.isArray(files) && files.length > 0) {
      for (const f of files) sanitizePath(f);
      const quoted = files.map(f => `"${f}"`).join(' ');
      await execGit(`git reset HEAD ${quoted}`);
    } else {
      await execGit('git reset HEAD');
    }

    res.json({ success: true, message: 'Files unstaged' });
  } catch (error: any) {
    console.error('[Git API] Error unstaging:', error);
    res.status(500).json({ success: false, error: 'UNSTAGE_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/commit
 * Commit staged changes
 * Body: { message: string }
 */
router.post('/commit', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    const message = req.body?.message;
    if (!message || typeof message !== 'string' || !message.trim()) {
      return res.status(400).json({
        success: false,
        error: 'MESSAGE_REQUIRED',
        message: 'A commit message is required'
      });
    }

    // Check that there are staged changes
    const staged = await execGit('git diff --cached --name-only');
    if (!staged) {
      return res.status(400).json({
        success: false,
        error: 'NOTHING_STAGED',
        message: 'No changes are staged for commit. Stage some files first.'
      });
    }

    // Sanitize commit message (escape double quotes)
    const sanitized = message.trim().replace(/"/g, '\\"');
    const { stdout } = await execAsync(`git commit -m "${sanitized}"`, {
      cwd: GIT_DIR,
      timeout: EXEC_TIMEOUT,
      maxBuffer: 1024 * 1024 * 10
    });

    // Get the new commit hash
    const hash = await execGit('git rev-parse --short HEAD');

    res.json({
      success: true,
      hash,
      message: `Committed: ${message.trim()}`,
      output: stdout.trim()
    });
  } catch (error: any) {
    console.error('[Git API] Error committing:', error);
    res.status(500).json({
      success: false,
      error: 'COMMIT_FAILED',
      message: error.message,
      stderr: error.stderr || ''
    });
  }
});

/**
 * POST /api/code/git/push
 * Push commits to remote (only Bugfix branch)
 */
router.post('/push', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    // Push with GitHub PAT from credential vault
    const { stdout, stderr } = await execGitNetwork(`git push origin ${ALLOWED_BRANCH}`);

    const combined = (stdout + '\n' + (stderr || '')).trim();
    const isUpToDate = combined.includes('Everything up-to-date');

    res.json({
      success: true,
      message: isUpToDate ? 'Everything up-to-date' : 'Push successful',
      output: combined
    });
  } catch (error: any) {
    console.error('[Git API] Error pushing:', error);
    res.status(500).json({
      success: false,
      error: 'PUSH_FAILED',
      message: error.message,
      stderr: error.stderr || ''
    });
  }
});

/**
 * POST /api/code/git/stash
 * Stash uncommitted changes
 * Body: { message?: string }
 */
router.post('/stash', async (req: Request, res: Response) => {
  try {
    const message = req.body?.message || '';
    const cmd = message
      ? `git stash push -m "${message.replace(/"/g, '\\"')}"`
      : 'git stash push';

    const output = await execGit(cmd);
    const noChanges = output.includes('No local changes to save');

    res.json({
      success: true,
      message: noChanges ? 'No changes to stash' : 'Changes stashed',
      output
    });
  } catch (error: any) {
    console.error('[Git API] Error stashing:', error);
    res.status(500).json({ success: false, error: 'STASH_FAILED', message: error.message });
  }
});

/**
 * GET /api/code/git/stash/list
 * List all stash entries
 */
router.get('/stash/list', async (req: Request, res: Response) => {
  try {
    const output = await execGit('git stash list --format="%gd|%s|%ai"').catch(() => '');
    const entries = output ? output.split('\n').filter(Boolean).map(line => {
      const [ref, message, date] = line.split('|');
      return { ref, message, date };
    }) : [];

    res.json({ entries, total: entries.length });
  } catch (error: any) {
    res.status(500).json({ error: 'STASH_LIST_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/stash/pop
 * Pop the most recent stash
 */
router.post('/stash/pop', async (req: Request, res: Response) => {
  try {
    const output = await execGit('git stash pop');
    res.json({ success: true, message: 'Stash applied and removed', output });
  } catch (error: any) {
    console.error('[Git API] Error popping stash:', error);
    // Check for conflicts
    if (error.stderr?.includes('CONFLICT') || error.stdout?.includes('CONFLICT')) {
      return res.status(409).json({
        success: false,
        error: 'MERGE_CONFLICT',
        message: 'Stash pop resulted in conflicts',
        output: ((error.stdout || '') + '\n' + (error.stderr || '')).trim()
      });
    }
    res.status(500).json({ success: false, error: 'STASH_POP_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/discard
 * Discard uncommitted changes to specific files or all
 * Body: { files?: string[] }
 */
router.post('/discard', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    const files: string[] | undefined = req.body?.files;

    if (files && Array.isArray(files) && files.length > 0) {
      for (const f of files) sanitizePath(f);
      const quoted = files.map(f => `"${f}"`).join(' ');
      await execGit(`git checkout -- ${quoted}`);
      // Also clean untracked
      await execGit(`git clean -fd ${quoted}`).catch(() => {});
    } else {
      await execGit('git checkout -- .');
      await execGit('git clean -fd');
    }

    res.json({ success: true, message: 'Changes discarded' });
  } catch (error: any) {
    console.error('[Git API] Error discarding:', error);
    res.status(500).json({ success: false, error: 'DISCARD_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/reset
 * Reset to a specific commit (soft, mixed, or hard)
 * Body: { target?: string, mode?: 'soft' | 'mixed' | 'hard' }
 */
router.post('/reset', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    const target = req.body?.target || 'HEAD';
    const mode = req.body?.mode || 'mixed';

    if (!['soft', 'mixed', 'hard'].includes(mode)) {
      return res.status(400).json({ success: false, error: 'INVALID_MODE', message: 'Mode must be soft, mixed, or hard' });
    }

    if (target !== 'HEAD') sanitizeHash(target);

    await execGit(`git reset --${mode} ${target}`);

    res.json({
      success: true,
      message: `Reset (${mode}) to ${target}`,
    });
  } catch (error: any) {
    console.error('[Git API] Error resetting:', error);
    res.status(500).json({ success: false, error: 'RESET_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/resolve-conflicts
 * Accept ours or theirs for conflicted files, or mark as resolved
 * Body: { strategy: 'ours' | 'theirs', files?: string[] }
 */
router.post('/resolve-conflicts', async (req: Request, res: Response) => {
  try {
    if (!(await enforceBranch(res))) return;

    const strategy = req.body?.strategy;
    const files: string[] | undefined = req.body?.files;

    if (!strategy || !['ours', 'theirs'].includes(strategy)) {
      return res.status(400).json({
        success: false,
        error: 'INVALID_STRATEGY',
        message: 'Strategy must be "ours" or "theirs"'
      });
    }

    // Get conflicted files
    const conflictOutput = await execGit('git diff --name-only --diff-filter=U');
    const conflictFiles = conflictOutput ? conflictOutput.split('\n').filter(Boolean) : [];

    if (conflictFiles.length === 0) {
      return res.json({ success: true, message: 'No conflicts to resolve' });
    }

    const targets = files && files.length > 0
      ? files.filter(f => conflictFiles.includes(f))
      : conflictFiles;

    for (const file of targets) {
      sanitizePath(file);
      await execGit(`git checkout --${strategy} "${file}"`);
      await execGit(`git add "${file}"`);
    }

    // Check if any conflicts remain
    const remaining = await execGit('git diff --name-only --diff-filter=U').catch(() => '');
    const remainingFiles = remaining ? remaining.split('\n').filter(Boolean) : [];

    res.json({
      success: true,
      message: `Resolved ${targets.length} file(s) using "${strategy}" strategy`,
      resolved: targets,
      remainingConflicts: remainingFiles,
    });
  } catch (error: any) {
    console.error('[Git API] Error resolving conflicts:', error);
    res.status(500).json({ success: false, error: 'RESOLVE_FAILED', message: error.message });
  }
});

/**
 * POST /api/code/git/abort-merge
 * Abort an in-progress merge
 */
router.post('/abort-merge', async (req: Request, res: Response) => {
  try {
    await execGit('git merge --abort');
    res.json({ success: true, message: 'Merge aborted' });
  } catch (error: any) {
    console.error('[Git API] Error aborting merge:', error);
    res.status(500).json({ success: false, error: 'ABORT_FAILED', message: error.message });
  }
});

/**
 * GET /api/code/git/file-content
 * Read a file's content at HEAD or a specific commit
 * Query: path (required), ref (optional, defaults to HEAD)
 */
router.get('/file-content', async (req: Request, res: Response) => {
  try {
    const filePath = sanitizePath(req.query.path as string);
    if (!filePath) {
      return res.status(400).json({ error: 'PATH_REQUIRED', message: 'path query parameter is required' });
    }
    const ref = req.query.ref as string || 'HEAD';
    if (ref !== 'HEAD') sanitizeHash(ref);

    const content = await execGit(`git show ${ref}:"${filePath}"`);
    res.json({ path: filePath, ref, content });
  } catch (error: any) {
    if (error.message === 'INVALID_PATH') {
      return res.status(400).json({ error: 'INVALID_PATH', message: 'Invalid file path' });
    }
    res.status(500).json({ error: 'FILE_CONTENT_FAILED', message: error.message });
  }
});

/**
 * GET /api/code/git/config
 * Get branch restriction configuration
 */
router.get('/config', async (_req: Request, res: Response) => {
  try {
    const current = await getCurrentBranch();
    const ahead = await execGit('git rev-list --count @{upstream}..HEAD').catch(() => '0');
    const behind = await execGit('git rev-list --count HEAD..@{upstream}').catch(() => '0');
    const remote = await execGit('git config --get remote.origin.url').catch(() => '');
    const lastFetchFile = `${GIT_DIR}/.git/FETCH_HEAD`;
    let lastFetch: string | null = null;
    try {
      const { stdout } = await execAsync(`stat -c %Y "${lastFetchFile}"`, { cwd: GIT_DIR, timeout: EXEC_TIMEOUT });
      lastFetch = new Date(parseInt(stdout.trim()) * 1000).toISOString();
    } catch { /* no fetch head yet */ }

    res.json({
      success: true,
      allowedBranch: ALLOWED_BRANCH,
      currentBranch: current,
      isOnAllowedBranch: current === ALLOWED_BRANCH,
      ahead: parseInt(ahead),
      behind: parseInt(behind),
      remote: remote || null,
      lastFetch,
      repositoryPath: GIT_DIR,
    });
  } catch (error: any) {
    res.status(500).json({ error: 'CONFIG_FAILED', message: error.message });
  }
});

export { router as gitRouter };
