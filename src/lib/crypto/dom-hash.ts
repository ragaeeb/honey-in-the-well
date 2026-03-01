import { arrayBufferToHex } from './ecdsa';

export async function hashDomContent(html: string): Promise<string> {
    const encoded = new TextEncoder().encode(html);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return arrayBufferToHex(hash);
}

export async function hashBlob(blob: Blob): Promise<string> {
    const buffer = await blob.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buffer);
    return arrayBufferToHex(hash);
}

export function captureDomSnapshot(): string {
    return document.documentElement.outerHTML;
}
