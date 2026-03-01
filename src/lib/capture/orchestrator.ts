import { loadImage } from '../utils/image';
import { CanvasManager } from './canvas-manager';
import {
    type CaptureMessage,
    type ExtensionMessage,
    MSG_CAPTURE,
    MSG_CAPTURE_COMPLETE,
    MSG_CAPTURE_ERROR,
    MSG_CAPTURE_FRAME,
    MSG_CHECK_EXISTS,
    MSG_SCROLL_PAGE,
} from './messages';

const CAPTURE_INTERVAL_MS = 550;
let lastCaptureTime = 0;

async function throttledCaptureVisibleTab(
    windowId: number,
    options: chrome.tabs.CaptureVisibleTabOptions,
): Promise<string> {
    const elapsed = Date.now() - lastCaptureTime;
    if (elapsed < CAPTURE_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, CAPTURE_INTERVAL_MS - elapsed));
    }

    const maxRetries = 3;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            lastCaptureTime = Date.now();
            return await chrome.tabs.captureVisibleTab(windowId, options);
        } catch (err) {
            const msg = (err as Error)?.message || '';
            if (msg.includes('MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND') && attempt < maxRetries - 1) {
                await new Promise((r) => setTimeout(r, CAPTURE_INTERVAL_MS * (attempt + 1)));
                continue;
            }
            throw err;
        }
    }
    throw new Error('captureVisibleTab failed after retries');
}

export type CaptureOptions = {
    imageFormat: 'png' | 'jpg';
};

export type CaptureResult = {
    blobs: Blob[];
    scaleMultiplier: number;
    metadata: Record<string, unknown>;
    totalWidth: number;
    totalHeight: number;
};

type ProgressCallback = (fraction: number) => void;
type SplitCallback = (count: number) => void;

export async function captureFullPage(
    tab: chrome.tabs.Tab,
    options: CaptureOptions,
    onProgress?: ProgressCallback,
    onSplit?: SplitCallback,
): Promise<CaptureResult> {
    const format = options.imageFormat;

    if (!tab.url || tab.url === '' || tab.url === 'about:blank') {
        return captureBlankPage(tab, format, onProgress);
    }

    if (tab.url === 'chrome://newtab/' || tab.url === 'chrome://apps/') {
        return captureVisibleOnly(tab, format, onProgress);
    }

    return captureWithScrolling(tab, format, onProgress, onSplit);
}

async function captureBlankPage(
    tab: chrome.tabs.Tab,
    format: 'png' | 'jpg',
    onProgress?: ProgressCallback,
): Promise<CaptureResult> {
    onProgress?.(0);
    const canvas = document.createElement('canvas');
    canvas.width = tab.width || 1280;
    canvas.height = tab.height || 720;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
    const dataUrl = canvas.toDataURL(mime);
    onProgress?.(0.5);

    const manager = new CanvasManager(format);
    const loaded = await loadImage(dataUrl);
    manager.setObjs(loaded.width, loaded.height);
    manager.drawImage(loaded.img, 0, 0, loaded.width, loaded.height);
    onProgress?.(1);

    const blobs = await manager.toBlobs();
    return {
        blobs,
        scaleMultiplier: manager.scaleMultiplier,
        metadata: manager.metadata,
        totalWidth: manager.totalWidth,
        totalHeight: manager.totalHeight,
    };
}

async function captureVisibleOnly(
    tab: chrome.tabs.Tab,
    format: 'png' | 'jpg',
    onProgress?: ProgressCallback,
): Promise<CaptureResult> {
    onProgress?.(0);
    const dataUrl = await throttledCaptureVisibleTab(tab.windowId!, {
        format: format === 'jpg' ? 'jpeg' : 'png',
    });
    onProgress?.(0.5);

    const manager = new CanvasManager(format);
    const loaded = await loadImage(dataUrl);
    manager.setObjs(loaded.width, loaded.height);
    manager.drawImage(loaded.img, 0, 0, loaded.width, loaded.height);
    onProgress?.(1);

    const blobs = await manager.toBlobs();
    return {
        blobs,
        scaleMultiplier: manager.scaleMultiplier,
        metadata: manager.metadata,
        totalWidth: manager.totalWidth,
        totalHeight: manager.totalHeight,
    };
}

