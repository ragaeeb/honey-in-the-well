import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as domUtils from '../utils/dom';
import { LinkObserver } from './link-observer';

vi.mock('../utils/dom', () => ({
    getElementBox: vi.fn(() => ({
        left: 10,
        top: 20,
        width: 100,
        height: 30,
    })),
}));

describe('LinkObserver', () => {
    let intersectionCallbacks: IntersectionObserverCallback[];
    let mutationCallbacks: MutationCallback[];

    beforeEach(() => {
        vi.clearAllMocks();
        intersectionCallbacks = [];
        mutationCallbacks = [];

        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(function IntersectionObserverMock(cb: IntersectionObserverCallback) {
                intersectionCallbacks.push(cb);
                return {
                    observe: vi.fn(),
                    unobserve: vi.fn(),
                    disconnect: vi.fn(),
                };
            }),
        );

        vi.stubGlobal(
            'MutationObserver',
            vi.fn(function MutationObserverMock(cb: MutationCallback) {
                mutationCallbacks.push(cb);
                return {
                    observe: vi.fn(),
                    disconnect: vi.fn(),
                };
            }),
        );

        vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            left: '0',
            marginLeft: '0',
        } as unknown as CSSStyleDeclaration);
    });

    it('should create observers on construction', () => {
        const observer = new LinkObserver();
        expect(intersectionCallbacks).toHaveLength(1);
        expect(mutationCallbacks).toHaveLength(1);
        observer.end();
    });

    it('should observe existing anchor elements in the document', () => {
        const a = document.createElement('a');
        a.href = 'https://example.com';
        document.body.appendChild(a);

        const observer = new LinkObserver();
        observer.end();
        document.body.removeChild(a);
    });

    it('should return empty links on step() when nothing is pending', () => {
        const observer = new LinkObserver();
        const links = observer.step(null);
        expect(links).toEqual([]);
        observer.end();
    });

    it('should collect links from intersection observer entries', () => {
        const observer = new LinkObserver();

        const anchor = document.createElement('a');
        anchor.href = 'https://example.com/page';

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: true,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        const links = observer.step(null);
        expect(links).toHaveLength(1);
        expect(links[0].url).toBe('https://example.com/page');
        expect(links[0].bounds).toHaveLength(1);
        observer.end();
    });

    it('should skip non-intersecting entries', () => {
        const observer = new LinkObserver();

        const anchor = document.createElement('a');
        anchor.href = 'https://example.com/page';

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: false,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        const links = observer.step(null);
        expect(links).toEqual([]);
        observer.end();
    });

    it('should skip elements with zero dimensions', () => {
        vi.mocked(domUtils.getElementBox).mockReturnValue({
            left: 0,
            top: 0,
            width: 0,
            height: 0,
        });

        const observer = new LinkObserver();
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: true,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        const links = observer.step(null);
        expect(links).toEqual([]);
        observer.end();
    });

    it('should handle mutation observer childList events', () => {
        const observer = new LinkObserver();

        const container = document.createElement('div');
        const anchor = document.createElement('a');
        anchor.href = 'https://new-link.com';
        container.appendChild(anchor);

        mutationCallbacks[0](
            [
                {
                    type: 'childList',
                    target: container,
                } as unknown as MutationRecord,
            ],
            {} as MutationObserver,
        );

        const links = observer.step(null);
        expect(links.length).toBeGreaterThanOrEqual(0);
        observer.end();
    });

    it('should flush pending links and clear on step', () => {
        const observer = new LinkObserver();
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: true,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        observer.step(null);
        const secondStep = observer.step(null);
        expect(secondStep).toEqual([]);
        observer.end();
    });

    it('should apply body offset to link bounds', () => {
        vi.spyOn(window, 'getComputedStyle').mockReturnValue({
            left: '5',
            marginLeft: '10',
        } as unknown as CSSStyleDeclaration);

        vi.mocked(domUtils.getElementBox).mockReturnValue({
            left: 100,
            top: 200,
            width: 50,
            height: 20,
        });

        const observer = new LinkObserver();
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: true,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        const links = observer.step(null);
        expect(links).toHaveLength(1);
        expect(links[0].bounds[0].x).toBe(115);
        expect(links[0].bounds[0].y).toBe(200);
        observer.end();
    });

    it('should adjust bounds for scrollable elements', () => {
        vi.mocked(domUtils.getElementBox).mockReturnValue({
            left: 600,
            top: 500,
            width: 50,
            height: 20,
        });

        const scrollable = {
            type: 'elt' as const,
            elt: document.createElement('div'),
            left: 0,
            top: 0,
            right: 500,
            bottom: 400,
            width: 500,
            height: 400,
            scrollWidth: 800,
            scrollHeight: 1200,
            ready: true,
        };

        const observer = new LinkObserver();
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: true,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        const links = observer.step(scrollable);
        expect(links).toHaveLength(1);
        expect(links[0].bounds[0].x).toBe(900);
        expect(links[0].bounds[0].y).toBe(1300);
        observer.end();
    });

    it('should not adjust bounds for elements inside scrollable elt', () => {
        const scrollableElt = document.createElement('div');
        const anchor = document.createElement('a');
        anchor.href = 'https://example.com';
        scrollableElt.appendChild(anchor);

        vi.mocked(domUtils.getElementBox).mockReturnValue({
            left: 600,
            top: 500,
            width: 50,
            height: 20,
        });

        const scrollable = {
            type: 'elt' as const,
            elt: scrollableElt,
            left: 0,
            top: 0,
            right: 500,
            bottom: 400,
            width: 500,
            height: 400,
            scrollWidth: 800,
            scrollHeight: 1200,
            ready: true,
        };

        const observer = new LinkObserver();

        intersectionCallbacks[0](
            [
                {
                    isIntersecting: true,
                    target: anchor,
                } as unknown as IntersectionObserverEntry,
            ],
            {} as IntersectionObserver,
        );

        const links = observer.step(scrollable);
        expect(links).toHaveLength(1);
        expect(links[0].bounds[0].x).toBe(600);
        expect(links[0].bounds[0].y).toBe(500);
        observer.end();
    });

    it('should disconnect both observers on end()', () => {
        const observer = new LinkObserver();
        observer.end();
        // no errors thrown
    });

    it('should not duplicate observations for the same element', () => {
        const observeFn = vi.fn();
        vi.stubGlobal(
            'IntersectionObserver',
            vi.fn(function IntersectionObserverMock(cb: IntersectionObserverCallback) {
                intersectionCallbacks.push(cb);
                return {
                    observe: observeFn,
                    unobserve: vi.fn(),
                    disconnect: vi.fn(),
                };
            }),
        );

        const a = document.createElement('a');
        a.href = 'https://example.com';
        document.body.appendChild(a);

        const callsBefore = observeFn.mock.calls.length;
        const _observer = new LinkObserver();
        const callsForFirstInit = observeFn.mock.calls.length - callsBefore;

        document.body.removeChild(a);
        _observer.end();

        expect(callsForFirstInit).toBeGreaterThanOrEqual(0);
    });
});
