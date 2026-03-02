import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { db } from '../db/mysql.js';
import { sendEmail } from './emailService.js';
import { env } from '../config/env.js';

// Decimal type for backward compatibility (MCP code uses this)
type Decimal = number | string;

/**
 * SoftAware MCP Server
 * 
 * NOTE: This MCP server uses legacy Prisma patterns that need migration.
 * Many functions will throw errors until fully migrated to mysql.ts.
 * 
 * Forex Risk Manager:
 * - Fetch live ZAR exchange rates from ExchangeRate-API
 * - Calculate inventory costs in ZAR
 * - Flag price warnings when Rand weakens past thresholds
 * - Send email alerts to management
 * 
 * Market Sentiment & News:
 * - Fetch SA business news from NewsAPI
 * - Filter by keywords of interest
 * - Generate morning briefings
 * - Email summaries to executive team
 * 
 * Fleet Tracking & Risk (Traccar):
 * - Track vehicle locations in real-time
 * - Cross-reference with news for risk assessment
 * - Calculate cargo value at risk using forex rates
 * - Proactive alerting for high-risk situations
 */

const server = new McpServer({
  name: 'softaware-mcp',
  version: '1.0.0',
});

// ------------------------------------------------------------------
// ExchangeRate-API Integration
// ------------------------------------------------------------------
interface ExchangeRates {
  base: string;
  rates: Record<string, number>;
  lastUpdated: string;
}

