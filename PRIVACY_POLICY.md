# Privacy Policy — Honey in the Well

Last updated: February 27, 2026

## What This Extension Does

Honey in the Well captures full-page screenshots of web pages you visit, with cryptographic integrity verification. It is designed to create tamper-evident records of web content.

## Data Collection

### What We Collect

- **Page content**: When you trigger a capture, the extension reads the visible DOM of the active tab to create a screenshot and compute integrity hashes.
- **Page URL and title**: Stored alongside the capture for identification.
- **DOM hash**: A SHA-256 hash of the page's HTML content at capture time.
- **Integrity signals**: DevTools open/closed status, DOM mutation statistics, page load timing. These are metadata about the capture environment, not about you.
- **Device key**: A unique ECDSA P-256 key pair is generated per extension installation. The private key never leaves your device.

### What We Do NOT Collect

- No personal information (name, email, browsing history, etc.)
- No data is sent to any remote server (the upload feature is not yet implemented)
- No analytics, telemetry, or tracking of any kind
- No cookies or cross-site tracking
- No access to pages you don't explicitly capture

## Data Storage

All data is stored locally on your device:

- Capture images and metadata: IndexedDB (browser-local)
- Extension settings and device key: `chrome.storage.local` (browser-local)
- No cloud storage, no remote databases

## Data Sharing

We do not share any data with third parties. All captured data remains entirely on your device unless you manually export it (e.g., downloading an image or PDF).

## Permissions

The extension requests the following Chrome permissions:

- `activeTab`: To capture the currently visible tab when you click the extension icon
- `scripting`: To inject the capture script into the active tab
- `storage`: To save settings and the device key
- `unlimitedStorage`: To store captured images in IndexedDB without size limits

## Future Server Features

A future version may include optional cloud upload functionality. If and when this is implemented:

- It will be opt-in only
- You will configure the server endpoint yourself
- A separate, updated privacy policy will be published before any server features go live
- No data will ever be uploaded without explicit user action

## Children's Privacy

This extension is not directed at children under 13 and does not knowingly collect data from children.

## Changes to This Policy

We may update this privacy policy from time to time. Changes will be noted in the extension's changelog and this document's "Last updated" date.

## Contact

For questions about this privacy policy, please open an issue at https://github.com/ragaeeb/honey-in-the-well/issues or contact the author at https://github.com/ragaeeb.

## Open Source

This extension is open source under the MIT license. You can inspect every line of code at https://github.com/ragaeeb/honey-in-the-well.
