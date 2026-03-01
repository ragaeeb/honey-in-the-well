import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    arrayBufferToBase64,
    arrayBufferToHex,
    base64ToArrayBuffer,
    generateKeyPair,
    getPublicKeyFingerprint,
    verifySignature,
} from '../../src/lib/crypto/ecdsa';
import { type CaptureMetadata, signCapture } from '../../src/lib/crypto/signer';

describe('crypto integration - sign and verify round-trip', () => {
    const mockPrivateKey: JsonWebKey = {
        kty: 'EC',
        crv: 'P-256',
        d: 'mock-private-d',
        x: 'mock-x',
        y: 'mock-y',
    };
    const mockPublicKey: JsonWebKey = {
        kty: 'EC',
        crv: 'P-256',
        x: 'mock-x',
        y: 'mock-y',
    };
    const mockSignature = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]).buffer;

    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(crypto.subtle.generateKey).mockResolvedValue({
            publicKey: {} as CryptoKey,
            privateKey: {} as CryptoKey,
        } as CryptoKeyPair);
        vi.mocked(crypto.subtle.exportKey).mockImplementation(async (_format: string, key: CryptoKey) => {
            if (key === ({} as CryptoKeyPair).publicKey) {
                return mockPublicKey;
            }
            return mockPrivateKey;
        });
        vi.mocked(crypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
        vi.mocked(crypto.subtle.sign).mockResolvedValue(mockSignature);
        vi.mocked(crypto.subtle.verify).mockResolvedValue(true);
        vi.mocked(crypto.subtle.digest).mockResolvedValue(new Uint8Array([0xab, 0xcd]).buffer);
    });

    it('should generate keys, sign metadata, and verify signature', async () => {
        const keyPair = await generateKeyPair();
        expect(keyPair).toBeDefined();

        const metadata: CaptureMetadata = {
            url: 'https://example.com',
            title: 'Example',
            timestamp: new Date().toISOString(),
            domHash: 'abc123',
            screenshotHash: 'def456',
            dimensions: { width: 1920, height: 1080, devicePixelRatio: 2 },
        };

        const signed = await signCapture(metadata, keyPair.privateKey, keyPair.publicKey);

        expect(signed.metadata).toEqual(metadata);
        expect(signed.signature).toBeTruthy();
        expect(signed.publicKeyFingerprint).toBeTruthy();

        const sigBuffer = base64ToArrayBuffer(signed.signature);
        expect(sigBuffer.byteLength).toBeGreaterThan(0);

        const payload = JSON.stringify(metadata);
        const encoded = new TextEncoder().encode(payload);
        const isValid = await verifySignature(keyPair.publicKey, sigBuffer, encoded.buffer as ArrayBuffer);
        expect(isValid).toBe(true);
    });

    it('should produce deterministic fingerprints for same key', async () => {
        const fp1 = await getPublicKeyFingerprint(mockPublicKey);
        const fp2 = await getPublicKeyFingerprint(mockPublicKey);
        expect(fp1).toBe(fp2);
        expect(fp1.length).toBeGreaterThan(0);
    });

    it('should convert between base64 and ArrayBuffer consistently', () => {
        const original = new Uint8Array([10, 20, 30, 40, 50]);
        const base64 = arrayBufferToBase64(original.buffer);
        const roundTripped = base64ToArrayBuffer(base64);
        expect(new Uint8Array(roundTripped)).toEqual(original);
    });

    it('should convert ArrayBuffer to hex correctly', () => {
        const bytes = new Uint8Array([0, 1, 15, 16, 255]);
        const hex = arrayBufferToHex(bytes.buffer);
        expect(hex).toBe('00010f10ff');
    });
});
