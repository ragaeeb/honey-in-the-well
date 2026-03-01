import { getElementBox } from '../utils/dom';
import type { BgRegion, ClipRect } from './messages';
import { bodyBackground, empty, findScrollable, type ScrollableResult } from './scroll-finder';

export type PageDimensions = {
    windowWidth: number;
    windowHeight: number;
    fullWidth: number;
    fullHeight: number;
    nonadjustedFullWidth: number;
    nonadjustedFullHeight: number;
    bodyMaxHeight: number;
    docEltMaxHeight: number;
    root: Element | undefined;
};

type Region = {
    type: 'main' | 'inner_elt' | 'inner_frame' | 'fill';
    page: {
        elt?: Element | Window;
        top: number;
        left: number;
        right: number;
        bottom: number;
        eltHeight?: number;
        eltWidth?: number;
        eltOffsetLeft?: number;
        eltOffsetTop?: number;
    };
    capture: ClipRect & { delay?: number; bufferBottom?: number };
};

export type ScrollPosition = {
    index: number;
    isMain: boolean;
    isFrame: boolean;
    isTopOfElt: boolean;
    elt?: Element | Window;
    scrollX: number;
    scrollY: number;
    clip: ClipRect;
    capture: ClipRect & { delay?: number; bufferBottom?: number };
    hideElts?: Element[];
    yAdjust?: number;
};

function maxOf(arr: number[]): number {
    return Math.max(...arr.filter((v) => typeof v === 'number'));
}

export class Arrangements {
    scrollable: ScrollableResult | null = null;
    regions: Region[] = [];
    bgRegions: BgRegion[] = [];
    positions: ScrollPosition[] = [];
    numPositions = 0;
    canvasBg: string | null = null;
    addedHeightChange = false;
    lastPosition: ScrollPosition | null = null;
    dimensions: PageDimensions;
    origWindowX: number;
    origWindowY: number;

    private docElt = document.documentElement;
    private body = document.body;

    constructor(_origBodyHeightZero: boolean, origWindowX: number, origWindowY: number) {
        this.origWindowX = origWindowX;
        this.origWindowY = origWindowY;
        this.dimensions = this.getDimensions();
    }

    getDimensions(): PageDimensions {
        const body = this.body;
        const docElt = this.docElt;
        const viewW = window.innerWidth;
        const viewH = window.innerHeight;

        const bodyStyle = body ? window.getComputedStyle(body) : ({} as CSSStyleDeclaration);
        const overflowHidden = bodyStyle.overflowY === 'hidden' && bodyStyle.overflowX === 'hidden';

        const widths = [
            docElt.clientWidth,
            docElt.offsetWidth,
            bodyStyle.overflowX !== 'hidden' ? docElt.scrollWidth : 0,
            body ? body.offsetWidth : 0,
            body && bodyStyle.overflowX !== 'hidden' ? body.scrollWidth : 0,
        ];

        const docHeights = [docElt.clientHeight, docElt.offsetHeight, overflowHidden ? 0 : docElt.scrollHeight];
        const bodyHeights = [body ? body.offsetHeight : 0, body && !overflowHidden ? body.scrollHeight : 0];

        const docEltMaxHeight = maxOf(docHeights);
        const bodyMaxHeight = maxOf(bodyHeights);
        const fullWidth = maxOf(widths);
        const fullHeight = maxOf([docEltMaxHeight, bodyMaxHeight]);

        let root: Element | undefined;
        if (document.body) {
            const lightbox = document.getElementById('lightbox-wrap');
            if (lightbox) {
                const box = getElementBox(lightbox);
                const lbStyle = window.getComputedStyle(lightbox);
                const zIndex = Number.parseInt(lbStyle.zIndex, 10);
                if (lbStyle.position === 'fixed' && !Number.isNaN(zIndex) && zIndex >= 1000) {
                    const tolerance = 2;
                    if (
                        [box.left, box.top, viewW - box.width, viewH - box.height].every(
                            (v) => Math.abs(v) <= tolerance,
                        )
                    ) {
                        root = lightbox;
                    }
                }
            }
        }

        return {
            windowWidth: viewW,
            windowHeight: viewH,
            bodyMaxHeight,
            docEltMaxHeight,
            fullWidth,
            fullHeight,
            nonadjustedFullWidth: fullWidth,
            nonadjustedFullHeight: fullHeight,
            root,
        };
    }

