/**
 * chatOfflineQueue.ts — Offline message queue using IndexedDB.
 *
 * When the socket is disconnected (offline), messages are queued locally.
 * When the socket reconnects, queued messages are sent automatically.
 *
 * Uses native IndexedDB API (no library dependency).
 */

const DB_NAME = 'softaware_chat_queue';
const DB_VERSION = 1;
const STORE_NAME = 'pending_messages';

export interface QueuedMessage {
  id?: number; // auto-increment IDB key
  conversationId: number;
  content: string;
  messageType: string;
  replyToId?: number | null;
  fileUrl?: string | null;
  fileName?: string | null;
  fileType?: string | null;
  fileSize?: number | null;
  thumbnailUrl?: string | null;
  queuedAt: string; // ISO timestamp
}

/* ─── IndexedDB helpers ─── */

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* ─── Public API ─── */

/**
 * Add a message to the offline queue.
 */
export async function enqueueMessage(msg: Omit<QueuedMessage, 'id' | 'queuedAt'>): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.add({ ...msg, queuedAt: new Date().toISOString() });
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('[OfflineQueue] Failed to enqueue message:', err);
  }
}

/**
 * Get all queued messages.
 */
export async function getQueuedMessages(): Promise<QueuedMessage[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        db.close();
        resolve(req.result || []);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.error('[OfflineQueue] Failed to get queued messages:', err);
    return [];
  }
}

/**
 * Remove a message from the queue after it's been sent.
 */
export async function dequeueMessage(id: number): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.delete(id);
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('[OfflineQueue] Failed to dequeue message:', err);
  }
}

/**
 * Clear the entire queue.
 */
export async function clearQueue(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch (err) {
    console.error('[OfflineQueue] Failed to clear queue:', err);
  }
}

/**
 * Get count of queued messages.
 */
export async function getQueueCount(): Promise<number> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.count();
    return new Promise((resolve, reject) => {
      req.onsuccess = () => {
        db.close();
        resolve(req.result);
      };
      req.onerror = () => {
        db.close();
        reject(req.error);
      };
    });
  } catch (err) {
    console.error('[OfflineQueue] Failed to get queue count:', err);
    return 0;
  }
}
