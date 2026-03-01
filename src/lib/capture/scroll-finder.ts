import { type ElementBox, getElementBox, isFrameElement, SearchNodes } from '../utils/dom';

export type ScrollableResult = {
    type: 'empty' | 'elt' | 'frame';
    elt?: Element;
    frame?: HTMLIFrameElement | HTMLFrameElement;
    scrollHeight: number;
    scrollWidth: number;
    top: number;
    bottom: number;
    left: number;
    right: number;
    height: number;
    width: number;
    url?: string;
    tagName?: string;
    ready: boolean;
};

function isChrome49(): boolean {
    const match = /Chrome\/([0-9]+)/.exec(navigator.userAgent);
    return !!match && match[1] === '49';
}

function findByDimension(root: Element, vertical: boolean): ScrollableResult | null {
    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    let maxScroll = 0;
    let maxElt: HTMLElement = root as HTMLElement;
    let maxStyle: CSSStyleDeclaration | null = null;
    let maxBox: ElementBox | null = null;

    const search = new SearchNodes(root);
    while (search.hasNext()) {
        let added = false;
        const node = search.next() as HTMLElement;
        const visible = vertical ? node.offsetHeight : node.offsetWidth;
        const scrollable = vertical ? node.scrollHeight : node.scrollWidth;

        if (
            scrollable > visible + 5 &&
            visible > 50 &&
            scrollable > maxScroll &&
            (vertical ? node.offsetWidth : node.offsetHeight) > 40
        ) {
            const style = window.getComputedStyle(node);
            const overflow = style[vertical ? 'overflowY' : 'overflowX'];

            const isPerfectScrollbar =
                ['ps', 'ps-container'].some((c) => node.classList.contains(c)) &&
                (vertical ? ['ps-active-y', 'ps--active-y'] : ['ps-active-x', 'ps--active-x']).some((c) =>
                    node.classList.contains(c),
                );

            if (
                (style.pointerEvents !== 'none' && overflow !== 'hidden' && overflow !== 'visible') ||
                isPerfectScrollbar
            ) {
                const box = getElementBox(node);
                const tolerance = 18;
                if (
                    box.left + tolerance >= 0 &&
                    box.left + box.width <= viewW + tolerance &&
                    box.top + tolerance >= 0 &&
                    box.top + box.height <= viewH + tolerance
                ) {
                    maxBox = box;
                    maxScroll = scrollable;
                    maxElt = node;
                    maxStyle = style;
                    added = true;
                }
            }
        }
        if (!added) {
            search.addAll(node.childNodes);
        }
    }

    maxBox = maxBox || getElementBox(maxElt);
    let { height, width } = maxBox;
    let scrollW = maxElt.scrollWidth;
    let scrollH = maxElt.scrollHeight;

    if (maxStyle) {
        const crossOverflow = maxStyle[vertical ? 'overflowX' : 'overflowY'];
        if (crossOverflow === 'hidden') {
            if (vertical) {
                const pl = Number.parseFloat(maxStyle.paddingLeft) || 0;
                const pr = Number.parseFloat(maxStyle.paddingRight) || 0;
                maxBox.left += pl;
                width -= pl + pr;
                scrollW -= pl + pr;
            } else {
                const pt = Number.parseFloat(maxStyle.paddingTop) || 0;
                const pb = Number.parseFloat(maxStyle.paddingBottom) || 0;
                maxBox.top += pt;
                height -= pt + pb;
                scrollH -= pt + pb;
            }
        }
    }

    if (maxElt === document.body) {
        return null;
    }
    if (
        root !== document.body &&
        maxElt === root &&
        Math.abs(scrollW - width) <= 2 &&
        Math.abs(scrollH - height) <= 2
    ) {
        return null;
    }

    let leftPos = maxBox.left;
    if (
        maxElt.classList.contains('bodyCells') &&
        document.querySelector('.pivotTableContainer .bodyCells') === maxElt
    ) {
        width = leftPos + width;
        leftPos = 0;
    }

    if (maxBox.left + width > innerWidth && maxBox.left < viewW) {
        width = viewW - maxBox.left;
    }
    if (maxBox.top + height > innerHeight && maxBox.top < innerHeight) {
        height = viewH - maxBox.top;
    }

    return {
        type: 'elt',
        elt: maxElt,
        scrollHeight: Math.max(height, scrollH),
        scrollWidth: Math.max(width, scrollW),
        top: maxBox.top,
        bottom: maxBox.top + height,
        left: leftPos,
        right: leftPos + width,
        height,
        width,
        ready: true,
    };
}

function findFrame(viewW: number, viewH: number): ScrollableResult | null {
    if (isChrome49()) {
        return null;
    }
    const frames = Array.from(document.querySelectorAll('iframe, frame'));
    const minArea = Math.min((viewW * viewH) / 4, 180_000);
    let maxArea = 0;
    let result: ScrollableResult | null = null;

    for (const frame of frames) {
        const box = getElementBox(frame);
        const area = box.width * box.height;
        if (
            area >= minArea &&
            area > maxArea &&
            box.left + 18 >= 0 &&
            box.left + box.width <= viewW + 18 &&
            box.top + 18 >= 0 &&
            box.top + box.height <= viewH + 18
        ) {
            maxArea = area;
            result = {
                type: 'frame',
                frame: frame as HTMLIFrameElement,
                width: box.width,
                height: box.height,
                top: box.top,
                left: box.left,
                url: (frame as HTMLIFrameElement).src,
                tagName: frame.nodeName.toLowerCase(),
                bottom: box.top + box.height,
                right: box.left + box.width,
                scrollHeight: box.height,
                scrollWidth: box.width,
                ready: false,
            };
        }
    }
    return result;
}

export function bodyBackground(): string {
    const candidates = [document.body, document.documentElement].filter(Boolean);
    for (const el of candidates) {
        const bg = window.getComputedStyle(el!).backgroundColor || '';
        if (bg !== 'transparent' && !bg.match(/^rgba\(\d+,\s*\d+,\s*\d+,\s*0\)$/)) {
            return bg;
        }
    }
    return '#ffffff';
}

export function empty(): ScrollableResult {
    return {
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
}

export function findScrollable(
    viewW: number,
    viewH: number,
    fullW: number,
    fullH: number,
    root?: Element | null,
): ScrollableResult {
    const result = empty();
    const widthOverflow = fullW > viewW + 15;
    const heightOverflow = fullH > viewH + 15;

    if (!widthOverflow && !heightOverflow) {
        return result;
    }

    if (window.location.protocol === 'chrome-extension:' && window.location.pathname === '/editor.html') {
        return result;
    }

    const searchRoot = root || document.body;
    if (!searchRoot) {
        return result;
    }

    if (!isFrameElement(searchRoot)) {
        const preferVertical = window.location.hostname !== 'trello.com';

        const primary = findByDimension(searchRoot, preferVertical);
        if (primary && primary.elt !== document.body) {
            return primary;
        }

        const secondary = findByDimension(searchRoot, !preferVertical);
        if (secondary && secondary.elt !== document.body) {
            return secondary;
        }

        if (primary || secondary) {
            return primary || secondary || result;
        }
    }

    return findFrame(viewW, viewH) || result;
}
