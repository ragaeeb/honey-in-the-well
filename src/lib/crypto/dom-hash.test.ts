import { beforeEach, describe, expect, it, vi } from 'vitest';
import { captureDomSnapshot, hashBlob, hashDomContent } from './dom-hash';

function createMockArrayBuffer(bytes: number[]): ArrayBuffer {
    const buffer = new ArrayBuffer(bytes.length);
    new Uint8Array(buffer).set(bytes);
    return buffer;
}

describe('dom-hash', () => {
    beforeEach(() => {
        vi.mocked(crypto.subtle.digest).mockResolvedValue(createMockArrayBuffer([0xab, 0xcd, 0xef, 0x12]));
    });

    describe('hashDomContent', () => {
        it('should hash HTML content and return hex string', async () => {
            const html = '<html><body>Hello</body></html>';

            const result = await hashDomContent(html);

            expect(result).toBe('abcdef12');
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', new TextEncoder().encode(html));
        });

        it('should handle empty string', async () => {
            const result = await hashDomContent('');

            expect(result).toBe('abcdef12');
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', new Uint8Array(0));
        });

        it('should handle unicode content', async () => {
            const html = '<p>日本語テスト</p>';

            const result = await hashDomContent(html);

            expect(typeof result).toBe('string');
            expect(result).toMatch(/^[0-9a-f]+$/);
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', new TextEncoder().encode(html));
        });
    });

    describe('hashBlob', () => {
        it('should hash blob content and return hex string', async () => {
            const content = 'blob content';
            const blob = new Blob([content]);

            const result = await hashBlob(blob);

            expect(result).toBe('abcdef12');
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', await blob.arrayBuffer());
        });

        it('should handle empty blob', async () => {
            const blob = new Blob([]);

            const result = await hashBlob(blob);

            expect(result).toBe('abcdef12');
            expect(crypto.subtle.digest).toHaveBeenCalledWith('SHA-256', expect.any(ArrayBuffer));
        });

        it('should handle binary blob content', async () => {
            const bytes = new Uint8Array([0x00, 0xff, 0xab]);
            const blob = new Blob([bytes]);

            const result = await hashBlob(blob);

            expect(result).toBe('abcdef12');
        });
    });

    describe('captureDomSnapshot', () => {
        it('should return document.documentElement.outerHTML', () => {
            // happy-dom provides a document; we need to set up the HTML
            document.documentElement.innerHTML = '<html><head></head><body><div>Test</div></body></html>';

            const result = captureDomSnapshot();

            expect(result).toContain('<html');
            expect(result).toContain('<body>');
            expect(result).toContain('<div>Test</div>');
            expect(result).toBe(document.documentElement.outerHTML);
        });

        it('should capture the full document structure', () => {
            document.documentElement.innerHTML = '<head><title>Page</title></head><body><h1>Hello</h1></body>';

            const result = captureDomSnapshot();

            expect(result).toContain('Page');
            expect(result).toContain('Hello');
        });
    });
});
