import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { type BrowserContext, chromium, expect, test } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EXTENSION_PATH = path.resolve(__dirname, '../../dist/chrome-mv3');

let context: BrowserContext;

test.beforeAll(async () => {
    const pathToExtension = EXTENSION_PATH;
    context = await chromium.launchPersistentContext('', {
        headless: false,
        args: [`--disable-extensions-except=${pathToExtension}`, `--load-extension=${pathToExtension}`, '--no-sandbox'],
    });
});

test.afterAll(async () => {
    await context?.close();
});

test.describe('Extension E2E', () => {
    test('should load the extension and access popup', async () => {
        let extensionId = '';
        const bg = context.serviceWorkers();
        if (bg.length > 0) {
            extensionId = bg[0].url().split('/')[2];
        } else {
            const sw = await context.waitForEvent('serviceworker');
            extensionId = sw.url().split('/')[2];
        }
        expect(extensionId).toBeTruthy();

        const popupPage = await context.newPage();
        await popupPage.goto(`chrome-extension://${extensionId}/popup.html`);
        await popupPage.waitForLoadState('domcontentloaded');

        const heading = popupPage.locator('h1');
        await expect(heading).toContainText('Honey in the Well');
    });

    test('should open options page with settings form', async () => {
        let extensionId = '';
        const bg = context.serviceWorkers();
        if (bg.length > 0) {
            extensionId = bg[0].url().split('/')[2];
        } else {
            const sw = await context.waitForEvent('serviceworker');
            extensionId = sw.url().split('/')[2];
        }

        const optionsPage = await context.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
        await optionsPage.waitForLoadState('domcontentloaded');

        const heading = optionsPage.locator('h1');
        await expect(heading).toContainText('Settings');

        const imageFormatSelect = optionsPage.locator('#imageFormat');
        await expect(imageFormatSelect).toBeVisible();

        const pdfFormatSelect = optionsPage.locator('#pdfFormat');
        await expect(pdfFormatSelect).toBeVisible();

        const saveButton = optionsPage.locator('button', {
            hasText: 'Save Settings',
        });
        await expect(saveButton).toBeVisible();
    });

    test('should navigate to capture result page', async () => {
        let extensionId = '';
        const bg = context.serviceWorkers();
        if (bg.length > 0) {
            extensionId = bg[0].url().split('/')[2];
        } else {
            const sw = await context.waitForEvent('serviceworker');
            extensionId = sw.url().split('/')[2];
        }

        const capturePage = await context.newPage();
        await capturePage.goto(`chrome-extension://${extensionId}/capture.html`);
        await capturePage.waitForLoadState('domcontentloaded');

        // Without an ID param, should show error
        const errorText = capturePage.locator('text=No capture ID specified');
        await expect(errorText).toBeVisible({ timeout: 5000 });
    });

    test('should save and load options settings', async () => {
        let extensionId = '';
        const bg = context.serviceWorkers();
        if (bg.length > 0) {
            extensionId = bg[0].url().split('/')[2];
        } else {
            const sw = await context.waitForEvent('serviceworker');
            extensionId = sw.url().split('/')[2];
        }

        const optionsPage = await context.newPage();
        await optionsPage.goto(`chrome-extension://${extensionId}/options.html`);
        await optionsPage.waitForLoadState('domcontentloaded');

        const imageFormatSelect = optionsPage.locator('#imageFormat');
        await imageFormatSelect.selectOption('jpg');

        const saveButton = optionsPage.locator('button', {
            hasText: 'Save Settings',
        });
        await saveButton.click();

        const savedText = optionsPage.locator('text=Saved');
        await expect(savedText).toBeVisible({ timeout: 3000 });

        await optionsPage.reload();
        await expect(optionsPage.locator('#imageFormat')).toHaveValue('jpg');
    });
});
