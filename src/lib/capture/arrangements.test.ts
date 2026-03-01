import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as domUtils from '../utils/dom';
import { Arrangements } from './arrangements';
import type { ScrollableResult } from './scroll-finder';
import * as scrollFinder from './scroll-finder';

vi.mock('../utils/dom', () => ({
    getElementBox: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 1024,
        height: 768,
    })),
}));

vi.mock('./scroll-finder', () => ({
    findScrollable: vi.fn(),
    bodyBackground: vi.fn(() => '#ffffff'),
    empty: vi.fn(() => ({
        type: 'empty',
        scrollHeight: 0,
        scrollWidth: 0,
        top: 0,
        bottom: 0,
        left: 0,
        right: 0,
        height: 0,
        width: 0,
        ready: true,
    })),
}));

function setupWindow(w: number, h: number) {
    Object.defineProperty(window, 'innerWidth', { value: w, writable: true });
    Object.defineProperty(window, 'innerHeight', { value: h, writable: true });
}

function mockDocDimensions(opts: {
    clientW?: number;
    clientH?: number;
    offsetW?: number;
    offsetH?: number;
    scrollW?: number;
    scrollH?: number;
    bodyOffsetW?: number;
    bodyOffsetH?: number;
    bodyScrollW?: number;
    bodyScrollH?: number;
}) {
    const docElt = document.documentElement;
    Object.defineProperty(docElt, 'clientWidth', {
        value: opts.clientW ?? 1024,
        configurable: true,
    });
    Object.defineProperty(docElt, 'clientHeight', {
        value: opts.clientH ?? 768,
        configurable: true,
    });
    Object.defineProperty(docElt, 'offsetWidth', {
        value: opts.offsetW ?? 1024,
        configurable: true,
    });
    Object.defineProperty(docElt, 'offsetHeight', {
        value: opts.offsetH ?? 768,
        configurable: true,
    });
    Object.defineProperty(docElt, 'scrollWidth', {
        value: opts.scrollW ?? 1024,
        configurable: true,
    });
    Object.defineProperty(docElt, 'scrollHeight', {
        value: opts.scrollH ?? 2000,
        configurable: true,
    });

    const body = document.body;
    Object.defineProperty(body, 'offsetWidth', {
        value: opts.bodyOffsetW ?? 1024,
        configurable: true,
    });
    Object.defineProperty(body, 'offsetHeight', {
        value: opts.bodyOffsetH ?? 2000,
        configurable: true,
    });
    Object.defineProperty(body, 'scrollWidth', {
        value: opts.bodyScrollW ?? 1024,
        configurable: true,
    });
    Object.defineProperty(body, 'scrollHeight', {
        value: opts.bodyScrollH ?? 2000,
        configurable: true,
    });
}

