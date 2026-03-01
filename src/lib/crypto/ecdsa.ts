const ALGORITHM: EcKeyGenParams = {
    name: 'ECDSA',
    namedCurve: 'P-256',
};

const SIGN_ALGORITHM: EcdsaParams = {
    name: 'ECDSA',
    hash: 'SHA-256',
};

export type KeyPairJwk = {
    publicKey: JsonWebKey;
    privateKey: JsonWebKey;
};

export async function generateKeyPair(): Promise<KeyPairJwk> {
    const keyPair = await crypto.subtle.generateKey(ALGORITHM, true, ['sign', 'verify']);
    const [publicKey, privateKey] = await Promise.all([
        crypto.subtle.exportKey('jwk', keyPair.publicKey),
        crypto.subtle.exportKey('jwk', keyPair.privateKey),
    ]);
    return { publicKey, privateKey };
}

export function isValidJwk(obj: unknown): obj is JsonWebKey {
    return obj !== null && typeof obj === 'object' && 'kty' in obj && typeof (obj as JsonWebKey).kty === 'string';
}

export async function signData(privateKeyJwk: JsonWebKey, data: ArrayBuffer): Promise<ArrayBuffer> {
    if (!isValidJwk(privateKeyJwk)) {
        throw new Error('Invalid JWK: missing or invalid kty');
    }
    const key = await crypto.subtle.importKey('jwk', privateKeyJwk, ALGORITHM, false, ['sign']);
    return crypto.subtle.sign(SIGN_ALGORITHM, key, data);
}

export async function verifySignature(
    publicKeyJwk: JsonWebKey,
    signature: ArrayBuffer,
    data: ArrayBuffer,
): Promise<boolean> {
    if (!isValidJwk(publicKeyJwk)) {
        throw new Error('Invalid JWK: missing or invalid kty');
    }
    const key = await crypto.subtle.importKey('jwk', publicKeyJwk, ALGORITHM, false, ['verify']);
    return crypto.subtle.verify(SIGN_ALGORITHM, key, signature, data);
}

export async function getPublicKeyFingerprint(publicKeyJwk: JsonWebKey): Promise<string> {
    const encoded = new TextEncoder().encode(JSON.stringify(publicKeyJwk));
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return arrayBufferToHex(hash);
}

export function arrayBufferToHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (const byte of bytes) {
        binary += String.fromCharCode(byte);
    }
    return btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
    if (typeof base64 !== 'string') {
        throw new Error('base64 must be a string');
    }
    let binary: string;
    try {
        binary = atob(base64);
    } catch {
        throw new Error('Invalid base64 string');
    }
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}
