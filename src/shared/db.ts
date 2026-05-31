import { openDB } from 'idb';

export async function initDB() {
  return openDB('CortexDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('memory')) {
        db.createObjectStore('memory', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('sessions')) {
        db.createObjectStore('sessions', { keyPath: 'id' });
      }
    }
  });
}
