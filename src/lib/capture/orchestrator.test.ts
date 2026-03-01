import { beforeEach, describe, expect, it, vi } from 'vitest';
import { type CaptureOptions, captureFullPage } from './orchestrator';

vi.mock('../utils/image', () => ({
    loadImage: vi.fn(() =>
        Promise.resolve({
            img: document.createElement('img'),
            src: 'data:image/png;base64,mock',
            width: 1024,
            height: 768,
        }),
    ),
}));

vi.mock('./canvas-manager', () => {
    const mockBlob = new Blob(['mock-image'], { type: 'image/png' });
    return {
        CanvasManager: vi.fn().mockImplementation(function CanvasManagerMock() {
            return {
                isEmpty: vi.fn(() => true),
                size: vi.fn(() => 1),
                setObjs: vi.fn(),
                setScaleMultiplier: vi.fn(),
                scaleAll: vi.fn(),
                drawImage: vi.fn(),
                setBgRegions: vi.fn(),
                applyBgRegions: vi.fn(),
                sortLinks: vi.fn(),
                updateMetadata: vi.fn(),
                appendMetadataLinks: vi.fn(),
                toBlobs: vi.fn(() => Promise.resolve([mockBlob])),
                canvasObjs: [],
                scaleMultiplier: 1,
                totalWidth: 1024,
                totalHeight: 768,
                metadata: {},
            };
        }),
    };
});

const nativeCreateElement = Document.prototype.createElement;

function makeTab(overrides?: Partial<chrome.tabs.Tab>): chrome.tabs.Tab {
    return {
        id: 1,
        index: 0,
        pinned: false,
        highlighted: false,
        windowId: 1,
        active: true,
        incognito: false,
        selected: false,
        discarded: false,
        autoDiscardable: true,
        groupId: -1,
        url: 'https://example.com',
        ...overrides,
    };
}