    getScrollable(): ScrollableResult {
        const d = this.dimensions;
        const result = findScrollable(d.windowWidth, d.windowHeight, d.fullWidth, d.fullHeight, d.root || null);
        this.scrollable = result;
        return result;
    }

    ignoreScrollable(): void {
        this.scrollable = empty();
    }

    addFrameResponse(response: { width: number; height: number } | undefined): void {
        if (!this.scrollable) {
            throw new Error('No scrollable set');
        }
        if (response) {
            Object.assign(this.scrollable, {
                ready: true,
                scrollWidth: response.width,
                scrollHeight: response.height,
            });
        }
    }

    calculate(): void {
        if (this.scrollable === undefined || this.scrollable === null) {
            this.getScrollable();
        }
        this.setRegions();
        this.setPositions();
    }

    popNextPosition(): ScrollPosition | undefined {
        const pos = this.positions.shift();
        if (pos) {
            this.lastPosition = pos;
        }
        return pos;
    }

    addPageHeightChange(pos: ScrollPosition, heightDelta: number): void {
        this.addedHeightChange = true;
        this.positions.unshift(pos);

        const mainPositions = this.positions.filter((p) => !p.isFrame && p.isMain && p.scrollY > 0);
        const maxScrollY = maxOf(mainPositions.map((p) => (!p.isFrame ? p.scrollY : 0)));

        if (maxScrollY > 0) {
            for (const p of mainPositions) {
                p.yAdjust = heightDelta;
            }
            for (const p of mainPositions) {
                if (!p.isFrame && p.scrollY === maxScrollY) {
                    const extra = { ...p };
                    extra.scrollY -= heightDelta;
                    this.positions.push(extra);
                }
            }
        }
    }

