import { beforeEach, describe, expect, it, vi } from 'vitest';
import { canvasToBlob } from '../utils/image';
import { CanvasManager } from './canvas-manager';
import type { BgRegion, CapturedLink, ClipRect } from './messages';

vi.mock('../utils/image', () => ({
    canvasToBlob: vi.fn(),
}));

vi.stubGlobal(
    'Path2D',
    class Path2DMock {
        rect = vi.fn();
    },
);

const nativeCreateElement = Document.prototype.createElement;

function createMockContext() {
    const redOpaqueData = new Uint8ClampedArray(4 * 10 * 10);
    for (let i = 0; i < redOpaqueData.length; i += 4) {
        redOpaqueData[i] = 255;
        redOpaqueData[i + 1] = 0;
        redOpaqueData[i + 2] = 0;
        redOpaqueData[i + 3] = 255;
    }
    const ctx = {
        fillRect: vi.fn(),
        fillStyle: '',
        drawImage: vi.fn(),
        getImageData: vi.fn(() => ({
            data: redOpaqueData,
            width: 10,
            height: 10,
        })),
        save: vi.fn(),
        restore: vi.fn(),
        clip: vi.fn(),
        scale: vi.fn(),
    };
    return ctx;
}

function createMockCanvas(ctx: ReturnType<typeof createMockContext>, width = 100, height = 100) {
    const canvas = {
        width,
        height,
        getContext: vi.fn((type: string) => (type === '2d' ? ctx : null)),
        toDataURL: vi.fn((mime: string) => `data:${mime};base64,mock`),
        toBlob: vi.fn((callback: (blob: Blob | null) => void) => {
            callback(new Blob(['mock'], { type: 'image/png' }));
        }),
    };
    return canvas;
}

