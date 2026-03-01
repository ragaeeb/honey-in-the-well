import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

export default defineConfig({
    srcDir: 'src',
    publicDir: 'src/public',
    outDir: 'dist',
    modules: ['@wxt-dev/module-react'],
    manifest: {
        name: 'Honey in the Well',
        description:
            'Capture full-page screenshots with cryptographic integrity verification — a source-of-truth snapshot for the web.',
        version: '0.1.0',
        permissions: ['activeTab', 'scripting', 'storage', 'unlimitedStorage'],
        optional_permissions: ['downloads'],
        devtools_page: 'devtools.html',
        minimum_chrome_version: '102',
        icons: {
            16: '16.png',
            32: '32.png',
            48: '48.png',
            96: '96.png',
            128: '128.png',
        },
        action: {
            default_icon: {
                16: '16.png',
                32: '32.png',
                48: '48.png',
                96: '96.png',
                128: '128.png',
            },
        },
        commands: {
            _execute_action: {
                suggested_key: { default: 'Alt+Shift+P' },
            },
        },
    },
    runner: {
        startUrls: ['https://example.com'],
    },
    vite: () => ({
        plugins: [tailwindcss()],
    }),
});