    private setRegions(): void {
        const regions: Region[] = [];
        const bgRegions: BgRegion[] = [];
        const scrollable = this.scrollable!;
        const { fullWidth, fullHeight } = this.dimensions;
        let scrollTarget: Element | Window = window;

        const { bodyMaxHeight, docEltMaxHeight } = this.dimensions;
        if (bodyMaxHeight - 20 > docEltMaxHeight && this.body) {
            scrollTarget = this.body;
        }

        if (scrollable.type !== 'empty' && scrollable.ready) {
            const hasBottom = scrollable.bottom < fullHeight;
            const hasRight = scrollable.right < fullWidth;

            let innerRegion: Region | undefined;

            if (scrollable.type === 'elt') {
                innerRegion = {
                    type: 'inner_elt',
                    page: {
                        elt: scrollable.elt,
                        eltHeight: scrollable.height,
                        eltWidth: scrollable.width,
                        eltOffsetLeft: scrollable.left,
                        eltOffsetTop: scrollable.top,
                        top: 0,
                        left: 0,
                        right: scrollable.scrollWidth,
                        bottom: scrollable.scrollHeight,
                    },
                    capture: {
                        x: scrollable.left,
                        y: scrollable.top,
                        width: scrollable.scrollWidth,
                        height: scrollable.scrollHeight,
                    },
                };

                let parent: Element | null = scrollable.elt as Element;
                while (parent) {
                    const mb = Number.parseInt(getComputedStyle(parent).marginBottom, 10);
                    if (!Number.isNaN(mb) && mb) {
                        if (mb < 0) {
                            innerRegion.capture.bufferBottom = Math.abs(mb);
                        }
                        break;
                    }
                    if ((parent as HTMLElement).offsetHeight !== parent.parentElement?.offsetHeight) {
                        break;
                    }
                    parent = parent.parentElement;
                }
            } else if (scrollable.type === 'frame') {
                innerRegion = {
                    type: 'inner_frame',
                    page: {
                        eltHeight: scrollable.height,
                        eltWidth: scrollable.width,
                        eltOffsetLeft: scrollable.left,
                        eltOffsetTop: scrollable.top,
                        top: 0,
                        left: 0,
                        right: scrollable.scrollWidth,
                        bottom: scrollable.scrollHeight,
                    },
                    capture: {
                        x: scrollable.left,
                        y: scrollable.top,
                        width: scrollable.scrollWidth,
                        height: scrollable.scrollHeight,
                    },
                };
            }

            if (hasBottom && hasRight) {
                regions.push({
                    type: 'main',
                    page: {
                        elt: scrollTarget,
                        top: scrollable.bottom,
                        left: scrollable.right,
                        right: fullWidth,
                        bottom: fullHeight,
                    },
                    capture: {
                        delay: 0,
                        x: scrollable.right + (scrollable.scrollWidth - scrollable.width),
                        y: scrollable.bottom + (scrollable.scrollHeight - scrollable.height),
                        width: fullWidth - scrollable.right,
                        height: fullHeight - scrollable.bottom,
                    },
                });
            }

            if (hasBottom) {
                const sw: Region = {
                    type: 'main',
                    page: {
                        elt: scrollTarget,
                        top: scrollable.bottom,
                        left: 0,
                        right: scrollable.right,
                        bottom: fullHeight,
                    },
                    capture: {
                        delay: 0,
                        x: 0,
                        y: scrollable.bottom + (scrollable.scrollHeight - scrollable.height),
                        width: scrollable.right,
                        height: fullHeight - scrollable.bottom,
                    },
                };
                regions.push(sw);
                if (innerRegion) {
                    bgRegions.push({
                        type: 'fill',
                        fill: {
                            x: sw.capture.x + sw.capture.width,
                            y: sw.capture.y,
                            width: innerRegion.capture.width - scrollable.width,
                            height: sw.capture.height,
                        },
                        sample: {
                            x: innerRegion.capture.x,
                            y: sw.capture.y,
                            height: sw.capture.height,
                            width: scrollable.width,
                        },
                    });
                }
            }

            if (hasRight) {
                const ne: Region = {
                    type: 'main',
                    page: {
                        elt: scrollTarget,
                        top: 0,
                        left: scrollable.right,
                        right: fullWidth,
                        bottom: scrollable.bottom,
                    },
                    capture: {
                        delay: 0,
                        x: scrollable.right + (scrollable.scrollWidth - scrollable.width),
                        y: 0,
                        width: fullWidth - scrollable.right,
                        height: scrollable.bottom,
                    },
                };
                regions.push(ne);
                if (innerRegion) {
                    bgRegions.push({
                        type: 'fill',
                        fill: {
                            x: ne.capture.x,
                            y: ne.capture.y + ne.capture.height,
                            width: ne.capture.width,
                            height:
                                innerRegion.capture.y + innerRegion.capture.height - (ne.capture.y + ne.capture.height),
                        },
                        sample: {
                            x: ne.capture.x,
                            y: innerRegion.capture.y,
                            width: ne.capture.width,
                            height: ne.page.bottom - innerRegion.capture.y,
                        },
                    });
                }
            }

            // NW region (always)
            const nw: Region = {
                type: 'main',
                page: {
                    elt: scrollTarget,
                    top: 0,
                    left: 0,
                    right: scrollable.right,
                    bottom: scrollable.bottom,
                },
                capture: {
                    delay: 0,
                    x: 0,
                    y: 0,
                    width: scrollable.right,
                    height: scrollable.bottom,
                },
            };
            regions.push(nw);

            if (innerRegion) {
                const nwBottom = nw.capture.y + nw.capture.height;
                bgRegions.push({
                    type: 'fill',
                    fill: {
                        x: 0,
                        y: nwBottom,
                        width: innerRegion.capture.x,
                        height: innerRegion.capture.y + innerRegion.capture.height - nwBottom,
                    },
                    sample: {
                        x: 0,
                        y: innerRegion.capture.y,
                        width: innerRegion.capture.x,
                        height: nw.page.bottom - innerRegion.capture.y,
                    },
                });
                bgRegions.push({
                    type: 'fill',
                    fill: {
                        x: nw.capture.x + nw.capture.width,
                        y: 0,
                        width: innerRegion.capture.width - scrollable.width,
                        height: innerRegion.capture.y,
                    },
                    sample: {
                        x: innerRegion.capture.x,
                        y: 0,
                        width: scrollable.width,
                        height: innerRegion.capture.y,
                    },
                });

                regions.push(innerRegion);
                this.dimensions.fullWidth += Math.max(0, innerRegion.page.right - (innerRegion.page.eltWidth || 0));
                this.dimensions.fullHeight += Math.max(0, innerRegion.page.bottom - (innerRegion.page.eltHeight || 0));
            }
        } else {
            regions.push({
                type: 'main',
                page: {
                    elt: scrollTarget,
                    top: 0,
                    left: 0,
                    right: fullWidth,
                    bottom: fullHeight,
                },
                capture: { x: 0, y: 0, width: fullWidth, height: fullHeight },
            });
        }

        this.regions = regions;
        this.bgRegions = bgRegions;
        this.canvasBg = bodyBackground();
    }

