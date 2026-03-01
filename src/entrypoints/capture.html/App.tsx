import {
    Activity,
    AlertTriangle,
    CheckCircle,
    Clock,
    Download,
    Droplets,
    ExternalLink,
    Eye,
    FileText,
    Fingerprint,
    Globe,
    Hash,
    Loader2,
    Shield,
    XCircle,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { type CaptureRecord, getCapture } from '@/lib/storage/capture-store';
import { loadSettings } from '@/lib/storage/settings-store';
import { isSafeUrl } from '@/lib/utils';
import { blobToUrl, loadImage } from '@/lib/utils/image';
import { generatePdf } from '@/lib/utils/pdf';

export default function App() {
    const [record, setRecord] = useState<CaptureRecord | null>(null);
    const [imageUrls, setImageUrls] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [pdfError, setPdfError] = useState<string | null>(null);
    const [zoom, setZoom] = useState<'fit' | 'actual'>('fit');
    const imageRef = useRef<HTMLDivElement>(null);
    const imageUrlsRef = useRef<string[]>([]);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('id');
        if (!id) {
            setError('No capture ID specified');
            setLoading(false);
            return;
        }

        let cancelled = false;
        getCapture(Number(id))
            .then((rec) => {
                if (cancelled) {
                    return;
                }
                if (!rec) {
                    setError('Capture not found');
                    return;
                }
                setRecord(rec);
                const urls = rec.imageBlobs.map(blobToUrl);
                imageUrlsRef.current = urls;
                setImageUrls(urls);
            })
            .catch((err) => {
                if (!cancelled) {
                    setError(err instanceof Error ? err.message : 'Unknown error');
                }
            })
            .finally(() => {
                if (!cancelled) {
                    setLoading(false);
                }
            });

        return () => {
            cancelled = true;
            for (const url of imageUrlsRef.current) {
                URL.revokeObjectURL(url);
            }
            imageUrlsRef.current = [];
        };
    }, []);

    const handleDownloadImage = useCallback(() => {
        if (!record || imageUrls.length === 0) {
            return;
        }
        for (let i = 0; i < imageUrls.length; i++) {
            const a = document.createElement('a');
            a.href = imageUrls[i];
            a.download =
                imageUrls.length > 1
                    ? `capture-${record.id}-${i + 1}.${record.format}`
                    : `capture-${record.id}.${record.format}`;
            a.click();
        }
    }, [record, imageUrls]);

    const handleDownloadPdf = useCallback(async () => {
        if (!record || imageUrls.length === 0) {
            return;
        }
        setPdfError(null);
        try {
            const images = await Promise.all(imageUrls.map(loadImage));
            const settings = await loadSettings();
            const pdfBlob = await generatePdf(images, record.scaleMultiplier, settings.pdfFormat);
            const url = blobToUrl(pdfBlob);
            const a = document.createElement('a');
            a.href = url;
            a.download = record.pdfFilename;
            a.click();
            setTimeout(() => URL.revokeObjectURL(url), 100);
        } catch (err) {
            setPdfError(err instanceof Error ? err.message : 'PDF generation failed');
        }
    }, [record, imageUrls]);

    if (loading) {
        return (
            <div
                className="flex items-center justify-center min-h-screen"
                aria-busy="true"
            >
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center min-h-screen p-6">
                <div className="text-center space-y-4 max-w-sm">
                    <XCircle className="h-12 w-12 text-destructive mx-auto" />
                    <p className="text-lg font-medium">{error}</p>
                    <Button variant="outline" onClick={() => window.close()} aria-label="Close and go back">
                        Close
                    </Button>
                </div>
            </div>
        );
    }

    if (!record) {
        return null;
    }

    return (
        <div className="min-h-screen bg-background flex">
            {/* Main content */}
            <div className="flex-1 flex flex-col">
                <header className="flex items-center justify-between border-b px-4 py-3">
                    <div className="flex items-center gap-2.5">
                        <div className="flex items-center justify-center w-7 h-7 rounded-md bg-primary/10">
                            <Droplets className="h-4 w-4 text-primary" />
                        </div>
                        <h1 className="font-semibold">Honey in the Well</h1>
                    </div>
                    <div className="flex items-center gap-2">
                        <Button variant="outline" size="sm" onClick={handleDownloadImage}>
                            <Download className="h-4 w-4" />
                            Image
                        </Button>
                        <Button variant="outline" size="sm" onClick={handleDownloadPdf}>
                            <FileText className="h-4 w-4" />
                            PDF
                        </Button>
                        {pdfError && (
                            <p className="text-xs text-destructive col-span-2 flex items-center gap-1">{pdfError}</p>
                        )}
                        <Button variant="outline" size="sm" onClick={() => setZoom(zoom === 'fit' ? 'actual' : 'fit')}>
                            {zoom === 'fit' ? '100%' : 'Fit'}
                        </Button>
                    </div>
                </header>

                {pdfError && (
                    <div className="px-4 py-2 bg-destructive/10 text-destructive text-sm border-b">{pdfError}</div>
                )}
                <div ref={imageRef} className="flex-1 overflow-auto p-4 flex items-start justify-center bg-muted/30">
                    {imageUrls.map((url, i) => (
                        <img
                            key={url}
                            src={url}
                            alt={`Capture ${i + 1}`}
                            className={
                                zoom === 'fit' ? 'max-w-full max-h-[calc(100vh-80px)] object-contain' : 'max-w-none'
                            }
                        />
                    ))}
                </div>
            </div>

            {/* Sidebar */}
            <aside className="w-80 border-l bg-card overflow-y-auto">
                <div className="p-4 space-y-6">
                    <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground">
                        Capture Details
                    </h2>

                    {/* URL */}
                    <SidebarField icon={<Globe className="h-4 w-4" />} label="URL">
                        {isSafeUrl(record.url) ? (
                            <a
                                href={record.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm text-primary hover:underline break-all flex items-center gap-1"
                            >
                                {record.url}
                                <ExternalLink className="h-3 w-3 shrink-0" />
                            </a>
                        ) : (
                            <p className="text-sm break-all text-muted-foreground">{record.url || '(no URL)'}</p>
                        )}
                    </SidebarField>

                    {/* Timestamp */}
                    <SidebarField icon={<Clock className="h-4 w-4" />} label="Captured At">
                        <p className="text-sm font-mono">{new Date(record.timestamp).toLocaleString()}</p>
                    </SidebarField>

                    {/* DOM Hash */}
                    <SidebarField icon={<Hash className="h-4 w-4" />} label="DOM Hash (SHA-256)">
                        <p className="text-xs font-mono break-all text-muted-foreground">{record.domHash}</p>
                    </SidebarField>

                    {/* Screenshot Hash */}
                    <SidebarField icon={<Fingerprint className="h-4 w-4" />} label="Screenshot Hash">
                        <p className="text-xs font-mono break-all text-muted-foreground">{record.screenshotHash}</p>
                    </SidebarField>

                    {/* Signature */}
                    <SidebarField icon={<Shield className="h-4 w-4" />} label="Signature">
                        {record.signature ? (
                            <Badge variant="success">
                                <CheckCircle className="h-3 w-3 mr-1" />
                                Signed
                            </Badge>
                        ) : (
                            <Badge variant="destructive">
                                <XCircle className="h-3 w-3 mr-1" />
                                Unsigned
                            </Badge>
                        )}
                        <p className="text-xs font-mono break-all text-muted-foreground mt-1">
                            Key: {record.publicKeyFingerprint.substring(0, 16)}...
                        </p>
                    </SidebarField>

                    {/* Integrity Signals */}
                    {record.integrity && (
                        <>
                            <h2 className="font-semibold text-sm uppercase tracking-wider text-muted-foreground pt-2 border-t">
                                Integrity Signals
                            </h2>

                            <SidebarField icon={<Eye className="h-4 w-4" />} label="DevTools Detection">
                                {record.integrity.devToolsWasOpen ||
                                record.integrity.devToolsSignals.dimensionMismatch ||
                                record.integrity.devToolsSignals.performanceAnomaly ? (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        DevTools Detected
                                    </Badge>
                                ) : (
                                    <Badge variant="success">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        No DevTools Detected
                                    </Badge>
                                )}
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                    <p>Panel open: {record.integrity.devToolsWasOpen ? 'Yes' : 'No'}</p>
                                    <p>
                                        Dimension mismatch:{' '}
                                        {record.integrity.devToolsSignals.dimensionMismatch ? 'Yes' : 'No'}
                                    </p>
                                    <p>
                                        Performance anomaly:{' '}
                                        {record.integrity.devToolsSignals.performanceAnomaly ? 'Yes' : 'No'}
                                    </p>
                                </div>
                            </SidebarField>

                            <SidebarField icon={<Hash className="h-4 w-4" />} label="DOM Baseline">
                                {record.integrity.baselineMatchesCapture === true ? (
                                    <Badge variant="success">
                                        <CheckCircle className="h-3 w-3 mr-1" />
                                        Baseline Matches
                                    </Badge>
                                ) : record.integrity.baselineMatchesCapture === false ? (
                                    <Badge variant="destructive">
                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                        DOM Modified Since Baseline
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary">Baseline Unavailable</Badge>
                                )}
                                {record.integrity.baselineDomHash && (
                                    <p className="text-xs font-mono break-all text-muted-foreground mt-1">
                                        {record.integrity.baselineDomHash.substring(0, 16)}...
                                    </p>
                                )}
                            </SidebarField>

                            <SidebarField icon={<Activity className="h-4 w-4" />} label="DOM Mutations">
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>Total mutations: {record.integrity.mutationStats.totalCount.toLocaleString()}</p>
                                    <p>Nodes added: {record.integrity.mutationStats.addedNodes.toLocaleString()}</p>
                                    <p>Nodes removed: {record.integrity.mutationStats.removedNodes.toLocaleString()}</p>
                                    <p>
                                        Attribute changes:{' '}
                                        {record.integrity.mutationStats.attributeChanges.toLocaleString()}
                                    </p>
                                    <p>Text changes: {record.integrity.mutationStats.textChanges.toLocaleString()}</p>
                                    <p>Mutation bursts: {record.integrity.mutationStats.mutationBursts}</p>
                                </div>
                            </SidebarField>

                            <SidebarField icon={<Clock className="h-4 w-4" />} label="Timing">
                                <div className="text-xs text-muted-foreground space-y-0.5">
                                    <p>Page loaded: {new Date(record.integrity.pageLoadedAt).toLocaleTimeString()}</p>
                                    <p>Time since load: {(record.integrity.timeSinceLoadMs / 1000).toFixed(1)}s</p>
                                    {record.integrity.baselineSettledAt && (
                                        <p>
                                            DOM settled after:{' '}
                                            {(
                                                (record.integrity.baselineSettledAt - record.integrity.pageLoadedAt) /
                                                1000
                                            ).toFixed(1)}
                                            s
                                        </p>
                                    )}
                                </div>
                            </SidebarField>
                        </>
                    )}
                </div>
            </aside>
        </div>
    );
}

function SidebarField({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-muted-foreground">
                {icon}
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
            </div>
            <div>{children}</div>
        </div>
    );
}
