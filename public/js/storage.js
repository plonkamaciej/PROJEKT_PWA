const DB_NAME = 'FinAssistDB';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';

let db;

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = e => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: '_id' });
      }
      if (!db.objectStoreNames.contains('budgets')) {
        db.createObjectStore('budgets', { keyPath: 'userId' });
      }
    };

    request.onsuccess = e => {
      db = e.target.result;
      resolve(db);
    };

    request.onerror = e => {
      reject('Error opening DB:' + e.target.errorCode);
    };
  });
}

export async function add(tx) {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const txToStore = { ...tx, synced: tx.synced !== undefined ? tx.synced : false };
    const request = store.put(txToStore);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      reject('Error adding transaction:' + e.target.errorCode);
    };
  });
}

export async function getAll() {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = e => {
      reject('Error getting all transactions:' + e.target.errorCode);
    };
  });
}

export async function remove(id) {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      reject('Error removing transaction:' + e.target.errorCode);
    };
  });
}

export async function clear() {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      reject('Error clearing transactions:' + e.target.errorCode);
    };
  });
}

export async function addBudget(budget) {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readwrite');
    const store = transaction.objectStore('budgets');
    const budgetToStore = { ...budget, synced: budget.synced !== undefined ? budget.synced : false };
    const request = store.put(budgetToStore);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      reject('Error adding budget:' + e.target.errorCode);
    };
  });
}

export async function getAllBudgets() {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readonly');
    const store = transaction.objectStore('budgets');
    const request = store.getAll();

    request.onsuccess = () => {
      resolve(request.result);
    };

    request.onerror = e => {
      reject('Error getting all budgets:' + e.target.errorCode);
    };
  });
}

export async function removeBudget(userId) {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readwrite');
    const store = transaction.objectStore('budgets');
    const request = store.delete(userId);

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      reject('Error removing budget:' + e.target.errorCode);
    };
  });
}

export async function clearBudgets() {
  if (!db) await openDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(['budgets'], 'readwrite');
    const store = transaction.objectStore('budgets');
    const request = store.clear();

    request.onsuccess = () => {
      resolve();
    };

    request.onerror = e => {
      reject('Error clearing budgets:' + e.target.errorCode);
    };
  });
}

// Open the database when the script loads
openDb().catch(console.error);
