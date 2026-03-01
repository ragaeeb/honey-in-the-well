import { containsElement, getElementBox, SearchNodes } from '../utils/dom';

type StyleEntry =
    | { action: 'css'; elt: HTMLElement; before: string; after: string }
    | { action: 'new_elt'; elt: Element }
    | { action: 'removed_attr'; elt: Element; attr: string; value: string }
    | { action: 'func'; undo: () => void };

const POSITIONED = new Set(['absolute', 'fixed', 'relative', 'sticky']);

let idCounter = 0;
function nextId(): string {
    idCounter++;
    return `__PIC_ID_${idCounter}_${Date.now()}`;
}

function camelToDash(str: string): string {
    return str.replace(/([a-zA-Z])(?=[A-Z])/g, '$1-').toLowerCase();
}

function pxToInt(v: string): number {
    return Number.parseInt(v, 10);
}

function pxToFloat(v: string): number {
    return Number.parseFloat(v);
}

function applyStyles(el: HTMLElement, styles: Record<string, string>): void {
    let css = `${el.style.cssText}; `;
    for (const key in styles) {
        css += `${camelToDash(key)}: ${styles[key]} !important; `;
    }
    el.style.cssText = css;
}

function isTransparent(color: string): boolean {
    const c = (color || '').toLowerCase().replace(/\s+/g, '');
    return c === '' || c === 'transparent' || c === 'rgba(0,0,0,0)' || c === '#0000' || c === '#00000000';
}

export class StyleManager {
    private stack: StyleEntry[] = [];
    private fixedStack: StyleEntry[] = [];

    init(): void {
        this.add(document.documentElement, { scrollBehavior: 'auto' });
        const body = document.body;
        if (body && window.getComputedStyle(body).overflowY === 'scroll') {
            this.add(body, { overflowY: 'visible' });
        }
        this.fixHangingAbsolutes();
        this.fixPseudoFixed();
        this.hideScrollbars();
        this.disableTransitions();
        this.siteHacks();
    }

    add(el: HTMLElement | null, styles: Record<string, string>): void {
        this.pushStyle(el, styles, this.stack);
    }

    addFixed(el: HTMLElement | null, styles: Record<string, string>): void {
        this.pushStyle(el, styles, this.fixedStack);
    }

    popAll(): void {
        while (this.stack.length) {
            this.popEntry(this.stack);
        }
    }

    popAllFixed(preserveHeaders = false): void {
        const skip: StyleEntry[] = [];
        while (this.fixedStack.length) {
            if (preserveHeaders) {
                const entry = this.fixedStack[this.fixedStack.length - 1];
                if (entry.action !== 'func' && entry.action !== 'new_elt' && entry.action !== 'removed_attr') {
                    const header = document.querySelector('header.fusion-header-wrapper');
                    if (header && containsElement(header, entry.elt)) {
                        skip.push(this.fixedStack.pop()!);
                        continue;
                    }
                }
            }
            this.popEntry(this.fixedStack);
        }
        if (skip.length) {
            this.fixedStack.push(...skip);
        }
    }

    initFixed(): void {
        const bodyStyle = document.body && window.getComputedStyle(document.body);
        if (!bodyStyle || bodyStyle.position === 'absolute') {
            return;
        }

        const updates: Record<string, string> = { position: 'relative' };
        let needsBoxSizing = false;

        if (bodyStyle.display === 'inline') {
            updates.display = 'block';
        }

        if (pxToInt(bodyStyle.width) === 0 || pxToInt(bodyStyle.height) === 0) {
            this.add(document.body, {
                backgroundColor: 'transparent',
                backgroundImage: 'none',
            });
            return;
        }

        if (bodyStyle.maxWidth === 'none' && pxToInt(bodyStyle.minWidth) === 0 && pxToInt(bodyStyle.marginLeft) === 0) {
            updates.minWidth = '100vw';
            needsBoxSizing = isBoxSizingRisky(bodyStyle);
        }

        if (bodyStyle.maxHeight === 'none' && pxToInt(bodyStyle.minHeight) === 0) {
            updates.minHeight = '100vh';
            needsBoxSizing = needsBoxSizing || isBoxSizingRisky(bodyStyle, true);
        }

        if (bodyStyle.marginTop !== '0px') {
            const pt = pxToInt(bodyStyle.paddingTop) + pxToInt(bodyStyle.marginTop);
            updates.paddingTop = `${pt}px`;
            updates.marginTop = '0px';
            needsBoxSizing = true;
        }
        if (bodyStyle.marginBottom !== '0px') {
            const pb = pxToInt(bodyStyle.paddingBottom) + pxToInt(bodyStyle.marginBottom);
            updates.paddingBottom = `${pb}px`;
            updates.marginBottom = '0px';
            needsBoxSizing = true;
        }

        if (needsBoxSizing) {
            updates.boxSizing = 'border-box';
        }
        this.add(document.body, updates);
    }

