// Offline-first IndexedDB persistence layer with automatic migration from localStorage

const DB_NAME = 'derivify_offline_db';
const DB_VERSION = 1;
const STORE_KV = 'kv_store';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB unavailable'));
      return;
    }
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_KV)) {
        db.createObjectStore(STORE_KV);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error('Failed to open IndexedDB'));
  });
}

export async function dbGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const db = await openDb();
    const val = await new Promise<T | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readonly');
      const store = tx.objectStore(STORE_KV);
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result as T | undefined);
      req.onerror = () => reject(req.error);
    });
    if (val !== undefined) return val;

    // Seamless one-time migration from localStorage if present
    const lsRaw = localStorage.getItem(key);
    if (lsRaw) {
      const parsed = JSON.parse(lsRaw) as T;
      await dbSet(key, parsed);
      return parsed;
    }
    return fallback;
  } catch {
    try {
      const lsRaw = localStorage.getItem(key);
      if (lsRaw) return JSON.parse(lsRaw) as T;
    } catch {
      // ignore
    }
    return fallback;
  }
}

export async function dbSet<T>(key: string, value: T): Promise<void> {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
  try {
    const db = await openDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_KV, 'readwrite');
      const store = tx.objectStore(STORE_KV);
      const req = store.put(value, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch {
    // fallback already written to localStorage
  }
}
