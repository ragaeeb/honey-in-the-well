import { canvasToBlob } from '../utils/image';
import type { BgRegion, CapturedLink, ClipRect } from './messages';

const MAX_SINGLE_DIM = 28800;
const MAX_CROSS_DIM = 9000;
const MAX_TOTAL_PIXELS = 259_200_000;

type CanvasObj = {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    index: number;
    left: number;
    right: number;
    top: number;
    bottom: number;
    width: number;
    height: number;
};

export class CanvasManager {
    canvasObjs: CanvasObj[] = [];
    private bgRegions: BgRegion[] = [];
    scaleMultiplier = 1;
    totalWidth = 0;
    totalHeight = 0;
    metadata: {
        ww?: number;
        wh?: number;
        dpr?: number;
        links?: CapturedLink[];
    } = {};
    private exportFormat: string;

    constructor(exportFormat: string) {
        this.exportFormat = exportFormat;
    }

    size(): number {
        return this.canvasObjs.length;
    }

    isEmpty(): boolean {
        return this.canvasObjs.length === 0;
    }

    updateMetadata(data: Record<string, unknown>): void {
        this.metadata = { ...this.metadata, ...data };
    }

    appendMetadataLinks(links?: CapturedLink[]): void {
        if (!links) {
            return;
        }
        const existing = this.metadata.links || [];
        this.metadata = { ...this.metadata, links: [...existing, ...links] };
    }

    sortLinks(): void {
        if (!this.metadata.links) {
            return;
        }
        this.metadata.links.sort((a, b) => {
            const ay = a.bounds[0]?.y ?? 0;
            const by = b.bounds[0]?.y ?? 0;
            if (ay === by) {
                return (a.bounds[0]?.x ?? 0) - (b.bounds[0]?.x ?? 0);
            }
            return ay - by;
        });
    }

    setScaleMultiplier(value: number): void {
        this.scaleMultiplier = value;
    }

    setObjs(totalWidth: number, totalHeight: number, bgColor?: string): void {
        this.totalWidth = totalWidth;
        this.totalHeight = totalHeight;

        const isLarge =
            totalHeight > MAX_SINGLE_DIM || totalWidth > MAX_SINGLE_DIM || totalHeight * totalWidth > MAX_TOTAL_PIXELS;
        const isWide = totalWidth > totalHeight;

        const tileW = isLarge ? (isWide ? MAX_SINGLE_DIM : MAX_CROSS_DIM) : totalWidth;
        const tileH = isLarge ? (isWide ? MAX_CROSS_DIM : MAX_SINGLE_DIM) : totalHeight;

        const cols = Math.ceil(totalWidth / tileW);
        const rows = Math.ceil(totalHeight / tileH);

        const objs: CanvasObj[] = [];
        let idx = 0;

        for (let row = 0; row < rows; row++) {
            for (let col = 0; col < cols; col++) {
                const canvas = document.createElement('canvas');
                const w = col === cols - 1 && totalWidth % tileW ? totalWidth % tileW : tileW;
                const h = row === rows - 1 && totalHeight % tileH ? totalHeight % tileH : tileH;
                canvas.width = w;
                canvas.height = h;

                const ctx = canvas.getContext('2d')!;
                if (bgColor) {
                    ctx.fillStyle = bgColor;
                    ctx.fillRect(0, 0, w, h);
                }

                const left = col * tileW;
                const top = row * tileH;
                objs.push({
                    canvas,
                    ctx,
                    index: idx++,
                    left,
                    right: left + w,
                    top,
                    bottom: top + h,
                    width: w,
                    height: h,
                });
            }
        }

        this.canvasObjs = objs;
    }

    toBlobs(): Promise<Blob[]> {
        return Promise.all(this.canvasObjs.map((obj) => canvasToBlob(obj.canvas, this.exportFormat)));
    }

    toDataURLs(): string[] {
        const mime = this.exportFormat === 'jpg' ? 'image/jpeg' : `image/${this.exportFormat}`;
        return this.canvasObjs.map((obj) => obj.canvas.toDataURL(mime));
    }

