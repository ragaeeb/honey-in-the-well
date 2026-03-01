import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    arrayBufferToBase64,
    arrayBufferToHex,
    base64ToArrayBuffer,
    generateKeyPair,
    getPublicKeyFingerprint,
    type KeyPairJwk,
    signData,
    verifySignature,
} from './ecdsa';

const mockPublicKeyJwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: 'base64x',
    y: 'base64y',
};

const mockPrivateKeyJwk: JsonWebKey = {
    ...mockPublicKeyJwk,
    d: 'base64d',
};

const mockKeyPair: KeyPairJwk = {
    publicKey: mockPublicKeyJwk,
    privateKey: mockPrivateKeyJwk,
};

function createMockArrayBuffer(bytes: number[]): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

describe('ecdsa', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.mocked(crypto.subtle.generateKey).mockResolvedValue({
            publicKey: {} as CryptoKey,
            privateKey: {} as CryptoKey,
        });
        vi.mocked(crypto.subtle.exportKey)
            .mockResolvedValueOnce(mockPublicKeyJwk as unknown as JsonWebKey)
            .mockResolvedValueOnce(mockPrivateKeyJwk as unknown as JsonWebKey);
        vi.mocked(crypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
        vi.mocked(crypto.subtle.sign).mockResolvedValue(createMockArrayBuffer([1, 2, 3, 4, 5]));
        vi.mocked(crypto.subtle.verify).mockResolvedValue(true);
        vi.mocked(crypto.subtle.digest).mockResolvedValue(createMockArrayBuffer([0xab, 0xcd, 0xef]));
    });

    describe('generateKeyPair', () => {
        it('should generate a key pair with public and private keys', async () => {
            const result = await generateKeyPair();

            expect(result).toEqual(mockKeyPair);
            expect(crypto.subtle.generateKey).toHaveBeenCalledWith({ name: 'ECDSA', namedCurve: 'P-256' }, true, [
                'sign',
                'verify',
            ]);
        });

        it('should export both keys as JWK format', async () => {
            await generateKeyPair();

            expect(crypto.subtle.exportKey).toHaveBeenCalledTimes(2);
            expect(crypto.subtle.exportKey).toHaveBeenNthCalledWith(1, 'jwk', expect.anything());
            expect(crypto.subtle.exportKey).toHaveBeenNthCalledWith(2, 'jwk', expect.anything());
        });
    });

    describe('signData', () => {
        it('should sign data with the private key and return signature buffer', async () => {
            const data = new TextEncoder().encode('hello');
            const result = await signData(mockPrivateKeyJwk, data.buffer as ArrayBuffer);

            expect(result).toBeInstanceOf(ArrayBuffer);
            expect(new Uint8Array(result)).toEqual(new Uint8Array([1, 2, 3, 4, 5]));
            expect(crypto.subtle.importKey).toHaveBeenCalledWith(
                'jwk',
                mockPrivateKeyJwk,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['sign'],
            );
            expect(crypto.subtle.sign).toHaveBeenCalledWith(
                { name: 'ECDSA', hash: 'SHA-256' },
                expect.anything(),
                data.buffer as ArrayBuffer,
            );
        });

        it('should throw on invalid JWK', async () => {
            const data = new TextEncoder().encode('hello');

            await expect(signData({} as JsonWebKey, data.buffer as ArrayBuffer)).rejects.toThrow('Invalid JWK');
        });
    });

    describe('verifySignature', () => {
        it('should return true when signature is valid', async () => {
            const data = new TextEncoder().encode('hello');
            const signature = createMockArrayBuffer([1, 2, 3]);

            const result = await verifySignature(mockPublicKeyJwk, signature, data.buffer as ArrayBuffer);

            expect(result).toBe(true);
            expect(crypto.subtle.importKey).toHaveBeenCalledWith(
                'jwk',
                mockPublicKeyJwk,
                { name: 'ECDSA', namedCurve: 'P-256' },
                false,
                ['verify'],
            );
            expect(crypto.subtle.verify).toHaveBeenCalledWith(
                { name: 'ECDSA', hash: 'SHA-256' },
                expect.anything(),
                signature,
                data.buffer as ArrayBuffer,
            );
        });

        it('should return false when signature is invalid', async () => {
            vi.mocked(crypto.subtle.verify).mockResolvedValue(false);
            const data = new TextEncoder().encode('hello');
            const signature = createMockArrayBuffer([1, 2, 3]);

            const result = await verifySignature(mockPublicKeyJwk, signature, data.buffer as ArrayBuffer);

            expect(result).toBe(false);
        });

        it('should throw on invalid JWK', async () => {
            const data = new TextEncoder().encode('hello');
            const signature = createMockArrayBuffer([1, 2, 3]);

            await expect(verifySignature({} as JsonWebKey, signature, data.buffer as ArrayBuffer)).rejects.toThrow(
                'Invalid JWK',
            );
        });
    });

    describe('getPublicKeyFingerprint', () => {
        it('should return hex string of SHA-256 hash of public key JSON', async () => {
            const result = await getPublicKeyFingerprint(mockPublicKeyJwk);

            expect(result).toBe('abcdef');
            expect(crypto.subtle.digest).toHaveBeenCalledWith(
                'SHA-256',
                new TextEncoder().encode(JSON.stringify(mockPublicKeyJwk)),
            );
        });
    });

    describe('arrayBufferToHex', () => {
        it('should convert ArrayBuffer to lowercase hex string', () => {
            const buffer = createMockArrayBuffer([0xab, 0xcd, 0xef, 0x01]);

            const result = arrayBufferToHex(buffer);

            expect(result).toBe('abcdef01');
        });

        it('should pad single-digit hex values with leading zero', () => {
            const buffer = createMockArrayBuffer([0x00, 0x0f]);

            const result = arrayBufferToHex(buffer);

            expect(result).toBe('000f');
        });

        it('should handle empty buffer', () => {
            const buffer = createMockArrayBuffer([]);

            const result = arrayBufferToHex(buffer);

            expect(result).toBe('');
        });
    });

    describe('arrayBufferToBase64', () => {
        it('should convert ArrayBuffer to base64 string', () => {
            const buffer = new TextEncoder().encode('hello').buffer as ArrayBuffer;

            const result = arrayBufferToBase64(buffer);

            expect(result).toBe('aGVsbG8=');
        });

        it('should handle empty buffer', () => {
            const buffer = createMockArrayBuffer([]);

            const result = arrayBufferToBase64(buffer);

            expect(result).toBe('');
        });

        it('should handle binary data', () => {
            const buffer = createMockArrayBuffer([0x00, 0xff, 0xab]);

            const result = arrayBufferToBase64(buffer);

            expect(result).toBe('AP+r');
        });
    });

    describe('base64ToArrayBuffer', () => {
        it('should convert base64 string to ArrayBuffer', () => {
            const base64 = 'aGVsbG8=';

            const result = base64ToArrayBuffer(base64);

            expect(new TextDecoder().decode(result)).toBe('hello');
        });

        it('should handle empty base64 string', () => {
            const base64 = '';

            const result = base64ToArrayBuffer(base64);

            expect(result.byteLength).toBe(0);
        });

        it('should round-trip with arrayBufferToBase64', () => {
            const original = createMockArrayBuffer([1, 2, 3, 255]);
            const base64 = arrayBufferToBase64(original);
            const result = base64ToArrayBuffer(base64);

            expect(new Uint8Array(result)).toEqual(new Uint8Array(original));
        });

        it('should throw on invalid base64', () => {
            expect(() => base64ToArrayBuffer('!!!')).toThrow('Invalid base64');
        });

        it('should throw when input is not a string', () => {
            expect(() => base64ToArrayBuffer(null as unknown as string)).toThrow('base64 must be a string');
        });
    });
});
