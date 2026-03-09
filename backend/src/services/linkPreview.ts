/**
 * Link Preview Service
 *
 * Fetches Open Graph / meta tags from URLs found in message content.
 * Returns a structured preview object that gets stored as JSON on the message.
 *
 * Cache: In-memory LRU (keeps last 500 URLs for 1 hour).
 */
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  domain: string;
  favicon: string | null;
}

// ── Simple LRU cache ────────────────────────────────────

interface CacheEntry {
  data: LinkPreview;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const MAX_CACHE = 500;
const CACHE_TTL = 60 * 60 * 1000; // 1 hour

function getFromCache(url: string): LinkPreview | null {
  const entry = cache.get(url);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    cache.delete(url);
    return null;
  }
  return entry.data;
}

function setCache(url: string, data: LinkPreview): void {
  if (cache.size >= MAX_CACHE) {
    // Evict oldest entry
    const firstKey = cache.keys().next().value;
    if (firstKey) cache.delete(firstKey);
  }
  cache.set(url, { data, expiresAt: Date.now() + CACHE_TTL });
}

// ── URL extraction ──────────────────────────────────────

const URL_REGEX = /https?:\/\/[^\s<>"')\]]+/gi;

/**
 * Extract the first URL from a text string.
 * Returns null if no URL found.
 */
export function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match ? match[0] : null;
}

/**
 * Extract all URLs from a text string.
 */
export function extractAllUrls(text: string): string[] {
  return text.match(URL_REGEX) || [];
}

// ── Fetch preview ───────────────────────────────────────

/**
 * Fetch Open Graph / meta data for a URL.
 * Returns null if the URL can't be fetched or parsed.
 *
 * Timeout: 5 seconds. Only processes HTML responses.
 */
export async function fetchLinkPreview(url: string): Promise<LinkPreview | null> {
  // Check cache first
  const cached = getFromCache(url);
  if (cached) return cached;

  try {
    // Parse domain for display
    const parsed = new URL(url);
    const domain = parsed.hostname.replace(/^www\./, '');

    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 3,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SoftAwareBot/1.0; +https://softaware.net.za)',
        'Accept': 'text/html,application/xhtml+xml',
      },
      // Only read first 500KB to avoid downloading large files
      maxContentLength: 500 * 1024,
      responseType: 'text',
      validateStatus: (s) => s >= 200 && s < 400,
    });

    const contentType = response.headers['content-type'] || '';
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return null;
    }

    const $ = cheerio.load(response.data);

    // Open Graph tags take priority
    const ogTitle = $('meta[property="og:title"]').attr('content');
    const ogDesc = $('meta[property="og:description"]').attr('content');
    const ogImage = $('meta[property="og:image"]').attr('content');

    // Twitter card fallback
    const twTitle = $('meta[name="twitter:title"]').attr('content');
    const twDesc = $('meta[name="twitter:description"]').attr('content');
    const twImage = $('meta[name="twitter:image"]').attr('content');

    // Standard HTML fallbacks
    const htmlTitle = $('title').first().text().trim();
    const metaDesc = $('meta[name="description"]').attr('content');

    // Favicon
    const faviconLink =
      $('link[rel="icon"]').attr('href') ||
      $('link[rel="shortcut icon"]').attr('href') ||
      `${parsed.protocol}//${parsed.host}/favicon.ico`;

    const title = ogTitle || twTitle || htmlTitle || null;
    const description = ogDesc || twDesc || metaDesc || null;
    let image = ogImage || twImage || null;

    // Resolve relative URLs
    if (image && !image.startsWith('http')) {
      image = new URL(image, url).href;
    }

    // Skip if we got nothing useful
    if (!title && !description && !image) {
      return null;
    }

    const preview: LinkPreview = {
      url,
      title: title ? title.substring(0, 300) : null,
      description: description ? description.substring(0, 500) : null,
      image,
      domain,
      favicon: faviconLink && !faviconLink.startsWith('http')
        ? new URL(faviconLink, url).href
        : faviconLink,
    };

    setCache(url, preview);
    return preview;
  } catch {
    // Network error, timeout, non-HTML, etc. — silently return null
    return null;
  }
}

/**
 * Extract the first URL from message content and fetch its preview.
 * Returns null if no URL or preview can't be generated.
 */
export async function getLinkPreviewForContent(content: string): Promise<LinkPreview | null> {
  const url = extractFirstUrl(content);
  if (!url) return null;
  return fetchLinkPreview(url);
}
