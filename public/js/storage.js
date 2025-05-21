const DB_NAME = 'FinAssistDB';
const DB_VERSION = 2;
const STORE_NAME = 'transactions';

let db = null;
let dbPromise = null;

async function openDbWithRetry(retries = 3, delay = 100) {
    for (let i = 0; i < retries; i++) {
        try {
            console.log(`[IndexedDB] Attempting to open DB (retry ${i + 1}/${retries})...`);
            return await new Promise((resolve, reject) => {
                const request = indexedDB.open(DB_NAME, DB_VERSION);

                request.onupgradeneeded = e => {
                  console.log('[IndexedDB] Upgrade needed', e.oldVersion, 'to', e.newVersion);
                  const db = e.target.result;
                  if (!db.objectStoreNames.contains(STORE_NAME)) {
                    console.log('[IndexedDB] Creating', STORE_NAME, 'store');
                    db.createObjectStore(STORE_NAME, { keyPath: '_id' });
                  }
                  if (db.objectStoreNames.contains('budgets')) {
                     console.log('[IndexedDB] Deleting old budgets store');
                     db.deleteObjectStore('budgets');
                  }
                  console.log('[IndexedDB] Creating new budgets store with keyPath _id');
                  db.createObjectStore('budgets', { keyPath: '_id' });
                };

                request.onsuccess = e => {
                  db = e.target.result;
                  console.log('[IndexedDB] Database opened successfully');
                  resolve(db);
                };

                request.onerror = e => {
                  console.error('[IndexedDB] Error opening DB request:', e);
                  console.error('[IndexedDB] Error object:', e.target.error);
                  reject('Error opening DB: ' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
                };

                 request.onblocked = (event) => {
                    console.warn('[IndexedDB] Database open request blocked. Please close all other tabs with this site.', event);
                };
            });
        } catch (error) {
            console.error(`[IndexedDB] Failed to open DB attempt ${i + 1}:`, error);
            if (i < retries - 1) {
                console.log(`[IndexedDB] Retrying in ${delay}ms...`);
                await new Promise(res => setTimeout(res, delay));
            }
        }
    }
    throw new Error(`[IndexedDB] Failed to open database after ${retries} retries.`);
}

function getDb() {
  if (!dbPromise) {
    dbPromise = openDbWithRetry().catch(error => {
      console.error("[IndexedDB] Final failure to open IndexedDB:", error);
      dbPromise = null;
      throw error;
    });
  }
  return dbPromise;
}

export async function add(tx) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const txToStore = { ...tx, synced: tx.synced !== undefined ? tx.synced : false };
    const request = store.put(txToStore);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error adding transaction:', e);
      reject('Error adding transaction:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function getAll() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error getting all transactions:', e);
      reject('Error getting all transactions:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function remove(id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error removing transaction:', e);
      reject('Error removing transaction:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function clear() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error clearing transactions:', e);
      reject('Error clearing transactions:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function addBudget(budget) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readwrite');
    const store = transaction.objectStore('budgets');
    const budgetToStore = { ...budget, synced: budget.synced !== undefined ? budget.synced : false };
    const request = store.put(budgetToStore);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error adding budget:', e);
      reject('Error adding budget:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function getAllBudgets() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readonly');
    const store = transaction.objectStore('budgets');
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error getting all budgets:', e);
      reject('Error getting all budgets:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function removeBudget(_id) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readwrite');
    const store = transaction.objectStore('budgets');
    const request = store.delete(_id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error removing budget:', e);
      reject('Error removing budget:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}

export async function clearBudgets() {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readwrite');
    const store = transaction.objectStore('budgets');
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      console.error('[IndexedDB] Error clearing budgets:', e);
      reject('Error clearing budgets:' + (e.target.errorCode || (e.target.error ? e.target.error.name : 'Unknown error')));
    };
  });
}
