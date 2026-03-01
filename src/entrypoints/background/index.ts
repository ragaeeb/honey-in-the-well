import { getOrCreateKeyPair } from '@/lib/crypto/key-store';

const devToolsOpenTabs = new Set<number>();

export default defineBackground(() => {
    chrome.runtime.onInstalled.addListener(async (details) => {
        if (details.reason === 'install') {
            await getOrCreateKeyPair();
            const url = chrome.runtime.getURL('/options.html');
            chrome.tabs.create({ url });
        }
    });

    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
        if (!message || typeof message !== 'object') {
            return false;
        }

        if (message.msg === 'devtools:opened' && typeof message.tabId === 'number') {
            devToolsOpenTabs.add(message.tabId);
            return false;
        }

        if (message.msg === 'devtools:closed' && typeof message.tabId === 'number') {
            devToolsOpenTabs.delete(message.tabId);
            return false;
        }

        if (message.msg === 'devtools:check' && typeof message.tabId === 'number') {
            sendResponse({ isOpen: devToolsOpenTabs.has(message.tabId) });
            return false;
        }

        return false;
    });

    chrome.tabs.onRemoved.addListener((tabId) => {
        devToolsOpenTabs.delete(tabId);
    });
});