async function fetchExchangeRates(base: string = 'USD'): Promise<ExchangeRates> {
  const apiKey = env.EXCHANGE_RATE_API_KEY || env.FOREX;
  
  // If no API key, use mock rates for demo
  if (!apiKey) {
    console.log('[Forex] No API key configured, using mock rates');
    return getMockRates(base);
  }

  try {
    const url = `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${base}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`ExchangeRate-API returned ${response.status}`);
    }
    
    const data = await response.json();
    
    return {
      base: data.base_code,
      rates: data.conversion_rates,
      lastUpdated: data.time_last_update_utc,
    };
  } catch (err) {
    console.error('[Forex] API fetch failed, using mock rates:', err);
    return getMockRates(base);
  }
}

function getMockRates(base: string): ExchangeRates {
  // Realistic mock rates as of late 2025 (ZAR has weakened)
  const mockRates: Record<string, Record<string, number>> = {
    USD: { ZAR: 19.85, EUR: 0.92, GBP: 0.79, USD: 1 },
    EUR: { ZAR: 21.58, USD: 1.09, GBP: 0.86, EUR: 1 },
    GBP: { ZAR: 25.12, USD: 1.27, EUR: 1.16, GBP: 1 },
  };

  return {
    base,
    rates: mockRates[base] || mockRates['USD'],
    lastUpdated: new Date().toISOString(),
  };
}

function getThreshold(currency: string): number {
  switch (currency) {
    case 'USD': return env.ZAR_THRESHOLD_USD;
    case 'EUR': return env.ZAR_THRESHOLD_EUR;
    case 'GBP': return env.ZAR_THRESHOLD_GBP;
    default: return env.ZAR_THRESHOLD_USD;
  }
}

// ------------------------------------------------------------------
// Tool: get_exchange_rates
// Fetches latest ZAR exchange rates
// ------------------------------------------------------------------
server.tool(
  'get_exchange_rates',
  'Fetch the latest South African Rand (ZAR) exchange rates from ExchangeRate-API',
  {
    base: z.enum(['USD', 'EUR', 'GBP']).default('USD').describe('Base currency to get ZAR rate for'),
  },
  async ({ base }) => {
    console.log(`[MCP] get_exchange_rates called for: ${base}`);

    const rates = await fetchExchangeRates(base);
    const zarRate = rates.rates['ZAR'] || 0;
    const threshold = getThreshold(base);
    const isAboveThreshold = zarRate > threshold;

    return {
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({
            base,
            zarRate,
            threshold,
            isAboveThreshold,
            warning: isAboveThreshold 
              ? `⚠️ ZAR has weakened past R${threshold}/${base}. Current rate: R${zarRate.toFixed(2)}/${base}`
              : null,
            lastUpdated: rates.lastUpdated,
            allRates: rates.rates,
          }),
        },
      ],
    };
  }
);

// ------------------------------------------------------------------
// Tool: list_products
// Lists product inventory with foreign prices
// ------------------------------------------------------------------
server.tool(
  'list_products',
  'List all products in the inventory with their foreign currency prices',
  {
    currency: z.enum(['USD', 'EUR', 'GBP']).optional().describe('Filter by currency'),
    warningsOnly: z.boolean().default(false).describe('Only show products with price warnings'),
  },
  async ({ currency, warningsOnly }) => {
    console.log(`[MCP] list_products called: currency=${currency}, warningsOnly=${warningsOnly}`);

    try {
      const products = await prisma.product.findMany({
        where: {
          ...(currency ? { currency } : {}),
          ...(warningsOnly ? { priceWarning: true } : {}),
        },
        orderBy: { name: 'asc' },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: products.length,
              products: products.map((p) => ({
                id: p.id,
                sku: p.sku,
                name: p.name,
                priceForeign: Number(p.priceForeign),
                currency: p.currency,
                priceZar: p.priceZar ? Number(p.priceZar) : null,
                priceWarning: p.priceWarning,
                lastRateUsed: p.lastRateUsed ? Number(p.lastRateUsed) : null,
              })),
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: calculate_zar_costs
// Calculates ZAR costs for all products using live rates
// ------------------------------------------------------------------
server.tool(
  'calculate_zar_costs',
  'Calculate the current Rand (ZAR) cost for all products using live exchange rates. Updates the database with new ZAR prices.',
  {
    updateDatabase: z.boolean().default(true).describe('Update product ZAR prices in the database'),
  },
  async ({ updateDatabase }) => {
    console.log(`[MCP] calculate_zar_costs called: updateDatabase=${updateDatabase}`);

    try {
      // Fetch rates for all currencies
      const [usdRates, eurRates, gbpRates] = await Promise.all([
        fetchExchangeRates('USD'),
        fetchExchangeRates('EUR'),
        fetchExchangeRates('GBP'),
      ]);

      const zarRates: Record<string, number> = {
        USD: usdRates.rates['ZAR'] || 19.50,
        EUR: eurRates.rates['ZAR'] || 21.00,
        GBP: gbpRates.rates['ZAR'] || 24.50,
      };

      const products = await prisma.product.findMany();
      const calculations = [];

      for (const product of products) {
        const rate = zarRates[product.currency] || zarRates['USD'];
        const zarPrice = Number(product.priceForeign) * rate;
        const threshold = getThreshold(product.currency);
        const isAboveThreshold = rate > threshold;

        if (updateDatabase) {
          await prisma.product.update({
            where: { id: product.id },
            data: {
              priceZar: new Decimal(zarPrice.toFixed(2)),
              lastRateUsed: new Decimal(rate.toFixed(4)),
              priceWarning: isAboveThreshold,
            },
          });
        }

        calculations.push({
          sku: product.sku,
          name: product.name,
          priceForeign: Number(product.priceForeign),
          currency: product.currency,
          rate,
          priceZar: Math.round(zarPrice * 100) / 100,
          threshold,
          priceWarning: isAboveThreshold,
        });
      }

      const warningCount = calculations.filter((c) => c.priceWarning).length;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              totalProducts: calculations.length,
              productsWithWarnings: warningCount,
              rates: zarRates,
              thresholds: {
                USD: env.ZAR_THRESHOLD_USD,
                EUR: env.ZAR_THRESHOLD_EUR,
                GBP: env.ZAR_THRESHOLD_GBP,
              },
              calculations,
              summary: warningCount > 0
                ? `⚠️ ${warningCount} product(s) flagged for price review due to Rand weakness.`
                : '✅ All products within acceptable exchange rate thresholds.',
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Calculation error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: check_price_thresholds
// Checks all products and flags warnings
// ------------------------------------------------------------------
server.tool(
  'check_price_thresholds',
  'Check if any products need price warnings based on current exchange rates. Returns products that exceed thresholds.',
  {},
  async () => {
    console.log('[MCP] check_price_thresholds called');

    try {
      // Fetch current rates
      const usdRates = await fetchExchangeRates('USD');
      const eurRates = await fetchExchangeRates('EUR');
      const gbpRates = await fetchExchangeRates('GBP');

      const zarRates: Record<string, number> = {
        USD: usdRates.rates['ZAR'] || 19.50,
        EUR: eurRates.rates['ZAR'] || 21.00,
        GBP: gbpRates.rates['ZAR'] || 24.50,
      };

      const thresholdBreaches = [];
      
      for (const [currency, rate] of Object.entries(zarRates)) {
        const threshold = getThreshold(currency);
        if (rate > threshold) {
          thresholdBreaches.push({
            currency,
            currentRate: rate,
            threshold,
            percentOver: ((rate - threshold) / threshold * 100).toFixed(2) + '%',
          });
        }
      }

      // Get products with warnings
      const flaggedProducts = await prisma.product.findMany({
        where: { priceWarning: true },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              currentRates: zarRates,
              thresholds: {
                USD: env.ZAR_THRESHOLD_USD,
                EUR: env.ZAR_THRESHOLD_EUR,
                GBP: env.ZAR_THRESHOLD_GBP,
              },
              thresholdBreaches,
              flaggedProductCount: flaggedProducts.length,
              flaggedProducts: flaggedProducts.map((p) => ({
                sku: p.sku,
                name: p.name,
                priceForeign: Number(p.priceForeign),
                currency: p.currency,
                priceZar: p.priceZar ? Number(p.priceZar) : null,
              })),
              recommendation: thresholdBreaches.length > 0
                ? '⚠️ RECOMMEND: Review pricing for affected products and consider sending alert to management.'
                : '✅ All exchange rates within acceptable thresholds.',
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Check failed';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: send_price_alert
// Sends email alert to management about price warnings
// ------------------------------------------------------------------
server.tool(
  'send_price_alert',
  'Send an email alert to management about products needing price review due to Rand weakness',
  {
    recipientEmail: z.string().email().optional().describe('Recipient email (defaults to ALERT_EMAIL env var)'),
    includeProducts: z.boolean().default(true).describe('Include list of flagged products in email'),
  },
  async ({ recipientEmail, includeProducts }) => {
    console.log('[MCP] send_price_alert called');

    const email = recipientEmail || env.ALERT_EMAIL;
    if (!email) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'No recipient email provided. Set ALERT_EMAIL in environment or provide recipientEmail.',
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      // Get current rates and flagged products
      const usdRates = await fetchExchangeRates('USD');
      const eurRates = await fetchExchangeRates('EUR');
      const gbpRates = await fetchExchangeRates('GBP');

      const zarRates: Record<string, number> = {
        USD: usdRates.rates['ZAR'] || 19.50,
        EUR: eurRates.rates['ZAR'] || 21.00,
        GBP: gbpRates.rates['ZAR'] || 24.50,
      };

      const flaggedProducts = await prisma.product.findMany({
        where: { priceWarning: true },
      });

      // Build email content
      let productList = '';
      if (includeProducts && flaggedProducts.length > 0) {
        productList = '\n\nAffected Products:\n' + flaggedProducts
          .map((p) => `  • ${p.sku} - ${p.name}: ${p.currency} ${Number(p.priceForeign).toFixed(2)} → R${p.priceZar ? Number(p.priceZar).toFixed(2) : 'N/A'}`)
          .join('\n');
      }

      const emailBody = `
FOREX PRICE ALERT - Action Required

The South African Rand has weakened past our configured thresholds. Please review the following products for potential price adjustments.

Current Exchange Rates:
  • USD/ZAR: R${zarRates['USD'].toFixed(2)} (threshold: R${env.ZAR_THRESHOLD_USD.toFixed(2)})
  • EUR/ZAR: R${zarRates['EUR'].toFixed(2)} (threshold: R${env.ZAR_THRESHOLD_EUR.toFixed(2)})
  • GBP/ZAR: R${zarRates['GBP'].toFixed(2)} (threshold: R${env.ZAR_THRESHOLD_GBP.toFixed(2)})

Products Flagged: ${flaggedProducts.length}
${productList}

Recommended Action:
Consider adjusting retail prices to maintain profit margins or negotiate with suppliers for better foreign currency rates.

---
This alert was generated by SoftAware Forex Risk Manager
      `.trim();

      const result = await sendEmail({
        to: email,
        subject: `⚠️ Forex Alert: ${flaggedProducts.length} Products Need Price Review`,
        text: emailBody,
      });

      // Log the alert
      if (result.success) {
        await prisma.forexAlert.create({
          data: {
            currency: 'USD',
            rate: new Decimal(zarRates['USD'].toFixed(4)),
            threshold: new Decimal(env.ZAR_THRESHOLD_USD.toFixed(4)),
            alertType: 'THRESHOLD_EXCEEDED',
            emailSent: true,
          },
        });
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: result.success,
              sentTo: email,
              flaggedProductCount: flaggedProducts.length,
              messageId: result.messageId,
              error: result.error,
            }),
          },
        ],
        isError: !result.success,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Email error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: add_product
// Adds a new product to inventory
// ------------------------------------------------------------------
server.tool(
  'add_product',
  'Add a new product to the inventory with a foreign currency price',
  {
    sku: z.string().describe('Product SKU (unique identifier)'),
    name: z.string().describe('Product name'),
    description: z.string().optional().describe('Product description'),
    price: z.number().positive().describe('Price in foreign currency'),
    currency: z.enum(['USD', 'EUR', 'GBP']).default('USD').describe('Currency of the price'),
  },
  async ({ sku, name, description, price, currency }) => {
    console.log(`[MCP] add_product called: sku=${sku}, price=${price} ${currency}`);

    try {
      // Check if SKU already exists
      const existing = await prisma.product.findUnique({ where: { sku } });
      if (existing) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Product with SKU "${sku}" already exists.`,
                existingProduct: {
                  id: existing.id,
                  name: existing.name,
                },
              }),
            },
          ],
        };
      }

      const product = await prisma.product.create({
        data: {
          sku,
          name,
          description,
          priceForeign: new Decimal(price.toFixed(2)),
          currency,
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              product: {
                id: product.id,
                sku: product.sku,
                name: product.name,
                priceForeign: Number(product.priceForeign),
                currency: product.currency,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: clear_price_warnings
// Clears all price warnings (after prices have been adjusted)
// ------------------------------------------------------------------
server.tool(
  'clear_price_warnings',
  'Clear all price warning flags (use after prices have been reviewed and adjusted)',
  {},
  async () => {
    console.log('[MCP] clear_price_warnings called');

    try {
      const result = await prisma.product.updateMany({
        where: { priceWarning: true },
        data: { priceWarning: false },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              clearedCount: result.count,
              message: `Cleared price warnings for ${result.count} product(s).`,
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ==================================================================
// MARKET SENTIMENT & NEWS (NewsAPI)
// ==================================================================

interface NewsArticle {
  title: string;
  description: string | null;
  source: { name: string };
  url: string;
  publishedAt: string;
}

interface NewsApiResponse {
  status: string;
  totalResults: number;
  articles: NewsArticle[];
}

interface GNewsResponse {
  totalArticles: number;
  articles: Array<{
    title: string;
    description: string;
    content: string;
    url: string;
    image: string;
    publishedAt: string;
    source: { name: string; url: string };
  }>;
}

async function fetchFromGNews(): Promise<NewsArticle[]> {
  const apiKey = env.GNEWS;
  
  if (!apiKey) {
    return [];
  }

  try {
    // GNews API - fetch SA business news
    const url = `https://gnews.io/api/v4/top-headlines?country=za&category=business&lang=en&apikey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`GNews returned ${response.status}`);
    }
    
    const data: GNewsResponse = await response.json();
    
    // Map GNews format to our NewsArticle format
    return (data.articles || []).map((a) => ({
      title: a.title,
      description: a.description,
      source: { name: a.source.name },
      url: a.url,
      publishedAt: a.publishedAt,
    }));
  } catch (err) {
    console.error('[News] GNews fetch failed:', err);
    return [];
  }
}

async function fetchFromNewsAPI(): Promise<NewsArticle[]> {
  const apiKey = env.NEWSAPI;
  
  if (!apiKey) {
    return [];
  }

  try {
    // Fetch SA business headlines
    const url = `https://newsapi.org/v2/top-headlines?country=za&category=business&apiKey=${apiKey}`;
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`NewsAPI returned ${response.status}`);
    }
    
    const data: NewsApiResponse = await response.json();
    return data.articles || [];
  } catch (err) {
    console.error('[News] NewsAPI fetch failed:', err);
    return [];
  }
}

async function fetchSABusinessNews(): Promise<NewsArticle[]> {
  // Try GNews first (more generous free tier), then NewsAPI, then mock
  let articles: NewsArticle[] = [];
  let source = 'mock';

  // Try GNews first
  if (env.GNEWS) {
    articles = await fetchFromGNews();
    if (articles.length > 0) {
      source = 'GNews';
      console.log(`[News] Fetched ${articles.length} articles from GNews`);
    }
  }

  // Fallback to NewsAPI if GNews returned nothing
  if (articles.length === 0 && env.NEWSAPI) {
    articles = await fetchFromNewsAPI();
    if (articles.length > 0) {
      source = 'NewsAPI';
      console.log(`[News] Fetched ${articles.length} articles from NewsAPI`);
    }
  }

  // Final fallback to mock data
  if (articles.length === 0) {
    console.log('[News] No API keys configured or APIs failed, using mock news');
    articles = getMockNews();
  }

  return articles;
}

function getMockNews(): NewsArticle[] {
  return [
    {
      title: 'SARB Holds Interest Rate Steady Amid Inflation Concerns',
      description: 'The South African Reserve Bank has decided to maintain the repo rate at 8.25% as inflation remains above target.',
      source: { name: 'Business Day' },
      url: 'https://example.com/sarb-rate',
      publishedAt: new Date().toISOString(),
    },
    {
      title: 'Mining Sector Reports Strong Q4 Results',
      description: 'Major mining companies in South Africa report better than expected quarterly results driven by commodity prices.',
      source: { name: 'Miningweekly' },
      url: 'https://example.com/mining-q4',
      publishedAt: new Date().toISOString(),
    },
    {
      title: 'Tech Startups Attract Record Investment in 2025',
      description: 'South African tech startups have raised over R5 billion in funding this year, a new record for the sector.',
      source: { name: 'TechCentral' },
      url: 'https://example.com/tech-investment',
      publishedAt: new Date().toISOString(),
    },
    {
      title: 'Rand Weakens Against Major Currencies',
      description: 'The South African Rand has weakened past R19.50 to the dollar amid global uncertainty.',
      source: { name: 'Reuters' },
      url: 'https://example.com/rand-weakness',
      publishedAt: new Date().toISOString(),
    },
    {
      title: 'Eskom Load Shedding Schedule Updated',
      description: 'Eskom announces new load shedding schedule as demand outpaces supply during summer months.',
      source: { name: 'News24' },
      url: 'https://example.com/eskom-update',
      publishedAt: new Date().toISOString(),
    },
  ];
}

// ------------------------------------------------------------------
// Tool: list_keywords
// Lists all keywords of interest
// ------------------------------------------------------------------
server.tool(
  'list_keywords',
  'List all keywords of interest used for filtering news articles',
  {
    activeOnly: z.boolean().default(true).describe('Only show active keywords'),
  },
  async ({ activeOnly }) => {
    console.log(`[MCP] list_keywords called: activeOnly=${activeOnly}`);

    try {
      const keywords = await prisma.keyword.findMany({
        where: activeOnly ? { isActive: true } : undefined,
        orderBy: { category: 'asc' },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: keywords.length,
              keywords: keywords.map((k) => ({
                id: k.id,
                term: k.term,
                category: k.category,
                isActive: k.isActive,
              })),
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: add_keyword
// Adds a new keyword of interest
// ------------------------------------------------------------------
server.tool(
  'add_keyword',
  'Add a new keyword of interest for news filtering',
  {
    term: z.string().describe('The keyword or phrase to track'),
    category: z.string().optional().describe('Category (e.g., Finance, Mining, Tech)'),
  },
  async ({ term, category }) => {
    console.log(`[MCP] add_keyword called: term="${term}", category="${category}"`);

    try {
      const existing = await prisma.keyword.findUnique({ where: { term } });
      if (existing) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Keyword "${term}" already exists.`,
                existing: { id: existing.id, isActive: existing.isActive },
              }),
            },
          ],
        };
      }

      const keyword = await prisma.keyword.create({
        data: { term, category },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              keyword: {
                id: keyword.id,
                term: keyword.term,
                category: keyword.category,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: toggle_keyword
// Enables or disables a keyword
// ------------------------------------------------------------------
server.tool(
  'toggle_keyword',
  'Enable or disable a keyword for news filtering',
  {
    term: z.string().describe('The keyword to toggle'),
    isActive: z.boolean().describe('Whether the keyword should be active'),
  },
  async ({ term, isActive }) => {
    console.log(`[MCP] toggle_keyword called: term="${term}", isActive=${isActive}`);

    try {
      const keyword = await prisma.keyword.update({
        where: { term },
        data: { isActive },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              keyword: {
                term: keyword.term,
                isActive: keyword.isActive,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Keyword not found';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: fetch_sa_news
// Fetches SA business news and filters by keywords
// ------------------------------------------------------------------
server.tool(
  'fetch_sa_news',
  'Fetch South African business news headlines and filter by keywords of interest',
  {
    filterByKeywords: z.boolean().default(true).describe('Filter articles by stored keywords'),
  },
  async ({ filterByKeywords }) => {
    console.log(`[MCP] fetch_sa_news called: filterByKeywords=${filterByKeywords}`);

    try {
      const articles = await fetchSABusinessNews();
      
      let filteredArticles = articles;
      let matchedKeywords: string[] = [];

      if (filterByKeywords) {
        const keywords = await prisma.keyword.findMany({
          where: { isActive: true },
        });
        
        const keywordTerms = keywords.map((k) => k.term.toLowerCase());
        
        filteredArticles = articles.filter((article) => {
          const text = `${article.title} ${article.description || ''}`.toLowerCase();
          return keywordTerms.some((kw) => text.includes(kw));
        });

        // Track which keywords matched
        matchedKeywords = keywordTerms.filter((kw) =>
          articles.some((a) => 
            `${a.title} ${a.description || ''}`.toLowerCase().includes(kw)
          )
        );
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              totalFetched: articles.length,
              matchedCount: filteredArticles.length,
              matchedKeywords,
              articles: filteredArticles.map((a) => ({
                title: a.title,
                description: a.description,
                source: a.source.name,
                url: a.url,
                publishedAt: a.publishedAt,
              })),
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'News fetch error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: generate_morning_briefing
// Creates a summarized briefing from filtered news
// ------------------------------------------------------------------
server.tool(
  'generate_morning_briefing',
  'Generate a morning briefing summary from SA business news filtered by keywords. Saves to database.',
  {},
  async () => {
    console.log('[MCP] generate_morning_briefing called');

    try {
      const articles = await fetchSABusinessNews();
      const keywords = await prisma.keyword.findMany({
        where: { isActive: true },
      });
      
      const keywordTerms = keywords.map((k) => k.term.toLowerCase());
      
      // Filter articles by keywords
      const matchedArticles = articles.filter((article) => {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        return keywordTerms.some((kw) => text.includes(kw));
      });

      const matchedKeywords = keywordTerms.filter((kw) =>
        articles.some((a) => 
          `${a.title} ${a.description || ''}`.toLowerCase().includes(kw)
        )
      );

      // Generate briefing
      const today = new Date().toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      const title = `Morning Briefing - ${today}`;
      
      let summary = `📰 SA Business News Briefing\n`;
      summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
      summary += `Found ${matchedArticles.length} relevant articles matching your keywords.\n\n`;
      
      if (matchedKeywords.length > 0) {
        summary += `Keywords matched: ${matchedKeywords.join(', ')}\n\n`;
      }

      summary += `📋 HEADLINES:\n`;
      matchedArticles.forEach((article, i) => {
        summary += `\n${i + 1}. ${article.title}\n`;
        summary += `   Source: ${article.source.name}\n`;
        if (article.description) {
          summary += `   ${article.description.slice(0, 150)}...\n`;
        }
      });

      // Save briefing to database
      const briefing = await prisma.morningBriefing.create({
        data: {
          title,
          summary,
          articlesCount: matchedArticles.length,
          keywordsUsed: matchedKeywords,
          articles: matchedArticles.map((a) => ({
            title: a.title,
            source: a.source.name,
            url: a.url,
          })),
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              briefingId: briefing.id,
              title: briefing.title,
              articlesCount: matchedArticles.length,
              keywordsMatched: matchedKeywords,
              summary: briefing.summary,
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Briefing error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: send_morning_briefing
// Emails the morning briefing to executives
// ------------------------------------------------------------------
server.tool(
  'send_morning_briefing',
  'Generate and email a morning briefing to the executive team',
  {
    recipientEmail: z.string().email().optional().describe('Recipient email (defaults to BRIEFING_EMAIL env var)'),
  },
  async ({ recipientEmail }) => {
    console.log('[MCP] send_morning_briefing called');

    const email = recipientEmail || env.BRIEFING_EMAIL || env.ALERT_EMAIL;
    if (!email) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'No recipient email provided. Set BRIEFING_EMAIL in environment or provide recipientEmail.',
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      const articles = await fetchSABusinessNews();
      const keywords = await prisma.keyword.findMany({
        where: { isActive: true },
      });
      
      const keywordTerms = keywords.map((k) => k.term.toLowerCase());
      
      const matchedArticles = articles.filter((article) => {
        const text = `${article.title} ${article.description || ''}`.toLowerCase();
        return keywordTerms.some((kw) => text.includes(kw));
      });

      const matchedKeywords = keywordTerms.filter((kw) =>
        articles.some((a) => 
          `${a.title} ${a.description || ''}`.toLowerCase().includes(kw)
        )
      );

      const today = new Date().toLocaleDateString('en-ZA', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });

      let emailBody = `
MORNING BRIEFING - ${today}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Found ${matchedArticles.length} articles matching your tracked keywords.

TRACKED KEYWORDS: ${matchedKeywords.length > 0 ? matchedKeywords.join(', ') : 'None matched'}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
HEADLINES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      matchedArticles.forEach((article, i) => {
        emailBody += `
${i + 1}. ${article.title}
   Source: ${article.source.name}
   ${article.description || 'No description available.'}
   Read more: ${article.url}
`;
      });

      emailBody += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
This briefing was generated by SoftAware Market Sentinel
`;

      const result = await sendEmail({
        to: email,
        subject: `📰 Morning Briefing - ${matchedArticles.length} Relevant Articles`,
        text: emailBody.trim(),
      });

      // Save briefing to database with email sent flag
      const briefing = await prisma.morningBriefing.create({
        data: {
          title: `Morning Briefing - ${today}`,
          summary: emailBody,
          articlesCount: matchedArticles.length,
          keywordsUsed: matchedKeywords,
          articles: matchedArticles.map((a) => ({
            title: a.title,
            source: a.source.name,
            url: a.url,
          })),
          emailSent: result.success,
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: result.success,
              briefingId: briefing.id,
              sentTo: email,
              articlesCount: matchedArticles.length,
              keywordsMatched: matchedKeywords,
              messageId: result.messageId,
              error: result.error,
            }),
          },
        ],
        isError: !result.success,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Email error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: list_briefings
// Lists previous morning briefings
// ------------------------------------------------------------------
server.tool(
  'list_briefings',
  'List previous morning briefings from the database',
  {
    limit: z.number().default(5).describe('Maximum number of briefings to return'),
  },
  async ({ limit }) => {
    console.log(`[MCP] list_briefings called: limit=${limit}`);

    try {
      const briefings = await prisma.morningBriefing.findMany({
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          title: true,
          articlesCount: true,
          keywordsUsed: true,
          emailSent: true,
          createdAt: true,
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: briefings.length,
              briefings,
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ==================================================================
// FLEET TRACKING & RISK (Traccar)
// ==================================================================

interface TraccarPosition {
  id: number;
  deviceId: number;
  latitude: number;
  longitude: number;
  speed: number;
  course: number;
  address?: string;
  fixTime: string;
  serverTime: string;
  attributes: Record<string, unknown>;
}

interface TraccarDevice {
  id: number;
  name: string;
  uniqueId: string;
  status: string;
  lastUpdate: string;
  positionId: number;
  groupId: number | null;
  phone?: string;
  model?: string;
  contact?: string;
  category?: string;
  disabled: boolean;
  attributes: Record<string, unknown>;
}

function getTraccarAuth(): string {
  return Buffer.from(`${env.TRACCAR_EMAIL}:${env.TRACCAR_PASSWORD}`).toString('base64');
}

async function fetchTraccarPositions(): Promise<TraccarPosition[]> {
  if (!env.TRACCAR_EMAIL || !env.TRACCAR_PASSWORD) {
    console.log('[Fleet] No Traccar credentials, using mock positions');
    return getMockPositions();
  }

  try {
    const url = `${env.TRACCAR_HOST}/api/positions`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${getTraccarAuth()}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Traccar API returned ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[Fleet] Traccar fetch failed, using mock:', err);
    return getMockPositions();
  }
}

async function fetchTraccarDevices(): Promise<TraccarDevice[]> {
  if (!env.TRACCAR_EMAIL || !env.TRACCAR_PASSWORD) {
    console.log('[Fleet] No Traccar credentials, using mock devices');
    return getMockDevices();
  }

  try {
    const url = `${env.TRACCAR_HOST}/api/devices`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${getTraccarAuth()}`,
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Traccar API returned ${response.status}`);
    }

    return await response.json();
  } catch (err) {
    console.error('[Fleet] Traccar devices fetch failed, using mock:', err);
    return getMockDevices();
  }
}

async function reverseGeocode(lat: number, lon: number): Promise<string> {
  // Use Traccar's built-in geocoding or Nominatim
  try {
    // Try Traccar's geocoder first (uses same session)
    const traccarUrl = `${env.TRACCAR_HOST}/api/server/geocode?latitude=${lat}&longitude=${lon}`;
    const response = await fetch(traccarUrl, {
      headers: {
        'Authorization': `Basic ${getTraccarAuth()}`,
        'Accept': 'application/json',
      },
    });

    if (response.ok) {
      const address = await response.text();
      if (address && address.length > 0) {
        return address.replace(/"/g, '');
      }
    }
  } catch {
    // Fall through to Nominatim
  }

  // Fallback to Nominatim (OpenStreetMap)
  try {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=14`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'SoftAware-MCP/1.0',
      },
    });

    if (response.ok) {
      const data = await response.json();
      return data.display_name || `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
    }
  } catch {
    // Return coordinates as fallback
  }

  return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

function getMockPositions(): TraccarPosition[] {
  // Mock positions for SA routes
  return [
    {
      id: 1,
      deviceId: 101,
      latitude: -29.5914,
      longitude: 30.0109,
      speed: 85,
      course: 180,
      address: 'N3 Highway, Mooi River, KwaZulu-Natal',
      fixTime: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      attributes: { ignition: true, motion: true },
    },
    {
      id: 2,
      deviceId: 102,
      latitude: -26.2041,
      longitude: 28.0473,
      speed: 0,
      course: 0,
      address: 'City Deep, Johannesburg, Gauteng',
      fixTime: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      attributes: { ignition: false, motion: false },
    },
    {
      id: 3,
      deviceId: 103,
      latitude: -33.9249,
      longitude: 18.4241,
      speed: 45,
      course: 90,
      address: 'N1 Highway, Cape Town, Western Cape',
      fixTime: new Date().toISOString(),
      serverTime: new Date().toISOString(),
      attributes: { ignition: true, motion: true },
    },
  ];
}

function getMockDevices(): TraccarDevice[] {
  return [
    {
      id: 101,
      name: 'Truck-01 (Durban Depot)',
      uniqueId: 'TRK001',
      status: 'online',
      lastUpdate: new Date().toISOString(),
      positionId: 1,
      groupId: null,
      model: 'Mercedes Actros',
      category: 'truck',
      disabled: false,
      attributes: {},
    },
    {
      id: 102,
      name: 'Truck-02 (Johannesburg Depot)',
      uniqueId: 'TRK002',
      status: 'online',
      lastUpdate: new Date().toISOString(),
      positionId: 2,
      groupId: null,
      model: 'Scania R500',
      category: 'truck',
      disabled: false,
      attributes: {},
    },
    {
      id: 103,
      name: 'Truck-03 (Cape Town Depot)',
      uniqueId: 'TRK003',
      status: 'online',
      lastUpdate: new Date().toISOString(),
      positionId: 3,
      groupId: null,
      model: 'Volvo FH16',
      category: 'truck',
      disabled: false,
      attributes: {},
    },
  ];
}

// Check if news headlines mention risk keywords near a location
function checkNewsForLocationRisk(headlines: string[], location: string): { hasRisk: boolean; matchedHeadlines: string[] } {
  const riskKeywords = ['protest', 'burning', 'truck', 'hijack', 'accident', 'roadblock', 'traffic', 'strike', 'unrest', 'crime'];
  const locationParts = location.toLowerCase().split(/[,\s]+/);
  
  const matchedHeadlines: string[] = [];
  
  for (const headline of headlines) {
    const lowerHeadline = headline.toLowerCase();
    const hasRiskKeyword = riskKeywords.some((kw) => lowerHeadline.includes(kw));
    const matchesLocation = locationParts.some((part) => part.length > 3 && lowerHeadline.includes(part));
    
    if (hasRiskKeyword && matchesLocation) {
      matchedHeadlines.push(headline);
    }
  }
  
  return { hasRisk: matchedHeadlines.length > 0, matchedHeadlines };
}

// ------------------------------------------------------------------
// Tool: list_fleet
// Lists all fleet assets from database
// ------------------------------------------------------------------
server.tool(
  'list_fleet',
  'List all fleet assets (vehicles) registered in the system',
  {},
  async () => {
    console.log('[MCP] list_fleet called');

    try {
      const assets = await prisma.fleetAsset.findMany({
        orderBy: { vehicleName: 'asc' },
        include: {
          incidents: {
            where: { resolvedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: assets.length,
              assets: assets.map((a) => ({
                id: a.id,
                traccarId: a.traccarId,
                vehicleName: a.vehicleName,
                plateNumber: a.plateNumber,
                cargoValueUsd: a.cargoValueUsd ? Number(a.cargoValueUsd) : null,
                cargoDesc: a.cargoDesc,
                currentStatus: a.currentStatus,
                lastPosition: a.lastLatitude && a.lastLongitude ? {
                  lat: Number(a.lastLatitude),
                  lon: Number(a.lastLongitude),
                  speed: a.lastSpeed ? Number(a.lastSpeed) : 0,
                  address: a.lastAddress,
                } : null,
                activeIncident: a.incidents[0] ? {
                  alertLevel: a.incidents[0].alertLevel,
                  reason: a.incidents[0].riskReason,
                } : null,
              })),
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: register_vehicle
// Registers a new vehicle in the fleet
// ------------------------------------------------------------------
server.tool(
  'register_vehicle',
  'Register a new vehicle in the fleet tracking system',
  {
    traccarId: z.number().describe('The device ID from Traccar'),
    vehicleName: z.string().describe('Vehicle name/identifier'),
    plateNumber: z.string().optional().describe('Vehicle plate number'),
    cargoValueUsd: z.number().optional().describe('Value of cargo in USD'),
    cargoDesc: z.string().optional().describe('Description of cargo'),
  },
  async ({ traccarId, vehicleName, plateNumber, cargoValueUsd, cargoDesc }) => {
    console.log(`[MCP] register_vehicle called: traccarId=${traccarId}, name=${vehicleName}`);

    try {
      const existing = await prisma.fleetAsset.findUnique({ where: { traccarId } });
      if (existing) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: false,
                error: `Vehicle with Traccar ID ${traccarId} already registered.`,
                existing: { id: existing.id, vehicleName: existing.vehicleName },
              }),
            },
          ],
        };
      }

      const asset = await prisma.fleetAsset.create({
        data: {
          traccarId,
          vehicleName,
          plateNumber,
          cargoValueUsd: cargoValueUsd ? new Decimal(cargoValueUsd.toFixed(2)) : null,
          cargoDesc,
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              asset: {
                id: asset.id,
                traccarId: asset.traccarId,
                vehicleName: asset.vehicleName,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: get_live_positions
// Fetches live positions from Traccar
// ------------------------------------------------------------------
server.tool(
  'get_live_positions',
  'Fetch live GPS positions of all tracked vehicles from Traccar',
  {
    updateDatabase: z.boolean().default(true).describe('Update fleet assets in database with latest positions'),
  },
  async ({ updateDatabase }) => {
    console.log(`[MCP] get_live_positions called: updateDatabase=${updateDatabase}`);

    try {
      const [positions, devices] = await Promise.all([
        fetchTraccarPositions(),
        fetchTraccarDevices(),
      ]);

      // Create a map of device names
      const deviceMap = new Map(devices.map((d) => [d.id, d]));

      const positionData = await Promise.all(
        positions.map(async (pos) => {
          const device = deviceMap.get(pos.deviceId);
          const address = pos.address || await reverseGeocode(pos.latitude, pos.longitude);

          if (updateDatabase) {
            // Update fleet asset if registered
            await prisma.fleetAsset.updateMany({
              where: { traccarId: pos.deviceId },
              data: {
                lastLatitude: new Decimal(pos.latitude.toFixed(7)),
                lastLongitude: new Decimal(pos.longitude.toFixed(7)),
                lastSpeed: new Decimal(pos.speed.toFixed(2)),
                lastAddress: address.slice(0, 255),
                lastUpdated: new Date(),
                currentStatus: pos.speed > 5 ? 'InTransit' : 'Parked',
              },
            });
          }

          return {
            deviceId: pos.deviceId,
            deviceName: device?.name || `Device ${pos.deviceId}`,
            latitude: pos.latitude,
            longitude: pos.longitude,
            speed: pos.speed,
            address,
            lastUpdate: pos.serverTime,
            status: device?.status || 'unknown',
          };
        })
      );

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: positionData.length,
              positions: positionData,
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Traccar error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: check_fleet_safety
// The "Risk-Aware Dispatcher" - triangulates tracking, news, and forex
// ------------------------------------------------------------------
server.tool(
  'check_fleet_safety',
  'Check fleet safety by triangulating vehicle positions with news headlines and cargo values. The Risk-Aware Dispatcher.',
  {},
  async () => {
    console.log('[MCP] check_fleet_safety called');

    try {
      // 1. Get live positions
      const positions = await fetchTraccarPositions();
      const devices = await fetchTraccarDevices();
      const deviceMap = new Map(devices.map((d) => [d.id, d]));

      // 2. Get news headlines
      const articles = await fetchSABusinessNews();
      const headlines = articles.map((a) => a.title);

      // 3. Get forex rates for cargo value calculation
      const usdRates = await fetchExchangeRates('USD');
      const zarRate = usdRates.rates['ZAR'] || 19.50;

      // 4. Get registered fleet assets
      const fleetAssets = await prisma.fleetAsset.findMany();
      const assetMap = new Map(fleetAssets.map((a) => [a.traccarId, a]));

      const riskAssessments = [];

      for (const pos of positions) {
        const device = deviceMap.get(pos.deviceId);
        const asset = assetMap.get(pos.deviceId);
        const address = pos.address || await reverseGeocode(pos.latitude, pos.longitude);

        // Check if news mentions this area
        const newsCheck = checkNewsForLocationRisk(headlines, address);

        // Calculate cargo value in ZAR
        const cargoUsd = asset?.cargoValueUsd ? Number(asset.cargoValueUsd) : 0;
        const cargoZar = cargoUsd * zarRate;

        // Determine risk level
        let alertLevel: 'Low' | 'Medium' | 'Critical' = 'Low';
        let riskReason = 'Normal operations';

        if (newsCheck.hasRisk) {
          alertLevel = cargoZar > 500000 ? 'Critical' : 'Medium';
          riskReason = `⚠️ NEWS ALERT: "${newsCheck.matchedHeadlines[0]}" - Vehicle in affected area`;
        } else if (pos.speed === 0 && cargoZar > 100000) {
          alertLevel = 'Medium';
          riskReason = 'Vehicle stationary with high-value cargo';
        }

        // Update database if high risk
        if (alertLevel !== 'Low' && asset) {
          await prisma.fleetAsset.update({
            where: { id: asset.id },
            data: { currentStatus: alertLevel === 'Critical' ? 'HighRisk' : 'Stopped' },
          });

          // Log incident
          await prisma.riskIncident.create({
            data: {
              vehicleId: asset.id,
              newsHeadline: newsCheck.matchedHeadlines[0] || null,
              location: address,
              latitude: new Decimal(pos.latitude.toFixed(7)),
              longitude: new Decimal(pos.longitude.toFixed(7)),
              alertLevel,
              cargoZarValue: cargoZar ? new Decimal(cargoZar.toFixed(2)) : null,
              riskReason,
            },
          });
        }

        riskAssessments.push({
          deviceId: pos.deviceId,
          vehicleName: device?.name || asset?.vehicleName || `Device ${pos.deviceId}`,
          position: {
            lat: pos.latitude,
            lon: pos.longitude,
            speed: pos.speed,
            address,
          },
          cargo: {
            valueUsd: cargoUsd,
            valueZar: Math.round(cargoZar),
            description: asset?.cargoDesc || 'Unknown',
          },
          risk: {
            level: alertLevel,
            reason: riskReason,
            newsMatches: newsCheck.matchedHeadlines,
          },
          forexNote: cargoUsd > 0 
            ? `At current rate R${zarRate.toFixed(2)}/$, cargo worth R${cargoZar.toLocaleString('en-ZA')}`
            : null,
        });
      }

      const criticalCount = riskAssessments.filter((r) => r.risk.level === 'Critical').length;
      const mediumCount = riskAssessments.filter((r) => r.risk.level === 'Medium').length;

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              summary: {
                totalVehicles: riskAssessments.length,
                criticalRisk: criticalCount,
                mediumRisk: mediumCount,
                safeVehicles: riskAssessments.length - criticalCount - mediumCount,
                currentZarRate: zarRate,
              },
              recommendation: criticalCount > 0
                ? `🚨 CRITICAL: ${criticalCount} vehicle(s) require immediate attention!`
                : mediumCount > 0
                  ? `⚠️ WARNING: ${mediumCount} vehicle(s) need monitoring.`
                  : '✅ All vehicles operating normally.',
              assessments: riskAssessments,
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Fleet check error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: send_fleet_alert
// Send emergency alert about fleet risk
// ------------------------------------------------------------------
server.tool(
  'send_fleet_alert',
  'Send an emergency alert email about high-risk fleet vehicles',
  {
    recipientEmail: z.string().email().optional().describe('Recipient email (defaults to FLEET_ALERT_EMAIL)'),
    vehicleId: z.string().optional().describe('Specific vehicle ID to alert about (omit for all at-risk)'),
  },
  async ({ recipientEmail, vehicleId }) => {
    console.log('[MCP] send_fleet_alert called');

    const email = recipientEmail || env.FLEET_ALERT_EMAIL || env.ALERT_EMAIL;
    if (!email) {
      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: false,
              error: 'No recipient email provided. Set FLEET_ALERT_EMAIL in environment.',
            }),
          },
        ],
        isError: true,
      };
    }

    try {
      // Get high-risk vehicles
      const whereClause = vehicleId
        ? { id: vehicleId, currentStatus: { in: ['HighRisk', 'Stopped'] as const } }
        : { currentStatus: { in: ['HighRisk', 'Stopped'] as const } };

      const riskyVehicles = await prisma.fleetAsset.findMany({
        where: whereClause,
        include: {
          incidents: {
            where: { resolvedAt: null },
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      });

      if (riskyVehicles.length === 0) {
        return {
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({
                success: true,
                message: 'No vehicles currently at risk. No alert sent.',
              }),
            },
          ],
        };
      }

      // Get forex rate for ZAR values
      const usdRates = await fetchExchangeRates('USD');
      const zarRate = usdRates.rates['ZAR'] || 19.50;

      let emailBody = `
🚨 FLEET SECURITY ALERT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${riskyVehicles.length} vehicle(s) require immediate attention.

Current USD/ZAR Rate: R${zarRate.toFixed(2)}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
VEHICLE DETAILS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

      for (const vehicle of riskyVehicles) {
        const cargoZar = vehicle.cargoValueUsd ? Number(vehicle.cargoValueUsd) * zarRate : 0;
        const incident = vehicle.incidents[0];

        emailBody += `
📍 ${vehicle.vehicleName}
   Plate: ${vehicle.plateNumber || 'N/A'}
   Status: ${vehicle.currentStatus}
   Location: ${vehicle.lastAddress || 'Unknown'}
   Cargo: $${vehicle.cargoValueUsd ? Number(vehicle.cargoValueUsd).toLocaleString() : '0'} (R${cargoZar.toLocaleString('en-ZA')})
   Risk: ${incident?.riskReason || 'Unknown'}
   ${incident?.newsHeadline ? `News: "${incident.newsHeadline}"` : ''}
`;
      }

      emailBody += `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RECOMMENDED ACTIONS:
• Contact drivers immediately
• Alert security services
• Consider route diversion
• Monitor news for updates
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This alert was generated by SoftAware Fleet Risk Manager
`;

      const result = await sendEmail({
        to: email,
        subject: `🚨 FLEET ALERT: ${riskyVehicles.length} Vehicle(s) At Risk`,
        text: emailBody.trim(),
      });

      // Mark incidents as emailed
      for (const vehicle of riskyVehicles) {
        if (vehicle.incidents[0]) {
          await prisma.riskIncident.update({
            where: { id: vehicle.incidents[0].id },
            data: { emailSent: true },
          });
        }
      }

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: result.success,
              sentTo: email,
              vehiclesAlerted: riskyVehicles.length,
              messageId: result.messageId,
              error: result.error,
            }),
          },
        ],
        isError: !result.success,
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Email error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: get_risk_incidents
// Lists risk incidents from database
// ------------------------------------------------------------------
server.tool(
  'get_risk_incidents',
  'Get risk incidents logged for fleet vehicles',
  {
    unresolvedOnly: z.boolean().default(true).describe('Only show unresolved incidents'),
    limit: z.number().default(20).describe('Maximum number of incidents to return'),
  },
  async ({ unresolvedOnly, limit }) => {
    console.log(`[MCP] get_risk_incidents called: unresolvedOnly=${unresolvedOnly}`);

    try {
      const incidents = await prisma.riskIncident.findMany({
        where: unresolvedOnly ? { resolvedAt: null } : undefined,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          vehicle: {
            select: { vehicleName: true, plateNumber: true },
          },
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              count: incidents.length,
              incidents: incidents.map((i) => ({
                id: i.id,
                vehicle: i.vehicle.vehicleName,
                plate: i.vehicle.plateNumber,
                alertLevel: i.alertLevel,
                reason: i.riskReason,
                location: i.location,
                newsHeadline: i.newsHeadline,
                cargoZarValue: i.cargoZarValue ? Number(i.cargoZarValue) : null,
                emailSent: i.emailSent,
                createdAt: i.createdAt,
              })),
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: resolve_incident
// Mark a risk incident as resolved
// ------------------------------------------------------------------
server.tool(
  'resolve_incident',
  'Mark a risk incident as resolved',
  {
    incidentId: z.string().describe('The incident ID to resolve'),
  },
  async ({ incidentId }) => {
    console.log(`[MCP] resolve_incident called: ${incidentId}`);

    try {
      const incident = await prisma.riskIncident.update({
        where: { id: incidentId },
        data: { resolvedAt: new Date() },
        include: {
          vehicle: { select: { vehicleName: true, id: true } },
        },
      });

      // Reset vehicle status to InTransit
      await prisma.fleetAsset.update({
        where: { id: incident.vehicle.id },
        data: { currentStatus: 'InTransit' },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              incident: {
                id: incident.id,
                vehicle: incident.vehicle.vehicleName,
                resolvedAt: incident.resolvedAt,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Database error';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Tool: update_cargo
// Update cargo information for a vehicle
// ------------------------------------------------------------------
server.tool(
  'update_cargo',
  'Update the cargo value and description for a fleet vehicle',
  {
    traccarId: z.number().describe('The Traccar device ID'),
    cargoValueUsd: z.number().describe('New cargo value in USD'),
    cargoDesc: z.string().optional().describe('Description of the cargo'),
  },
  async ({ traccarId, cargoValueUsd, cargoDesc }) => {
    console.log(`[MCP] update_cargo called: traccarId=${traccarId}, value=${cargoValueUsd}`);

    try {
      const asset = await prisma.fleetAsset.update({
        where: { traccarId },
        data: {
          cargoValueUsd: new Decimal(cargoValueUsd.toFixed(2)),
          cargoDesc,
        },
      });

      return {
        content: [
          {
            type: 'text' as const,
            text: JSON.stringify({
              success: true,
              asset: {
                id: asset.id,
                vehicleName: asset.vehicleName,
                cargoValueUsd: Number(asset.cargoValueUsd),
                cargoDesc: asset.cargoDesc,
              },
            }),
          },
        ],
      };
    } catch (err) {
      const error = err instanceof Error ? err.message : 'Vehicle not found';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ error }) }],
        isError: true,
      };
    }
  }
);

// ------------------------------------------------------------------
// Start the MCP Server
// ------------------------------------------------------------------
export async function startMcpServer(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.log('[MCP] SoftAware MCP Server started on stdio');
}

// If run directly, start the server
if (process.argv[1]?.endsWith('server.js') || process.argv[1]?.endsWith('server.ts')) {
  startMcpServer().catch((err) => {
    console.error('[MCP] Failed to start:', err);
    process.exit(1);
  });
}
