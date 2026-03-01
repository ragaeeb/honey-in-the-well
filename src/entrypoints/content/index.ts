import { Arrangements } from '@/lib/capture/arrangements';
import { LinkObserver } from '@/lib/capture/link-observer';
import {
    type CaptureMessage,
    MSG_CAPTURE,
    MSG_CAPTURE_COMPLETE,
    MSG_CAPTURE_ERROR,
    MSG_CHECK_EXISTS,
    MSG_GET_INTEGRITY,
    MSG_SCROLL_PAGE,
} from '@/lib/capture/messages';
import { StyleManager } from '@/lib/capture/styles';
import { IntegrityMonitor } from '@/lib/integrity/integrity-monitor';
import { getScrollPosition, scrollTo } from '@/lib/utils/dom';

export default defineContentScript({
    matches: ['<all_urls>'],
    runAt: 'document_idle',
    main() {
        const SCRIPT_START = Math.round(Date.now() / 1000);
        const CAPTURE_DELAY = 150;
        const styles = new StyleManager();
        const integrityMonitor = new IntegrityMonitor();
        integrityMonitor.start();
        window.addEventListener('beforeunload', () => integrityMonitor.stop());
        let previousListener: Parameters<typeof chrome.runtime.onMessage.addListener>[0] | null = null;

        function sendChromeMessage(msg: Record<string, unknown>): Promise<unknown> {
            return new Promise((resolve, reject) => {
                chrome.runtime.sendMessage(msg, (response) => {
                    if (chrome.runtime.lastError) {
                        reject(chrome.runtime.lastError);
                    } else {
                        resolve(response);
                    }
                });
            });
        }

        function sleep(ms: number): Promise<void> {
            return new Promise((r) => setTimeout(r, ms));
        }

        async function scrollAndGetPosition(
            target: Element | Window,
            x: number,
            y: number,
        ): Promise<{ x: number; y: number }> {
            const el = 'style' in (target as HTMLElement) ? (target as HTMLElement) : document.documentElement;
            if (el?.style?.scrollBehavior && el.style.scrollBehavior !== 'auto') {
                el.style.cssText = `${el.style.cssText}; scroll-behavior: auto !important`;
            }

            scrollTo(target, x, y);

            try {
                if ('dispatchEvent' in target) {
                    target.dispatchEvent(new CustomEvent('scroll'));
                }
            } catch (_) {}

            return getScrollPosition(target);
        }

        function reportError(err: unknown): void {
            const error = err as Error;
            const msg = {
                msg: MSG_CAPTURE_ERROR,
                name: error?.name || 'unknown',
                message: error?.message || 'unknown',
                stack: error?.stack,
            };
            chrome.runtime.sendMessage(msg, () => {});
        }

        async function warmupPage(arrangements: Arrangements): Promise<void> {
            if (!arrangements.numPositions) {
                return;
            }
            if (/^(.*\.)?imgur\.com$/.test(window.location.hostname)) {
                return;
            }

            const positions = arrangements.positions.filter((p) => !p.isFrame);
            if (positions.length === 0) {
                return;
            }

            const maxPos = positions.reduce((max, p) => (p.scrollY > max.scrollY ? p : max));

            if (maxPos.elt) {
                await scrollAndGetPosition(maxPos.elt, maxPos.scrollX, maxPos.scrollY);
                await scrollAndGetPosition(maxPos.elt, 0, 0);
            }
            await sleep(60);
        }

        async function captureStep(
            arrangements: Arrangements,
            canvasId: number,
            linkObserver: LinkObserver,
        ): Promise<boolean> {
            if (arrangements.positions.length === 0) {
                cleanup(arrangements, linkObserver);
                return true;
            }

            const isFirst = arrangements.positions.length === arrangements.numPositions;
            const position = arrangements.popNextPosition()!;

            if (position.isFrame) {
                const msg: CaptureMessage = {
                    msg: MSG_CAPTURE,
                    canvasId,
                    complete: (arrangements.numPositions - arrangements.positions.length) / arrangements.numPositions,
                    canvasBg: arrangements.canvasBg || '#ffffff',
                    bgRegions: arrangements.bgRegions,
                    windowWidth: arrangements.dimensions.windowWidth,
                    windowHeight: arrangements.dimensions.windowHeight,
                    totalWidth: arrangements.dimensions.fullWidth,
                    totalHeight: arrangements.dimensions.fullHeight,
                    devicePixelRatio: window.devicePixelRatio,
                    isFrame: true,
                    x: 0,
                    y: 0,
                    clip: position.clip,
                    capture: position.capture,
                    scriptStart: SCRIPT_START,
                };
                const result = await sendChromeMessage(msg);
                return !!result;
            }

            if (!position.elt) {
                throw new Error('Missing position.elt');
            }

            const scrollX = position.scrollX;
            const scrollY = position.scrollY + (position.yAdjust || 0);
            const scrollResult = await scrollAndGetPosition(position.elt, scrollX, scrollY);

            const checkHeightChange =
                !arrangements.addedHeightChange &&
                position.isMain &&
                arrangements.lastPosition &&
                (position.index === 1 || position.index === 2) &&
                position.scrollY > 0;

            if (checkHeightChange) {
                const newDims = arrangements.getDimensions();
                const heightDelta = Math.ceil(
                    newDims.nonadjustedFullHeight - arrangements.dimensions.nonadjustedFullHeight,
                );
                if (heightDelta < 0) {
                    arrangements.addPageHeightChange(position, heightDelta);
                    return doCaptureStep(arrangements, canvasId, linkObserver);
                }
            }

            const delay = isFirst && styles.isMobile() ? 500 : 20;
            await sleep(delay);

            styles.updateFixed(
                arrangements.scrollable?.type === 'elt' ? (arrangements.scrollable.elt as Element) : null,
                position.isTopOfElt,
                arrangements.dimensions.nonadjustedFullHeight,
                arrangements.dimensions.nonadjustedFullWidth,
                position.hideElts,
                isFirst,
            );

            const captureDelay = position.capture.delay !== undefined ? position.capture.delay : CAPTURE_DELAY;
            await sleep(captureDelay);

            const links = linkObserver.step(arrangements.scrollable);

            const msg: CaptureMessage = {
                msg: MSG_CAPTURE,
                canvasId,
                complete: (arrangements.numPositions - arrangements.positions.length) / arrangements.numPositions,
                canvasBg: arrangements.canvasBg || '#ffffff',
                bgRegions: arrangements.bgRegions,
                windowWidth: arrangements.dimensions.windowWidth,
                windowHeight: arrangements.dimensions.windowHeight,
                totalWidth: arrangements.dimensions.fullWidth,
                totalHeight: arrangements.dimensions.fullHeight,
                devicePixelRatio: window.devicePixelRatio,
                isFrame: false,
                x: scrollResult.x,
                y: scrollResult.y - (position.yAdjust || 0),
                clip: position.clip,
                capture: position.capture,
                links,
                scriptStart: SCRIPT_START,
            };

            const result = await sendChromeMessage(msg);
            styles.popAllFixed(true);

            if (result) {
                return doCaptureStep(arrangements, canvasId, linkObserver);
            }
            return false;
        }

        async function doCaptureStep(
            arrangements: Arrangements,
            canvasId: number,
            linkObserver: LinkObserver,
        ): Promise<boolean> {
            if (arrangements.positions.length === 0) {
                cleanup(arrangements, linkObserver);
                return true;
            }
            return captureStep(arrangements, canvasId, linkObserver);
        }

        function cleanup(arrangements: Arrangements, linkObserver: LinkObserver): void {
            linkObserver.end();
            styles.popAll();
            styles.popAllFixed();
            window.scrollTo(arrangements.origWindowX, arrangements.origWindowY);
        }

        function handleMessage(
            message: Record<string, unknown>,
            _sender: chrome.runtime.MessageSender,
            sendResponse: (response?: unknown) => void,
        ): boolean | undefined {
            switch (message.msg) {
                case MSG_CHECK_EXISTS:
                    styles.popAll();
                    styles.popAllFixed();
                    sendResponse({
                        startTime: SCRIPT_START,
                        script: 'content-scripts/content.js',
                    });
                    return false;

                case MSG_SCROLL_PAGE: {
                    const canvasId = (message.canvasId as number) || 0;
                    startCapture(canvasId).catch((err) => {
                        reportError(err);
                    });
                    sendResponse({ info: 'capture initiated' });
                    return false;
                }

                case MSG_GET_INTEGRITY: {
                    integrityMonitor
                        .getSnapshot()
                        .then((snapshot) => sendResponse(snapshot))
                        .catch(() => sendResponse(null));
                    return true;
                }

                default:
                    return false;
            }
        }

        async function startCapture(canvasId: number): Promise<void> {
            const body = document.body;
            const origX = window.scrollX;
            const origY = window.scrollY;
            const bodyHeightZero = (body && body.offsetHeight === 0) || false;

            styles.init();
            styles.initFixed();

            const arrangements = new Arrangements(bodyHeightZero, origX, origY);
            const linkObserver = new LinkObserver();
            const scrollable = arrangements.getScrollable();

            let frameResponse: { width: number; height: number } | undefined;
            if (scrollable.type === 'frame' && scrollable.frame) {
                // For frame capture, we'd need cross-frame messaging
                // Simplified: skip frame interior capture
                arrangements.ignoreScrollable();
            }

            arrangements.addFrameResponse(frameResponse);
            arrangements.calculate();

            if (scrollable.type === 'elt' && scrollable.elt) {
                styles.add(scrollable.elt as HTMLElement, {
                    scrollBehavior: 'auto',
                });
                styles.hideScrollbarsInner(scrollable.elt);
            }

            await warmupPage(arrangements);
            await doCaptureStep(arrangements, canvasId, linkObserver);
            await sendChromeMessage({
                msg: MSG_CAPTURE_COMPLETE,
                canvasId,
            });
        }

        if (previousListener) {
            chrome.runtime.onMessage.removeListener(previousListener);
        }
        chrome.runtime.onMessage.addListener(handleMessage);
        previousListener = handleMessage;
    },
});
