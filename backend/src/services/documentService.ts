import { randomUUID } from 'crypto';
import { db, toMySQLDate } from '../db/mysql.js';
import axios from 'axios';
import * as cheerio from 'cheerio';
import { embeddingService, generateEmbedding } from './embeddingService.js';

export interface DocumentMetadata {
  id: string;
  client_id: string;
  content: string;
  source_url: string | null;
  source_type: 'website' | 'pdf' | 'txt' | 'doc';
  chunk_index: number;
  char_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * Chunk text into smaller semantic blocks
 */
function chunkText(text: string, maxChunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < text.length) {
    const end = start + maxChunkSize;
    let chunk = text.slice(start, end);

    // Try to end on a sentence boundary
    if (end < text.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastQuestion = chunk.lastIndexOf('?');
      const lastExclamation = chunk.lastIndexOf('!');
      const lastBoundary = Math.max(lastPeriod, lastQuestion, lastExclamation);

      if (lastBoundary > maxChunkSize * 0.7) {
        chunk = chunk.slice(0, lastBoundary + 1);
      }
    }

    chunks.push(chunk.trim());
    start += chunk.length - overlap;
  }

  return chunks.filter(chunk => chunk.length > 50); // Filter out tiny chunks
}

/**
 * Extract clean text from HTML
 */
function extractTextFromHTML(html: string, url: string): string {
  const $ = cheerio.load(html);

  // Remove unwanted elements
  $('script, style, nav, header, footer, iframe, noscript, [role="navigation"], .nav, .menu, .sidebar, .advertisement, .cookie-notice').remove();

  // Extract main content
  let text = '';

  // Try to find main content area
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '.main-content', '#content'];
  for (const selector of mainSelectors) {
    const mainContent = $(selector);
    if (mainContent.length > 0) {
      text = mainContent.text();
      break;
    }
  }

  // Fallback to body if no main content found
  if (!text) {
    text = $('body').text();
  }

  // Clean up whitespace
  text = text
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  return text;
}

export const documentService = {
  /**
   * Store a document chunk
   */
  async storeChunk(params: {
    clientId: string;
    content: string;
    sourceUrl?: string;
    sourceType: 'website' | 'pdf' | 'txt' | 'doc';
    chunkIndex: number;
  }): Promise<DocumentMetadata> {
    const id = randomUUID();
    const now = toMySQLDate(new Date());
    const charCount = params.content.length;

    await db.execute(
      `INSERT INTO document_metadata (
        id, client_id, content, source_url, source_type, chunk_index, char_count, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id,
        params.clientId,
        params.content,
        params.sourceUrl || null,
        params.sourceType,
        params.chunkIndex,
        charCount,
        now,
        now
      ]
    );

    // Generate and store embedding
    await embeddingService.embedDocument(id, params.content);

    return {
      id,
      client_id: params.clientId,
      content: params.content,
      source_url: params.sourceUrl || null,
      source_type: params.sourceType,
      chunk_index: params.chunkIndex,
      char_count: charCount,
      created_at: now,
      updated_at: now
    };
  },

  /**
   * Crawl a website URL and store chunks
   */
  async crawlWebsite(clientId: string, url: string): Promise<{
    success: boolean;
    chunksCreated: number;
    error?: string;
  }> {
    try {
      // Fetch HTML
      const response = await axios.get(url, {
        timeout: 30000,
        headers: {
          'User-Agent': 'SoftAware-Bot/1.0'
        }
      });

      if (response.status !== 200) {
        throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
      }

      // Extract text
      const text = extractTextFromHTML(response.data, url);

      if (text.length < 100) {
        throw new Error('Insufficient content extracted from page');
      }

      // Chunk text
      const chunks = chunkText(text);

      // Store chunks
      for (let i = 0; i < chunks.length; i++) {
        await this.storeChunk({
          clientId,
          content: chunks[i],
          sourceUrl: url,
          sourceType: 'website',
          chunkIndex: i
        });
      }

      // Update pages_ingested count
      await db.execute(
        'UPDATE widget_clients SET pages_ingested = pages_ingested + 1 WHERE id = ?',
        [clientId]
      );

      return {
        success: true,
        chunksCreated: chunks.length
      };
    } catch (error) {
      console.error('Website crawl failed:', error);
      return {
        success: false,
        chunksCreated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Store uploaded file content
   */
  async storeFileContent(params: {
    clientId: string;
    content: string;
    filename: string;
    sourceType: 'pdf' | 'txt' | 'doc';
  }): Promise<{
    success: boolean;
    chunksCreated: number;
    error?: string;
  }> {
    try {
      // Chunk content
      const chunks = chunkText(params.content);

      // Store chunks
      for (let i = 0; i < chunks.length; i++) {
        await this.storeChunk({
          clientId: params.clientId,
          content: chunks[i],
          sourceUrl: params.filename,
          sourceType: params.sourceType,
          chunkIndex: i
        });
      }

      // Update pages_ingested count (count 1 file as 1 page)
      await db.execute(
        'UPDATE widget_clients SET pages_ingested = pages_ingested + 1 WHERE id = ?',
        [params.clientId]
      );

      return {
        success: true,
        chunksCreated: chunks.length
      };
    } catch (error) {
      console.error('File storage failed:', error);
      return {
        success: false,
        chunksCreated: 0,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  },

  /**
   * Get all documents for a client
   */
  async getClientDocuments(clientId: string): Promise<DocumentMetadata[]> {
    return db.query<DocumentMetadata>(
      'SELECT * FROM document_metadata WHERE client_id = ? ORDER BY source_url, chunk_index',
      [clientId]
    );
  },

  /**
   * Get document sources (grouped by URL/filename)
   */
  async getDocumentSources(clientId: string): Promise<Array<{
    sourceUrl: string;
    sourceType: string;
    chunkCount: number;
    totalChars: number;
  }>> {
    return db.query(
      `SELECT 
        source_url as sourceUrl,
        source_type as sourceType,
        COUNT(*) as chunkCount,
        SUM(char_count) as totalChars
       FROM document_metadata
       WHERE client_id = ?
       GROUP BY source_url, source_type
       ORDER BY MAX(created_at) DESC`,
      [clientId]
    );
  },

  /**
   * Delete all documents for a client
   */
  async deleteClientDocuments(clientId: string): Promise<void> {
    await db.execute(
      'DELETE FROM document_metadata WHERE client_id = ?',
      [clientId]
    );

    // Reset pages_ingested count
    await db.execute(
      'UPDATE widget_clients SET pages_ingested = 0 WHERE id = ?',
      [clientId]
    );
  },

  /**
   * Delete documents by source
   */
  async deleteDocumentsBySource(clientId: string, sourceUrl: string): Promise<void> {
    // Get count first
    const countResult = await db.queryOne<{ count: number }>(
      'SELECT COUNT(DISTINCT source_url) as count FROM document_metadata WHERE client_id = ? AND source_url = ?',
      [clientId, sourceUrl]
    );

    // Delete documents
    await db.execute(
      'DELETE FROM document_metadata WHERE client_id = ? AND source_url = ?',
      [clientId, sourceUrl]
    );

    // Decrement pages_ingested
    if (countResult && countResult.count > 0) {
      await db.execute(
        'UPDATE widget_clients SET pages_ingested = GREATEST(pages_ingested - 1, 0) WHERE id = ?',
        [clientId]
      );
    }
  }
};
