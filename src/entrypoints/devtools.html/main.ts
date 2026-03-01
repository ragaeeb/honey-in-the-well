const tabId = chrome.devtools.inspectedWindow.tabId;

chrome.runtime.sendMessage({
    msg: 'devtools:opened',
    tabId,
});

// Note: beforeunload messages may not be delivered reliably; tabs.onRemoved in
// the background script cleans up when the tab is closed.
window.addEventListener('beforeunload', () => {
    chrome.runtime.sendMessage({
        msg: 'devtools:closed',
        tabId,
    });
});
