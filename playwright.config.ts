import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30_000,
    retries: 0,
    use: {
        viewport: { width: 1280, height: 720 },
        actionTimeout: 10_000,
    },
    projects: [
        {
            name: 'chromium',
            use: {
                browserName: 'chromium',
                // Chrome extension E2E requires headed mode; tests use launchPersistentContext with headless: false
                headless: false,
            },
        },
    ],
});
