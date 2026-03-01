export const MSG_CAPTURE = 'capture' as const;
export const MSG_CAPTURE_COMPLETE = 'captureComplete' as const;
export const MSG_CAPTURE_ERROR = 'captureError' as const;
export const MSG_CAPTURE_FRAME = 'captureFrame' as const;
export const MSG_CHECK_EXISTS = 'checkExists' as const;
export const MSG_SCROLL_PAGE = 'scrollPage' as const;
export const MSG_GET_INTEGRITY = 'getIntegrity' as const;

export type MessageType =
    | typeof MSG_CAPTURE
    | typeof MSG_CAPTURE_COMPLETE
    | typeof MSG_CAPTURE_ERROR
    | typeof MSG_CAPTURE_FRAME
    | typeof MSG_CHECK_EXISTS
    | typeof MSG_SCROLL_PAGE
    | typeof MSG_GET_INTEGRITY;

export type ClipRect = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type CaptureRegion = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type LinkBounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export type CapturedLink = {
    bounds: LinkBounds[];
    url: string;
};

export type CaptureMessage = {
    msg: typeof MSG_CAPTURE;
    canvasId: number;
    complete: number;
    canvasBg: string;
    bgRegions: BgRegion[];
    windowWidth: number;
    windowHeight: number;
    totalWidth: number;
    totalHeight: number;
    devicePixelRatio: number;
    isFrame: boolean;
    x: number;
    y: number;
    clip: ClipRect;
    capture: CaptureRegion;
    links?: CapturedLink[];
    scriptStart?: number;
};

export type CaptureCompleteMessage = {
    msg: typeof MSG_CAPTURE_COMPLETE;
    canvasId: number;
};

export type CaptureErrorMessage = {
    msg: typeof MSG_CAPTURE_ERROR;
    name: string;
    message: string;
    stack?: string;
};

export type CaptureFrameMessage = {
    msg: typeof MSG_CAPTURE_FRAME;
    url: string;
    tagName: string;
    top: number;
    left: number;
    width: number;
    height: number;
    windowWidth: number;
};

export type CheckExistsMessage = {
    msg: typeof MSG_CHECK_EXISTS;
};

export type ScrollPageMessage = {
    msg: typeof MSG_SCROLL_PAGE;
    canvasId: number;
    opts?: Record<string, unknown>;
};

export type BgRegion = {
    type: 'fill';
    sample: ClipRect;
    fill: ClipRect;
};

export type GetIntegrityMessage = {
    msg: typeof MSG_GET_INTEGRITY;
};

export type ExtensionMessage =
    | CaptureMessage
    | CaptureCompleteMessage
    | CaptureErrorMessage
    | CaptureFrameMessage
    | CheckExistsMessage
    | ScrollPageMessage
    | GetIntegrityMessage;