async function captureWithScrolling(
    tab: chrome.tabs.Tab,
    format: 'png' | 'jpg',
    onProgress?: ProgressCallback,
    onSplit?: SplitCallback,
): Promise<CaptureResult> {
    return new Promise((resolve, reject) => {
        const manager = new CanvasManager(format);
        let windowWidth: number | undefined;

        const messageListener = (
            msg: ExtensionMessage,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void,
        ): boolean => {
            switch (msg.msg) {
                case MSG_CAPTURE: {
                    const captureMsg = msg as CaptureMessage;
                    onProgress?.(captureMsg.complete);

                    if (windowWidth === undefined && captureMsg.windowWidth) {
                        windowWidth = captureMsg.windowWidth;
                    }

                    if (manager.isEmpty()) {
                        manager.updateMetadata({
                            ww: captureMsg.windowWidth,
                            wh: captureMsg.windowHeight,
                            dpr: captureMsg.devicePixelRatio,
                        });
                    }

                    if (captureMsg.links?.length) {
                        manager.appendMetadataLinks(captureMsg.links);
                    }

                    if (captureMsg.isFrame) {
                        sendResponse(true);
                        return true;
                    }

                    (async () => {
                        try {
                            const dataUrl = await throttledCaptureVisibleTab(tab.windowId!, {
                                format: 'png',
                            });

                            if (!dataUrl) {
                                reject(new Error('No dataURI from captureVisibleTab'));
                                sendResponse(false);
                                return;
                            }

                            const loaded = await loadImage(dataUrl);
                            const scaleRatio =
                                windowWidth === loaded.width ? 1 : loaded.width / (windowWidth || loaded.width);

                            manager.setScaleMultiplier(scaleRatio);

                            const wasEmpty = manager.isEmpty();

                            if (scaleRatio !== 1) {
                                manager.scaleAll(captureMsg as unknown as Record<string, unknown>, [
                                    'x',
                                    'y',
                                    'capture.*',
                                    'clip.*',
                                ]);
                            }

                            if (wasEmpty) {
                                if (scaleRatio !== 1) {
                                    manager.scaleAll(captureMsg as unknown as Record<string, unknown>, [
                                        'totalWidth',
                                        'totalHeight',
                                    ]);
                                }
                                manager.setObjs(captureMsg.totalWidth, captureMsg.totalHeight, captureMsg.canvasBg);

                                if (manager.size() > 1 && onSplit) {
                                    onSplit(manager.size());
                                }

                                if (captureMsg.bgRegions) {
                                    for (const region of captureMsg.bgRegions) {
                                        manager.scaleAll(region as unknown as Record<string, unknown>, [
                                            'sample.*',
                                            'fill.*',
                                        ]);
                                    }
                                    manager.setBgRegions(captureMsg.bgRegions);
                                }
                            }

                            const destX = captureMsg.x + captureMsg.capture.x;
                            const destY = captureMsg.y + captureMsg.capture.y;

                            manager.drawImage(
                                loaded.img,
                                destX - captureMsg.clip.x,
                                destY - captureMsg.clip.y,
                                loaded.width,
                                loaded.height,
                                captureMsg,
                                {
                                    x: destX,
                                    y: destY,
                                    width: captureMsg.clip.width,
                                    height: captureMsg.clip.height,
                                },
                            );

                            sendResponse(true);
                        } catch (err) {
                            chrome.runtime.onMessage.removeListener(
                                messageListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
                            );
                            reject(err);
                            sendResponse(false);
                        }
                    })();

                    return true;
                }

                case MSG_CAPTURE_ERROR: {
                    const errMsg = msg as {
                        name: string;
                        message: string;
                        stack?: string;
                    };
                    const error = new Error(`${errMsg.name}: ${errMsg.message}`);
                    error.stack = errMsg.stack;
                    reject(error);
                    return false;
                }

                case MSG_CAPTURE_COMPLETE: {
                    chrome.runtime.onMessage.removeListener(
                        messageListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
                    );
                    manager.applyBgRegions();
                    manager.sortLinks();
                    onProgress?.(1);

                    (async () => {
                        try {
                            const blobs = await manager.toBlobs();
                            resolve({
                                blobs,
                                scaleMultiplier: manager.scaleMultiplier,
                                metadata: manager.metadata,
                                totalWidth: manager.totalWidth,
                                totalHeight: manager.totalHeight,
                            });
                        } catch (err) {
                            reject(err);
                        }
                    })();
                    return false;
                }

                case MSG_CAPTURE_FRAME: {
                    sendResponse({ skip: true });
                    return true;
                }

                default:
                    return false;
            }
        };

        chrome.runtime.onMessage.addListener(
            messageListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
        );

        injectAndStart(tab, 0, manager)
            .then(() => {
                // Capture started — waiting for messages
            })
            .catch((err) => {
                chrome.runtime.onMessage.removeListener(
                    messageListener as Parameters<typeof chrome.runtime.onMessage.addListener>[0],
                );
                reject(err);
            });
    });
}

async function injectAndStart(tab: chrome.tabs.Tab, canvasId: number, _manager: CanvasManager): Promise<void> {
    let scriptExists = false;
    try {
        const response = await chrome.tabs.sendMessage(tab.id!, {
            msg: MSG_CHECK_EXISTS,
        });
        if (response?.script) {
            scriptExists = true;
        }
    } catch {
        // Script not injected yet
    }

    if (!scriptExists) {
        await chrome.scripting.executeScript({
            target: { tabId: tab.id! },
            files: ['content-scripts/content.js'],
        });
    }

    await chrome.tabs.sendMessage(tab.id!, {
        msg: MSG_SCROLL_PAGE,
        canvasId,
    });
}
