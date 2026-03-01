import { getElementBox } from '../utils/dom';
import type { CapturedLink, LinkBounds } from './messages';
import type { ScrollableResult } from './scroll-finder';

export class LinkObserver {
    private intersectionObserver: IntersectionObserver | null = null;
    private mutationObserver: MutationObserver | null = null;
    private observedLinks = new Set<HTMLAnchorElement>();
    private pendingLinks: HTMLAnchorElement[] = [];

    constructor() {
        if (!document.body) {
            return;
        }

        if (window.IntersectionObserver) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        this.pendingLinks.push(entry.target as HTMLAnchorElement);
                        this.intersectionObserver?.unobserve(entry.target);
                    }
                }
            });
        }

        this.addElements(document.querySelectorAll('a'));

        this.mutationObserver = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.type === 'childList') {
                    this.addElements([mutation.target as Element]);
                }
            }
        });
        this.mutationObserver.observe(document.body, {
            childList: true,
            subtree: true,
        });
    }

    step(scrollable: ScrollableResult | null): CapturedLink[] {
        const elements = this.flush();
        return this.toLinks(elements, scrollable);
    }

    end(): void {
        this.intersectionObserver?.disconnect();
        this.mutationObserver?.disconnect();
    }

    private flush(): HTMLAnchorElement[] {
        const result = [...this.pendingLinks];
        this.pendingLinks = [];
        return result;
    }

    private addElements(elements: NodeListOf<Element> | Element[]): void {
        const observe = (el: HTMLAnchorElement) => {
            if (this.observedLinks.has(el)) {
                return;
            }
            this.observedLinks.add(el);
            if (this.intersectionObserver) {
                this.intersectionObserver.observe(el);
            } else {
                this.pendingLinks.push(el);
            }
        };

        for (const el of Array.from(elements)) {
            if (el.tagName === 'A') {
                observe(el as HTMLAnchorElement);
            } else {
                for (const anchor of el.querySelectorAll('a')) {
                    observe(anchor as HTMLAnchorElement);
                }
            }
        }
    }

    private toLinks(elements: HTMLAnchorElement[], scrollable: ScrollableResult | null): CapturedLink[] {
        const links: CapturedLink[] = [];
        let bodyOffset = 0;

        if (document.body) {
            const bodyStyle = window.getComputedStyle(document.body);
            bodyOffset = (Number.parseInt(bodyStyle.left, 10) || 0) + (Number.parseInt(bodyStyle.marginLeft, 10) || 0);
        }

        for (const el of elements) {
            const box = getElementBox(el);
            if (box.width === 0 || box.height === 0) {
                continue;
            }

            const bounds: LinkBounds[] = [
                {
                    x: box.left + bodyOffset,
                    y: box.top,
                    width: box.width,
                    height: box.height,
                },
            ];

            if (scrollable && scrollable.type !== 'empty' && scrollable.ready) {
                adjustForScrollable(el, bounds, scrollable);
            }

            links.push({ bounds, url: el.href });
        }
        return links;
    }
}

function adjustForScrollable(el: HTMLAnchorElement, bounds: LinkBounds[], scrollable: ScrollableResult): void {
    const right = scrollable.left + scrollable.width;
    const bottom = scrollable.top + scrollable.height;
    const extraW = scrollable.scrollWidth - scrollable.width;
    const extraH = scrollable.scrollHeight - scrollable.height;

    if (scrollable.type === 'elt' && scrollable.elt?.contains(el)) {
        return;
    }

    if (bounds[0].x >= right) {
        for (const b of bounds) {
            b.x += extraW;
        }
    }
    if (bounds[0].y >= bottom) {
        for (const b of bounds) {
            b.y += extraH;
        }
    }
}
