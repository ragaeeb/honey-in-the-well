import { describe, expect, it } from 'vitest';
import {
    type BgRegion,
    type CaptureCompleteMessage,
    type CapturedLink,
    type CaptureErrorMessage,
    type CaptureFrameMessage,
    type CaptureMessage,
    type CaptureRegion,
    type CheckExistsMessage,
    type ClipRect,
    type ExtensionMessage,
    type LinkBounds,
    type MessageType,
    MSG_CAPTURE,
    MSG_CAPTURE_COMPLETE,
    MSG_CAPTURE_ERROR,
    MSG_CAPTURE_FRAME,
    MSG_CHECK_EXISTS,
    MSG_SCROLL_PAGE,
    type ScrollPageMessage,
} from './messages';

describe('messages', () => {
    describe('message type constants', () => {
        it("should export MSG_CAPTURE with value 'capture'", () => {
            expect(MSG_CAPTURE).toBe('capture');
        });

        it("should export MSG_CAPTURE_COMPLETE with value 'captureComplete'", () => {
            expect(MSG_CAPTURE_COMPLETE).toBe('captureComplete');
        });

        it("should export MSG_CAPTURE_ERROR with value 'captureError'", () => {
            expect(MSG_CAPTURE_ERROR).toBe('captureError');
        });

        it("should export MSG_CAPTURE_FRAME with value 'captureFrame'", () => {
            expect(MSG_CAPTURE_FRAME).toBe('captureFrame');
        });

        it("should export MSG_CHECK_EXISTS with value 'checkExists'", () => {
            expect(MSG_CHECK_EXISTS).toBe('checkExists');
        });

        it("should export MSG_SCROLL_PAGE with value 'scrollPage'", () => {
            expect(MSG_SCROLL_PAGE).toBe('scrollPage');
        });

        it('should allow MessageType to accept all message constants', () => {
            const types: MessageType[] = [
                MSG_CAPTURE,
                MSG_CAPTURE_COMPLETE,
                MSG_CAPTURE_ERROR,
                MSG_CAPTURE_FRAME,
                MSG_CHECK_EXISTS,
                MSG_SCROLL_PAGE,
            ];
            expect(types).toHaveLength(6);
            expect(types).toContain('capture');
            expect(types).toContain('captureComplete');
            expect(types).toContain('captureError');
            expect(types).toContain('captureFrame');
            expect(types).toContain('checkExists');
            expect(types).toContain('scrollPage');
        });
    });

    describe('ClipRect interface', () => {
        it('should accept valid ClipRect shape', () => {
            const rect: ClipRect = { x: 0, y: 10, width: 100, height: 50 };
            expect(rect.x).toBe(0);
            expect(rect.y).toBe(10);
            expect(rect.width).toBe(100);
            expect(rect.height).toBe(50);
        });
    });

    describe('CaptureRegion interface', () => {
        it('should accept valid CaptureRegion shape', () => {
            const region: CaptureRegion = {
                x: 5,
                y: 5,
                width: 200,
                height: 150,
            };
            expect(region.x).toBe(5);
            expect(region.y).toBe(5);
            expect(region.width).toBe(200);
            expect(region.height).toBe(150);
        });
    });

    describe('LinkBounds interface', () => {
        it('should accept valid LinkBounds shape', () => {
            const bounds: LinkBounds = { x: 1, y: 2, width: 10, height: 20 };
            expect(bounds.x).toBe(1);
            expect(bounds.y).toBe(2);
            expect(bounds.width).toBe(10);
            expect(bounds.height).toBe(20);
        });
    });

    describe('CapturedLink interface', () => {
        it('should accept valid CapturedLink shape', () => {
            const link: CapturedLink = {
                bounds: [{ x: 0, y: 0, width: 50, height: 20 }],
                url: 'https://example.com',
            };
            expect(link.bounds).toHaveLength(1);
            expect(link.bounds[0].x).toBe(0);
            expect(link.url).toBe('https://example.com');
        });
    });

    describe('CaptureMessage interface', () => {
        it('should accept valid CaptureMessage shape', () => {
            const msg: CaptureMessage = {
                msg: MSG_CAPTURE,
                canvasId: 1,
                complete: 0,
                canvasBg: '#ffffff',
                bgRegions: [],
                windowWidth: 1920,
                windowHeight: 1080,
                totalWidth: 3840,
                totalHeight: 2160,
                devicePixelRatio: 2,
                isFrame: false,
                x: 0,
                y: 0,
                clip: { x: 0, y: 0, width: 1920, height: 1080 },
                capture: { x: 0, y: 0, width: 1920, height: 1080 },
            };
            expect(msg.msg).toBe('capture');
            expect(msg.canvasId).toBe(1);
            expect(msg.bgRegions).toEqual([]);
        });

        it('should accept CaptureMessage with optional links and scriptStart', () => {
            const msg: CaptureMessage = {
                msg: MSG_CAPTURE,
                canvasId: 0,
                complete: 1,
                canvasBg: '#000',
                bgRegions: [],
                windowWidth: 800,
                windowHeight: 600,
                totalWidth: 800,
                totalHeight: 600,
                devicePixelRatio: 1,
                isFrame: true,
                x: 0,
                y: 0,
                clip: { x: 0, y: 0, width: 800, height: 600 },
                capture: { x: 0, y: 0, width: 800, height: 600 },
                links: [{ bounds: [], url: 'https://test.com' }],
                scriptStart: 1234567890,
            };
            expect(msg.links).toHaveLength(1);
            expect(msg.scriptStart).toBe(1234567890);
        });
    });

    describe('CaptureCompleteMessage interface', () => {
        it('should accept valid CaptureCompleteMessage shape', () => {
            const msg: CaptureCompleteMessage = {
                msg: MSG_CAPTURE_COMPLETE,
                canvasId: 42,
            };
            expect(msg.msg).toBe('captureComplete');
            expect(msg.canvasId).toBe(42);
        });
    });

    describe('CaptureErrorMessage interface', () => {
        it('should accept valid CaptureErrorMessage shape', () => {
            const msg: CaptureErrorMessage = {
                msg: MSG_CAPTURE_ERROR,
                name: 'Error',
                message: 'Something went wrong',
            };
            expect(msg.msg).toBe('captureError');
            expect(msg.name).toBe('Error');
            expect(msg.message).toBe('Something went wrong');
        });

        it('should accept CaptureErrorMessage with optional stack', () => {
            const msg: CaptureErrorMessage = {
                msg: MSG_CAPTURE_ERROR,
                name: 'TypeError',
                message: 'Cannot read property',
                stack: 'at foo (bar.js:1:1)',
            };
            expect(msg.stack).toBe('at foo (bar.js:1:1)');
        });
    });

    describe('CaptureFrameMessage interface', () => {
        it('should accept valid CaptureFrameMessage shape', () => {
            const msg: CaptureFrameMessage = {
                msg: MSG_CAPTURE_FRAME,
                url: 'https://example.com',
                tagName: 'IFRAME',
                top: 100,
                left: 50,
                width: 400,
                height: 300,
                windowWidth: 1920,
            };
            expect(msg.msg).toBe('captureFrame');
            expect(msg.url).toBe('https://example.com');
            expect(msg.tagName).toBe('IFRAME');
            expect(msg.top).toBe(100);
            expect(msg.left).toBe(50);
            expect(msg.width).toBe(400);
            expect(msg.height).toBe(300);
            expect(msg.windowWidth).toBe(1920);
        });
    });

    describe('CheckExistsMessage interface', () => {
        it('should accept valid CheckExistsMessage shape', () => {
            const msg: CheckExistsMessage = { msg: MSG_CHECK_EXISTS };
            expect(msg.msg).toBe('checkExists');
        });
    });

    describe('ScrollPageMessage interface', () => {
        it('should accept valid ScrollPageMessage shape', () => {
            const msg: ScrollPageMessage = {
                msg: MSG_SCROLL_PAGE,
                canvasId: 1,
            };
            expect(msg.msg).toBe('scrollPage');
            expect(msg.canvasId).toBe(1);
        });

        it('should accept ScrollPageMessage with optional opts', () => {
            const msg: ScrollPageMessage = {
                msg: MSG_SCROLL_PAGE,
                canvasId: 2,
                opts: { behavior: 'smooth' },
            };
            expect(msg.opts).toEqual({ behavior: 'smooth' });
        });
    });

    describe('BgRegion interface', () => {
        it('should accept valid BgRegion shape', () => {
            const region: BgRegion = {
                type: 'fill',
                sample: { x: 0, y: 0, width: 10, height: 10 },
                fill: { x: 0, y: 0, width: 100, height: 100 },
            };
            expect(region.type).toBe('fill');
            expect(region.sample.width).toBe(10);
            expect(region.fill.width).toBe(100);
        });
    });

    describe('ExtensionMessage union type', () => {
        it('should accept CaptureMessage as ExtensionMessage', () => {
            const msg: ExtensionMessage = {
                msg: MSG_CAPTURE,
                canvasId: 0,
                complete: 0,
                canvasBg: '#fff',
                bgRegions: [],
                windowWidth: 800,
                windowHeight: 600,
                totalWidth: 800,
                totalHeight: 600,
                devicePixelRatio: 1,
                isFrame: false,
                x: 0,
                y: 0,
                clip: { x: 0, y: 0, width: 800, height: 600 },
                capture: { x: 0, y: 0, width: 800, height: 600 },
            };
            expect(msg.msg).toBe('capture');
        });

        it('should accept CaptureCompleteMessage as ExtensionMessage', () => {
            const msg: ExtensionMessage = {
                msg: MSG_CAPTURE_COMPLETE,
                canvasId: 1,
            };
            expect(msg.msg).toBe('captureComplete');
        });

        it('should accept CaptureErrorMessage as ExtensionMessage', () => {
            const msg: ExtensionMessage = {
                msg: MSG_CAPTURE_ERROR,
                name: 'Error',
                message: 'msg',
            };
            expect(msg.msg).toBe('captureError');
        });

        it('should accept CaptureFrameMessage as ExtensionMessage', () => {
            const msg: ExtensionMessage = {
                msg: MSG_CAPTURE_FRAME,
                url: 'https://x.com',
                tagName: 'IFRAME',
                top: 0,
                left: 0,
                width: 100,
                height: 100,
                windowWidth: 800,
            };
            expect(msg.msg).toBe('captureFrame');
        });

        it('should accept CheckExistsMessage as ExtensionMessage', () => {
            const msg: ExtensionMessage = { msg: MSG_CHECK_EXISTS };
            expect(msg.msg).toBe('checkExists');
        });

        it('should accept ScrollPageMessage as ExtensionMessage', () => {
            const msg: ExtensionMessage = {
                msg: MSG_SCROLL_PAGE,
                canvasId: 0,
            };
            expect(msg.msg).toBe('scrollPage');
        });
    });
});