    private setPositions(): void {
        const { windowWidth: viewW, windowHeight: viewH, fullWidth } = this.dimensions;
        const positions: ScrollPosition[] = [];

        for (const region of this.regions) {
            if (region.type === 'inner_frame') {
                positions.push({
                    index: 0,
                    isFrame: true,
                    isMain: false,
                    isTopOfElt: false,
                    scrollX: 0,
                    scrollY: 0,
                    clip: { x: 0, y: 0, width: 0, height: 0 },
                    capture: { x: 0, y: 0, width: 0, height: 0 },
                });
                continue;
            }

            const page = region.page;
            const step = region.type === 'main' ? 200 : 100;
            const clip = {
                x: page.left,
                y: page.top,
                width: Math.min(viewW, page.right - page.left),
                height: Math.min(viewH, page.bottom - page.top),
            };

            if (region.type !== 'main') {
                clip.x += page.eltOffsetLeft || 0;
                clip.y += page.eltOffsetTop || 0;
                clip.width = page.eltWidth || clip.width;
                clip.height = page.eltHeight || clip.height;
            }

            if (clip.width === 0 || clip.height === 0) {
                continue;
            }

            const fullClip = { ...clip };
            const fullCapture = { ...region.capture };
            if (fullClip.height - step > 0 && fullCapture.height - step > 0) {
                fullClip.y += step;
                fullClip.height -= step;
                fullCapture.y += step;
                fullCapture.height -= step;
            }

            const eltH = (region.type === 'inner_elt' && page.eltHeight) || viewH;
            let scrollStep = eltH - (eltH > step ? step : 0);
            const eltW = (region.type === 'inner_elt' && page.eltWidth) || viewW;

            if (region.capture.bufferBottom) {
                const adj = scrollStep - region.capture.bufferBottom;
                if (adj > 10) {
                    scrollStep = adj;
                }
            }

            if (window.devicePixelRatio < 1) {
                scrollStep -= Math.ceil(1 / window.devicePixelRatio);
            } else {
                scrollStep -= Math.ceil(window.devicePixelRatio);
            }

            let scrollY = 0;
            while (scrollY < page.bottom) {
                const isFirst = scrollY === 0;
                const isLast = scrollY + eltH >= page.bottom;

                let scrollX = page.left;
                while (scrollX < fullWidth) {
                    positions.push({
                        index: positions.length,
                        isMain: region.type === 'main',
                        isFrame: false,
                        isTopOfElt: isFirst,
                        elt: page.elt,
                        scrollX,
                        scrollY,
                        clip: isFirst ? clip : fullClip,
                        capture: isFirst ? region.capture : fullCapture,
                    });
                    scrollX += eltW;
                }
                if (isLast) {
                    break;
                }
                scrollY += scrollStep;
            }
        }

        this.positions = positions;
        this.numPositions = positions.length;
        for (let i = 0; i < positions.length; i++) {
            positions[i].index = i;
        }
    }
}
