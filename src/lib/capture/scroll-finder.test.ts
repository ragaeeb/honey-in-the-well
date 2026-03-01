import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as domUtils from '../utils/dom';
import { bodyBackground, empty, findScrollable } from './scroll-finder';

vi.mock('../utils/dom', () => ({
    getElementBox: vi.fn(() => ({
        left: 0,
        top: 0,
        width: 100,
        height: 100,
    })),
    SearchNodes: vi.fn().mockImplementation(function SearchNodesMock() {
        return {
            hasNext: vi.fn(() => false),
            next: vi.fn(),
            addAll: vi.fn(),
        };
    }),
    isFrameElement: vi.fn(() => false),
}));

describe('scroll-finder', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        Object.defineProperty(window, 'innerWidth', {
            value: 1024,
            writable: true,
        });
        Object.defineProperty(window, 'innerHeight', {
            value: 768,
            writable: true,
        });
    });

    describe('empty()', () => {
        it('should return a ScrollableResult with type empty', () => {
            const result = empty();
            expect(result.type).toBe('empty');
            expect(result.ready).toBe(true);
            expect(result.scrollHeight).toBe(0);
            expect(result.scrollWidth).toBe(0);
            expect(result.top).toBe(0);
            expect(result.bottom).toBe(0);
            expect(result.left).toBe(0);
            expect(result.right).toBe(0);
            expect(result.height).toBe(0);
            expect(result.width).toBe(0);
        });
    });

    describe('bodyBackground()', () => {
        it('should return body background color when it is not transparent', () => {
            vi.spyOn(window, 'getComputedStyle').mockImplementation(
                (el) =>
                    ({
                        backgroundColor: el === document.body ? 'rgb(255, 0, 0)' : 'transparent',
                    }) as CSSStyleDeclaration,
            );
            expect(bodyBackground()).toBe('rgb(255, 0, 0)');
        });

        it('should return html background color when body is transparent', () => {
            vi.spyOn(window, 'getComputedStyle').mockImplementation(
                (el) =>
                    ({
                        backgroundColor: el === document.documentElement ? 'rgb(0, 0, 255)' : 'transparent',
                    }) as CSSStyleDeclaration,
            );
            expect(bodyBackground()).toBe('rgb(0, 0, 255)');
        });

        it('should return #ffffff when both body and html are transparent', () => {
            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                backgroundColor: 'transparent',
            } as CSSStyleDeclaration);
            expect(bodyBackground()).toBe('#ffffff');
        });

        it('should treat rgba(0, 0, 0, 0) as transparent', () => {
            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                backgroundColor: 'rgba(0, 0, 0, 0)',
            } as CSSStyleDeclaration);
            expect(bodyBackground()).toBe('#ffffff');
        });
    });

    describe('findScrollable()', () => {
        it('should return empty when no overflow detected', () => {
            const result = findScrollable(1024, 768, 1024, 768);
            expect(result.type).toBe('empty');
        });

        it('should return empty when overflow is within 15px tolerance', () => {
            const result = findScrollable(1024, 768, 1030, 775);
            expect(result.type).toBe('empty');
        });

        it('should return empty for chrome-extension editor page', () => {
            const origProtocol = window.location.protocol;
            const origPathname = window.location.pathname;
            Object.defineProperty(window, 'location', {
                value: {
                    protocol: 'chrome-extension:',
                    pathname: '/editor.html',
                    hostname: '',
                },
                writable: true,
            });

            const result = findScrollable(1024, 768, 2000, 2000);
            expect(result.type).toBe('empty');

            Object.defineProperty(window, 'location', {
                value: { protocol: origProtocol, pathname: origPathname, hostname: '' },
                writable: true,
            });
        });

        it('should attempt to find scrollable element when height overflows', () => {
            let callCount = 0;
            vi.mocked(domUtils.SearchNodes).mockImplementation(function SearchNodesMock() {
                callCount++;
                return {
                    hasNext: vi.fn(() => false),
                    next: vi.fn(),
                    addAll: vi.fn(),
                } as unknown as domUtils.SearchNodes;
            });

            const result = findScrollable(1024, 768, 1024, 2000);
            expect(callCount).toBeGreaterThan(0);
            expect(result).toBeDefined();
        });

        it('should attempt to find scrollable element when width overflows', () => {
            let callCount = 0;
            vi.mocked(domUtils.SearchNodes).mockImplementation(function SearchNodesMock() {
                callCount++;
                return {
                    hasNext: vi.fn(() => false),
                    next: vi.fn(),
                    addAll: vi.fn(),
                } as unknown as domUtils.SearchNodes;
            });

            const result = findScrollable(1024, 768, 2000, 768);
            expect(callCount).toBeGreaterThan(0);
            expect(result).toBeDefined();
        });

        it('should return empty when no suitable scrollable element is found', () => {
            vi.mocked(domUtils.SearchNodes).mockImplementation(function SearchNodesMock() {
                return {
                    hasNext: vi.fn(() => false),
                    next: vi.fn(),
                    addAll: vi.fn(),
                } as unknown as domUtils.SearchNodes;
            });

            const result = findScrollable(1024, 768, 1024, 2000);
            expect(result.type).toBe('empty');
        });

        it('should check frames when no scrollable element found and root is a frame', () => {
            vi.mocked(domUtils.isFrameElement).mockReturnValue(true);
            vi.mocked(domUtils.SearchNodes).mockImplementation(function SearchNodesMock() {
                return {
                    hasNext: vi.fn(() => false),
                    next: vi.fn(),
                    addAll: vi.fn(),
                } as unknown as domUtils.SearchNodes;
            });

            const result = findScrollable(1024, 768, 1024, 2000);
            expect(result).toBeDefined();
        });

        it('should use provided root element for search', () => {
            const root = document.createElement('div');
            vi.mocked(domUtils.SearchNodes).mockImplementation(function SearchNodesMock() {
                return {
                    hasNext: vi.fn(() => false),
                    next: vi.fn(),
                    addAll: vi.fn(),
                } as unknown as domUtils.SearchNodes;
            });

            const result = findScrollable(1024, 768, 1024, 2000, root);
            expect(result).toBeDefined();
        });

        it('should find a scrollable element with overflowY auto', () => {
            const scrollableDiv = document.createElement('div');
            Object.defineProperty(scrollableDiv, 'offsetHeight', { value: 500 });
            Object.defineProperty(scrollableDiv, 'scrollHeight', { value: 2000 });
            Object.defineProperty(scrollableDiv, 'offsetWidth', { value: 500 });
            Object.defineProperty(scrollableDiv, 'scrollWidth', { value: 500 });
            Object.defineProperty(scrollableDiv, 'classList', {
                value: { contains: () => false },
            });

            let firstCall = true;
            vi.mocked(domUtils.SearchNodes).mockImplementation(function SearchNodesMock() {
                return {
                    hasNext: vi.fn(() => {
                        if (firstCall) {
                            firstCall = false;
                            return true;
                        }
                        return false;
                    }),
                    next: vi.fn(() => scrollableDiv),
                    addAll: vi.fn(),
                } as unknown as domUtils.SearchNodes;
            });

            vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                overflowY: 'auto',
                overflowX: 'hidden',
                pointerEvents: 'auto',
                paddingLeft: '0',
                paddingRight: '0',
            } as unknown as CSSStyleDeclaration);

            vi.mocked(domUtils.getElementBox).mockReturnValue({
                left: 0,
                top: 0,
                width: 500,
                height: 500,
            });

            const result = findScrollable(1024, 768, 1024, 2000);
            expect(result).toBeDefined();
        });
    });
});
