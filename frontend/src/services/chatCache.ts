/**
 * IndexedDB message-caching layer for Groups & Team Chats.
 *
 * GRP-008: Persist messages locally so they load instantly on revisit.
 * The DB stores a bounded set of recent messages per group/team.
 *
 * Schema:
 *   Database: "softaware_chat_cache"
 *   Object store: "messages"   — key: [groupId, messageId]
 *                                 index: "by-group" on "groupId"
 *   Object store: "meta"       — key: groupId  (stores { groupId, lastFetched, count })
 */

const DB_NAME = 'softaware_chat_cache';
const DB_VERSION = 1;
const MSG_STORE = 'messages';
const META_STORE = 'meta';
const MAX_MESSAGES_PER_GROUP = 200;

// ── Cached message shape (matches UnifiedMessage) ───────────

export interface CachedMessage {
  groupId: string;              // "local_3" or "ext_abc"
  messageId: string;            // unique within group
  text: string;
  user_id?: string | number;
  user_name: string;
  timestamp: number;
  direction?: string;
  message_type?: string;
  file_url?: string;
  file_name?: string;
  file_type?: string;
  file_size?: number;
  caption?: string;
  reply_to_message_id?: string;
  reply_to_content?: string;
  reply_to_user_name?: string;
}

interface GroupMeta {
  groupId: string;
  lastFetched: number;          // Date.now()
  count: number;
}

// ── DB singleton ────────────────────────────────────────────

let _dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(MSG_STORE)) {
        const store = db.createObjectStore(MSG_STORE, { keyPath: ['groupId', 'messageId'] });
        store.createIndex('by-group', 'groupId', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'groupId' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      console.error('[ChatCache] Failed to open IndexedDB:', req.error);
      reject(req.error);
    };
  });

  return _dbPromise;
}

// ── Public API ──────────────────────────────────────────────

/**
 * Save an array of messages for a given group, replacing the entire cache
 * for that group. Trims to MAX_MESSAGES_PER_GROUP (keeps most recent).
 */
export async function cacheMessages(groupId: string, messages: CachedMessage[]): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([MSG_STORE, META_STORE], 'readwrite');
    const msgStore = tx.objectStore(MSG_STORE);
    const metaStore = tx.objectStore(META_STORE);

    // Delete old messages for this group
    const idx = msgStore.index('by-group');
    const range = IDBKeyRange.only(groupId);
    let cursor = await wrapRequest<IDBCursorWithValue | null>(idx.openCursor(range));
    while (cursor) {
      cursor.delete();
      cursor.advance(1);
      cursor = await wrapRequest<IDBCursorWithValue | null>(idx.openCursor(range));
    }

    // Insert new messages (trim to max)
    const toStore = messages.slice(-MAX_MESSAGES_PER_GROUP);
    for (const msg of toStore) {
      msgStore.put({ ...msg, groupId });
    }

    // Update meta
    metaStore.put({ groupId, lastFetched: Date.now(), count: toStore.length } as GroupMeta);

    await wrapTransaction(tx);
  } catch (err) {
    console.warn('[ChatCache] cacheMessages failed:', err);
  }
}

/**
 * Append a single message to a group's cache (used on real-time events).
 */
export async function appendCachedMessage(groupId: string, message: CachedMessage): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(MSG_STORE, 'readwrite');
    tx.objectStore(MSG_STORE).put({ ...message, groupId });
    await wrapTransaction(tx);
  } catch (err) {
    console.warn('[ChatCache] appendCachedMessage failed:', err);
  }
}

/**
 * Remove a single cached message (used when message deleted).
 */
export async function removeCachedMessage(groupId: string, messageId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction(MSG_STORE, 'readwrite');
    tx.objectStore(MSG_STORE).delete([groupId, messageId]);
    await wrapTransaction(tx);
  } catch (err) {
    console.warn('[ChatCache] removeCachedMessage failed:', err);
  }
}

/**
 * Retrieve all cached messages for a group, ordered by timestamp.
 */
export async function getCachedMessages(groupId: string): Promise<CachedMessage[]> {
  try {
    const db = await openDb();
    const tx = db.transaction(MSG_STORE, 'readonly');
    const idx = tx.objectStore(MSG_STORE).index('by-group');
    const all = await wrapRequest<CachedMessage[]>(idx.getAll(groupId));
    // Sort ascending by timestamp
    all.sort((a, b) => a.timestamp - b.timestamp);
    return all;
  } catch (err) {
    console.warn('[ChatCache] getCachedMessages failed:', err);
    return [];
  }
}

/**
 * Clear the entire cache for a specific group.
 */
export async function clearGroupCache(groupId: string): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([MSG_STORE, META_STORE], 'readwrite');
    const msgStore = tx.objectStore(MSG_STORE);
    const idx = msgStore.index('by-group');
    const range = IDBKeyRange.only(groupId);
    let cursor = await wrapRequest<IDBCursorWithValue | null>(idx.openCursor(range));
    while (cursor) {
      cursor.delete();
      cursor.advance(1);
      cursor = await wrapRequest<IDBCursorWithValue | null>(idx.openCursor(range));
    }
    tx.objectStore(META_STORE).delete(groupId);
    await wrapTransaction(tx);
  } catch (err) {
    console.warn('[ChatCache] clearGroupCache failed:', err);
  }
}

/**
 * Clear all cached data (useful on logout).
 */
export async function clearAllChatCache(): Promise<void> {
  try {
    const db = await openDb();
    const tx = db.transaction([MSG_STORE, META_STORE], 'readwrite');
    tx.objectStore(MSG_STORE).clear();
    tx.objectStore(META_STORE).clear();
    await wrapTransaction(tx);
  } catch (err) {
    console.warn('[ChatCache] clearAllChatCache failed:', err);
  }
}

// ── Internal helpers ────────────────────────────────────────

function wrapRequest<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function wrapTransaction(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}