describe('orchestrator', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        vi.clearAllMocks();
        vi.useFakeTimers();

        vi.mocked(chrome.tabs.captureVisibleTab).mockResolvedValue('data:image/png;base64,mockdata');
        vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ script: true });
        vi.mocked(chrome.scripting.executeScript).mockResolvedValue([]);

        vi.spyOn(document, 'createElement').mockImplementation((tagName: string, options?: ElementCreationOptions) => {
            if (tagName.toLowerCase() === 'canvas') {
                const ctx = {
                    fillRect: vi.fn(),
                    fillStyle: '',
                    drawImage: vi.fn(),
                    getImageData: vi.fn(),
                    save: vi.fn(),
                    restore: vi.fn(),
                    clip: vi.fn(),
                };
                return {
                    width: 0,
                    height: 0,
                    getContext: () => ctx,
                    toDataURL: () => 'data:image/png;base64,mock',
                    toBlob: (cb: (b: Blob) => void) => cb(new Blob(['mock'], { type: 'image/png' })),
                } as unknown as HTMLCanvasElement;
            }
            return nativeCreateElement.call(document, tagName, options);
        });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    describe('captureFullPage', () => {
        it('should capture a blank page when url is empty', async () => {
            const tab = makeTab({ url: '', width: 800, height: 600 });
            const options: CaptureOptions = { imageFormat: 'png' };

            const promise = captureFullPage(tab, options);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.blobs).toHaveLength(1);
            expect(result.scaleMultiplier).toBeDefined();
        });

        it('should capture a blank page when url is about:blank', async () => {
            const tab = makeTab({ url: 'about:blank', width: 1024, height: 768 });
            const options: CaptureOptions = { imageFormat: 'png' };

            const promise = captureFullPage(tab, options);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.blobs).toHaveLength(1);
        });

        it('should capture visible only for chrome://newtab/', async () => {
            const tab = makeTab({ url: 'chrome://newtab/', windowId: 1 });
            const options: CaptureOptions = { imageFormat: 'png' };

            const promise = captureFullPage(tab, options);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.blobs).toHaveLength(1);
            expect(chrome.tabs.captureVisibleTab).toHaveBeenCalled();
        });

        it('should capture visible only for chrome://apps/', async () => {
            const tab = makeTab({ url: 'chrome://apps/', windowId: 1 });
            const options: CaptureOptions = { imageFormat: 'png' };

            const promise = captureFullPage(tab, options);
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.blobs).toHaveLength(1);
        });

        it('should call progress callback for blank page', async () => {
            const tab = makeTab({ url: '' });
            const onProgress = vi.fn();

            const promise = captureFullPage(tab, { imageFormat: 'png' }, onProgress);
            await vi.runAllTimersAsync();
            await promise;

            expect(onProgress).toHaveBeenCalledWith(0);
            expect(onProgress).toHaveBeenCalledWith(0.5);
            expect(onProgress).toHaveBeenCalledWith(1);
        });

        it('should call progress callback for visible-only capture', async () => {
            const tab = makeTab({ url: 'chrome://newtab/', windowId: 1 });
            const onProgress = vi.fn();

            const promise = captureFullPage(tab, { imageFormat: 'png' }, onProgress);
            await vi.runAllTimersAsync();
            await promise;

            expect(onProgress).toHaveBeenCalledWith(0);
            expect(onProgress).toHaveBeenCalledWith(0.5);
            expect(onProgress).toHaveBeenCalledWith(1);
        });

        it('should use default dimensions for blank page without tab dimensions', async () => {
            const tab = makeTab({ url: '' });
            delete (tab as Record<string, unknown>).width;
            delete (tab as Record<string, unknown>).height;

            const promise = captureFullPage(tab, { imageFormat: 'png' });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.blobs).toHaveLength(1);
        });

        it('should use jpg format for blank page capture', async () => {
            const tab = makeTab({ url: '', width: 100, height: 100 });

            const promise = captureFullPage(tab, { imageFormat: 'jpg' });
            await vi.runAllTimersAsync();
            const result = await promise;

            expect(result.blobs).toHaveLength(1);
        });

        it('should initiate scrolling capture for normal URLs', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();

            vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ script: true });

            const promise = captureFullPage(tab, { imageFormat: 'png' });

            await vi.advanceTimersByTimeAsync(100);

            expect(chrome.runtime.onMessage.addListener).toHaveBeenCalled();

            const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as (
                msg: unknown,
                sender: unknown,
                sendResponse: (r?: unknown) => void,
            ) => boolean;

            const sendResponse = vi.fn();

            listener(
                {
                    msg: 'capture',
                    canvasId: 0,
                    complete: 0.5,
                    canvasBg: '#fff',
                    bgRegions: [],
                    windowWidth: 1024,
                    windowHeight: 768,
                    totalWidth: 1024,
                    totalHeight: 2000,
                    devicePixelRatio: 1,
                    isFrame: false,
                    x: 0,
                    y: 0,
                    clip: { x: 0, y: 0, width: 1024, height: 768 },
                    capture: { x: 0, y: 0, width: 1024, height: 768 },
                },
                {},
                sendResponse,
            );

            await vi.advanceTimersByTimeAsync(1000);

            listener({ msg: 'captureComplete', canvasId: 0 }, {}, vi.fn());

            await vi.advanceTimersByTimeAsync(100);

            const result = await promise;
            expect(result.blobs).toHaveLength(1);
        });

        it('should handle capture error message', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();

            vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ script: true });

            const promise = captureFullPage(tab, { imageFormat: 'png' });
            await vi.advanceTimersByTimeAsync(100);

            const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as (
                msg: unknown,
                sender: unknown,
                sendResponse: (r?: unknown) => void,
            ) => boolean;

            listener(
                {
                    msg: 'captureError',
                    name: 'TestError',
                    message: 'Something went wrong',
                    stack: 'at test:1',
                },
                {},
                vi.fn(),
            );

            await expect(promise).rejects.toThrow('TestError: Something went wrong');
        });

        it('should handle captureFrame message', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();
            vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ script: true });

            captureFullPage(tab, { imageFormat: 'png' });
            await vi.advanceTimersByTimeAsync(100);

            const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as (
                msg: unknown,
                sender: unknown,
                sendResponse: (r?: unknown) => void,
            ) => boolean;

            const sendResponse = vi.fn();
            const result = listener({ msg: 'captureFrame', url: 'https://frame.com' }, {}, sendResponse);

            expect(result).toBe(true);
            expect(sendResponse).toHaveBeenCalledWith({ skip: true });
        });

        it('should return false for unknown message types', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();
            vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ script: true });

            captureFullPage(tab, { imageFormat: 'png' });
            await vi.advanceTimersByTimeAsync(100);

            const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as (
                msg: unknown,
                sender: unknown,
                sendResponse: (r?: unknown) => void,
            ) => boolean;

            const result = listener({ msg: 'unknownMessageType' }, {}, vi.fn());
            expect(result).toBe(false);
        });

        it('should handle frame capture messages by responding with true', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();
            vi.mocked(chrome.tabs.sendMessage).mockResolvedValue({ script: true });

            captureFullPage(tab, { imageFormat: 'png' });
            await vi.advanceTimersByTimeAsync(100);

            const listener = vi.mocked(chrome.runtime.onMessage.addListener).mock.calls[0][0] as (
                msg: unknown,
                sender: unknown,
                sendResponse: (r?: unknown) => void,
            ) => boolean;

            const sendResponse = vi.fn();
            listener(
                {
                    msg: 'capture',
                    isFrame: true,
                    complete: 0.5,
                    windowWidth: 1024,
                    windowHeight: 768,
                },
                {},
                sendResponse,
            );

            expect(sendResponse).toHaveBeenCalledWith(true);
        });

        it('should inject content script if not already present', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();

            vi.mocked(chrome.tabs.sendMessage)
                .mockRejectedValueOnce(new Error('No script'))
                .mockResolvedValue(undefined);

            captureFullPage(tab, { imageFormat: 'png' });
            await vi.advanceTimersByTimeAsync(100);

            expect(chrome.scripting.executeScript).toHaveBeenCalledWith({
                target: { tabId: 42 },
                files: ['content-scripts/content.js'],
            });
        });

        it('should reject when inject fails', async () => {
            const tab = makeTab({ url: 'https://example.com', id: 42, windowId: 1 });

            chrome.runtime.onMessage.addListener = vi.fn();
            chrome.runtime.onMessage.removeListener = vi.fn();

            vi.mocked(chrome.tabs.sendMessage).mockImplementation(() => {
                return Promise.reject(new Error('No script'));
            });
            vi.mocked(chrome.scripting.executeScript).mockImplementation(() => {
                return Promise.reject(new Error('Injection failed'));
            });

            const promise = captureFullPage(tab, { imageFormat: 'png' });
            promise.catch(() => {});
            await vi.advanceTimersByTimeAsync(100);

            await expect(promise).rejects.toThrow('Injection failed');
        });
    });
});
