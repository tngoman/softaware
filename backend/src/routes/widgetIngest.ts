import express from 'express';
import multer from 'multer';
import { documentService } from '../services/documentService.js';
import { crawlerService } from '../services/crawlerService.js';
import { widgetService } from '../services/widgetService.js';
// @ts-ignore - pdf-parse has module resolution issues with ESM
// import pdfParse from 'pdf-parse/lib/pdf-parse.js';
// Temporarily disabled - use mammoth or other PDF library

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, TXT, DOC, DOCX allowed'));
    }
  }
});

/**
 * POST /api/v1/ingest/url
 * 
 * Add a URL to crawl queue
 * Body: { clientId, url }
 */
router.post('/url', async (req, res) => {
  try {
    const { clientId, url } = req.body;

    if (!clientId || !url) {
      return res.status(400).json({ error: 'clientId and url are required' });
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL format' });
    }

    // Get client and check page limit
    const client = await widgetService.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Widget client not found' });
    }

    if (client.pages_ingested >= 50) {
      return res.status(429).json({
        error: 'Page limit reached',
        limit: 50,
        current: client.pages_ingested
      });
    }

    // Enqueue crawl job
    const job = await crawlerService.enqueueCrawl(clientId, url);

    // Process immediately
    const result = await documentService.crawlWebsite(clientId, url);

    if (result.success) {
      await crawlerService.markCompleted(job.id);
    } else {
      await crawlerService.markFailed(job.id, result.error || 'Unknown error');
    }

    return res.json({
      success: result.success,
      jobId: job.id,
      chunksCreated: result.chunksCreated,
      error: result.error
    });

  } catch (error) {
    console.error('URL ingestion error:', error);
    return res.status(500).json({
      error: 'Failed to ingest URL',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * POST /api/v1/ingest/file
 * 
 * Upload and ingest a file (PDF, TXT, DOC)
 * Multipart form data: clientId, file
 */
router.post('/file', upload.single('file'), async (req, res) => {
  try {
    const { clientId } = req.body;
    const file = req.file;

    if (!clientId || !file) {
      return res.status(400).json({ error: 'clientId and file are required' });
    }

    // Get client and check page limit
    const client = await widgetService.getClientById(clientId);
    if (!client) {
      return res.status(404).json({ error: 'Widget client not found' });
    }

    if (client.pages_ingested >= 50) {
      return res.status(429).json({
        error: 'Page limit reached',
        limit: 50,
        current: client.pages_ingested
      });
    }

    let content = '';
    let sourceType: 'pdf' | 'txt' | 'doc' = 'txt';

    // Extract text based on file type
    if (file.mimetype === 'application/pdf') {
      // PDF support temporarily disabled due to module resolution issues
      return res.status(400).json({ error: 'PDF support temporarily disabled. Please use plain text files.' });
      // const pdfData = await pdfParse(file.buffer);
      // content = pdfData.text;
      // sourceType = 'pdf';
    } else if (file.mimetype === 'text/plain') {
      content = file.buffer.toString('utf-8');
      sourceType = 'txt';
    } else {
      // For DOC/DOCX, we'd need additional libraries like mammoth
      // For now, return error
      return res.status(400).json({ error: 'DOC/DOCX support coming soon' });
    }

    if (content.length < 100) {
      return res.status(400).json({ error: 'File content too short or unreadable' });
    }

    // Store file content
    const result = await documentService.storeFileContent({
      clientId,
      content,
      filename: file.originalname,
      sourceType
    });

    return res.json({
      success: result.success,
      chunksCreated: result.chunksCreated,
      filename: file.originalname,
      error: result.error
    });

  } catch (error) {
    console.error('File upload error:', error);
    return res.status(500).json({
      error: 'Failed to process file',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

/**
 * GET /api/v1/ingest/sources/:clientId
 * 
 * Get all ingested sources for a client
 */
router.get('/sources/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    const sources = await documentService.getDocumentSources(clientId);

    return res.json({
      success: true,
      sources
    });

  } catch (error) {
    console.error('Get sources error:', error);
    return res.status(500).json({
      error: 'Failed to fetch sources'
    });
  }
});

/**
 * DELETE /api/v1/ingest/source
 * 
 * Delete a specific source
 * Body: { clientId, sourceUrl }
 */
router.delete('/source', async (req, res) => {
  try {
    const { clientId, sourceUrl } = req.body;

    if (!clientId || !sourceUrl) {
      return res.status(400).json({ error: 'clientId and sourceUrl are required' });
    }

    await documentService.deleteDocumentsBySource(clientId, sourceUrl);

    return res.json({
      success: true,
      message: 'Source deleted successfully'
    });

  } catch (error) {
    console.error('Delete source error:', error);
    return res.status(500).json({
      error: 'Failed to delete source'
    });
  }
});

/**
 * DELETE /api/v1/ingest/all/:clientId
 * 
 * Delete all ingested documents for a client
 */
router.delete('/all/:clientId', async (req, res) => {
  try {
    const { clientId } = req.params;

    await documentService.deleteClientDocuments(clientId);

    return res.json({
      success: true,
      message: 'All documents deleted successfully'
    });

  } catch (error) {
    console.error('Delete all documents error:', error);
    return res.status(500).json({
      error: 'Failed to delete documents'
    });
  }
});

export default router;
