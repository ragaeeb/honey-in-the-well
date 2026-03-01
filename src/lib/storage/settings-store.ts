export type Settings = {
    imageFormat: 'png' | 'jpg';
    pdfFormat: 'a4' | 'letter' | 'full';
    autoDownload: boolean;
};

const DEFAULT_SETTINGS: Settings = {
    imageFormat: 'png',
    pdfFormat: 'a4',
    autoDownload: false,
};

const STORAGE_KEY = 'hitw_settings';

export async function loadSettings(): Promise<Settings> {
    return new Promise((resolve) => {
        chrome.storage.local.get([STORAGE_KEY], (result) => {
            const stored = result[STORAGE_KEY] || {};
            resolve({ ...DEFAULT_SETTINGS, ...stored });
        });
    });
}

export async function saveSettings(updates: Partial<Settings>): Promise<Settings> {
    const current = await loadSettings();
    const merged = { ...current, ...updates };
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEY]: merged }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve(merged);
            }
        });
    });
}

export async function resetSettings(): Promise<Settings> {
    return new Promise((resolve, reject) => {
        chrome.storage.local.set({ [STORAGE_KEY]: DEFAULT_SETTINGS }, () => {
            if (chrome.runtime.lastError) {
                reject(new Error(chrome.runtime.lastError.message));
            } else {
                resolve({ ...DEFAULT_SETTINGS });
            }
        });
    });
}
