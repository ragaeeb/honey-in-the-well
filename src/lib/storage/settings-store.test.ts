import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadSettings, resetSettings, type Settings, saveSettings } from './settings-store';

const STORAGE_KEY = 'hitw_settings';

describe('settings-store', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        chrome.runtime.lastError = null;

        vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) => {
            (cb as (result: Record<string, unknown>) => void)({});
            return undefined as unknown;
        });

        vi.mocked(chrome.storage.local.set).mockImplementation((_items, cb) => {
            if (cb) {
                cb();
            }
            return undefined as unknown;
        });
    });

    describe('loadSettings', () => {
        it('should return defaults when nothing stored', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) => {
                (cb as (result: Record<string, unknown>) => void)({});
                return undefined as unknown;
            });

            const settings = await loadSettings();

            expect(settings).toEqual({
                imageFormat: 'png',
                pdfFormat: 'a4',
                autoDownload: false,
            });
            expect(chrome.storage.local.get).toHaveBeenCalledWith([STORAGE_KEY], expect.any(Function));
        });

        it('should merge stored values with defaults', async () => {
            const stored: Partial<Settings> = {
                imageFormat: 'jpg',
                autoDownload: true,
            };
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) => {
                (cb as (result: Record<string, unknown>) => void)({
                    [STORAGE_KEY]: stored,
                });
                return undefined as unknown;
            });

            const settings = await loadSettings();

            expect(settings).toEqual({
                imageFormat: 'jpg',
                pdfFormat: 'a4',
                autoDownload: true,
            });
        });

        it('should call chrome.storage.local.get with STORAGE_KEY', async () => {
            await loadSettings();

            expect(chrome.storage.local.get).toHaveBeenCalledWith([STORAGE_KEY], expect.any(Function));
        });
    });

    describe('saveSettings', () => {
        it('should merge updates with existing settings', async () => {
            vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) => {
                (cb as (result: Record<string, unknown>) => void)({
                    [STORAGE_KEY]: {
                        imageFormat: 'png',
                    },
                });
                return undefined as unknown;
            });

            const result = await saveSettings({
                imageFormat: 'jpg',
                autoDownload: true,
            });

            expect(result).toEqual({
                imageFormat: 'jpg',
                pdfFormat: 'a4',
                autoDownload: true,
            });
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEY]: result }, expect.any(Function));
        });

        it('should merge with defaults when nothing stored', async () => {
            const result = await saveSettings({ imageFormat: 'jpg' });

            expect(result.imageFormat).toBe('jpg');
            expect(result.pdfFormat).toBe('a4');
            expect(result.autoDownload).toBe(false);
        });

        it('should reject when chrome.runtime.lastError is set', async () => {
            vi.mocked(chrome.storage.local.set).mockImplementation((_items, cb) => {
                chrome.runtime.lastError = { message: 'Storage quota exceeded' };
                if (cb) {
                    cb();
                }
                return undefined as unknown;
            });

            await expect(saveSettings({ imageFormat: 'png' })).rejects.toThrow('Storage quota exceeded');
        });
    });

    describe('resetSettings', () => {
        it('should return defaults and clear stored settings', async () => {
            const result = await resetSettings();

            expect(result).toEqual({
                imageFormat: 'png',
                pdfFormat: 'a4',
                autoDownload: false,
            });
            expect(chrome.storage.local.set).toHaveBeenCalledWith({ [STORAGE_KEY]: result }, expect.any(Function));
        });

        it('should reject when chrome.runtime.lastError is set', async () => {
            vi.mocked(chrome.storage.local.set).mockImplementation((_items, cb) => {
                chrome.runtime.lastError = { message: 'Storage error' };
                if (cb) {
                    cb();
                }
                return undefined as unknown;
            });

            await expect(resetSettings()).rejects.toThrow('Storage error');
        });
    });
});
