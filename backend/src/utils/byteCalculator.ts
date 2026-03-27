/**
 * byteCalculator.ts — Utility for calculating the byte size of JSON objects
 *
 * Used by the CMS storage ledger to precisely track how much disk space
 * each JSON document occupies. Buffer.byteLength accounts for multi-byte
 * UTF-8 characters (e.g. emoji, CJK) that would be undercounted by .length.
 */

/**
 * Calculate the byte size of any data object when serialised to JSON.
 * This is the exact number of bytes that MySQL will store.
 */
export function calculateByteSize(dataObject: any): number {
  const jsonString = JSON.stringify(dataObject);
  return Buffer.byteLength(jsonString, 'utf8');
}
