import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

const chromeMock = {
    runtime: {
        id: 'test-extension-id',
        getURL: (path: string) => `chrome-extension://test-extension-id${path}`,
        sendMessage: vi.fn(),
        onMessage: {
            addListener: vi.fn(),
            removeListener: vi.fn(),
            hasListener: vi.fn(),
        },
        onInstalled: {
            addListener: vi.fn(),
        },
        lastError: null as chrome.runtime.LastError | null,
    },
    tabs: {
        create: vi.fn(),
        query: vi.fn(),
        sendMessage: vi.fn(),
        captureVisibleTab: vi.fn(),
        getZoom: vi.fn(),
    },
    scripting: {
        executeScript: vi.fn(),
    },
    storage: {
        local: {
            get: vi.fn(),
            set: vi.fn(),
            remove: vi.fn(),
        },
        sync: {
            get: vi.fn(),
            set: vi.fn(),
            remove: vi.fn(),
        },
        onChanged: {
            addListener: vi.fn(),
        },
    },
    permissions: {
        contains: vi.fn(),
        request: vi.fn(),
    },
    downloads: {
        download: vi.fn(),
    },
};

vi.stubGlobal('chrome', chromeMock);
vi.stubGlobal('browser', chromeMock);

const cryptoMock = {
    subtle: {
        generateKey: vi.fn(),
        exportKey: vi.fn(),
        importKey: vi.fn(),
        sign: vi.fn(),
        verify: vi.fn(),
        digest: vi.fn(),
    },
    getRandomValues: <T extends ArrayBufferView>(arr: T): T => {
        const bytes = new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = Math.floor(Math.random() * 256);
        }
        return arr;
    },
};

vi.stubGlobal('crypto', cryptoMock);
