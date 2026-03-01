export type LoadedImage = {
    img: HTMLImageElement;
    src: string;
    width: number;
    height: number;
};

export function loadImage(src: string): Promise<LoadedImage> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = (e) => reject(e);
        img.onload = () => resolve({ img, src, width: img.width, height: img.height });
        img.src = src;
    });
}

function toBlobMime(format: string): string {
    if (format === 'jpg' || format === 'image/jpeg') {
        return 'image/jpeg';
    }
    if (format === 'webp' || format === 'image/webp') {
        return 'image/webp';
    }
    return format.startsWith('image/') ? format : `image/${format}`;
}

export function canvasToBlob(canvas: HTMLCanvasElement, format: string): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const mime = toBlobMime(format);
        canvas.toBlob(
            (blob) => {
                if (blob) {
                    resolve(blob);
                } else {
                    reject(new Error('Canvas toBlob returned null'));
                }
            },
            mime,
            mime === 'image/jpeg' ? 0.92 : undefined,
        );
    });
}

export function blobToUrl(blob: Blob): string {
    return URL.createObjectURL(blob);
}

export function revokeObjectUrl(url: string): void {
    URL.revokeObjectURL(url);
}
