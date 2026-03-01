import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearKeyPair, getOrCreateKeyPair, getStoredKeyPair, storeKeyPair } from './key-store';

const mockKeyPair = {
    publicKey: { kty: 'EC', crv: 'P-256', x: 'x', y: 'y' } as JsonWebKey,
    privateKey: {
        kty: 'EC',
        crv: 'P-256',
        x: 'x',
        y: 'y',
        d: 'd',
    } as JsonWebKey,
};

describe('key-store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(chrome.runtime, 'lastError', {
            configurable: true,
            value: null,
        });

        vi.mocked(crypto.subtle.generateKey).mockResolvedValue({
            publicKey: {} as CryptoKey,
            privateKey: {} as CryptoKey,
        });
        vi.mocked(crypto.subtle.exportKey)
            .mockResolvedValueOnce(mockKeyPair.publicKey as unknown as JsonWebKey)
            .mockResolvedValueOnce(mockKeyPair.privateKey as unknown as JsonWebKey);
    });

    describe('getStoredKeyPair', () => {
        it('should return stored key pair when present', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({
                    hitw_ecdsa_keypair: mockKeyPair,
                });
            });

            const result = await getStoredKeyPair();

            expect(result).toEqual(mockKeyPair);
            expect(chrome.storage.local.get).toHaveBeenCalledWith(['hitw_ecdsa_keypair'], expect.any(Function));
        });

        it('should return null when no key pair is stored', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({});
            });

            const result = await getStoredKeyPair();

            expect(result).toBeNull();
        });

        it('should return null when stored data has no publicKey', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({ hitw_ecdsa_keypair: { privateKey: {} } });
            });

            const result = await getStoredKeyPair();

            expect(result).toBeNull();
        });

        it('should return null when stored data has no privateKey', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({ hitw_ecdsa_keypair: { publicKey: {} } });
            });

            const result = await getStoredKeyPair();

            expect(result).toBeNull();
        });
    });

    describe('storeKeyPair', () => {
        it('should store key pair in chrome storage', async () => {
            vi.mocked(chrome.storage.local.set).mockImplementation((_items, callback) => {
                callback?.();
            });

            await storeKeyPair(mockKeyPair);

            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                { hitw_ecdsa_keypair: mockKeyPair },
                expect.any(Function),
            );
        });

        it('should reject when chrome.storage reports an error', async () => {
            vi.mocked(chrome.storage.local.set).mockImplementation((_items, callback) => {
                Object.defineProperty(chrome.runtime, 'lastError', {
                    configurable: true,
                    value: {
                        message: 'Storage quota exceeded',
                    } as chrome.runtime.LastError,
                });
                callback?.();
            });

            await expect(storeKeyPair(mockKeyPair)).rejects.toThrow('Storage quota exceeded');
        });
    });

    describe('clearKeyPair', () => {
        it('should remove key pair from chrome storage', async () => {
            vi.mocked(chrome.storage.local.remove).mockImplementation((_keys, callback) => {
                callback?.();
            });

            await clearKeyPair();

            expect(chrome.storage.local.remove).toHaveBeenCalledWith(['hitw_ecdsa_keypair'], expect.any(Function));
        });
    });

    describe('getOrCreateKeyPair', () => {
        it('should return stored key pair when one exists', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({ hitw_ecdsa_keypair: mockKeyPair });
            });

            const result = await getOrCreateKeyPair();

            expect(result).toEqual(mockKeyPair);
            expect(chrome.storage.local.get).toHaveBeenCalled();
            expect(crypto.subtle.generateKey).not.toHaveBeenCalled();
        });

        it('should generate and store new key pair when none exists', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({});
            });
            vi.mocked(chrome.storage.local.set).mockImplementation((_items, callback) => {
                callback?.();
            });

            const result = await getOrCreateKeyPair();

            expect(result).toEqual(mockKeyPair);
            expect(crypto.subtle.generateKey).toHaveBeenCalled();
            expect(chrome.storage.local.set).toHaveBeenCalledWith(
                { hitw_ecdsa_keypair: mockKeyPair },
                expect.any(Function),
            );
        });

        it('should store the newly generated key pair before returning', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, callback) => {
                callback({});
            });
            const setCalls: unknown[] = [];
            vi.mocked(chrome.storage.local.set).mockImplementation((items, callback) => {
                setCalls.push(items);
                callback?.();
            });

            await getOrCreateKeyPair();

            expect(setCalls).toHaveLength(1);
            expect((setCalls[0] as Record<string, unknown>).hitw_ecdsa_keypair).toEqual(mockKeyPair);
        });
    });
});