    drawImage(
        img: HTMLImageElement,
        x: number,
        y: number,
        width: number,
        height: number,
        _meta?: unknown,
        mask?: ClipRect,
    ): void {
        for (const obj of this.filterObjs(x, y, width, height)) {
            const shifted = this.shift(obj, x, y);
            const ctx = obj.ctx;
            ctx.save();

            if (mask) {
                const maskShifted = this.shift(obj, mask.x, mask.y);
                const path = new Path2D();
                path.rect(
                    Math.floor(maskShifted.x),
                    Math.floor(maskShifted.y),
                    Math.ceil(mask.width),
                    Math.ceil(mask.height),
                );
                ctx.clip(path);
            }

            ctx.drawImage(img, shifted.x, shifted.y);
            ctx.restore();
        }
    }

    fillRect(color: string, x: number, y: number, width: number, height: number): void {
        for (const obj of this.filterObjs(x, y, width, height)) {
            const shifted = this.shift(obj, x, y);
            obj.ctx.fillStyle = color;
            obj.ctx.fillRect(shifted.x, shifted.y, width, height);
        }
    }

    scale(value: number): number {
        return (value || 0) * this.scaleMultiplier;
    }

    scaleAll(target: Record<string, unknown>, keys: string[]): void {
        for (const key of keys) {
            if (key === '*') {
                for (const k of Object.keys(target)) {
                    (target as Record<string, number>)[k] = this.scale(target[k] as number);
                }
            } else {
                const dot = key.indexOf('.');
                if (dot === -1) {
                    (target as Record<string, number>)[key] = this.scale(target[key] as number);
                } else {
                    const parent = key.substring(0, dot);
                    const child = key.substring(dot + 1);
                    this.scaleAll(target[parent] as Record<string, unknown>, [child]);
                }
            }
        }
    }

    setBgRegions(regions: BgRegion[]): void {
        this.bgRegions = regions;
    }

    applyBgRegions(): void {
        for (const { sample, fill } of this.bgRegions) {
            const histo = new Map<number, number>();
            for (const obj of this.filterObjs(sample.x, sample.y, sample.width, sample.height)) {
                const constrained = this.constrain(obj, sample.x, sample.y, sample.width, sample.height);
                if (constrained.width > 0 && constrained.height > 0) {
                    const tmpCanvas = document.createElement('canvas');
                    tmpCanvas.width = constrained.width;
                    tmpCanvas.height = constrained.height;
                    const tmpCtx = tmpCanvas.getContext('2d')!;
                    tmpCtx.drawImage(obj.canvas, -constrained.x, -constrained.y);
                    try {
                        const data = tmpCtx.getImageData(0, 0, constrained.width, constrained.height);
                        this.buildHistogram(data.data, histo);
                    } catch (_) {}
                }
            }

            let maxCount = 0;
            let maxColor = 0;
            histo.forEach((count, color) => {
                if (count > maxCount) {
                    maxCount = count;
                    maxColor = color;
                }
            });

            if (maxColor !== 0) {
                const [r, g, b] = toRgb(maxColor);
                this.fillRect(`rgb(${r}, ${g}, ${b})`, fill.x, fill.y, fill.width, fill.height);
            }
        }
    }

    private filterObjs(x: number, y: number, width: number, height: number): CanvasObj[] {
        const right = x + width;
        const bottom = y + height;
        return this.canvasObjs.filter((obj) => x < obj.right && right > obj.left && y < obj.bottom && bottom > obj.top);
    }

    private shift(obj: CanvasObj, x: number, y: number): { x: number; y: number } {
        return {
            x: Math.round(x - obj.left),
            y: Math.round(y - obj.top),
        };
    }

    private constrain(
        obj: CanvasObj,
        x: number,
        y: number,
        width: number,
        height: number,
    ): { x: number; y: number; width: number; height: number } {
        const shifted = this.shift(obj, x, y);
        const startX = Math.max(0, shifted.x);
        const startY = Math.max(0, shifted.y);
        return {
            x: startX,
            y: startY,
            width: Math.min(obj.width, shifted.x + width) - startX,
            height: Math.min(obj.height, shifted.y + height) - startY,
        };
    }

    private buildHistogram(data: Uint8ClampedArray, histo: Map<number, number>): void {
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] === 255) {
                const color = (data[i] << 16) + (data[i + 1] << 8) + data[i + 2];
                histo.set(color, (histo.get(color) || 0) + 1);
            }
        }
    }
}

function toRgb(color: number): [number, number, number] {
    const b = color & 0xff;
    const g = (color >> 8) & 0xff;
    const r = (color >> 16) & 0xff;
    return [r, g, b];
}
