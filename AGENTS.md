# AGENTS.md

Guidelines for AI coding agents working on this repository.

## Project Overview

**Honey in the Well** is a Chrome MV3 browser extension that captures full-page screenshots with cryptographic integrity verification. It's built with WXT, React 19, Tailwind CSS 4, and TypeScript.

## Architecture

- **WXT** is the extension framework. Entry points live in `src/entrypoints/`. WXT auto-discovers them by convention.
- **React 19** powers all UI pages (popup, capture result, options).
- **Tailwind CSS 4** with ShadCN components in `src/components/ui/`.
- All business logic lives in `src/lib/` organized by domain: `capture/`, `crypto/`, `integrity/`, `storage/`, `utils/`.
- **Integrity module** (`src/lib/integrity/`): baseline DOM hash, MutationObserver tracking, DevTools detection (devtools_page + dimension/performance heuristics), page load timing.
- **DevTools page** (`devtools.html`): notifies background when DevTools opens/closes on a tab for integrity signals.

## Coding Standards

### Language & Style

- TypeScript with `strict: true` and `target: ESNext`.
- Use **Biome** for linting and formatting (not ESLint/Prettier). Run `bun run lint` to lint + auto-fix.
- Indent with **tabs**. Biome enforces this.
- No unused variables or imports (enforced by Biome as errors).
- Non-null assertions (`!`) are allowed — common in Chrome extension code.
- Prefer `for...of` over `.forEach()`.
- No comments that merely narrate code. Comments explain *why*, not *what*.

### File Organization

- Co-locate test files beside implementations: `foo.ts` → `foo.test.ts`.
- No `__tests__/` directories.
- UI components go in `src/components/ui/`.
- Shared React hooks go in `src/hooks/`.
- Static assets go in `src/public/`.

### Testing

- **Unit tests**: Vitest with happy-dom. Use `it('should ...')` convention.
- **Integration tests**: `tests/integration/`. Same runner.
- **E2E tests**: Playwright in `tests/e2e/`.
- Test setup is in `src/test-setup.ts` — it mocks `chrome` and `crypto` APIs.
- Aim for 100% coverage on `src/lib/` modules.

### Dependencies

- Runtime: `bun` >= 1.3.10
- Package manager: `bun`
- Do not add ESLint, Prettier, or Jest — we use Biome and Vitest.
- Prefer native APIs (`fetch`, `crypto.subtle`, `URL`) over third-party libraries when possible.

## Key Patterns

### Chrome API Mocking

The test setup at `src/test-setup.ts` provides `vi.fn()` mocks for all Chrome APIs. Tests should configure return values via `vi.mocked()`:

```ts
vi.mocked(chrome.storage.local.get).mockImplementation((_keys, cb) => {
  cb({ key: value });
});
```

### Storage Keys

- IndexedDB database: `HoneyInTheWellDB`
- ECDSA key pair: `hitw_ecdsa_keypair` in `chrome.storage.local`
- Settings: `hitw_settings` in `chrome.storage.local`

### Build Output

- Development: `bun run dev` (hot-reload)
- Production: `bun run build` → `dist/chrome-mv3/`
- The `dist/` directory is gitignored.

## Common Tasks

| Task | Command |
|---|---|
| Start dev server | `bun run dev` |
| Build for production | `bun run build` |
| Run all tests | `bun run test` |
| Coverage report | `bun run test:coverage` |
| Lint + format (auto-fix) | `bun run lint` |
| E2E tests | `bun run build && bun run test:e2e` |

## Extension Permissions

The manifest requests: `activeTab`, `scripting`, `storage`, `unlimitedStorage`. Optional: `downloads`. The extension targets Chrome 102+. Includes `devtools_page` for integrity detection.

## Capture Flow

- Content script injects `IntegrityMonitor` and capture logic.
- Popup orchestrates capture via `chrome.tabs.captureVisibleTab` with 550ms throttling and 3 retries for Chrome's rate limit.
- Background coordinates DevTools open/close messages from the devtools page.
