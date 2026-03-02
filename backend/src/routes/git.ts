import { Router, Request, Response } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import { requireApiKey } from '../middleware/apiKey.js';

const router = Router();
const execAsync = promisify(exec);

// Git repository location
const GIT_DIR = '/var/www/code/silulumanzi';

// Execute timeout (10 seconds)
const EXEC_TIMEOUT = 10000;

// API key middleware
router.use(requireApiKey);

/**
 * Execute git command safely
 */
async function execGit(command: string): Promise<string> {
  try {
    const { stdout } = await execAsync(command, {
      cwd: GIT_DIR,
      timeout: EXEC_TIMEOUT,
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
 * Switch to a different branch
 * Body: { branch: string, create?: boolean }
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

    // Check for uncommitted changes
    const statusOutput = await execGit('git status --porcelain');
    if (statusOutput) {
      return res.status(400).json({
        success: false,
        error: 'UNCOMMITTED_CHANGES',
        message: 'Repository has uncommitted changes. Stash or commit them first.'
      });
    }

    const create = req.body?.create === true;
    const command = create ? `git checkout -b ${branch}` : `git checkout ${branch}`;

    await execGit(command);

    const newBranch = await execGit('git rev-parse --abbrev-ref HEAD');

    res.json({
      success: true,
      branch: newBranch,
      created: create,
      message: create ? `Created and switched to branch '${branch}'` : `Switched to branch '${branch}'`
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
 * POST /api/code/git/pull
 * Pull latest changes from remote repository
 */
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

router.post('/pull', async (req: Request, res: Response) => {
  try {
    // Check for uncommitted changes first
    const statusOutput = await execGit('git status --porcelain');
    if (statusOutput) {
      return res.status(400).json({
        success: false,
        error: 'UNCOMMITTED_CHANGES',
        message: 'Repository has uncommitted changes. Cannot pull.'
      });
    }

    // Get remote and branch (default to origin/main)
    const remote = req.body?.remote || 'origin';
    const branch = req.body?.branch || 'main';

    // Execute git pull with 30s timeout
    const { stdout } = await execAsync(`git pull ${remote} ${branch}`, {
      cwd: GIT_DIR,
      timeout: 30000,
      maxBuffer: 1024 * 1024 * 10
    });

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

    res.status(500).json({
      success: false,
      error: 'PULL_FAILED',
      message: error.message,
      stderr: error.stderr || ''
    });
  }
});

export { router as gitRouter };
