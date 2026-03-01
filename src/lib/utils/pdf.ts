import { jsPDF } from 'jspdf';
import type { LoadedImage } from './image';

export type PdfFormat = 'a4' | 'letter' | 'full';

export async function generatePdf(
    images: LoadedImage[],
    scaleMultiplier: number,
    format: PdfFormat = 'a4',
): Promise<Blob> {
    if (images.length === 0) {
        throw new Error('No images to generate PDF');
    }

    const firstImg = images[0];
    const imgW = firstImg.width / scaleMultiplier;
    const totalImgH = images.reduce((sum, img) => sum + img.height / scaleMultiplier, 0);

    let pageWidth: number;
    let pageHeight: number;
    let orientation: 'portrait' | 'landscape';

    if (format === 'full') {
        pageWidth = imgW;
        pageHeight = totalImgH;
        orientation = imgW > totalImgH ? 'landscape' : 'portrait';
    } else {
        const sizes = {
            a4: { w: 595.28, h: 841.89 },
            letter: { w: 612, h: 792 },
        };
        const size = sizes[format];
        orientation = imgW > totalImgH ? 'landscape' : 'portrait';
        if (orientation === 'landscape') {
            pageWidth = size.h;
            pageHeight = size.w;
        } else {
            pageWidth = size.w;
            pageHeight = size.h;
        }
    }

    const doc = new jsPDF({
        orientation,
        unit: 'pt',
        format: format === 'full' ? [pageWidth, pageHeight] : format,
    });

    let yOffset = 0;
    const scale = format === 'full' ? 1 : pageWidth / imgW;

    for (let i = 0; i < images.length; i++) {
        const img = images[i];
        const w = (img.width / scaleMultiplier) * scale;
        const h = (img.height / scaleMultiplier) * scale;

        if (format !== 'full' && i > 0 && yOffset + h > pageHeight) {
            doc.addPage();
            yOffset = 0;
        }

        doc.addImage(img.src, 'PNG', 0, yOffset, w, h);
        yOffset += h;
    }

    return doc.output('blob');
}