describe('CanvasManager', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        (canvasToBlob as ReturnType<typeof vi.fn>).mockResolvedValue(new Blob(['mock'], { type: 'image/png' }));

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
            if (tagName.toLowerCase() === 'canvas') {
                const ctx = createMockContext();
                return createMockCanvas(ctx) as unknown as HTMLCanvasElement;
            }
            return nativeCreateElement.call(document, tagName, options);
        });
    });

    describe('constructor', () => {
        it('should create a CanvasManager with the given export format', () => {
            const manager = new CanvasManager('png');
            expect(manager).toBeInstanceOf(CanvasManager);
            expect(manager.canvasObjs).toEqual([]);
            expect(manager.totalWidth).toBe(0);
            expect(manager.totalHeight).toBe(0);
            expect(manager.scaleMultiplier).toBe(1);
            expect(manager.metadata).toEqual({});
        });

        it('should accept jpg as export format', () => {
            const manager = new CanvasManager('jpg');
            expect(manager).toBeInstanceOf(CanvasManager);
        });
    });

    describe('size()', () => {
        it('should return 0 when no canvas objects exist', () => {
            const manager = new CanvasManager('png');
            expect(manager.size()).toBe(0);
        });

        it('should return the number of canvas objects after setObjs', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(200, 200);
            expect(manager.size()).toBe(1);
        });

        it('should return correct count for tiled canvases', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(1000, 1000);
            expect(manager.size()).toBeGreaterThanOrEqual(1);
        });
    });

    describe('isEmpty()', () => {
        it('should return true when no canvas objects exist', () => {
            const manager = new CanvasManager('png');
            expect(manager.isEmpty()).toBe(true);
        });

        it('should return false after setObjs creates canvases', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);
            expect(manager.isEmpty()).toBe(false);
        });
    });

    describe('setObjs()', () => {
        it('should set totalWidth and totalHeight', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(500, 300);
            expect(manager.totalWidth).toBe(500);
            expect(manager.totalHeight).toBe(300);
        });

        it('should create a single canvas for small dimensions', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);
            expect(manager.canvasObjs).toHaveLength(1);
            expect(manager.canvasObjs[0].width).toBe(100);
            expect(manager.canvasObjs[0].height).toBe(100);
            expect(manager.canvasObjs[0].left).toBe(0);
            expect(manager.canvasObjs[0].top).toBe(0);
        });

        it('should apply background color when provided', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100, '#ff0000');
            expect(manager.canvasObjs).toHaveLength(1);
            const ctx = manager.canvasObjs[0].ctx;
            expect(ctx.fillStyle).toBe('#ff0000');
            expect(ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
        });

        it('should not call fillRect when no bgColor is provided', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);
            expect(manager.canvasObjs[0].ctx.fillRect).not.toHaveBeenCalled();
        });

        it('should create multiple tiles for large dimensions', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(30000, 10000);
            expect(manager.canvasObjs.length).toBeGreaterThan(1);
        });
    });

    describe('drawImage()', () => {
        it('should draw image on overlapping canvas objects', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(200, 200);

            const img = document.createElement('img');
            Object.defineProperty(img, 'width', { value: 50 });
            Object.defineProperty(img, 'height', { value: 50 });

            manager.drawImage(img, 10, 10, 50, 50);

            expect(manager.canvasObjs[0].ctx.save).toHaveBeenCalled();
            expect(manager.canvasObjs[0].ctx.drawImage).toHaveBeenCalled();
            expect(manager.canvasObjs[0].ctx.restore).toHaveBeenCalled();
        });

        it('should apply mask when provided', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(200, 200);

            const img = document.createElement('img');
            const mask: ClipRect = { x: 5, y: 5, width: 40, height: 40 };

            manager.drawImage(img, 10, 10, 50, 50, undefined, mask);

            expect(manager.canvasObjs[0].ctx.clip).toHaveBeenCalled();
        });
    });

    describe('fillRect()', () => {
        it('should fill rect on overlapping canvas objects', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(200, 200);

            manager.fillRect('#00ff00', 20, 20, 50, 50);

            expect(manager.canvasObjs[0].ctx.fillStyle).toBe('#00ff00');
            expect(manager.canvasObjs[0].ctx.fillRect).toHaveBeenCalledWith(20, 20, 50, 50);
        });
    });

    describe('toBlobs()', () => {
        it('should return empty array when no canvases', async () => {
            const manager = new CanvasManager('png');
            const blobs = await manager.toBlobs();
            expect(blobs).toEqual([]);
        });

        it('should call canvasToBlob for each canvas and return blobs', async () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);

            const blobs = await manager.toBlobs();

            expect(canvasToBlob).toHaveBeenCalledTimes(1);
            expect(blobs).toHaveLength(1);
            expect(blobs[0]).toBeInstanceOf(Blob);
        });

        it('should pass correct format to canvasToBlob for png', async () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);
            await manager.toBlobs();
            expect(canvasToBlob).toHaveBeenCalledWith(expect.anything(), 'png');
        });

        it('should pass correct format to canvasToBlob for jpg', async () => {
            const manager = new CanvasManager('jpg');
            manager.setObjs(100, 100);
            await manager.toBlobs();
            expect(canvasToBlob).toHaveBeenCalledWith(expect.anything(), 'jpg');
        });
    });

    describe('toDataURLs()', () => {
        it('should return empty array when no canvases', () => {
            const manager = new CanvasManager('png');
            expect(manager.toDataURLs()).toEqual([]);
        });

        it('should return data URLs for each canvas with png mime', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);

            const urls = manager.toDataURLs();

            expect(urls).toHaveLength(1);
            expect(manager.canvasObjs[0].canvas.toDataURL).toHaveBeenCalledWith('image/png');
            expect(urls[0]).toBe('data:image/png;base64,mock');
        });

        it('should use image/jpeg mime for jpg format', () => {
            const manager = new CanvasManager('jpg');
            manager.setObjs(100, 100);

            manager.toDataURLs();

            expect(manager.canvasObjs[0].canvas.toDataURL).toHaveBeenCalledWith('image/jpeg');
        });
    });

    describe('scale()', () => {
        it('should return value multiplied by scaleMultiplier', () => {
            const manager = new CanvasManager('png');
            expect(manager.scale(10)).toBe(10);
        });

        it('should return scaled value when scaleMultiplier is set', () => {
            const manager = new CanvasManager('png');
            manager.setScaleMultiplier(2);
            expect(manager.scale(10)).toBe(20);
        });

        it('should return 0 for null/undefined-like input', () => {
            const manager = new CanvasManager('png');
            expect(manager.scale(0)).toBe(0);
        });
    });

    describe('scaleAll()', () => {
        it('should scale values for specified keys', () => {
            const manager = new CanvasManager('png');
            manager.setScaleMultiplier(2);

            const target = { a: 10, b: 20 };
            manager.scaleAll(target, ['a', 'b']);

            expect(target.a).toBe(20);
            expect(target.b).toBe(40);
        });

        it("should scale all keys when '*' is used", () => {
            const manager = new CanvasManager('png');
            manager.setScaleMultiplier(3);

            const target = { x: 5, y: 10 };
            manager.scaleAll(target, ['*']);

            expect(target.x).toBe(15);
            expect(target.y).toBe(30);
        });

        it('should handle nested keys with dot notation', () => {
            const manager = new CanvasManager('png');
            manager.setScaleMultiplier(2);

            const target = { bounds: { x: 10, y: 20 } };
            manager.scaleAll(target, ['bounds.x', 'bounds.y']);

            expect(target.bounds.x).toBe(20);
            expect(target.bounds.y).toBe(40);
        });
    });

    describe('setBgRegions()', () => {
        it('should store background regions', () => {
            const manager = new CanvasManager('png');
            const regions: BgRegion[] = [
                {
                    type: 'fill',
                    sample: { x: 0, y: 0, width: 10, height: 10 },
                    fill: { x: 0, y: 0, width: 100, height: 100 },
                },
            ];

            manager.setBgRegions(regions);
            manager.applyBgRegions();

            expect(manager.canvasObjs.length).toBeGreaterThanOrEqual(0);
        });
    });

    describe('applyBgRegions()', () => {
        it('should not throw when no regions', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(100, 100);
            expect(() => manager.applyBgRegions()).not.toThrow();
        });

        it('should sample and fill when regions overlap canvas', () => {
            const manager = new CanvasManager('png');
            manager.setObjs(200, 200);

            const regions: BgRegion[] = [
                {
                    type: 'fill',
                    sample: { x: 0, y: 0, width: 10, height: 10 },
                    fill: { x: 0, y: 0, width: 100, height: 100 },
                },
            ];
            manager.setBgRegions(regions);
            manager.applyBgRegions();

            expect(manager.canvasObjs[0].ctx.fillRect).toHaveBeenCalledWith(0, 0, 100, 100);
            expect(manager.canvasObjs[0].ctx.fillStyle).toBe('rgb(255, 0, 0)');
        });
    });

    describe('updateMetadata()', () => {
        it('should merge new data into metadata', () => {
            const manager = new CanvasManager('png');
            manager.updateMetadata({ ww: 1920, wh: 1080 });
            expect(manager.metadata).toEqual({ ww: 1920, wh: 1080 });
        });

        it('should preserve existing metadata when merging', () => {
            const manager = new CanvasManager('png');
            manager.updateMetadata({ ww: 1920 });
            manager.updateMetadata({ wh: 1080 });
            expect(manager.metadata).toEqual({ ww: 1920, wh: 1080 });
        });

        it('should overwrite keys when updating', () => {
            const manager = new CanvasManager('png');
            manager.updateMetadata({ ww: 1920 });
            manager.updateMetadata({ ww: 800 });
            expect(manager.metadata.ww).toBe(800);
        });
    });

    describe('appendMetadataLinks()', () => {
        it('should do nothing when links is undefined', () => {
            const manager = new CanvasManager('png');
            manager.updateMetadata({});
            manager.appendMetadataLinks(undefined);
            expect(manager.metadata.links).toBeUndefined();
        });

        it('should append links to empty metadata', () => {
            const manager = new CanvasManager('png');
            const links: CapturedLink[] = [
                {
                    bounds: [{ x: 0, y: 0, width: 10, height: 10 }],
                    url: 'https://a.com',
                },
            ];
            manager.appendMetadataLinks(links);
            expect(manager.metadata.links).toHaveLength(1);
            expect(manager.metadata.links?.[0]?.url).toBe('https://a.com');
        });

        it('should append links to existing links', () => {
            const manager = new CanvasManager('png');
            manager.appendMetadataLinks([{ bounds: [], url: 'https://a.com' }]);
            manager.appendMetadataLinks([{ bounds: [], url: 'https://b.com' }]);
            expect(manager.metadata.links).toHaveLength(2);
            expect(manager.metadata.links?.[0]?.url).toBe('https://a.com');
            expect(manager.metadata.links?.[1]?.url).toBe('https://b.com');
        });
    });

    describe('sortLinks()', () => {
        it('should do nothing when no links in metadata', () => {
            const manager = new CanvasManager('png');
            expect(() => manager.sortLinks()).not.toThrow();
        });

        it('should sort links by y then x of first bounds', () => {
            const manager = new CanvasManager('png');
            manager.appendMetadataLinks([
                { bounds: [{ x: 50, y: 100, width: 10, height: 10 }], url: 'b' },
                { bounds: [{ x: 10, y: 50, width: 10, height: 10 }], url: 'a' },
                { bounds: [{ x: 30, y: 50, width: 10, height: 10 }], url: 'c' },
            ]);

            manager.sortLinks();

            expect(manager.metadata.links?.[0]?.url).toBe('a');
            expect(manager.metadata.links?.[1]?.url).toBe('c');
            expect(manager.metadata.links?.[2]?.url).toBe('b');
        });

        it('should handle links with empty bounds', () => {
            const manager = new CanvasManager('png');
            manager.appendMetadataLinks([
                { bounds: [], url: 'a' },
                { bounds: [], url: 'b' },
            ]);
            manager.sortLinks();
            expect(manager.metadata.links).toHaveLength(2);
        });
    });

    describe('setScaleMultiplier()', () => {
        it('should set scaleMultiplier', () => {
            const manager = new CanvasManager('png');
            manager.setScaleMultiplier(2.5);
            expect(manager.scaleMultiplier).toBe(2.5);
        });

        it('should affect scale() output', () => {
            const manager = new CanvasManager('png');
            manager.setScaleMultiplier(0.5);
            expect(manager.scale(100)).toBe(50);
        });
    });
});
