import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockStore = new Map<number, unknown>();
let autoId = 0;

const mockDb = {
    add: vi.fn((_, record: Record<string, unknown>) => {
        autoId++;
        mockStore.set(autoId, { ...record, id: autoId });
        return Promise.resolve(autoId);
    }),
    get: vi.fn((_: string, id: number) => {
        return Promise.resolve(mockStore.get(id));
    }),
    getAll: vi.fn(() => {
        return Promise.resolve(Array.from(mockStore.values()));
    }),
    delete: vi.fn((_: string, id: number) => {
        mockStore.delete(id);
        return Promise.resolve();
    }),
    put: vi.fn((_: string, record: Record<string, unknown>) => {
        const id = record.id as number;
        mockStore.set(id, record);
        return Promise.resolve(id);
    }),
    count: vi.fn(() => {
        return Promise.resolve(mockStore.size);
    }),
    clear: vi.fn(() => {
        mockStore.clear();
        return Promise.resolve();
    }),
};

vi.mock('idb', () => ({
    openDB: vi.fn(() => Promise.resolve(mockDb)),
}));

import {
    type CaptureRecord,
    clearAllCaptures,
    deleteCapture,
    getAllCaptures,
    getCapture,
    getCaptureCount,
    saveCapture,
    updateCapture,
} from './capture-store';

function makeCaptureRecord(overrides?: Partial<CaptureRecord>): Omit<CaptureRecord, 'id'> {
    return {
        url: 'https://example.com',
        title: 'Example',
        timestamp: new Date().toISOString(),
        format: 'png',
        imageBlobs: [new Blob(['test'])],
        pdfFilename: 'capture.pdf',
        scaleMultiplier: 1,
        domHash: 'abc123',
        screenshotHash: 'def456',
        signature: 'sig789',
        publicKeyFingerprint: 'fp000',
        metadata: {},
        ...overrides,
    };
}

describe('capture-store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        mockStore.clear();
        autoId = 0;
    });

    describe('saveCapture', () => {
        it('should save a capture record and return its id', async () => {
            const record = makeCaptureRecord();
            const id = await saveCapture(record);

            expect(id).toBe(1);
            expect(mockDb.add).toHaveBeenCalledWith(
                'captures',
                expect.objectContaining({
                    url: 'https://example.com',
                }),
            );
        });

        it('should assign incrementing ids', async () => {
            const id1 = await saveCapture(makeCaptureRecord());
            const id2 = await saveCapture(makeCaptureRecord({ url: 'https://other.com' }));

            expect(id1).toBe(1);
            expect(id2).toBe(2);
        });
    });

    describe('getCapture', () => {
        it('should retrieve a saved capture by id', async () => {
            await saveCapture(makeCaptureRecord({ url: 'https://test.com' }));

            const record = await getCapture(1);
            expect(record).toBeDefined();
            expect((record as CaptureRecord).url).toBe('https://test.com');
        });

        it('should return undefined for non-existent id', async () => {
            const record = await getCapture(999);
            expect(record).toBeUndefined();
        });
    });

    describe('getAllCaptures', () => {
        it('should return empty array when no captures exist', async () => {
            const all = await getAllCaptures();
            expect(all).toEqual([]);
        });

        it('should return all saved captures', async () => {
            await saveCapture(makeCaptureRecord({ url: 'https://a.com' }));
            await saveCapture(makeCaptureRecord({ url: 'https://b.com' }));

            const all = await getAllCaptures();
            expect(all).toHaveLength(2);
        });
    });

    describe('deleteCapture', () => {
        it('should remove a capture by id', async () => {
            await saveCapture(makeCaptureRecord());
            await deleteCapture(1);

            const record = await getCapture(1);
            expect(record).toBeUndefined();
        });

        it('should not throw when deleting non-existent id', async () => {
            await expect(deleteCapture(999)).resolves.toBeUndefined();
        });
    });

    describe('updateCapture', () => {
        it('should update an existing capture', async () => {
            await saveCapture(makeCaptureRecord({ url: 'https://old.com' }));

            const updated: CaptureRecord = {
                id: 1,
                ...makeCaptureRecord({ url: 'https://new.com' }),
            };
            const id = await updateCapture(updated);

            expect(id).toBe(1);
            expect(mockDb.put).toHaveBeenCalledWith('captures', expect.objectContaining({ url: 'https://new.com' }));
        });
    });

    describe('getCaptureCount', () => {
        it('should return 0 when no captures exist', async () => {
            const count = await getCaptureCount();
            expect(count).toBe(0);
        });

        it('should return correct count after saves', async () => {
            await saveCapture(makeCaptureRecord());
            await saveCapture(makeCaptureRecord());

            const count = await getCaptureCount();
            expect(count).toBe(2);
        });
    });

    describe('clearAllCaptures', () => {
        it('should remove all captures', async () => {
            await saveCapture(makeCaptureRecord());
            await saveCapture(makeCaptureRecord());
            await clearAllCaptures();

            const all = await getAllCaptures();
            expect(all).toEqual([]);
        });
    });
});
