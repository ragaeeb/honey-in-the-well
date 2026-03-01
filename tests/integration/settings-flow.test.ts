import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, resetSettings, saveSettings } from '../../src/lib/storage/settings-store';

describe('settings integration flow', () => {
    let storage: Record<string, unknown>;

    beforeEach(() => {
        storage = {};
        vi.clearAllMocks();

        vi.mocked(chrome.storage.local.get).mockImplementation(
            (keys: unknown, callback?: (result: Record<string, unknown>) => void) => {
                const result: Record<string, unknown> = {};
                if (Array.isArray(keys)) {
                    for (const key of keys) {
                        if (key in storage) {
                            result[key] = storage[key];
                        }
                    }
                }
                callback?.(result);
            },
        );

        vi.mocked(chrome.storage.local.set).mockImplementation(
            (items: Record<string, unknown>, callback?: () => void) => {
                Object.assign(storage, items);
                Object.defineProperty(chrome.runtime, 'lastError', {
                    configurable: true,
                    value: null,
                });
                callback?.();
            },
        );
    });

    it('should load default settings initially', async () => {
        const settings = await loadSettings();
        expect(settings.imageFormat).toBe('png');
        expect(settings.pdfFormat).toBe('a4');
        expect(settings.autoDownload).toBe(false);
    });

    it('should save and then load updated settings', async () => {
        await saveSettings({ imageFormat: 'jpg' });
        const loaded = await loadSettings();
        expect(loaded.imageFormat).toBe('jpg');
        expect(loaded.pdfFormat).toBe('a4');
    });

    it('should save multiple settings incrementally', async () => {
        await saveSettings({ pdfFormat: 'letter' });
        await saveSettings({ imageFormat: 'jpg' });
        const loaded = await loadSettings();
        expect(loaded.pdfFormat).toBe('letter');
        expect(loaded.imageFormat).toBe('jpg');
    });

    it('should reset settings to defaults', async () => {
        await saveSettings({
            imageFormat: 'jpg',
            pdfFormat: 'letter',
        });
        await resetSettings();
        const loaded = await loadSettings();
        expect(loaded.imageFormat).toBe('png');
        expect(loaded.pdfFormat).toBe('a4');
    });
});