    updateFixed(
        scrollableElt: Element | null,
        isTopOfElt: boolean,
        fullHeight: number,
        fullWidth: number,
        hideElts?: Element[],
        isFirstPosition?: boolean,
    ): number {
        const result = this.getFixedAndStickyElements(scrollableElt, isFirstPosition);

        if (!isTopOfElt) {
            for (const el of result.fixedHeader) {
                this.addFixed(el as HTMLElement, {
                    visibility: 'hidden',
                    overflow: 'hidden',
                });
            }
        }

        for (const el of result.fixed) {
            this.convertFixedToAbsolute(el as HTMLElement, fullHeight, fullWidth);
        }

        const stickyIds: string[] = [];
        for (const el of result.sticky) {
            this.add(el as HTMLElement, {
                position: 'relative',
                top: 'auto',
                left: 'auto',
                right: 'auto',
                bottom: 'auto',
            });
            if (!el.id) {
                el.id = nextId();
            }
            stickyIds.push(el.id);
        }

        if (stickyIds.length) {
            const selector = stickyIds.map((id) => `#${CSS.escape(id)}`).join(',');
            const rule =
                'position: relative !important; left: auto !important; right: auto !important; top: auto !important; bottom: auto !important;';
            this.addStyleSheet(`${selector} { ${rule} }`);
        }

        for (const el of result.innerAbsolutes) {
            if ((el as HTMLElement).offsetWidth * (el as HTMLElement).offsetHeight < 5000) {
                this.add(el as HTMLElement, { display: 'none' });
            }
        }

        for (const el of result.fixedBg) {
            const style = window.getComputedStyle(el);
            const updates: Record<string, string> = {
                backgroundAttachment: 'scroll',
            };
            if (isTransparent(style.backgroundColor) && style.backgroundRepeat === 'no-repeat') {
                updates.backgroundRepeat = 'repeat';
            }
            this.add(el as HTMLElement, updates);
        }

        if (hideElts) {
            for (const el of hideElts) {
                this.addFixed(el as HTMLElement, { visibility: 'hidden' });
            }
        }

        return result.fixed.length + result.sticky.length;
    }

    hideScrollbars(): void {
        if (this.isMobile() || this.isImage()) {
            this.add(document.documentElement, { overflow: 'hidden' });
        }
        this.hideScrollbarsForSelectors(['html', 'body']);
        try {
            window.dispatchEvent(new CustomEvent('resize'));
        } catch (_) {}
    }

    hideScrollbarsInner(el: Element): void {
        if (!el.id) {
            el.id = nextId();
        }
        const selector = `#${CSS.escape(el.id)}`;
        this.hideScrollbarsForSelectors([selector]);
        const htmlEl = el as HTMLElement;
        const prev: Record<string, string> = {};
        for (const prop of ['overflow', 'overflowY', 'overflowX'] as const) {
            prev[prop] = htmlEl.style[prop];
        }
        htmlEl.style.overflow = 'hidden';
        for (const prop of ['overflow', 'overflowY', 'overflowX'] as const) {
            htmlEl.style[prop] = prev[prop];
        }
    }

    disableTransitions(): void {
        this.addStyleSheet(`* {
			transition: none !important;
			transition-delay: 0s !important;
			animation-duration: 0s !important;
			animation-delay: 0s !important;
		}`);

        const aosAttr = 'data-aos';
        const aosElements = Array.from(document.querySelectorAll(`[${aosAttr}]`));
        for (const el of aosElements) {
            const value = el.getAttribute(aosAttr);
            el.removeAttribute(aosAttr);
            if (value) {
                this.stack.push({
                    action: 'removed_attr',
                    elt: el,
                    attr: aosAttr,
                    value,
                });
            }
        }

        window.dispatchEvent(new CustomEvent('animateme:destroy'));
        this.stack.push({
            action: 'func',
            undo: () => window.dispatchEvent(new CustomEvent('animateme:enable')),
        });
    }

    addStyleSheet(css: string): void {
        const style = document.createElement('style');
        style.innerHTML = css;
        const target = document.getElementsByTagName('head')[0] || document.getElementsByTagName('body')[0];
        if (target) {
            target.appendChild(style);
            this.stack.push({ action: 'new_elt', elt: style });
        }
    }

    isMobile(): boolean {
        try {
            document.createEvent('TouchEvent');
            return true;
        } catch {
            return false;
        }
    }

