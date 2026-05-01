import type { AnyBoke } from "../data/bokes";
import type { InputMode } from "../types";
import type { ScoreCard } from "./scoring";

const DB_NAME = "tsukkome";
const DB_VERSION = 1;
const STORE_HISTORY = "history";

let dbPromise: Promise<IDBDatabase> | null = null;

const openDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onerror = () => reject(req.error ?? new Error("indexedDB error"));
    req.onsuccess = () => resolve(req.result);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_HISTORY)) {
        db.createObjectStore(STORE_HISTORY, { keyPath: "timestamp" });
      }
    };
  });
  return dbPromise;
};

export type StoredEntry = {
  timestamp: number;
  boke: AnyBoke;
  tsukkomi: string;
  mode: InputMode;
  audioBlob: Blob | null;
  audioMime: string | null;
  scoreCard: ScoreCard | null;
};

export const saveEntry = async (entry: StoredEntry): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_HISTORY, "readwrite");
      tx.objectStore(STORE_HISTORY).put(entry);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("write error"));
    });
  } catch (e) {
    console.warn("[storage] saveEntry failed", e);
  }
};

export const loadAllEntries = async (): Promise<StoredEntry[]> => {
  try {
    const db = await openDB();
    return await new Promise<StoredEntry[]>((resolve, reject) => {
      const tx = db.transaction(STORE_HISTORY, "readonly");
      const req = tx.objectStore(STORE_HISTORY).getAll();
      req.onsuccess = () => {
        const list = (req.result as StoredEntry[]).sort(
          (a, b) => b.timestamp - a.timestamp,
        );
        resolve(list);
      };
      req.onerror = () => reject(req.error ?? new Error("read error"));
    });
  } catch (e) {
    console.warn("[storage] loadAllEntries failed", e);
    return [];
  }
};

export const clearAllEntries = async (): Promise<void> => {
  try {
    const db = await openDB();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_HISTORY, "readwrite");
      tx.objectStore(STORE_HISTORY).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error ?? new Error("clear error"));
    });
  } catch (e) {
    console.warn("[storage] clearAllEntries failed", e);
  }
};
