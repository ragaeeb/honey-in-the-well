const FRAME_TAGS = new Set(['iframe', 'frame']);

export function isFrameElement(el: Element): el is HTMLIFrameElement | HTMLFrameElement {
    return FRAME_TAGS.has(el.tagName.toLowerCase());
}

export type ElementBox = {
    left: number;
    top: number;
    width: number;
    height: number;
};

function getTransformMatrix(el: HTMLElement): DOMMatrix | WebKitCSSMatrix | undefined {
    if (window.DOMMatrix || window.WebKitCSSMatrix) {
        const style = window.getComputedStyle(el);
        const transform =
            style.transform || (style as CSSStyleDeclaration & { webkitTransform?: string }).webkitTransform;
        if (!transform || transform === 'none') {
            return undefined;
        }
        try {
            if (window.DOMMatrix) {
                return new DOMMatrix(transform);
            }
            if (window.WebKitCSSMatrix) {
                return new (window.WebKitCSSMatrix as { new (value: string): WebKitCSSMatrix })(transform);
            }
        } catch {
            return undefined;
        }
    }
}

function getFrameInsets(el: Element): {
    left: number;
    right: number;
    top: number;
    bottom: number;
} {
    const style = window.getComputedStyle(el);
    const parse = (props: string[]) =>
        props.reduce((sum, prop) => {
            const v = Number.parseFloat(style.getPropertyValue(prop));
            return sum + (Number.isNaN(v) ? 0 : v);
        }, 0);

    return {
        left: parse(['border-left-width', 'padding-left']),
        right: parse(['border-right-width', 'padding-right']),
        top: parse(['padding-top', 'border-top-width']),
        bottom: parse(['padding-bottom', 'border-bottom-width']),
    };
}

export function getElementBox(el: Element, isFrameParam?: boolean): ElementBox {
    const isFrame = isFrameParam ?? isFrameElement(el);
    const rect = el.getBoundingClientRect();
    let { width, height } = rect;
    let left = 0;
    let top = 0;

    let current: HTMLElement | null = el as HTMLElement;
    while (current) {
        left += current.offsetLeft;
        if (current === document.body) {
            top += current.getBoundingClientRect().top + window.scrollY;
        } else {
            top += current.offsetTop;
        }
        const matrix = getTransformMatrix(current);
        if (matrix) {
            left += matrix.m41;
            top += matrix.m42;
        }
        current = current.offsetParent as HTMLElement | null;
    }

    if (isFrame) {
        const insets = getFrameInsets(el);
        left += insets.left;
        top += insets.top;
        width -= insets.left + insets.right;
        height -= insets.top + insets.bottom;
    }

    return { left, top, width, height };
}

export function isElementVisible(
    rect: { width: number; height: number; left: number; top: number },
    style: CSSStyleDeclaration,
): boolean {
    return (
        rect.width !== 0 &&
        rect.height !== 0 &&
        rect.left + rect.width > 0 &&
        rect.left < window.innerWidth &&
        rect.top + rect.height > 0 &&
        rect.top < window.innerHeight &&
        style.display !== 'none' &&
        style.visibility !== 'hidden' &&
        style.opacity !== '0'
    );
}

export type SearchNodesOptions = {
    isBfs?: boolean;
    autoAdd?: boolean;
    onlyElementNodes?: boolean;
    ignoreNodeNames?: Set<string>;
    ignoreHidden?: boolean;
};

const SEARCH_DEFAULTS: Required<SearchNodesOptions> = {
    isBfs: false,
    autoAdd: false,
    onlyElementNodes: true,
    ignoreNodeNames: new Set(['SCRIPT', 'HEAD', 'STYLE', 'LINK', 'META']),
    ignoreHidden: true,
};

export class SearchNodes {
    private root: Element;
    private search: Element[];
    private isBfs: boolean;
    private autoAdd: boolean;
    private ignoreNodeNames: Set<string>;
    private ignoreHidden: boolean;

    constructor(root?: Element, opts?: SearchNodesOptions) {
        this.root = root || document.body || document.documentElement;
        const cfg = { ...SEARCH_DEFAULTS, ...opts };
        this.isBfs = cfg.isBfs;
        this.autoAdd = cfg.autoAdd;
        this.ignoreNodeNames = cfg.ignoreNodeNames;
        this.ignoreHidden = cfg.ignoreHidden;
        this.search = this.root ? [this.root] : [];
    }

    hasNext(): boolean {
        return this.search.length > 0;
    }

    next(): Element {
        const node = this.isBfs ? this.search.shift()! : this.search.pop()!;
        if (this.autoAdd) {
            this.addAll(node.childNodes);
        }
        return node;
    }

    addAll(nodes: NodeListOf<ChildNode>): this {
        let elements = Array.from(nodes).filter((n): n is Element => n.nodeType === Node.ELEMENT_NODE);
        if (this.ignoreNodeNames) {
            elements = elements.filter((n) => !this.ignoreNodeNames.has(n.nodeName));
        }
        if (this.ignoreHidden) {
            elements = elements.filter((n) => !this.isHidden(n));
        }
        this.search.push(...elements);
        return this;
    }

    private isHidden(el: Element): boolean {
        if (el.nodeType !== Node.ELEMENT_NODE) {
            return false;
        }
        const style = getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') {
            return true;
        }
        const h = Number.parseInt(style.height, 10);
        const w = Number.parseInt(style.width, 10);
        if (h === 0 && style.overflowY === 'hidden' && style.position !== 'static') {
            return true;
        }
        if (w === 0 && style.overflowX === 'hidden' && style.position !== 'static') {
            return true;
        }
        return false;
    }
}

export function containsElement(parent: Node, child: Node): boolean {
    let current: Node | null = child;
    while (current) {
        if (current === parent) {
            return true;
        }
        current = current.parentNode;
    }
    return false;
}

export function scrollTo(target: Element | Window, x: number, y: number): void {
    if ('scrollTo' in target && typeof target.scrollTo === 'function') {
        target.scrollTo(x, y);
    } else {
        const el = target as Element;
        el.scrollLeft = x;
        el.scrollTop = y;
    }
}

export function getScrollPosition(target: Element | Window): {
    x: number;
    y: number;
} {
    if ('scrollX' in target) {
        return { x: target.scrollX, y: target.scrollY };
    }
    return {
        x: (target as Element).scrollLeft,
        y: (target as Element).scrollTop,
    };
}