    private isImage(): boolean {
        const ct = document.contentType;
        return !!ct && ct.startsWith('image/');
    }

    private pushStyle(el: HTMLElement | null, styles: Record<string, string>, stack: StyleEntry[]): void {
        if (!el?.style) {
            return;
        }
        const before = el.style.cssText;
        applyStyles(el, styles);
        stack.push({
            action: 'css',
            elt: el,
            before,
            after: el.style.cssText,
        });
    }

    private popEntry(stack: StyleEntry[]): void {
        const entry = stack.pop();
        if (!entry) {
            return;
        }
        switch (entry.action) {
            case 'new_elt':
                entry.elt.parentNode?.removeChild(entry.elt);
                break;
            case 'removed_attr':
                entry.elt.setAttribute(entry.attr, entry.value);
                break;
            case 'func':
                entry.undo();
                break;
            default:
                (entry as { elt: HTMLElement; before: string }).elt.style.cssText = (
                    entry as { before: string }
                ).before;
        }
    }

    private fixHangingAbsolutes(): void {
        const body = document.body;
        if (!body) {
            return;
        }
        const bodyStyle = window.getComputedStyle(body);
        if (POSITIONED.has(bodyStyle.position)) {
            return;
        }

        const absolutes: { elt: Element; style: CSSStyleDeclaration }[] = [];
        const search = new SearchNodes(body);
        while (search.hasNext()) {
            const node = search.next();
            const style = window.getComputedStyle(node);
            if (style.position === 'absolute') {
                const tag = node.nodeName.toLowerCase();
                if ((tag === 'iframe' || tag === 'img') && pxToInt(style.width) <= 5 && pxToInt(style.height) <= 5) {
                    continue;
                }
                absolutes.push({ elt: node, style });
            } else if (!POSITIONED.has(style.position)) {
                search.addAll(node.childNodes);
            }
        }

        const bodyRect = body.getBoundingClientRect();
        const bodyLeft = bodyRect.left + window.scrollX;
        const bodyTop = bodyRect.top + window.scrollY;

        for (const { elt, style } of absolutes) {
            const left = pxToFloat(style.left) - bodyLeft;
            const top = pxToFloat(style.top) + pxToFloat(bodyStyle.marginTop) - bodyTop;
            this.add(elt as HTMLElement, {
                width: style.width,
                height: style.height,
                left: `${left}px`,
                top: `${top}px`,
                right: 'auto',
                bottom: 'auto',
            });
        }
    }

    private fixPseudoFixed(): void {
        if (!document.body) {
            return;
        }
        const search = new SearchNodes(document.body);
        while (search.hasNext()) {
            const el = search.next();
            const rect = el.getBoundingClientRect();
            if (rect.width > 0.75 * window.innerWidth && rect.height > 0.75 * window.innerHeight) {
                let found = false;
                for (const pseudo of ['::before', '::after'] as const) {
                    if (window.getComputedStyle(el, pseudo).position === 'fixed') {
                        found = true;
                        if (!el.id) {
                            el.id = nextId();
                        }
                        const selector = `#${CSS.escape(el.id)}${pseudo}`;
                        this.addStyleSheet(`${selector} { position: absolute; }`);
                    }
                }
                if (!found) {
                    search.addAll(el.childNodes);
                }
            }
        }
    }

    private convertFixedToAbsolute(el: HTMLElement, fullHeight: number, fullWidth: number): void {
        const style = window.getComputedStyle(el);
        const oldLeft = pxToFloat(style.left);
        const oldRight = pxToFloat(style.right);
        const oldTop = pxToFloat(style.top);
        const oldBottom = pxToFloat(style.bottom);
        const oldWidth = pxToFloat(style.width);
        const oldHeight = pxToFloat(style.height);

        this.addFixed(el, { position: 'absolute', transition: 'none' });

        const parent = el.offsetParent;
        if (!parent) {
            return;
        }

        const parentBox = getElementBox(parent);
        const newLeft = oldLeft - parentBox.left;
        const newRight = oldRight - (fullWidth - (parentBox.left + parentBox.width));
        const newTop = oldTop - parentBox.top;
        const newBottom = oldBottom - (fullHeight - (parentBox.top + parentBox.height));

        const updates: Record<string, string> = {};
        let changed = false;

        if (!Number.isNaN(newLeft) && newLeft <= 0) {
            changed = true;
            updates.left = `${newLeft}px`;
        } else if (!Number.isNaN(newRight)) {
            changed = true;
            updates.right = `${newRight}px`;
        }

        if (!Number.isNaN(newTop) && newTop <= 0) {
            changed = true;
            updates.height = `${oldHeight}px`;
            updates.top = `${newTop}px`;
        } else if (!Number.isNaN(newBottom)) {
            changed = true;
            updates.bottom = `${newBottom}px`;
        }

        if (updates.left && !updates.right) {
            updates.width = `${oldWidth}px`;
        }
        if (updates.right && !updates.left) {
            updates.width = `${oldWidth}px`;
        }

        if (changed) {
            if (updates.width) {
                updates.maxWidth = updates.width;
            }
            if (updates.height) {
                updates.maxHeight = updates.height;
            }
            this.addFixed(el, updates);
        }
    }

