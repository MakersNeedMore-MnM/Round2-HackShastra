import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { EmergencyMessage, MessageStatus } from '../types/message';

const DB_NAME_DEFAULT = 'morrowmesh_db';
const DB_VERSION = 1;

interface MorrowMeshDB extends DBSchema {
  outbox: {
    key: string;
    value: EmergencyMessage;
    indexes: { 'by-status': MessageStatus; 'by-timestamp': number };
  };
  seen_messages: {
    key: string;
    value: { id: string; firstSeenAt: number; originNode: string };
  };
  synced_messages: {
    key: string;
    value: EmergencyMessage;
  };
}

const dbInstances: Map<string, Promise<IDBPDatabase<MorrowMeshDB>>> = new Map();

/**
 * Get or open the IndexedDB instance.
 * Supports an optional database name suffix (e.g. per-node database) so multiple
 * simulated nodes can run within the same origin without sharing identical local storage.
 */
export function getDB(dbName: string = DB_NAME_DEFAULT): Promise<IDBPDatabase<MorrowMeshDB>> {
  if (!dbInstances.has(dbName)) {
    const p = openDB<MorrowMeshDB>(dbName, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('outbox')) {
          const outboxStore = db.createObjectStore('outbox', { keyPath: 'id' });
          outboxStore.createIndex('by-status', 'status');
          outboxStore.createIndex('by-timestamp', 'timestamp');
        }

        if (!db.objectStoreNames.contains('seen_messages')) {
          db.createObjectStore('seen_messages', { keyPath: 'id' });
        }

        if (!db.objectStoreNames.contains('synced_messages')) {
          db.createObjectStore('synced_messages', { keyPath: 'id' });
        }
      },
    });
    dbInstances.set(dbName, p);
  }
  return dbInstances.get(dbName)!;
}

/**
 * Persist an emergency message into the node's local outbox and mark it as seen.
 */
export async function saveMessage(message: EmergencyMessage, dbName?: string): Promise<void> {
  const db = await getDB(dbName);
  const tx = db.transaction(['outbox', 'seen_messages'], 'readwrite');
  await tx.objectStore('outbox').put(message);
  await tx.objectStore('seen_messages').put({
    id: message.id,
    firstSeenAt: Date.now(),
    originNode: message.originNode,
  });
  await tx.done;
}

/**
 * Retrieve a message by ID from the outbox.
 */
export async function getMessage(id: string, dbName?: string): Promise<EmergencyMessage | undefined> {
  const db = await getDB(dbName);
  return db.get('outbox', id);
}

/**
 * Get all emergency messages stored in the outbox, ordered by newest first.
 */
export async function getOutboxMessages(dbName?: string): Promise<EmergencyMessage[]> {
  const db = await getDB(dbName);
  const messages = await db.getAll('outbox');
  return messages.sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Update the status of an existing message.
 */
export async function markMessageStatus(id: string, status: MessageStatus, dbName?: string): Promise<void> {
  const db = await getDB(dbName);
  const tx = db.transaction('outbox', 'readwrite');
  const message = await tx.store.get(id);
  if (message) {
    message.status = status;
    await tx.store.put(message);
  }
  await tx.done;
}

/**
 * Check if a message has already been received or seen by this node.
 */
export async function messageExists(id: string, dbName?: string): Promise<boolean> {
  const db = await getDB(dbName);
  const seen = await db.get('seen_messages', id);
  return Boolean(seen);
}

/**
 * Remove a message from the outbox.
 */
export async function clearMessage(id: string, dbName?: string): Promise<void> {
  const db = await getDB(dbName);
  await db.delete('outbox', id);
}

/**
 * Mark a message as successfully synchronized with the backend.
 * Updates the status in outbox and stores a copy into synced_messages.
 */
export async function markMessageAsSynced(id: string, dbName?: string): Promise<void> {
  const db = await getDB(dbName);
  const tx = db.transaction(['outbox', 'synced_messages'], 'readwrite');
  const message = await tx.objectStore('outbox').get(id);
  if (message) {
    message.status = 'SYNCED_TO_GATEWAY';
    await tx.objectStore('outbox').put(message);
    await tx.objectStore('synced_messages').put(message);
  }
  await tx.done;
}

/**
 * Get messages in the local outbox that have not yet been synchronized.
 */
export async function getPendingSyncMessages(dbName?: string): Promise<EmergencyMessage[]> {
  const db = await getDB(dbName);
  const messages = await db.getAll('outbox');
  return messages
    .filter(
      (m) =>
        m.status !== 'SYNCED_TO_GATEWAY' &&
        m.status !== 'PROCESSED' &&
        m.status !== 'DISPATCHED' &&
        m.status !== 'RESOLVED'
    )
    .sort((a, b) => b.timestamp - a.timestamp);
}

/**
 * Get or create the local Node ID.
 * Defaults to localStorage ('morrowmesh_node_id').
 * Supports an optional key override (e.g. for tab-scoped multi-node demonstration).
 */
export function getOrCreateNodeId(overrideKey?: string): string {
  const STORAGE_KEY = overrideKey || 'morrowmesh_node_id';
  let nodeId = (overrideKey ? sessionStorage.getItem(STORAGE_KEY) : null) || localStorage.getItem(STORAGE_KEY);
  if (!nodeId) {
    const randomHex = Math.random().toString(36).substring(2, 8).toUpperCase();
    nodeId = `NODE-${randomHex}`;
    if (overrideKey) {
      sessionStorage.setItem(STORAGE_KEY, nodeId);
    } else {
      localStorage.setItem(STORAGE_KEY, nodeId);
    }
  }
  return nodeId;
}
