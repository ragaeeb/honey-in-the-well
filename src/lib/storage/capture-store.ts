import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { IntegritySignals } from '@/lib/crypto/signer';

const DB_NAME = 'HoneyInTheWellDB';
const DB_VERSION = 1;
const STORE_NAME = 'captures';

export type CaptureRecord = {
    id?: number;
    url: string;
    title: string;
    timestamp: string;
    format: string;
    imageBlobs: Blob[];
    pdfFilename: string;
    scaleMultiplier: number;
    domHash: string;
    screenshotHash: string;
    signature: string;
    publicKeyFingerprint: string;
    metadata: Record<string, unknown>;
    integrity?: IntegritySignals;
};

type CaptureDB = DBSchema & {
    captures: {
        key: number;
        value: CaptureRecord;
        indexes: {
            'by-url': string;
            'by-timestamp': string;
        };
    };
};

let dbPromise: Promise<IDBPDatabase<CaptureDB>> | null = null;

function getDb(): Promise<IDBPDatabase<CaptureDB>> {
    if (!dbPromise) {
        dbPromise = openDB<CaptureDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                const store = db.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true,
                });
                store.createIndex('by-url', 'url');
                store.createIndex('by-timestamp', 'timestamp');
            },
        });
    }
    return dbPromise;
}

export async function saveCapture(record: Omit<CaptureRecord, 'id'>): Promise<number> {
    const db = await getDb();
    return db.add(STORE_NAME, record as CaptureRecord);
}

export async function getCapture(id: number): Promise<CaptureRecord | undefined> {
    const db = await getDb();
    return db.get(STORE_NAME, id);
}

export async function getAllCaptures(): Promise<CaptureRecord[]> {
    const db = await getDb();
    return db.getAll(STORE_NAME);
}

export async function deleteCapture(id: number): Promise<void> {
    const db = await getDb();
    return db.delete(STORE_NAME, id);
}

export async function updateCapture(record: CaptureRecord): Promise<number> {
    const db = await getDb();
    return db.put(STORE_NAME, record);
}

export async function getCaptureCount(): Promise<number> {
    const db = await getDb();
    return db.count(STORE_NAME);
}

export async function clearAllCaptures(): Promise<void> {
    const db = await getDb();
    return db.clear(STORE_NAME);
}
