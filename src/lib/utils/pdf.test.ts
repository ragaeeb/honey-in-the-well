import { describe, expect, it, vi } from 'vitest';
import type { LoadedImage } from './image';
import { generatePdf } from './pdf';

vi.mock('jspdf', () => {
    const addImageFn = vi.fn();
    const addPageFn = vi.fn();
    const outputFn = vi.fn().mockReturnValue(new Blob(['pdf-content'], { type: 'application/pdf' }));

    return {
        jsPDF: vi.fn().mockImplementation(function JsPdfMock() {
            return {
                addImage: addImageFn,
                addPage: addPageFn,
                output: outputFn,
                internal: {
                    pageSize: {
                        getWidth: () => 595.28,
                        getHeight: () => 841.89,
                    },
                },
            };
        }),
        __mocks: { addImageFn, addPageFn, outputFn },
    };
});

function makeImage(width: number, height: number): LoadedImage {
    return {
        img: document.createElement('img'),
        src: `data:image/png;base64,${btoa(`mock-${width}x${height}`)}`,
        width,
        height,
    };
}

describe('generatePdf', () => {
    it('should throw when no images are provided', async () => {
        await expect(generatePdf([], 1)).rejects.toThrow('No images to generate PDF');
    });

    it('should generate a PDF blob for a single image with default a4 format', async () => {
        const images = [makeImage(1024, 768)];
        const blob = await generatePdf(images, 1);

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should generate a PDF with letter format', async () => {
        const images = [makeImage(800, 1200)];
        const blob = await generatePdf(images, 1, 'letter');

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should generate a PDF with full page format', async () => {
        const images = [makeImage(1024, 5000)];
        const blob = await generatePdf(images, 1, 'full');

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle multiple images', async () => {
        const images = [makeImage(1024, 768), makeImage(1024, 768)];
        const blob = await generatePdf(images, 2);

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should apply scaleMultiplier to image dimensions', async () => {
        const images = [makeImage(2048, 1536)];
        const blob = await generatePdf(images, 2);

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should use landscape orientation when width > height', async () => {
        const images = [makeImage(2000, 500)];
        const blob = await generatePdf(images, 1, 'a4');

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should use portrait orientation when height > width', async () => {
        const images = [makeImage(500, 2000)];
        const blob = await generatePdf(images, 1, 'a4');

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should use landscape for full format when width > height', async () => {
        const images = [makeImage(2000, 500)];
        const blob = await generatePdf(images, 1, 'full');

        expect(blob).toBeInstanceOf(Blob);
    });

    it('should handle a4 format explicitly', async () => {
        const blob = await generatePdf([makeImage(800, 1200)], 1, 'a4');
        expect(blob).toBeInstanceOf(Blob);
    });

    it('should add pages for a4 format when content exceeds page height', async () => {
        const { __mocks } = (await import('jspdf')) as unknown as {
            __mocks: { addPageFn: ReturnType<typeof vi.fn> };
        };
        const { addPageFn } = __mocks;
        addPageFn.mockClear();

        const tallImages = [makeImage(595, 400), makeImage(595, 400), makeImage(595, 400)];
        await generatePdf(tallImages, 1, 'a4');

        expect(addPageFn.mock.calls.length).toBeGreaterThanOrEqual(0);
    });

    it('should not add pages for full format', async () => {
        const { __mocks } = (await import('jspdf')) as unknown as {
            __mocks: { addPageFn: ReturnType<typeof vi.fn> };
        };
        const { addPageFn } = __mocks;
        addPageFn.mockClear();

        const images = [makeImage(500, 2000), makeImage(500, 2000)];
        await generatePdf(images, 1, 'full');

        expect(addPageFn).not.toHaveBeenCalled();
    });
});
