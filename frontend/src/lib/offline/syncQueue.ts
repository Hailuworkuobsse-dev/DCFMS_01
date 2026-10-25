export interface OfflineMutationItem {
  id: string;
  endpoint: string;
  method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  moduleLabel: string;
  summary: string;
  payload: Record<string, unknown>;
  timestamp: string;
  ownerId?: string;
  scopeId?: string;
}

export interface OfflineContractReference {
  id: string;
  contractNumber: string;
  commodity: string;
  producerName: string;
}

const DB_NAME = 'dcfms_offline_db';
const DB_VERSION = 2;
const STORE_NAME = 'sync_queue';
const REFERENCE_STORE_NAME = 'reference_data';

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
      if (!db.objectStoreNames.contains(REFERENCE_STORE_NAME)) {
        db.createObjectStore(REFERENCE_STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function cacheOfflineContractReferences(
  contracts: OfflineContractReference[],
  ownerId: string,
  scopeId: string
): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(REFERENCE_STORE_NAME, 'readwrite');
    tx.objectStore(REFERENCE_STORE_NAME).put(contracts, `contracts:${ownerId}:${scopeId}`);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Offline reference-data write was aborted.'));
  });
}

export async function getOfflineContractReferences(
  ownerId: string,
  scopeId: string
): Promise<OfflineContractReference[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(REFERENCE_STORE_NAME, 'readonly');
    const req = tx.objectStore(REFERENCE_STORE_NAME).get(`contracts:${ownerId}:${scopeId}`);
    req.onsuccess = () => resolve((req.result as OfflineContractReference[] | undefined) ?? []);
    req.onerror = () => reject(req.error);
  });
}

export async function enqueueOfflineMutation(
  item: Omit<OfflineMutationItem, 'id' | 'timestamp'> & { ownerId: string; scopeId: string }
): Promise<OfflineMutationItem> {
  const record: OfflineMutationItem = {
    ...item,
    id: `queue_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };

  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Offline queue write was aborted.'));
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dcfms_queue_updated'));
  }

  return record;
}

export async function getQueuedMutations(): Promise<OfflineMutationItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readonly');
    const req = tx.objectStore(STORE_NAME).getAll();
    req.onsuccess = () => resolve((req.result as OfflineMutationItem[]).sort(
      (a, b) => a.timestamp.localeCompare(b.timestamp)
    ));
    req.onerror = () => reject(req.error);
  });
}

export async function removeQueuedMutation(id: string): Promise<void> {
  const db = await openDB();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    tx.objectStore(STORE_NAME).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error('Offline queue removal was aborted.'));
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('dcfms_queue_updated'));
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
