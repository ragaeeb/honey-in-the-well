import { beforeEach, describe, expect, it, vi } from 'vitest';
import { blobToUrl, canvasToBlob, loadImage, revokeObjectUrl } from './image';

describe('image utils', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('loadImage', () => {
        it('should resolve with image data when image loads successfully', async () => {
            const mockImg = {
                width: 800,
                height: 600,
                onload: null as (() => void) | null,
                onerror: null as ((e: Event) => void) | null,
                src: '',
                addEventListener: vi.fn(),
            };

            vi.stubGlobal(
                'Image',
                vi.fn(function (this: typeof mockImg) {
                    Object.assign(this, mockImg);
                    setTimeout(() => {
                        if (this.onload) {
                            this.onload();
                        }
                    }, 0);
                    return this;
                }),
            );

            const result = await loadImage('https://example.com/image.png');

            expect(result).toEqual({
                img: expect.any(Object),
                src: 'https://example.com/image.png',
                width: 800,
                height: 600,
            });
        });

        it('should reject on image load error', async () => {
            const mockImg = {
                width: 0,
                height: 0,
                onload: null as (() => void) | null,
                onerror: null as ((e: Event) => void) | null,
                src: '',
            };

            vi.stubGlobal(
                'Image',
                vi.fn(function (this: typeof mockImg) {
                    Object.assign(this, mockImg);
                    setTimeout(() => {
                        if (this.onerror) {
                            this.onerror(new Event('error'));
                        }
                    }, 0);
                    return this;
                }),
            );

            await expect(loadImage('https://example.com/bad.png')).rejects.toBeInstanceOf(Event);
        });

        it('should set img.src to trigger load', async () => {
            const mockImg = {
                width: 100,
                height: 100,
                onload: null as (() => void) | null,
                onerror: null as ((e: Event) => void) | null,
                src: '',
            };

            vi.stubGlobal(
                'Image',
                vi.fn(function (this: typeof mockImg) {
                    Object.assign(this, mockImg);
                    setTimeout(() => {
                        expect(this.src).toBe('https://example.com/img.png');
                        if (this.onload) {
                            this.onload();
                        }
                    }, 0);
                    return this;
                }),
            );

            await loadImage('https://example.com/img.png');
        });
    });

    describe('blobToUrl', () => {
        it('should call URL.createObjectURL and return the result', () => {
            const createObjectURL = vi.fn(() => 'blob:https://example.com/abc123');
            vi.stubGlobal('URL', {
                createObjectURL,
                revokeObjectURL: vi.fn(),
            });

            const blob = new Blob(['data']);
            const url = blobToUrl(blob);

            expect(createObjectURL).toHaveBeenCalledWith(blob);
            expect(url).toBe('blob:https://example.com/abc123');
        });
    });

    describe('revokeObjectUrl', () => {
        it('should call URL.revokeObjectURL with the given url', () => {
            const revokeObjectURL = vi.fn();
            vi.stubGlobal('URL', {
                createObjectURL: vi.fn(),
                revokeObjectURL,
            });

            revokeObjectUrl('blob:https://example.com/abc123');

            expect(revokeObjectURL).toHaveBeenCalledWith('blob:https://example.com/abc123');
        });
    });

    describe('canvasToBlob', () => {
        it('should resolve with blob when toBlob succeeds', async () => {
            const mockBlob = new Blob(['data'], { type: 'image/png' });
            const mockCanvas = {
                toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
                    cb(mockBlob);
                }),
            } as unknown as HTMLCanvasElement;

            const result = await canvasToBlob(mockCanvas, 'png');

            expect(result).toBe(mockBlob);
            expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png', undefined);
        });

        it('should use image/jpeg and quality 0.92 for jpg format', async () => {
            const mockBlob = new Blob(['data'], { type: 'image/jpeg' });
            const mockCanvas = {
                toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
                    cb(mockBlob);
                }),
            } as unknown as HTMLCanvasElement;

            const result = await canvasToBlob(mockCanvas, 'jpg');

            expect(result).toBe(mockBlob);
            expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.92);
        });

        it('should reject when toBlob returns null', async () => {
            const mockCanvas = {
                toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
                    cb(null);
                }),
            } as unknown as HTMLCanvasElement;

            await expect(canvasToBlob(mockCanvas, 'png')).rejects.toThrow('Canvas toBlob returned null');
        });

        it('should use image/webp for webp format', async () => {
            const mockBlob = new Blob(['data'], { type: 'image/webp' });
            const mockCanvas = {
                toBlob: vi.fn((cb: (blob: Blob | null) => void) => {
                    cb(mockBlob);
                }),
            } as unknown as HTMLCanvasElement;

            await canvasToBlob(mockCanvas, 'webp');

            expect(mockCanvas.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/webp', undefined);
        });
    });
});
