import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type CaptureMetadata, signCapture } from './signer';

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

function createMockArrayBuffer(bytes: number[]): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

const sampleMetadata: CaptureMetadata = {
    url: 'https://example.com',
    title: 'Example Page',
    timestamp: '2025-02-27T12:00:00Z',
    domHash: 'abc123',
    screenshotHash: 'def456',
    dimensions: {
        width: 1920,
        height: 1080,
        devicePixelRatio: 2,
    },
};

describe('signer', () => {
    beforeEach(() => {
        vi.mocked(crypto.subtle.importKey).mockResolvedValue({} as CryptoKey);
        vi.mocked(crypto.subtle.sign).mockResolvedValue(createMockArrayBuffer([1, 2, 3, 4, 5]));
        vi.mocked(crypto.subtle.digest).mockResolvedValue(createMockArrayBuffer([0xab, 0xcd, 0xef]));
    });

    describe('signCapture', () => {
        it('should sign capture metadata and return SignedCapture with base64 signature', async () => {
            const result = await signCapture(sampleMetadata, mockPrivateKeyJwk, mockPublicKeyJwk);

            expect(result).toEqual({
                metadata: sampleMetadata,
                signature: 'AQIDBAU=',
                publicKeyFingerprint: 'abcdef',
            });
        });

        it('should include metadata unchanged in the result', async () => {
            const result = await signCapture(sampleMetadata, mockPrivateKeyJwk, mockPublicKeyJwk);

            expect(result.metadata).toEqual(sampleMetadata);
        });

        it('should sign the JSON-stringified metadata payload', async () => {
            await signCapture(sampleMetadata, mockPrivateKeyJwk, mockPublicKeyJwk);

            const expectedPayload = new TextEncoder().encode(JSON.stringify(sampleMetadata));
            expect(crypto.subtle.sign).toHaveBeenCalledWith(
                { name: 'ECDSA', hash: 'SHA-256' },
                expect.anything(),
                expectedPayload,
            );
        });

        it('should compute public key fingerprint from public key JWK', async () => {
            await signCapture(sampleMetadata, mockPrivateKeyJwk, mockPublicKeyJwk);

            expect(crypto.subtle.digest).toHaveBeenCalledWith(
                'SHA-256',
                new TextEncoder().encode(JSON.stringify(mockPublicKeyJwk)),
            );
        });

        it('should return signature as base64 encoded string', async () => {
            // Signature bytes [1,2,3,4,5] => base64 "AQIDBAU="
            const result = await signCapture(sampleMetadata, mockPrivateKeyJwk, mockPublicKeyJwk);

            expect(result.signature).toBe('AQIDBAU=');
            expect(typeof result.signature).toBe('string');
            expect(result.signature).toMatch(/^[A-Za-z0-9+/=]+$/);
        });
    });
});
