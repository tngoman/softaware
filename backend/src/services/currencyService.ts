/**
 * Currency service — multi-currency support for packages & pricing.
 * Provides formatting, conversion, and rate management.
 */

import { db } from '../db/mysql.js';

// ── Types ────────────────────────────────────────────────────────
export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimal_places: number;
  exchange_rate_to_zar: number;
  is_active: boolean;
  updated_at: string;
}

// ── In-memory cache (refreshed every 15 min) ────────────────────
let currencyCache: Currency[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL = 15 * 60 * 1000; // 15 minutes

async function ensureCache(): Promise<Currency[]> {
  if (currencyCache.length > 0 && Date.now() - cacheLoadedAt < CACHE_TTL) {
    return currencyCache;
  }
  currencyCache = await db.query<Currency>(
    'SELECT code, name, symbol, decimal_places, exchange_rate_to_zar, is_active, updated_at FROM currencies WHERE is_active = 1 ORDER BY code',
  );
  cacheLoadedAt = Date.now();
  return currencyCache;
}

// ── Public API ──────────────────────────────────────────────────

/** Get all active currencies */
export async function getActiveCurrencies(): Promise<Currency[]> {
  return ensureCache();
}

/** Get a specific currency by ISO code */
export async function getCurrency(code: string): Promise<Currency | null> {
  const currencies = await ensureCache();
  return currencies.find(c => c.code === code.toUpperCase()) || null;
}

/**
 * Format an amount in the given currency.
 * @param amountInCents - Amount in the currency's smallest unit (e.g., cents)
 * @param currencyCode - ISO 4217 code (default: ZAR)
 */
export async function formatCurrency(amountInCents: number, currencyCode = 'ZAR'): Promise<string> {
  const currency = await getCurrency(currencyCode);
  if (!currency) return `${currencyCode} ${(amountInCents / 100).toFixed(2)}`;
  const divisor = Math.pow(10, currency.decimal_places);
  const formatted = (amountInCents / divisor).toFixed(currency.decimal_places);
  return `${currency.symbol}${formatted}`;
}

/**
 * Synchronous format (uses cache — must call ensureCache first).
 * Useful in map/reduce where async is inconvenient.
 */
export function formatCurrencySync(amountInCents: number, currencyCode = 'ZAR'): string {
  const currency = currencyCache.find(c => c.code === currencyCode.toUpperCase());
  if (!currency) return `${currencyCode} ${(amountInCents / 100).toFixed(2)}`;
  const divisor = Math.pow(10, currency.decimal_places);
  const formatted = (amountInCents / divisor).toFixed(currency.decimal_places);
  return `${currency.symbol}${formatted}`;
}

/**
 * Convert an amount from one currency to another via ZAR as base.
 * @param amount - Amount in the source currency's smallest unit
 * @param fromCode - Source currency ISO code
 * @param toCode - Target currency ISO code
 * @returns Amount in the target currency's smallest unit
 */
export async function convertCurrency(amount: number, fromCode: string, toCode: string): Promise<number> {
  if (fromCode === toCode) return amount;
  const from = await getCurrency(fromCode);
  const to = await getCurrency(toCode);
  if (!from || !to) throw new Error(`Unknown currency: ${from ? toCode : fromCode}`);

  // Convert to ZAR first, then to target
  const zarAmount = amount * from.exchange_rate_to_zar;
  const targetAmount = zarAmount / to.exchange_rate_to_zar;
  return Math.round(targetAmount);
}

/**
 * Update exchange rate for a currency.
 * @returns true if updated
 */
export async function updateExchangeRate(code: string, rateToZar: number): Promise<boolean> {
  const result = await db.execute(
    'UPDATE currencies SET exchange_rate_to_zar = ? WHERE code = ?',
    [rateToZar, code.toUpperCase()],
  );
  // Invalidate cache
  cacheLoadedAt = 0;
  return (result as any).affectedRows > 0;
}

/**
 * Admin: Add or update a currency.
 */
export async function upsertCurrency(data: Omit<Currency, 'updated_at'>): Promise<void> {
  await db.execute(
    `INSERT INTO currencies (code, name, symbol, decimal_places, exchange_rate_to_zar, is_active)
     VALUES (?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE name = VALUES(name), symbol = VALUES(symbol),
       decimal_places = VALUES(decimal_places), exchange_rate_to_zar = VALUES(exchange_rate_to_zar),
       is_active = VALUES(is_active)`,
    [data.code.toUpperCase(), data.name, data.symbol, data.decimal_places, data.exchange_rate_to_zar, data.is_active ? 1 : 0],
  );
  cacheLoadedAt = 0; // Invalidate cache
}
