export interface OfflineMutationItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  moduleLabel: string;
  summary: string;
  payload: Record<string, unknown>;
  timestamp: string;
}

const DB_NAME = 'dcfms_offline_db';
const DB_VERSION = 1;
const STORE_NAME = 'sync_queue';

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineMutation(
  item: Omit<OfflineMutationItem, 'id' | 'timestamp'>
): Promise<OfflineMutationItem> {
  const record: OfflineMutationItem = {
    ...item,
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put(record);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dcfms_queue_updated'));
    }
  } catch (err) {
    console.warn('Failed to enqueue to IndexedDB:', err);
  }

  return record;
}

export async function getQueuedMutations(): Promise<OfflineMutationItem[]> {
  try {
    const db = await openDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const req = tx.objectStore(STORE_NAME).getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  } catch {
    return [];
  }
}

export async function removeQueuedMutation(id: string): Promise<void> {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('dcfms_queue_updated'));
    }
  } catch (err) {
    console.warn('Failed to remove queued mutation:', err);
  }
}

export async function flushOfflineQueue(
  sendFn?: (item: OfflineMutationItem) => Promise<boolean>
): Promise<{ processed: number; failed: number }> {
  const defaultSend = async (item: OfflineMutationItem) => {
    try {
      const res = await fetch(item.endpoint, {
        method: item.method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(item.payload),
        credentials: 'include',
      });
      return res.ok;
    } catch {
      return false;
    }
  };
  const execSend = sendFn || defaultSend;
  const items = await getQueuedMutations();
  let processed = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const ok = await execSend(item);
      if (ok) {
        await removeQueuedMutation(item.id);
        processed++;
      } else {
        failed++;
      }
    } catch {
      failed++;
    }
  }

  return { processed, failed };
}
