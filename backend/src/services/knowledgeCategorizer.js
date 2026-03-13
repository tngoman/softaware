/**
 * Dynamic Knowledge Categorizer Service
 *
 * Analyzes ingested content against the assistant's specific knowledge
 * checklist — NOT a hardcoded set of categories.
 *
 * Flow:
 *  1. The ingestion worker passes the cleaned content + the assistant's
 *     current checklist (a ChecklistItem[]) to categorizeContent().
 *  2. categorizeContent() builds a dynamic LLM prompt listing only those
 *     checklist items, asks Ollama to evaluate each one, and returns an
 *     updated map of key → boolean.
 *  3. mergeChecklist() ORs the new results into the assistant's stored
 *     checklist so that once an item is satisfied it stays satisfied.
 */
import axios from 'axios';
import { env } from '../config/env.js';
import { db, toMySQLDate } from '../db/mysql.js';
import { getDefaultChecklist } from '../config/personaTemplates.js';
const OLLAMA_API = env.OLLAMA_BASE_URL;
const CATEGORIZER_MODEL = 'qwen2.5:3b-instruct';
// ---------------------------------------------------------------------------
// AI categorization — dynamic prompt built from the assistant's checklist
// ---------------------------------------------------------------------------
/**
 * Analyze content against a specific set of checklist items.
 * Returns a map of  key → boolean  (satisfied or not).
 */
