const SETTLE_TIMEOUT_MS = 2000;
const PERFORMANCE_ANOMALY_THRESHOLD_MS = 15;
const PERFORMANCE_ANOMALY_RATIO = 8;

export type MutationStats = {
    totalCount: number;
    addedNodes: number;
    removedNodes: number;
    attributeChanges: number;
    textChanges: number;
    firstMutationAt: number | null;
    lastMutationAt: number | null;
    mutationBursts: number;
};

export type DevToolsSignals = {
    dimensionMismatch: boolean;
    outerWidthDiff: number;
    outerHeightDiff: number;
    performanceAnomaly: boolean;
};

export type IntegritySnapshot = {
    pageLoadedAt: number;
    contentScriptLoadedAt: number;
    baselineDomHash: string | null;
    baselineSettledAt: number | null;
    captureTimeDomHash: string | null;
    baselineMatchesCapture: boolean | null;
    mutationStats: MutationStats;
    devToolsSignals: DevToolsSignals;
    timeSinceLoadMs: number;
};

async function sha256(input: string): Promise<string> {
    const encoded = new TextEncoder().encode(input);
    const hash = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hash))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
}

function getDomContent(): string {
    return document.documentElement.outerHTML;
}

export class IntegrityMonitor {
    private pageLoadedAt: number;
    private contentScriptLoadedAt: number;
    private observer: MutationObserver | null = null;
    private baselineDomHash: string | null = null;
    private baselineSettledAt: number | null = null;
    private settleTimer: ReturnType<typeof setTimeout> | null = null;
    private isStopped = false;
    private stats: MutationStats = {
        totalCount: 0,
        addedNodes: 0,
        removedNodes: 0,
        attributeChanges: 0,
        textChanges: 0,
        firstMutationAt: null,
        lastMutationAt: null,
        mutationBursts: 0,
    };
    private burstWindow: number[] = [];

    constructor() {
        this.contentScriptLoadedAt = Date.now();
        this.pageLoadedAt = performance.timeOrigin ? Math.round(performance.timeOrigin) : this.contentScriptLoadedAt;
    }

    start(): void {
        this.startMutationObserver();
        this.scheduleBaselineHash();
    }

    stop(): void {
        this.isStopped = true;
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
        if (this.settleTimer) {
            clearTimeout(this.settleTimer);
            this.settleTimer = null;
        }
    }

    async getSnapshot(): Promise<IntegritySnapshot> {
        const captureTimeDomHash = await sha256(getDomContent());

        return {
            pageLoadedAt: this.pageLoadedAt,
            contentScriptLoadedAt: this.contentScriptLoadedAt,
            baselineDomHash: this.baselineDomHash,
            baselineSettledAt: this.baselineSettledAt,
            captureTimeDomHash,
            baselineMatchesCapture: this.baselineDomHash !== null ? this.baselineDomHash === captureTimeDomHash : null,
            mutationStats: { ...this.stats },
            devToolsSignals: this.checkDevToolsSignals(),
            timeSinceLoadMs: Date.now() - this.pageLoadedAt,
        };
    }

    private startMutationObserver(): void {
        this.observer = new MutationObserver((mutations) => {
            if (this.isStopped) {
                return;
            }
            const now = Date.now();

            for (const mutation of mutations) {
                this.stats.totalCount++;
                if (this.stats.firstMutationAt === null) {
                    this.stats.firstMutationAt = now;
                }
                this.stats.lastMutationAt = now;

                switch (mutation.type) {
                    case 'childList':
                        this.stats.addedNodes += mutation.addedNodes.length;
                        this.stats.removedNodes += mutation.removedNodes.length;
                        break;
                    case 'attributes':
                        this.stats.attributeChanges++;
                        break;
                    case 'characterData':
                        this.stats.textChanges++;
                        break;
                }
            }

            this.burstWindow.push(now);
            this.burstWindow = this.burstWindow.filter((t) => now - t < 1000);
            if (this.burstWindow.length >= 50) {
                this.stats.mutationBursts++;
                this.burstWindow = [];
            }

            this.scheduleBaselineHash();
        });

        this.observer.observe(document.documentElement, {
            childList: true,
            attributes: true,
            characterData: true,
            subtree: true,
        });
    }

    private scheduleBaselineHash(): void {
        if (this.isStopped) {
            return;
        }
        if (this.settleTimer) {
            clearTimeout(this.settleTimer);
        }
        this.settleTimer = setTimeout(async () => {
            if (this.isStopped) {
                return;
            }
            try {
                this.baselineDomHash = await sha256(getDomContent());
                if (this.isStopped) {
                    return;
                }
                this.baselineSettledAt = Date.now();
            } catch {
                // DOM hashing failed - page may be unloading
            }
        }, SETTLE_TIMEOUT_MS);
    }

    private checkDevToolsSignals(): DevToolsSignals {
        const outerWidthDiff = window.outerWidth - window.innerWidth;
        const outerHeightDiff = window.outerHeight - window.innerHeight;
        const dimensionThreshold = 170;

        let performanceAnomaly = false;
        try {
            performanceAnomaly = this.checkPerformanceAnomaly();
        } catch {
            // Timing check failed
        }

        return {
            dimensionMismatch: outerWidthDiff > dimensionThreshold || outerHeightDiff > dimensionThreshold,
            outerWidthDiff,
            outerHeightDiff,
            performanceAnomaly,
        };
    }

    private checkPerformanceAnomaly(): boolean {
        const testData = Array.from({ length: 100 }, (_, i) => ({
            id: i,
            value: 'x'.repeat(20),
        }));

        const start = performance.now();
        console.table(testData);
        const tableTime = performance.now() - start;

        const start2 = performance.now();
        console.log(testData);
        const logTime = performance.now() - start2;

        console.clear();

        return tableTime > PERFORMANCE_ANOMALY_THRESHOLD_MS && tableTime > logTime * PERFORMANCE_ANOMALY_RATIO;
    }
}
