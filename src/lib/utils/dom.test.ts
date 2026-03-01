import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    containsElement,
    getElementBox,
    getScrollPosition,
    isElementVisible,
    isFrameElement,
    SearchNodes,
    scrollTo,
} from './dom';

describe('dom utils', () => {
    describe('isFrameElement', () => {
        it('should return true for iframe elements', () => {
            const iframe = document.createElement('iframe');
            expect(isFrameElement(iframe)).toBe(true);
        });

        it('should return true for frame elements', () => {
            const frame = document.createElement('frame');
            expect(isFrameElement(frame)).toBe(true);
        });

        it('should return false for div elements', () => {
            const div = document.createElement('div');
            expect(isFrameElement(div)).toBe(false);
        });

        it('should return false for other element types', () => {
            const span = document.createElement('span');
            const img = document.createElement('img');
            const script = document.createElement('script');
            expect(isFrameElement(span)).toBe(false);
            expect(isFrameElement(img)).toBe(false);
            expect(isFrameElement(script)).toBe(false);
        });

        it('should handle elements with uppercase tag names', () => {
            const iframe = document.createElement('IFRAME');
            expect(isFrameElement(iframe)).toBe(true);
        });
    });

    describe('getElementBox', () => {
        let getComputedStyleSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            getComputedStyleSpy = vi.spyOn(window, 'getComputedStyle').mockReturnValue({
                getPropertyValue: () => '0',
                transform: 'none',
                webkitTransform: 'none',
            } as unknown as CSSStyleDeclaration);
        });

        afterEach(() => {
            getComputedStyleSpy?.mockRestore();
        });

        it('should return element box with offset calculation', () => {
            const parent = document.createElement('div');
            const child = document.createElement('div');
            parent.appendChild(child);
            document.body.innerHTML = '';
            document.body.appendChild(parent);

            Object.defineProperty(child, 'offsetLeft', {
                value: 10,
                configurable: true,
            });
            Object.defineProperty(child, 'offsetTop', {
                value: 20,
                configurable: true,
            });
            Object.defineProperty(child, 'offsetParent', {
                value: parent,
                configurable: true,
            });

            Object.defineProperty(parent, 'offsetLeft', {
                value: 5,
                configurable: true,
            });
            Object.defineProperty(parent, 'offsetTop', {
                value: 15,
                configurable: true,
            });
            Object.defineProperty(parent, 'offsetParent', {
                value: null,
                configurable: true,
            });

            vi.spyOn(child, 'getBoundingClientRect').mockReturnValue({
                width: 100,
                height: 50,
                left: 0,
                top: 0,
                right: 100,
                bottom: 50,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            });

            const box = getElementBox(child);

            expect(box.left).toBe(15);
            expect(box.top).toBe(35);
            expect(box.width).toBe(100);
            expect(box.height).toBe(50);
        });

        it('should apply frame insets when isFrame is true', () => {
            const iframe = document.createElement('iframe');
            document.body.innerHTML = '';
            document.body.appendChild(iframe);

            Object.defineProperty(iframe, 'offsetLeft', {
                value: 0,
                configurable: true,
            });
            Object.defineProperty(iframe, 'offsetTop', {
                value: 0,
                configurable: true,
            });
            Object.defineProperty(iframe, 'offsetParent', {
                value: null,
                configurable: true,
            });

            vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue({
                width: 200,
                height: 150,
                left: 0,
                top: 0,
                right: 200,
                bottom: 150,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            });

            vi.mocked(window.getComputedStyle).mockReturnValue({
                getPropertyValue: (prop: string) => {
                    if (prop === 'border-left-width') {
                        return '5';
                    }
                    if (prop === 'border-right-width') {
                        return '5';
                    }
                    if (prop === 'border-top-width') {
                        return '3';
                    }
                    if (prop === 'border-bottom-width') {
                        return '3';
                    }
                    if (prop === 'padding-left') {
                        return '10';
                    }
                    if (prop === 'padding-right') {
                        return '10';
                    }
                    if (prop === 'padding-top') {
                        return '2';
                    }
                    if (prop === 'padding-bottom') {
                        return '2';
                    }
                    return '0';
                },
                transform: 'none',
                webkitTransform: 'none',
            } as unknown as CSSStyleDeclaration);

            const box = getElementBox(iframe, true);

            expect(box.left).toBe(15);
            expect(box.top).toBe(5);
            expect(box.width).toBe(170);
            expect(box.height).toBe(140);
        });

        it('should infer isFrame from element when not provided', () => {
            const iframe = document.createElement('iframe');
            document.body.innerHTML = '';
            document.body.appendChild(iframe);

            Object.defineProperty(iframe, 'offsetLeft', {
                value: 0,
                configurable: true,
            });
            Object.defineProperty(iframe, 'offsetTop', {
                value: 0,
                configurable: true,
            });
            Object.defineProperty(iframe, 'offsetParent', {
                value: null,
                configurable: true,
            });

            vi.spyOn(iframe, 'getBoundingClientRect').mockReturnValue({
                width: 100,
                height: 100,
                left: 0,
                top: 0,
                right: 100,
                bottom: 100,
                x: 0,
                y: 0,
                toJSON: () => ({}),
            });

            const box = getElementBox(iframe);
            expect(box).toHaveProperty('left');
            expect(box).toHaveProperty('top');
            expect(box).toHaveProperty('width');
            expect(box).toHaveProperty('height');
        });
    });

    describe('isElementVisible', () => {
        const createStyle = (overrides: Partial<CSSStyleDeclaration> = {}) =>
            Object.assign(
                {
                    display: 'block',
                    visibility: 'visible',
                    opacity: '1',
                },
                overrides,
            ) as CSSStyleDeclaration;

        it('should return true for visible element in viewport', () => {
            const rect = { width: 100, height: 50, left: 50, top: 50 };
            const style = createStyle();
            expect(isElementVisible(rect, style)).toBe(true);
        });

        it('should return false when width is 0', () => {
            const rect = { width: 0, height: 50, left: 50, top: 50 };
            const style = createStyle();
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return false when height is 0', () => {
            const rect = { width: 100, height: 0, left: 50, top: 50 };
            const style = createStyle();
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return false when element is to the left of viewport', () => {
            const rect = { width: 100, height: 50, left: -150, top: 50 };
            const style = createStyle();
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return false when element is to the right of viewport', () => {
            const rect = {
                width: 100,
                height: 50,
                left: window.innerWidth + 100,
                top: 50,
            };
            const style = createStyle();
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return false when display is none', () => {
            const rect = { width: 100, height: 50, left: 50, top: 50 };
            const style = createStyle({ display: 'none' });
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return false when visibility is hidden', () => {
            const rect = { width: 100, height: 50, left: 50, top: 50 };
            const style = createStyle({ visibility: 'hidden' });
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return false when opacity is 0', () => {
            const rect = { width: 100, height: 50, left: 50, top: 50 };
            const style = createStyle({ opacity: '0' });
            expect(isElementVisible(rect, style)).toBe(false);
        });

        it('should return true when element partially overlaps viewport', () => {
            const rect = { width: 100, height: 50, left: -50, top: 50 };
            const style = createStyle();
            expect(isElementVisible(rect, style)).toBe(true);
        });
    });

    describe('SearchNodes', () => {
        beforeEach(() => {
            document.body.innerHTML = `
				<div id="root">
					<div id="child1">
						<span id="grandchild1"></span>
					</div>
					<div id="child2"></div>
					<script id="script-child"></script>
					<div id="hidden-child" style="display: none"></div>
				</div>
			`;
        });

        it('should have hasNext return true when nodes exist', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, { autoAdd: false });
            expect(search.hasNext()).toBe(true);
        });

        it('should have hasNext return false when no nodes remain', () => {
            const root = document.createElement('div');
            const search = new SearchNodes(root, { autoAdd: false });
            search.next();
            expect(search.hasNext()).toBe(false);
        });

        it('should return root element on first next() when autoAdd is false', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, { autoAdd: false });
            const node = search.next();
            expect(node).toBe(root);
        });

        it('should use DFS (LIFO) by default', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                autoAdd: true,
                ignoreNodeNames: new Set(),
                ignoreHidden: false,
            });
            const order: string[] = [];
            while (search.hasNext()) {
                const node = search.next();
                order.push(node.id || node.tagName);
            }
            expect(order[0]).toBe('root');
            expect(order[order.length - 1]).toMatch(/child|grandchild|span/);
        });

        it('should use BFS when isBfs is true', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                isBfs: true,
                autoAdd: true,
                ignoreNodeNames: new Set(),
                ignoreHidden: false,
            });
            const order: string[] = [];
            while (search.hasNext()) {
                const node = search.next();
                order.push(node.id || node.tagName);
            }
            expect(order[0]).toBe('root');
            const child1Idx = order.indexOf('child1');
            const child2Idx = order.indexOf('child2');
            expect(child1Idx).toBeLessThan(order.indexOf('grandchild1'));
            expect(child2Idx).toBeLessThan(order.indexOf('grandchild1'));
        });

        it('should add child nodes when autoAdd is true', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                autoAdd: true,
                ignoreNodeNames: new Set(),
                ignoreHidden: false,
            });
            let count = 0;
            while (search.hasNext()) {
                search.next();
                count++;
            }
            expect(count).toBeGreaterThan(1);
        });

        it('should filter out SCRIPT, HEAD, STYLE, LINK, META by default', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                autoAdd: true,
                ignoreHidden: false,
            });
            const nodes: Element[] = [];
            while (search.hasNext()) {
                nodes.push(search.next());
            }
            const scriptNodes = nodes.filter((n) => n.tagName === 'SCRIPT');
            expect(scriptNodes).toHaveLength(0);
        });

        it('should filter hidden elements when ignoreHidden is true', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                autoAdd: true,
                ignoreNodeNames: new Set(),
            });
            const nodes: Element[] = [];
            while (search.hasNext()) {
                nodes.push(search.next());
            }
            const hiddenNode = nodes.find((n) => n.id === 'hidden-child');
            expect(hiddenNode).toBeUndefined();
        });

        it('should include hidden elements when ignoreHidden is false', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                autoAdd: true,
                ignoreNodeNames: new Set(),
                ignoreHidden: false,
            });
            const nodes: Element[] = [];
            while (search.hasNext()) {
                nodes.push(search.next());
            }
            const hiddenNode = nodes.find((n) => n.id === 'hidden-child');
            expect(hiddenNode).toBeDefined();
        });

        it('should respect custom ignoreNodeNames', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, {
                autoAdd: true,
                ignoreNodeNames: new Set(['DIV']),
                ignoreHidden: false,
            });
            const nodes: Element[] = [];
            while (search.hasNext()) {
                nodes.push(search.next());
            }
            // Root itself is returned (it's always the seed), but its DIV children
            // should be excluded from further traversal by ignoreNodeNames
            const divNodes = nodes.filter((n) => n.tagName === 'DIV');
            // Only the root div should be present since child divs are filtered
            expect(divNodes).toHaveLength(1);
            expect(divNodes[0]).toBe(root);
        });

        it('should addAll return this for chaining', () => {
            const root = document.getElementById('root');
            if (!root) {
                throw new Error('Root element not found');
            }
            const search = new SearchNodes(root, { autoAdd: false });
            const result = search.addAll(root.childNodes);
            expect(result).toBe(search);
        });

        it('should use document.body when root is not provided', () => {
            const search = new SearchNodes();
            expect(search.hasNext()).toBe(true);
            const node = search.next();
            expect(node).toBe(document.body);
        });
    });

    describe('containsElement', () => {
        it('should return true when parent contains child', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            parent.appendChild(child);
            expect(containsElement(parent, child)).toBe(true);
        });

        it('should return true when parent is ancestor of child', () => {
            const parent = document.createElement('div');
            const middle = document.createElement('div');
            const child = document.createElement('span');
            parent.appendChild(middle);
            middle.appendChild(child);
            expect(containsElement(parent, child)).toBe(true);
        });

        it('should return true when parent and child are the same', () => {
            const el = document.createElement('div');
            expect(containsElement(el, el)).toBe(true);
        });

        it('should return false when parent does not contain child', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            expect(containsElement(parent, child)).toBe(false);
        });

        it('should return false when child is parent of parent', () => {
            const parent = document.createElement('div');
            const child = document.createElement('span');
            child.appendChild(parent);
            expect(containsElement(parent, child)).toBe(false);
        });

        it('should return false for sibling elements', () => {
            const container = document.createElement('div');
            const sibling1 = document.createElement('span');
            const sibling2 = document.createElement('span');
            container.appendChild(sibling1);
            container.appendChild(sibling2);
            expect(containsElement(sibling1, sibling2)).toBe(false);
        });
    });

    describe('scrollTo', () => {
        it('should call scrollTo on Window-like targets', () => {
            const scrollToSpy = vi.spyOn(window, 'scrollTo').mockImplementation(() => {});
            try {
                scrollTo(window, 100, 200);
                expect(scrollToSpy).toHaveBeenCalledWith(100, 200);
            } finally {
                scrollToSpy.mockRestore();
            }
        });

        it('should set scrollLeft and scrollTop on Element-like targets', () => {
            const div = document.createElement('div');
            scrollTo(div, 50, 75);
            expect(div.scrollLeft).toBe(50);
            expect(div.scrollTop).toBe(75);
        });
    });

    describe('getScrollPosition', () => {
        it('should return scrollX and scrollY for Window-like targets', () => {
            const win = {
                scrollX: 42,
                scrollY: 84,
            } as unknown as Window;
            const pos = getScrollPosition(win);
            expect(pos).toEqual({ x: 42, y: 84 });
        });

        it('should return scrollLeft and scrollTop for Element-like targets', () => {
            const div = document.createElement('div');
            div.scrollLeft = 10;
            div.scrollTop = 20;
            const pos = getScrollPosition(div);
            expect(pos).toEqual({ x: 10, y: 20 });
        });
    });
});