export async function categorizeContent(content, checklist) {
    const truncated = content.slice(0, 8000);
    // Build the JSON schema dynamically from checklist items
    const schemaLines = checklist
        .map((item) => `  "${item.key}": boolean  // ${item.label}`)
        .join('\n');
    const itemDescriptions = checklist
        .map((item) => `- "${item.key}": Does the content contain substantial information about ${item.label}?`)
        .join('\n');
    const prompt = `Analyze this business website content and determine which of the following knowledge requirements are satisfied.

CONTENT TO ANALYZE:
"""
${truncated}
"""

KNOWLEDGE REQUIREMENTS:
${itemDescriptions}

Return ONLY a JSON object with these boolean fields (true if the content contains SUBSTANTIAL information):
{
${schemaLines}
}

Important: Only mark as true if there is substantial information, not just a brief mention.
Return ONLY the JSON object, no other text.`;
    try {
        const response = await axios.post(`${OLLAMA_API}/api/generate`, {
            model: CATEGORIZER_MODEL,
            prompt,
            stream: false,
            options: {
                temperature: 0.1,
                top_p: 0.9,
            },
        }, { timeout: 120_000 });
        const responseText = response.data.response || '';
        // Extract JSON from response (handle markdown code blocks)
        let jsonStr = responseText;
        const jsonMatch = responseText.match(/\{[\s\S]*?\}/);
        if (jsonMatch)
            jsonStr = jsonMatch[0];
        const parsed = JSON.parse(jsonStr);
        // Build result map — only include keys we asked about
        const result = {};
        for (const item of checklist) {
            result[item.key] = Boolean(parsed[item.key]);
        }
        return result;
    }
    catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Categorizer] Error analyzing content:', errMsg);
        if (axios.isAxiosError(error)) {
            console.error('[Categorizer] Axios error:', {
                code: error.code,
                status: error.response?.status,
                isTimeout: error.code === 'ECONNABORTED'
            });
        }
        // Return all-false on failure — will be retried on next ingestion
        const result = {};
        for (const item of checklist) {
            result[item.key] = false;
        }
        return result;
    }
}
// ---------------------------------------------------------------------------
// Full recategorization — re-reads all chunks for the assistant
// ---------------------------------------------------------------------------
export async function updateAssistantCategories(assistantId) {
    // 1. Load current checklist
    const checklist = await getStoredChecklist(assistantId);
    // 2. Load content chunks
    const chunks = await db.query(`SELECT content FROM assistant_knowledge WHERE assistant_id = ? ORDER BY created_at DESC LIMIT 50`, [assistantId]);
    if (chunks.length === 0) {
        // Reset all items to unsatisfied
        const reset = checklist.map((c) => ({ ...c, satisfied: false }));
        await saveChecklist(assistantId, reset);
        return reset;
    }
    const combinedContent = chunks.map((c) => c.content).join('\n\n---\n\n');
    // 3. Run the dynamic categorizer
    const results = await categorizeContent(combinedContent, checklist);
    // 4. Apply results
    const updated = checklist.map((item) => ({
        ...item,
        satisfied: Boolean(results[item.key]),
    }));
    await saveChecklist(assistantId, updated);
    console.log(`[Categorizer] Updated checklist for ${assistantId}:`, results);
    return updated;
}
// ---------------------------------------------------------------------------
// Merge — OR new results into existing checklist (incremental ingestion)
// ---------------------------------------------------------------------------
export async function mergeChecklist(assistantId, newResults) {
    const checklist = await getStoredChecklist(assistantId);
    const merged = checklist.map((item) => ({
        ...item,
        // Once satisfied, stays satisfied (OR merge)
        satisfied: item.satisfied || Boolean(newResults[item.key]),
    }));
    await saveChecklist(assistantId, merged);
    return merged;
}
// ---------------------------------------------------------------------------
// Health score calculation — works on any checklist length
// ---------------------------------------------------------------------------
export function calculateHealthScore(checklist) {
    if (!checklist || checklist.length === 0) {
        return { score: 0, checklist: [], missing: [], recommendations: [] };
    }
    const total = checklist.length;
    const satisfied = checklist.filter((c) => c.satisfied).length;
    const score = Math.round((satisfied / total) * 100);
    const missing = [];
    const recommendations = [];
    for (const item of checklist) {
        if (!item.satisfied) {
            missing.push(item.label);
            recommendations.push({
                key: item.key,
                label: item.label,
                action: item.type === 'url'
                    ? `Add your ${item.label.toLowerCase()} page URL`
                    : `Upload a document with ${item.label.toLowerCase()}`,
                type: item.type,
            });
        }
    }
    return { score, checklist, missing, recommendations };
}
// ---------------------------------------------------------------------------
// Get Knowledge Health for an assistant (called by the API endpoint)
// ---------------------------------------------------------------------------
export async function getAssistantKnowledgeHealth(assistantId) {
    const assistant = await db.queryOne(`SELECT knowledge_categories, business_type, pages_indexed, tier FROM assistants WHERE id = ?`, [assistantId]);
    if (!assistant)
        throw new Error(`Assistant ${assistantId} not found`);
    // Compute real pages_indexed from completed ingestion jobs (source of truth)
    const realCount = await db.queryOne(`SELECT COUNT(*) AS cnt FROM ingestion_jobs WHERE assistant_id = ? AND status = 'completed'`, [assistantId]);
    const pagesIndexed = realCount?.cnt ?? assistant.pages_indexed;
    // Sync the column if it drifted
    if (pagesIndexed !== assistant.pages_indexed) {
        await db.execute(`UPDATE assistants SET pages_indexed = ? WHERE id = ?`, [pagesIndexed, assistantId]).catch(() => { });
    }
    const checklist = parseStoredChecklist(assistant.knowledge_categories, assistant.business_type);
    const health = calculateHealthScore(checklist);
    const pageLimit = assistant.tier === 'paid' ? 500 : 50;
    const storageFull = pagesIndexed >= pageLimit;
    const pointsPerItem = checklist.length > 0 ? Math.round(100 / checklist.length) : 0;
    return {
        ...health,
        pagesIndexed,
        tier: assistant.tier,
        pageLimit,
        storageFull,
        pointsPerItem,
    };
}
// ---------------------------------------------------------------------------
// Helpers — read / write checklist from knowledge_categories JSON column
// ---------------------------------------------------------------------------
/** Read the stored checklist for an assistant (with fallback to template) */
export async function getStoredChecklist(assistantId) {
    const row = await db.queryOne(`SELECT knowledge_categories, business_type FROM assistants WHERE id = ?`, [assistantId]);
    if (!row)
        return getDefaultChecklist('other');
    return parseStoredChecklist(row.knowledge_categories, row.business_type);
}
/** Parse the JSON stored in knowledge_categories — handles both old and new format */
function parseStoredChecklist(raw, businessType) {
    // MySQL driver may auto-parse JSON columns
    if (typeof raw === 'object' && raw !== null) {
        console.log('[Categorizer] Got pre-parsed object:', Object.keys(raw));
        if (raw.checklist && Array.isArray(raw.checklist)) {
            console.log('[Categorizer] Returning checklist with', raw.checklist.length, 'items, satisfied:', raw.checklist.filter((c) => c.satisfied).length);
            return raw.checklist;
        }
        if (Array.isArray(raw) && raw.length > 0 && 'key' in raw[0]) {
            return raw;
        }
    }
    if (!raw || raw === 'null')
        return getDefaultChecklist(businessType || 'other');
    // Try parsing if it's a string
    try {
        const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        console.log('[Categorizer] Parsed object keys:', Object.keys(parsed));
        // NEW FORMAT: { checklist: ChecklistItem[] }
        if (parsed.checklist && Array.isArray(parsed.checklist)) {
            console.log('[Categorizer] Returning checklist with', parsed.checklist.length, 'items');
            return parsed.checklist;
        }
        // NEW FORMAT (array directly)
        if (Array.isArray(parsed) && parsed.length > 0 && 'key' in parsed[0]) {
            return parsed;
        }
        // OLD FORMAT: { has_pricing: true, has_contact_info: false, ... }
        // Migrate on-the-fly: create a default checklist and mark items satisfied
        // based on the old boolean values
        const checklist = getDefaultChecklist(businessType || 'other');
        const OLD_KEY_MAP = {
            has_pricing: ['pricing_info', 'pricing_plans', 'pricing_fees', 'menu_prices'],
            has_contact_info: ['contact_details', 'contact_hours'],
            has_services_described: ['services_offered', 'services_products', 'products_catalog', 'features'],
            has_return_policy: ['return_policy'],
            has_about_history: ['about_company', 'about_team', 'about_restaurant', 'about_practice', 'about_institution', 'about_agency'],
        };
        for (const [oldKey, newKeys] of Object.entries(OLD_KEY_MAP)) {
            if (parsed[oldKey] === true) {
                for (const item of checklist) {
                    if (newKeys.includes(item.key)) {
                        item.satisfied = true;
                    }
                }
            }
        }
        return checklist;
    }
    catch {
        return getDefaultChecklist(businessType || 'other');
    }
}
/** Persist the checklist to the knowledge_categories column */
async function saveChecklist(assistantId, checklist) {
    const json = JSON.stringify({ checklist });
    await db.execute(`UPDATE assistants SET knowledge_categories = ?, updated_at = ? WHERE id = ?`, [json, toMySQLDate(new Date()), assistantId]);
}