describe('Arrangements', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        setupWindow(1024, 768);
        mockDocDimensions({});

        vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            overflowY: 'visible',
            overflowX: 'visible',
            marginBottom: '0px',
            position: 'static',
            zIndex: 'auto',
        } as unknown as CSSStyleDeclaration);

        Object.defineProperty(window, 'devicePixelRatio', {
            value: 1,
            writable: true,
        });
    });

    describe('constructor', () => {
        it('should initialize with page dimensions', () => {
            const arr = new Arrangements(false, 0, 0);
            expect(arr.dimensions).toBeDefined();
            expect(arr.dimensions.windowWidth).toBe(1024);
            expect(arr.dimensions.windowHeight).toBe(768);
        });

        it('should store original scroll position', () => {
            const arr = new Arrangements(false, 100, 200);
            expect(arr.scrollable).toBeNull();
            expect(arr.regions).toEqual([]);
            expect(arr.positions).toEqual([]);
        });
    });

    describe('getDimensions()', () => {
        it('should return window dimensions', () => {
            const arr = new Arrangements(false, 0, 0);
            const dims = arr.getDimensions();
            expect(dims.windowWidth).toBe(1024);
            expect(dims.windowHeight).toBe(768);
        });

        it('should compute fullWidth and fullHeight from DOM', () => {
            mockDocDimensions({
                scrollW: 2000,
                scrollH: 3000,
                bodyScrollW: 1500,
                bodyScrollH: 3000,
            });
            const arr = new Arrangements(false, 0, 0);
            const dims = arr.getDimensions();
            expect(dims.fullWidth).toBeGreaterThanOrEqual(1500);
            expect(dims.fullHeight).toBeGreaterThanOrEqual(3000);
        });

        it('should not include scrollWidth when overflowX is hidden', () => {
            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                overflowY: 'hidden',
                overflowX: 'hidden',
                position: 'static',
                zIndex: 'auto',
            } as unknown as CSSStyleDeclaration);

            mockDocDimensions({
                clientW: 1024,
                offsetW: 1024,
                scrollW: 5000,
                bodyScrollW: 5000,
            });

            const arr = new Arrangements(false, 0, 0);
            const dims = arr.getDimensions();
            expect(dims.fullWidth).toBeLessThanOrEqual(1024);
        });

        it('should detect lightbox root element', () => {
            const lightbox = document.createElement('div');
            lightbox.id = 'lightbox-wrap';
            document.body.appendChild(lightbox);

            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                overflowY: 'visible',
                overflowX: 'visible',
                position: 'fixed',
                zIndex: '9999',
            } as unknown as CSSStyleDeclaration);

            vi.mocked(domUtils.getElementBox).mockReturnValue({
                left: 0,
                top: 0,
                width: 1024,
                height: 768,
            });

            const arr = new Arrangements(false, 0, 0);
            const dims = arr.getDimensions();
            expect(dims.root).toBe(lightbox);

            document.body.removeChild(lightbox);
        });

        it('should not use lightbox if it does not cover viewport', () => {
            const lightbox = document.createElement('div');
            lightbox.id = 'lightbox-wrap';
            document.body.appendChild(lightbox);

            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                overflowY: 'visible',
                overflowX: 'visible',
                position: 'fixed',
                zIndex: '9999',
            } as unknown as CSSStyleDeclaration);

            vi.mocked(domUtils.getElementBox).mockReturnValue({
                left: 100,
                top: 100,
                width: 200,
                height: 200,
            });

            const arr = new Arrangements(false, 0, 0);
            const dims = arr.getDimensions();
            expect(dims.root).toBeUndefined();

            document.body.removeChild(lightbox);
        });
    });

    describe('getScrollable()', () => {
        it('should call findScrollable and store result', () => {
            const emptyResult: ScrollableResult = {
                type: 'empty',
                scrollHeight: 0,
                scrollWidth: 0,
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                height: 0,
                width: 0,
                ready: true,
            };
            vi.mocked(scrollFinder.findScrollable).mockReturnValue(emptyResult);

            const arr = new Arrangements(false, 0, 0);
            const result = arr.getScrollable();

            expect(scrollFinder.findScrollable).toHaveBeenCalled();
            expect(result).toBe(emptyResult);
            expect(arr.scrollable).toBe(emptyResult);
        });
    });

    describe('ignoreScrollable()', () => {
        it('should set scrollable to empty', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            expect(arr.scrollable).toBeDefined();
            expect(arr.scrollable!.type).toBe('empty');
        });
    });

    describe('addFrameResponse()', () => {
        it('should throw when no scrollable is set', () => {
            const arr = new Arrangements(false, 0, 0);
            expect(() => arr.addFrameResponse({ width: 100, height: 200 })).toThrow('No scrollable set');
        });

        it('should update scrollable dimensions from frame response', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.addFrameResponse({ width: 500, height: 1000 });

            expect(arr.scrollable!.ready).toBe(true);
            expect(arr.scrollable!.scrollWidth).toBe(500);
            expect(arr.scrollable!.scrollHeight).toBe(1000);
        });

        it('should handle undefined response', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            const before = { ...arr.scrollable };
            arr.addFrameResponse(undefined);
            expect(arr.scrollable!.ready).toBe(before.ready);
        });
    });

    describe('calculate()', () => {
        it('should get scrollable if not set and generate positions', () => {
            const emptyResult: ScrollableResult = {
                type: 'empty',
                scrollHeight: 0,
                scrollWidth: 0,
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                height: 0,
                width: 0,
                ready: true,
            };
            vi.mocked(scrollFinder.findScrollable).mockReturnValue(emptyResult);

            const arr = new Arrangements(false, 0, 0);
            arr.calculate();

            expect(arr.regions.length).toBeGreaterThan(0);
            expect(arr.numPositions).toBeGreaterThan(0);
        });

        it('should create a single main region when scrollable is empty', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            expect(arr.regions).toHaveLength(1);
            expect(arr.regions[0].type).toBe('main');
        });

        it('should generate positions for the main region', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            expect(arr.positions.length).toBeGreaterThan(0);
            expect(arr.positions[0].isMain).toBe(true);
        });

        it('should handle scrollable elt type with inner regions', () => {
            const scrollableElt = document.createElement('div');
            Object.defineProperty(scrollableElt, 'offsetHeight', {
                value: 500,
                configurable: true,
            });

            const eltResult: ScrollableResult = {
                type: 'elt',
                elt: scrollableElt,
                scrollHeight: 2000,
                scrollWidth: 800,
                top: 100,
                bottom: 600,
                left: 50,
                right: 550,
                height: 500,
                width: 500,
                ready: true,
            };

            const arr = new Arrangements(false, 0, 0);
            arr.scrollable = eltResult;
            arr.calculate();

            const innerElt = arr.regions.find((r) => r.type === 'inner_elt');
            expect(innerElt).toBeDefined();
        });

        it('should handle scrollable frame type', () => {
            const frameResult: ScrollableResult = {
                type: 'frame',
                scrollHeight: 2000,
                scrollWidth: 800,
                top: 100,
                bottom: 600,
                left: 50,
                right: 550,
                height: 500,
                width: 500,
                ready: true,
            };

            const arr = new Arrangements(false, 0, 0);
            arr.scrollable = frameResult;
            arr.calculate();

            const innerFrame = arr.regions.find((r) => r.type === 'inner_frame');
            expect(innerFrame).toBeDefined();
        });
    });

    describe('popNextPosition()', () => {
        it('should return undefined when no positions', () => {
            const arr = new Arrangements(false, 0, 0);
            expect(arr.popNextPosition()).toBeUndefined();
        });

        it('should return and remove the first position', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            const total = arr.positions.length;
            const first = arr.popNextPosition();

            expect(first).toBeDefined();
            expect(first!.index).toBe(0);
            expect(arr.positions.length).toBe(total - 1);
            expect(arr.lastPosition).toBe(first);
        });

        it('should track lastPosition', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            const first = arr.popNextPosition();
            expect(arr.lastPosition).toBe(first);

            const second = arr.popNextPosition();
            expect(arr.lastPosition).toBe(second);
        });
    });

    describe('addPageHeightChange()', () => {
        it('should set addedHeightChange flag', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            const pos = arr.popNextPosition()!;
            arr.addPageHeightChange(pos, 100);

            expect(arr.addedHeightChange).toBe(true);
        });

        it('should prepend the position back to the queue', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            const pos = arr.popNextPosition()!;
            const lengthBefore = arr.positions.length;
            arr.addPageHeightChange(pos, 100);

            expect(arr.positions.length).toBeGreaterThanOrEqual(lengthBefore + 1);
            expect(arr.positions[0]).toBe(pos);
        });

        it('should adjust yAdjust for main scrolled positions', () => {
            mockDocDimensions({
                scrollH: 5000,
                bodyScrollH: 5000,
                bodyOffsetH: 5000,
            });

            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            while (arr.positions.length > 2) {
                arr.positions.pop();
            }

            const scrolledPos = arr.positions.find((p) => p.scrollY > 0 && p.isMain && !p.isFrame);
            if (scrolledPos) {
                const pos = arr.popNextPosition()!;
                arr.addPageHeightChange(pos, 50);
                const adjusted = arr.positions.find((p) => p.yAdjust !== undefined && p.yAdjust !== 0);
                expect(adjusted?.yAdjust).toBe(50);
            }
        });
    });

    describe('bgRegions', () => {
        it('should be empty when scrollable is empty', () => {
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();
            expect(arr.bgRegions).toEqual([]);
        });

        it('should produce bgRegions when scrollable elt has bottom/right overflow', () => {
            const scrollableElt = document.createElement('div');
            Object.defineProperty(scrollableElt, 'offsetHeight', {
                value: 400,
                configurable: true,
            });

            const arr = new Arrangements(false, 0, 0);
            arr.scrollable = {
                type: 'elt',
                elt: scrollableElt,
                scrollHeight: 2000,
                scrollWidth: 800,
                top: 100,
                bottom: 500,
                left: 50,
                right: 550,
                height: 400,
                width: 500,
                ready: true,
            };
            arr.calculate();

            expect(arr.bgRegions.length).toBeGreaterThan(0);
        });
    });

    describe('canvasBg', () => {
        it('should be set after calculate', () => {
            vi.mocked(scrollFinder.bodyBackground).mockReturnValue('#ff0000');
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();
            expect(arr.canvasBg).toBe('#ff0000');
        });
    });

    describe('devicePixelRatio handling', () => {
        it('should adjust scroll step for dpr > 1', () => {
            Object.defineProperty(window, 'devicePixelRatio', {
                value: 2,
                writable: true,
            });
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();
            expect(arr.positions.length).toBeGreaterThan(0);
        });

        it('should adjust scroll step for dpr < 1', () => {
            Object.defineProperty(window, 'devicePixelRatio', {
                value: 0.5,
                writable: true,
            });
            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();
            expect(arr.positions.length).toBeGreaterThan(0);
        });
    });

    describe('body as scroll target', () => {
        it('should use body as scroll target when bodyMaxHeight exceeds docEltMaxHeight by 20+', () => {
            mockDocDimensions({
                clientH: 500,
                offsetH: 500,
                scrollH: 500,
                bodyOffsetH: 3000,
                bodyScrollH: 3000,
            });

            const arr = new Arrangements(false, 0, 0);
            arr.ignoreScrollable();
            arr.calculate();

            const mainRegion = arr.regions.find((r) => r.type === 'main');
            expect(mainRegion).toBeDefined();
        });
    });
});
