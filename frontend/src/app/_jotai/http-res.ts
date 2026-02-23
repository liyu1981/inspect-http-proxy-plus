import { atom } from "jotai";
import type { RequestData } from "./http-req";

export interface ResponseData {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  duration: number;
}

export interface ResponseState {
  loading: boolean;
  error: string | null;
  data: ResponseData | null;
  request: RequestData | null; // Added to retain a copy of the triggering request
}

// IndexedDB configuration
const DB_NAME = "http-responses-db";
const DB_VERSION = 1;
const STORE_NAME = "responses";
const MAX_STORED_RESPONSES = 1000; // Limit number of cached responses

/**
 * Calculates SHA256 Hash of the request components using Web Crypto API.
 */
export async function calculateRequestHash(req: RequestData): Promise<string> {
  const enabledHeaders = req.headers
    .filter((h) => h.enabled)
    .sort((a, b) => a.key.localeCompare(b.key))
    .map((h) => `${h.key}:${h.value}`)
    .join("|");

  const rawString = `${req.method}${req.url}${enabledHeaders}${req.body}${req.timestamp}`;

  const msgUint8 = new TextEncoder().encode(rawString);
  const hashBuffer = await crypto.subtle.digest("SHA-256", msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// IndexedDB helper functions
let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "hash" });
        store.createIndex("timestamp", "timestamp", { unique: false });
      }
    };
  });
}

interface StoredResponse extends ResponseState {
  hash: string;
  timestamp: number;
}

// Load a single response from IndexedDB
async function loadResponseFromDB(hash: string): Promise<ResponseState | null> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    return new Promise((resolve, reject) => {
      const request = store.get(hash);
      request.onsuccess = () => {
        const result = request.result as StoredResponse | undefined;
        if (result) {
          const { hash: _, timestamp: __, ...state } = result;
          resolve(state);
        } else {
          resolve(null);
        }
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to load response from IndexedDB:", error);
    return null;
  }
}

// Save a single response to IndexedDB
async function saveResponseToDB(
  hash: string,
  state: ResponseState,
): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const storedResponse: StoredResponse = {
      ...state,
      hash,
      timestamp: Date.now(),
    };

    await new Promise<void>((resolve, reject) => {
      const request = store.put(storedResponse);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });

    // Check if cleanup is needed (async, don't await)
    checkAndCleanupOldEntries(db);
  } catch (error) {
    console.error("Failed to save response to IndexedDB:", error);
  }
}

// Delete a single response from IndexedDB
async function deleteResponseFromDB(hash: string): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.delete(hash);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to delete response from IndexedDB:", error);
  }
}

// Async cleanup - doesn't block the save operation
async function checkAndCleanupOldEntries(db: IDBDatabase): Promise<void> {
  try {
    const transaction = db.transaction([STORE_NAME], "readonly");
    const store = transaction.objectStore(STORE_NAME);

    // Count total entries
    const countRequest = store.count();
    const count = await new Promise<number>((resolve, reject) => {
      countRequest.onsuccess = () => resolve(countRequest.result);
      countRequest.onerror = () => reject(countRequest.error);
    });

    // Only cleanup if we exceed the limit
    if (count > MAX_STORED_RESPONSES) {
      await cleanupOldEntries(db, count - MAX_STORED_RESPONSES);
    }
  } catch (error) {
    console.error("Failed to check entries count:", error);
  }
}

async function cleanupOldEntries(
  db: IDBDatabase,
  deleteCount: number,
): Promise<void> {
  try {
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index("timestamp");

    // Get oldest entries
    const cursorRequest = index.openCursor();
    let deletedCount = 0;

    await new Promise<void>((resolve, reject) => {
      cursorRequest.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;

        if (cursor && deletedCount < deleteCount) {
          cursor.delete();
          deletedCount++;
          cursor.continue();
        } else {
          resolve();
        }
      };
      cursorRequest.onerror = () => reject(cursorRequest.error);
    });
  } catch (error) {
    console.error("Failed to cleanup old entries:", error);
  }
}

async function clearAllResponsesFromDB(): Promise<void> {
  try {
    const db = await openDB();
    const transaction = db.transaction([STORE_NAME], "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    await new Promise<void>((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error("Failed to clear all responses from IndexedDB:", error);
  }
}

// Map of SHA-256 Hash -> ResponseState
export const responseMapAtom = atom<Map<string, ResponseState>>(new Map());

// Async atom: Get response state, loading from IndexedDB if not in memory
export const getResponseStateAtom = atom(
  null,
  async (get, set, hash: string): Promise<ResponseState> => {
    const currentMap = get(responseMapAtom);

    // Check memory first
    const memoryState = currentMap.get(hash);
    if (memoryState) {
      return memoryState;
    }

    // Load from IndexedDB
    const storedState = await loadResponseFromDB(hash);

    if (storedState) {
      // Populate memory cache
      const newMap = new Map(currentMap);
      newMap.set(hash, storedState);
      set(responseMapAtom, newMap);
      return storedState;
    }

    // Return default if not found anywhere
    return {
      loading: false,
      error: null,
      data: null,
      request: null,
    };
  },
);

// Write-only: Update state for a specific hash
export const updateResponseStateAtom = atom(
  null,
  (
    get,
    set,
    { hash, state }: { hash: string; state: Partial<ResponseState> },
  ) => {
    const currentMap = get(responseMapAtom);
    const currentState = currentMap.get(hash) || {
      loading: false,
      error: null,
      data: null,
      request: null,
    };

    const newState = { ...currentState, ...state };
    const newMap = new Map(currentMap);
    newMap.set(hash, newState);
    set(responseMapAtom, newMap);

    // Sync this response to IndexedDB (save all states including loading)
    saveResponseToDB(hash, newState);
  },
);

// Family-like pattern using a derived atom function to get reactive state
export const responseStateAtom = (hash: string) =>
  atom((get) => {
    return (
      get(responseMapAtom).get(hash) || {
        loading: false,
        error: null,
        data: null,
        request: null,
      }
    );
  });

// Atom for clearing all cached responses
export const clearAllResponsesAtom = atom(null, async (get, set) => {
  set(responseMapAtom, new Map());
  await clearAllResponsesFromDB();
});

// Atom to delete a specific response
export const deleteResponseAtom = atom(null, async (get, set, hash: string) => {
  const currentMap = get(responseMapAtom);
  const newMap = new Map(currentMap);
  newMap.delete(hash);
  set(responseMapAtom, newMap);

  // Delete only this response from IndexedDB
  await deleteResponseFromDB(hash);
});
