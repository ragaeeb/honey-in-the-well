import { CheckCircle, Droplets, Key, Loader2, Save } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { getPublicKeyFingerprint } from '@/lib/crypto/ecdsa';
import { getOrCreateKeyPair } from '@/lib/crypto/key-store';
import { loadSettings, type Settings as SettingsType, saveSettings } from '@/lib/storage/settings-store';

export default function App() {
    const [settings, setSettings] = useState<SettingsType | null>(null);
    const [fingerprint, setFingerprint] = useState<string>('');
    const [saved, setSaved] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [loadError, setLoadError] = useState<string | null>(null);
    const mountedRef = useRef(true);

    useEffect(() => {
        mountedRef.current = true;
        loadSettings()
            .then((s) => {
                if (mountedRef.current) {
                    setSettings(s);
                }
            })
            .catch((err) => {
                if (mountedRef.current) {
                    setLoadError(err instanceof Error ? err.message : 'Failed to load');
                }
            });
        getOrCreateKeyPair()
            .then(async (kp) => {
                const fp = await getPublicKeyFingerprint(kp.publicKey);
                if (mountedRef.current) {
                    setFingerprint(fp);
                }
            })
            .catch(() => {
                if (mountedRef.current) {
                    setFingerprint('');
                }
            });
        return () => {
            mountedRef.current = false;
        };
    }, []);

    const handleSave = useCallback(async () => {
        if (!settings) {
            return;
        }
        setSaveError(null);
        try {
            await saveSettings(settings);
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            setSaveError(err instanceof Error ? err.message : 'Failed to save settings');
        }
    }, [settings]);

    if (loadError) {
        return (
            <div className="max-w-2xl mx-auto p-8">
                <p className="text-destructive">{loadError}</p>
            </div>
        );
    }

    if (!settings) {
        return (
            <div
                className="max-w-2xl mx-auto p-8 flex items-center gap-2"
                aria-busy="true"
            >
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Loading...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto p-8 space-y-8">
            <header className="space-y-1">
                <div className="flex items-center gap-3">
                    <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                        <Droplets className="h-5 w-5 text-primary" />
                    </div>
                    <h1 className="text-2xl font-bold">Honey in the Well — Settings</h1>
                </div>
                <p className="text-muted-foreground">Configure capture preferences.</p>
            </header>

            {/* Capture Settings */}
            <section className="space-y-4 border rounded-lg p-4">
                <h2 className="text-lg font-semibold">Capture Settings</h2>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <Label htmlFor="imageFormat">Image Format</Label>
                        <Select
                            id="imageFormat"
                            value={settings.imageFormat}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    imageFormat: e.target.value as 'png' | 'jpg',
                                })
                            }
                        >
                            <option value="png">PNG</option>
                            <option value="jpg">JPEG</option>
                        </Select>
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="pdfFormat">PDF Page Size</Label>
                        <Select
                            id="pdfFormat"
                            value={settings.pdfFormat}
                            onChange={(e) =>
                                setSettings({
                                    ...settings,
                                    pdfFormat: e.target.value as 'a4' | 'letter' | 'full',
                                })
                            }
                        >
                            <option value="a4">A4</option>
                            <option value="letter">Letter</option>
                            <option value="full">Full Page</option>
                        </Select>
                    </div>
                </div>
            </section>

            {/* Key Info */}
            <section className="space-y-4 border rounded-lg p-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                    <Key className="h-5 w-5" />
                    Device Key
                </h2>
                <div className="space-y-2">
                    <div className="flex items-center gap-2">
                        <Badge variant="outline">ECDSA P-256</Badge>
                    </div>
                    <p className="text-xs font-mono break-all text-muted-foreground">
                        Fingerprint: {fingerprint || 'Generating...'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                        A unique ECDSA key pair is generated per installation. Captures are signed with the device key
                        for integrity verification.
                    </p>
                </div>
            </section>

            {/* Save */}
            <div className="flex flex-col gap-3">
                <div className="flex items-center gap-3">
                    <Button onClick={handleSave}>
                        <Save className="h-4 w-4" />
                        Save Settings
                    </Button>
                    {saved && (
                        <span className="text-sm text-success flex items-center gap-1">
                            <CheckCircle className="h-4 w-4" />
                            Saved
                        </span>
                    )}
                </div>
                {saveError && <p className="text-sm text-destructive">{saveError}</p>}
            </div>
        </div>
    );
}
