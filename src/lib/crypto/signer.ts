import { arrayBufferToBase64, getPublicKeyFingerprint, signData } from './ecdsa';

export type IntegritySignals = {
    pageLoadedAt: number;
    contentScriptLoadedAt: number;
    baselineDomHash: string | null;
    baselineSettledAt: number | null;
    captureTimeDomHash: string | null;
    baselineMatchesCapture: boolean | null;
    mutationStats: {
        totalCount: number;
        addedNodes: number;
        removedNodes: number;
        attributeChanges: number;
        textChanges: number;
        firstMutationAt: number | null;
        lastMutationAt: number | null;
        mutationBursts: number;
    };
    devToolsSignals: {
        dimensionMismatch: boolean;
        outerWidthDiff: number;
        outerHeightDiff: number;
        performanceAnomaly: boolean;
    };
    devToolsWasOpen: boolean;
    timeSinceLoadMs: number;
};

export type CaptureMetadata = {
    url: string;
    title: string;
    timestamp: string;
    domHash: string;
    screenshotHash: string;
    dimensions: {
        width: number;
        height: number;
        devicePixelRatio: number;
    };
    integrity?: IntegritySignals;
};

export type SignedCapture = {
    metadata: CaptureMetadata;
    signature: string;
    publicKeyFingerprint: string;
};

export async function signCapture(
    metadata: CaptureMetadata,
    privateKeyJwk: JsonWebKey,
    publicKeyJwk: JsonWebKey,
): Promise<SignedCapture> {
    const payload = JSON.stringify(metadata);
    const encoded = new TextEncoder().encode(payload);
    const signatureBuffer = await signData(privateKeyJwk, encoded);

    return {
        metadata,
        signature: arrayBufferToBase64(signatureBuffer),
        publicKeyFingerprint: await getPublicKeyFingerprint(publicKeyJwk),
    };
}
