import { generateKeyPair, isValidJwk, type KeyPairJwk } from './ecdsa';

const STORAGE_KEY = 'hitw_ecdsa_keypair';

function isValidKeyPair(data: unknown): data is KeyPairJwk {
    return (
        data !== null &&
        typeof data === 'object' &&
        isValidJwk((data as KeyPairJwk).publicKey) &&
        isValidJwk((data as KeyPairJwk).privateKey)
    );
}

export async function getOrCreateKeyPair(): Promise<KeyPairJwk> {
    const stored = await getStoredKeyPair();
    if (stored) {
        return stored;
    }

    const keyPair = await generateKeyPair();
    await storeKeyPair(keyPair);
    return keyPair;
}

export async function getStoredKeyPair(): Promise<KeyPairJwk | null> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const data = result[STORAGE_KEY];
            if (isValidKeyPair(data)) {
                resolve(data);
            } else {
                resolve(null);
            }
        });
    });
}

export async function storeKeyPair(keyPair: KeyPairJwk): Promise<void> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEY]: keyPair }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve();
            }
        });
    });
}

export async function clearKeyPair(): Promise<void> {
    return new Promise((resolve) => {
        chrome.storage.local.remove([STORAGE_KEY], () => resolve());
    });
}
