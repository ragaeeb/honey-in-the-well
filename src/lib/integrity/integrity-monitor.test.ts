import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IntegrityMonitor } from './integrity-monitor';

describe('IntegrityMonitor', () => {
    beforeEach(() => {
        vi.spyOn(console, 'table').mockImplementation(() => {});
        vi.spyOn(console, 'log').mockImplementation(() => {});
        vi.spyOn(console, 'clear').mockImplementation(() => {});
        vi.mocked(crypto.subtle.digest).mockResolvedValue(new Uint8Array([0xab, 0xcd, 0xef]).buffer);
        document.documentElement.innerHTML = '<html><body><div>Test</div></body></html>';
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
    });

    it('should start and produce a snapshot with captureTimeDomHash', async () => {
        const monitor = new IntegrityMonitor();
        monitor.start();

        const snapshot = await monitor.getSnapshot();

        expect(snapshot.captureTimeDomHash).toBeTruthy();
        expect(snapshot.pageLoadedAt).toBeGreaterThan(0);
        expect(snapshot.contentScriptLoadedAt).toBeGreaterThan(0);
        expect(snapshot.timeSinceLoadMs).toBeGreaterThanOrEqual(0);
        expect(snapshot.mutationStats.totalCount).toBeGreaterThanOrEqual(0);
        expect(snapshot.devToolsSignals).toEqual(
            expect.objectContaining({
                dimensionMismatch: expect.any(Boolean),
                outerWidthDiff: expect.any(Number),
                outerHeightDiff: expect.any(Number),
                performanceAnomaly: expect.any(Boolean),
            }),
        );

        monitor.stop();
    });

    it('should stop and clean up observer', async () => {
        const monitor = new IntegrityMonitor();
        monitor.start();
        monitor.stop();

        const snapshot = await monitor.getSnapshot();
        expect(snapshot.captureTimeDomHash).toBeTruthy();
    });

    it('should set baselineMatchesCapture when baseline has settled', async () => {
        vi.useFakeTimers();
        const monitor = new IntegrityMonitor();
        monitor.start();

        await vi.advanceTimersByTimeAsync(2500);

        const snapshot = await monitor.getSnapshot();
        expect(snapshot.baselineDomHash).toBeTruthy();
        expect(snapshot.baselineSettledAt).toBeTruthy();
        expect(snapshot.baselineMatchesCapture).toBe(true);

        monitor.stop();
    });
});
