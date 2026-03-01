<p align="center">
  <img src="icon.png" width="128" alt="Honey in the Well Logo" />
</p>

# Honey in the Well

[![Build](https://github.com/ragaeeb/honey-in-the-well/actions/workflows/ci.yml/badge.svg)](https://github.com/ragaeeb/honey-in-the-well/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Chrome MV3](https://img.shields.io/badge/Chrome-MV3-4285F4?logo=googlechrome&logoColor=white)](https://developer.chrome.com/docs/extensions/mv3/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![wakatime](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/0aaf5b7a-213d-45ed-b4b2-630ad04b129a.svg)](https://wakatime.com/badge/user/a0b906ce-b8e7-4463-8bce-383238df6d4b/project/0aaf5b7a-213d-45ed-b4b2-630ad04b129a)
![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ragaeeb/honey-in-the-well?utm_source=oss&utm_medium=github&utm_campaign=ragaeeb%2Fhoney-in-the-well&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)
[![codecov](https://codecov.io/gh/ragaeeb/honey-in-the-well/graph/badge.svg?token=7BXCSPFA7O)](https://codecov.io/gh/ragaeeb/honey-in-the-well)

**Integrity-verified full-page screenshots for the web.** Capture an entire page — just like The Wayback Machine — with cryptographic proof that the content hasn't been tampered with.

## What It Does

1. **Full-page capture** — Automatically scrolls the page and stitches viewport screenshots into a single full-page image or PDF. Uses `chrome.tabs.captureVisibleTab` with throttling (550ms) and retry (3 attempts) to handle Chrome's rate limit.
2. **Integrity monitoring** — Baseline DOM hash, MutationObserver tracking, DevTools detection (devtools_page + dimension/performance heuristics), and page load timing.
3. **DOM integrity hashing** — Computes a SHA-256 hash of the page DOM at capture time.
4. **Cryptographic signing** — Each installation generates a unique ECDSA P-256 key pair. Every capture's metadata (URL, timestamp, DOM hash, screenshot hash) is signed with the device key.

## Tech Stack

| Layer | Technology |
|---|---|
| Extension framework | [WXT](https://wxt.dev) |
| UI | React 19, Tailwind CSS 4, ShadCN components |
| Crypto | Web Crypto API (ECDSA P-256, SHA-256) |
| Storage | IndexedDB (`idb`), `chrome.storage` |
| PDF | jsPDF |
| Linting | Biome |
| Testing | Vitest (unit + integration), Playwright (E2E) |
| Runtime | Bun 1.3.10+ |

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) >= 1.3.10
- Chrome (for loading the unpacked extension)

### Install

```bash
git clone https://github.com/ragaeeb/honey-in-the-well.git
cd honey-in-the-well
bun install
```

### Development

```bash
bun run dev
```

This starts WXT in dev mode with hot-reload. Chrome opens automatically with the extension loaded.

### Build

```bash
bun run build
```

Output goes to `dist/chrome-mv3/`. Load it as an unpacked extension in `chrome://extensions`.

### Package

```bash
bun run zip
```

Creates a distributable `.zip` in `dist/`.

## Testing

```bash
# Unit + integration tests
bun run test

# Coverage report
bun run test:coverage

# E2E tests (build first)
bun run build && bun run test:e2e
```

## Linting

```bash
# Lint + format with auto-fix
bun run lint

# Build always runs lint + type-check first
bun run build
```

## Project Structure

```
src/
├── entrypoints/           # Extension entry points (WXT convention)
│   ├── background/        # Service worker
│   ├── content/           # Content script (scroll + capture logic)
│   ├── popup/             # Popup UI (React)
│   ├── capture.html/      # Capture result page (React)
│   └── options.html/      # Settings page (React)
├── components/ui/         # ShadCN UI components
├── lib/
│   ├── capture/           # Full-page capture engine
│   │   ├── scroll-finder  # Find primary scrollable element
│   │   ├── arrangements   # Calculate scroll positions & regions
│   │   ├── styles         # Temporary DOM modifications
│   │   ├── canvas-manager # Multi-canvas stitching
│   │   ├── orchestrator   # Capture flow coordination
│   │   └── link-observer  # Track links for PDF annotations
│   ├── crypto/            # Integrity & signing
│   │   ├── ecdsa          # ECDSA P-256 key management
│   │   ├── dom-hash       # SHA-256 DOM hashing
│   │   ├── signer         # Metadata signing
│   │   └── key-store      # Key persistence
│   ├── storage/           # Data persistence
│   │   ├── capture-store  # IndexedDB capture records
│   │   └── settings-store # Extension settings
│   └── utils/             # Shared helpers
│       ├── dom            # DOM traversal utilities
│       ├── image          # Image loading & conversion
│       └── pdf            # PDF generation
└── public/                # Static assets
tests/
├── integration/           # Integration tests
└── e2e/                   # Playwright E2E tests
```

## How Capture Works

1. User clicks the extension icon
2. Content script is injected into the active tab; `IntegrityMonitor` starts (MutationObserver, baseline DOM hash)
3. `ScrollFinder` locates the primary scrollable element
4. `Arrangements` calculates all scroll positions and clip regions
5. `Styles` temporarily modifies fixed/sticky elements
6. For each position: content script scrolls, popup captures the viewport via `chrome.tabs.captureVisibleTab()` (throttled 550ms, retries on rate limit)
7. `CanvasManager` stitches all viewport captures into the full-page canvas
8. DOM content is hashed (SHA-256) and metadata is signed (ECDSA P-256)
9. Integrity snapshot (baseline vs capture hash, DevTools signals, mutation stats) is attached
10. Result is stored in IndexedDB and displayed on the capture result page

## Security Model

- **Per-install keys**: Each extension installation generates a unique ECDSA P-256 key pair on first install
- **DOM hash**: SHA-256 of `document.documentElement.outerHTML` at capture time
- **Metadata signing**: URL, timestamp, DOM hash, screenshot hash, and dimensions are signed

## License

[MIT](LICENSE)