    private getFixedAndStickyElements(
        scrollableElt: Element | null,
        _isFirstPosition?: boolean,
    ): {
        fixed: Element[];
        sticky: Element[];
        innerAbsolutes: Element[];
        fixedBg: Element[];
        fixedHeader: Element[];
    } {
        const fixed: Element[] = [];
        const sticky: Element[] = [];
        const innerAbsolutes: Element[] = [];
        const fixedBg: Element[] = [];
        const fixedHeader: Element[] = [];

        const root = scrollableElt || document.body;
        if (!root) {
            return { fixed, sticky, innerAbsolutes, fixedBg, fixedHeader };
        }

        const search = new SearchNodes(root, { autoAdd: true });
        while (search.hasNext()) {
            const el = search.next();
            if (el === root) {
                continue;
            }

            const style = window.getComputedStyle(el);
            switch (style.position) {
                case 'sticky':
                    sticky.push(el);
                    break;
                case 'fixed': {
                    const box = getElementBox(el);
                    const tolerance = 20;
                    const belowTop = window.innerHeight - box.top - tolerance;

                    if (box.top < tolerance && box.height < belowTop) {
                        if (this.hasOverflowHiddenParent(el)) {
                            continue;
                        }
                        fixedHeader.push(el);
                    } else if (
                        (box.top + box.height <= 0 && box.height > 0) ||
                        (box.left + box.width <= 0 && box.width > 0) ||
                        (box.top > window.innerHeight && box.height > 0) ||
                        (box.left > window.innerWidth && box.width > 0)
                    ) {
                        // offscreen — skip
                    } else if (box.height > window.innerHeight && box.width >= (2 * window.innerWidth) / 3) {
                        // too tall — skip
                    } else {
                        if (this.hasOverflowHiddenParent(el)) {
                            continue;
                        }
                        fixed.push(el);
                    }
                    break;
                }
                case 'absolute':
                    if (scrollableElt) {
                        const parent = (el as HTMLElement).offsetParent;
                        if (parent && parent !== scrollableElt && parent.contains(scrollableElt)) {
                            innerAbsolutes.push(el);
                        }
                    }
                    break;
            }

            if (style.backgroundAttachment === 'fixed') {
                fixedBg.push(el);
            }
        }

        return { fixed, sticky, innerAbsolutes, fixedBg, fixedHeader };
    }

    private hasOverflowHiddenParent(el: Element): boolean {
        const parent = el.parentNode as Element | null;
        if (parent && parent !== document.documentElement && parent !== document.body) {
            return window.getComputedStyle(parent).overflow === 'hidden';
        }
        return false;
    }

    private hideScrollbarsForSelectors(selectors: string[]): void {
        const webkit = selectors.map((s) => `${s}::-webkit-scrollbar`).join(', ');
        let css = `${webkit} { width: 0 !important; height: 0 !important; }`;
        css += ` ${selectors.join(', ')} { scrollbar-width: none !important; }`;
        this.addStyleSheet(css);
    }

    private siteHacks(): void {
        for (const el of document.querySelectorAll('[role="progressbar"]')) {
            if ((el as HTMLElement).style.display === 'none') {
                this.add(el as HTMLElement, { visibility: 'hidden' });
            }
        }

        this.addStyleSheet('.sqs-layout .sqs-row .sqs-block-content figure { opacity: 1 !important; }');

        if (document.querySelector('.notion-scroller')) {
            this.addStyleSheet(
                '.notion-scroller > .notion-table-view > .notion-selectable > div { transform: none !important; }',
            );
        }
    }
}

function isBoxSizingRisky(style: CSSStyleDeclaration, heightOnly?: boolean): boolean {
    const props = ['paddingTop', 'paddingBottom', 'borderTopWidth', 'borderBottomWidth'];
    if (!heightOnly) {
        props.push('paddingRight', 'paddingLeft', 'borderRightWidth', 'borderLeftWidth');
    }
    const hasNonZero = props.some(
        (p) => style[p as keyof CSSStyleDeclaration] && style[p as keyof CSSStyleDeclaration] !== '0px',
    );
    return style.boxSizing === 'content-box' && hasNonZero;
}
