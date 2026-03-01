import { AlertCircle, CheckCircle, Droplets, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { MSG_GET_INTEGRITY } from '@/lib/capture/messages';
import { captureFullPage } from '@/lib/capture/orchestrator';
import { hashBlob, hashDomContent } from '@/lib/crypto/dom-hash';
import { getOrCreateKeyPair } from '@/lib/crypto/key-store';
import { type CaptureMetadata, type IntegritySignals, signCapture } from '@/lib/crypto/signer';
import { saveCapture } from '@/lib/storage/capture-store';
import { loadSettings } from '@/lib/storage/settings-store';

type CaptureState = 'idle' | 'capturing' | 'processing' | 'done' | 'error';

export default function App() {
    const [state, setState] = useState<CaptureState>('idle');
    const [progress, setProgress] = useState(0);
    const [error, setError] = useState<string | null>(null);
    const [splitCount, setSplitCount] = useState<number | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const startCapture = useCallback(async () => {
        setState('capturing');
        setProgress(0);
        setError(null);
        setSplitCount(null);

        const guard = (fn: () => void) => {
            if (mountedRef.current) {
                fn();
            }
        };

        try {
            const [tab] = await chrome.tabs.query({
                active: true,
                currentWindow: true,
            });
            if (!tab?.id) {
                throw new Error('No active tab found');
            }

            const settings = await loadSettings();
            const result = await captureFullPage(
                tab,
                { imageFormat: settings.imageFormat },
                (fraction) => guard(() => setProgress(Math.floor(fraction * 100))),
                (count) => guard(() => setSplitCount(count)),
            );
            if (!mountedRef.current) {
                return;
            }

            guard(() => setState('processing'));

            const keyPair = await getOrCreateKeyPair();
            const screenshotHash = result.blobs[0] ? await hashBlob(result.blobs[0]) : '';

            let domHash = '';
            try {
                const [domResult] = await chrome.scripting.executeScript({
                    target: { tabId: tab.id },
                    func: () => document.documentElement.outerHTML,
                });
                if (domResult?.result) {
                    domHash = await hashDomContent(domResult.result as string);
                }
            } catch {
                domHash = 'unavailable';
            }

            let integrity: IntegritySignals | undefined;
            try {
                const integritySnapshot = await chrome.tabs.sendMessage(tab.id, {
                    msg: MSG_GET_INTEGRITY,
                });

                let devToolsWasOpen = false;
                try {
                    const devToolsResult = await chrome.runtime.sendMessage({
                        msg: 'devtools:check',
                        tabId: tab.id,
                    });
                    devToolsWasOpen = devToolsResult?.isOpen === true;
                } catch {
                    // DevTools check unavailable
                }

                if (integritySnapshot) {
                    integrity = {
                        ...integritySnapshot,
                        devToolsWasOpen,
                    };
                }
            } catch {
                // Integrity data unavailable
            }

            const metadata: CaptureMetadata = {
                url: tab.url || '',
                title: tab.title || '',
                timestamp: new Date().toISOString(),
                domHash,
                screenshotHash,
                dimensions: {
                    width: result.totalWidth,
                    height: result.totalHeight,
                    devicePixelRatio: window.devicePixelRatio,
                },
                integrity,
            };

            const signed = await signCapture(metadata, keyPair.privateKey, keyPair.publicKey);

            if (!mountedRef.current) {
                return;
            }
            const captureId = await saveCapture({
                url: metadata.url,
                title: metadata.title,
                timestamp: metadata.timestamp,
                format: settings.imageFormat,
                imageBlobs: result.blobs,
                pdfFilename: `capture-${Date.now()}.pdf`,
                scaleMultiplier: result.scaleMultiplier,
                domHash,
                screenshotHash,
                signature: signed.signature,
                publicKeyFingerprint: signed.publicKeyFingerprint,
                metadata: result.metadata,
                integrity,
            });

            guard(() => setState('done'));

            const captureUrl = chrome.runtime.getURL(`/capture.html?id=${captureId}`);
            await chrome.tabs.create({ url: captureUrl });
        } catch (err) {
            guard(() => {
                setState('error');
                setError(err instanceof Error ? err.message : 'Unknown error');
            });
        }
    }, []);

    useEffect(() => {
        if (state === 'idle') {
            startCapture();
        }
    }, [state, startCapture]);

    return (
        <div className="w-[340px] min-h-[140px] p-5 space-y-4">
            <header className="flex items-center gap-2.5">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                    <Droplets className="h-4.5 w-4.5 text-primary" />
                </div>
                <div>
                    <h1 className="text-sm font-semibold leading-tight">Honey in the Well</h1>
                    <p className="text-[11px] text-muted-foreground leading-tight">Integrity-verified page capture</p>
                </div>
            </header>

            {(state === 'capturing' || state === 'idle') && (
                <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                        <p className="text-sm text-foreground">Capturing page...</p>
                        <span className="text-xs font-mono text-muted-foreground tabular-nums">{progress}%</span>
                    </div>
                    <Progress value={progress} aria-label="Capture progress" />
                    {splitCount && (
                        <p className="text-xs text-warning">Large page — splitting into {splitCount} tiles</p>
                    )}
                </div>
            )}

            {state === 'processing' && (
                <div className="flex items-center gap-2.5 pt-1">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <p className="text-sm text-foreground">Signing & storing capture...</p>
                </div>
            )}

            {state === 'done' && (
                <div className="flex items-center gap-2.5 pt-1 text-success">
                    <CheckCircle className="h-4 w-4" />
                    <p className="text-sm font-medium">Capture complete — opening results</p>
                </div>
            )}

            {state === 'error' && (
                <div className="space-y-3 pt-1">
                    <div className="flex items-center gap-2 text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <p className="text-sm font-medium">Capture failed</p>
                    </div>
                    {error && <p className="text-xs text-muted-foreground break-words leading-relaxed">{error}</p>}
                    <Button variant="outline" size="sm" className="w-full" onClick={() => setState('idle')}>
                        Retry capture
                    </Button>
                </div>
            )}
        </div>
    );
}
