const DB_NAME = 'qhp';
const DB_VERSION = 1;
let dbPromise = null;

export function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      if (!db.objectStoreNames.contains('letterErrors')) db.createObjectStore('letterErrors');
      if (!db.objectStoreNames.contains('diacriticErrors')) db.createObjectStore('diacriticErrors');
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => reject(new Error('IndexedDB upgrade blocked by another tab'));
  }).catch((err) => {
    dbPromise = null; // allow retry
    throw err;
  });
  return dbPromise;
}

export async function kvGet(key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readonly');
    const r = tx.objectStore('kv').get(key);
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}

export async function kvPut(key, value) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction('kv', 'readwrite');
    tx.objectStore('kv').put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function counterIncrement(storeName, key) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    const r = store.get(key);
    r.onsuccess = () => {
      const next = (r.result || 0) + 1;
      store.put(next, key);
    };
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}

export async function counterAll(storeName) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readonly');
    const store = tx.objectStore(storeName);
    const out = {};
    const cur = store.openCursor();
    cur.onsuccess = (e) => {
      const c = e.target.result;
      if (c) { out[c.key] = c.value; c.continue(); } else { res(out); }
    };
    cur.onerror = () => rej(cur.error);
  });
}

export async function counterClear(storeName) {
  const db = await openDb();
  return new Promise((res, rej) => {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error);
  });
}
