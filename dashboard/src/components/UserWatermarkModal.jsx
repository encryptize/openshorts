import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Loader2, Stamp, Trash2 } from 'lucide-react';
import Modal from './ui/Modal';
import { getWatermarkPresets, addWatermarkPreset } from '../lib/watermarks';

// Default watermark geometry: 20% of clip width, 80% opacity, top-left.
const DEFAULT_WIDTH = 0.20;
const DEFAULT_OPACITY = 0.80;
const DEFAULT_X = 0.05;
const DEFAULT_Y = 0.05;

/**
 * Drag-and-drop watermark overlay editor.
 *
 * The user picks a logo — either an uploaded PNG (from Settings) or a saved
 * preset (logo + position/size) — drags it to position over a 9:16 preview,
 * adjusts width/opacity, then applies or saves a preset. Apply and remove are
 * delegated to ResultCard handlers that POST to the server and update the
 * clip's video_url.
 *
 * Props:
 *  - isOpen / onClose
 *  - serverVideoFile, currentVideoUrl
 *  - uploads: [{ filename, url }] uploaded PNG logos (server-side)
 *  - onApply({ logo_filename, x_ratio, y_ratio, width_ratio, opacity })
 *  - onRemove()
 *  - isProcessing (bool)
 */
export default function UserWatermarkModal({
    isOpen, onClose, serverVideoFile, currentVideoUrl, uploads = [], onApply, onRemove, isProcessing = false,
}) {
    const [presets, setPresets] = useState(() => getWatermarkPresets());
    const [selectedPresetId, setSelectedPresetId] = useState('');
    const [logoFilename, setLogoFilename] = useState('');
    const [logoUrl, setLogoUrl] = useState('');
    // Natural aspect ratio of the loaded logo (h/w), used to derive the
    // height fraction for drag clamping.
    const [logoAspect, setLogoAspect] = useState(1);
    const [xRatio, setXRatio] = useState(DEFAULT_X);
    const [yRatio, setYRatio] = useState(DEFAULT_Y);
    const [widthRatio, setWidthRatio] = useState(DEFAULT_WIDTH);
    const [opacity, setOpacity] = useState(DEFAULT_OPACITY);
    const [presetName, setPresetName] = useState('');
    const [dragging, setDragging] = useState(false);

    const containerRef = useRef(null);

    // Reset state when the modal opens.
    useEffect(() => {
        if (isOpen) {
            setPresets(getWatermarkPresets());
            setSelectedPresetId('');
            setLogoFilename('');
            setLogoUrl('');
            setXRatio(DEFAULT_X);
            setYRatio(DEFAULT_Y);
            setWidthRatio(DEFAULT_WIDTH);
            setOpacity(DEFAULT_OPACITY);
            setPresetName('');
        }
    }, [isOpen]);

    const hasWatermark = /^wmark_\d+_/.test(serverVideoFile || '');

    // heightRatio as a fraction of the container height, derived from the
    // logo's natural aspect ratio and the container's 9:16 aspect ratio.
    const heightRatio = widthRatio * logoAspect * (9 / 16);

    const handlePointerDown = useCallback((e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        setDragging(true);
    }, []);

    const handlePointerMove = useCallback((e) => {
        if (!dragging) return;
        const el = containerRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;
        // Clamp so the logo stays fully in-frame.
        setXRatio(Math.min(1 - widthRatio, Math.max(0, px - widthRatio / 2)));
        setYRatio(Math.min(1 - heightRatio, Math.max(0, py - heightRatio / 2)));
    }, [dragging, widthRatio, heightRatio]);

    const handlePointerUp = useCallback((e) => {
        e.currentTarget.releasePointerCapture(e.pointerId);
        setDragging(false);
    }, []);

    const loadPreset = (id) => {
        setSelectedPresetId(id);
        if (!id) return;
        const p = presets.find((pr) => pr.id === id);
        if (!p) return;
        setLogoFilename(p.logoFilename);
        setLogoUrl(p.logoUrl);
        setXRatio(p.xRatio);
        setYRatio(p.yRatio);
        setWidthRatio(p.widthRatio);
        setOpacity(p.opacity);
    };

    const selectLogo = (u) => {
        setSelectedPresetId('');
        setLogoFilename(u.filename);
        setLogoUrl(u.url);
        setXRatio(DEFAULT_X);
        setYRatio(DEFAULT_Y);
        setWidthRatio(DEFAULT_WIDTH);
        setOpacity(DEFAULT_OPACITY);
    };

    const handleSavePreset = () => {
        const name = presetName.trim();
        if (!name || !logoFilename) return;
        const preset = {
            id: crypto.randomUUID(),
            name,
            logoFilename,
            logoUrl,
            xRatio,
            yRatio,
            widthRatio,
            opacity,
        };
        const updated = addWatermarkPreset(preset);
        setPresets(updated);
        setSelectedPresetId(preset.id);
    };

    const handleApply = () => {
        if (!logoFilename || isProcessing) return;
        onApply({ logo_filename: logoFilename, x_ratio: xRatio, y_ratio: yRatio, width_ratio: widthRatio, opacity });
    };

    const handleLogoLoad = (e) => {
        const img = e.target;
        if (img.naturalWidth && img.naturalHeight) {
            setLogoAspect(img.naturalHeight / img.naturalWidth);
        }
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="watermark" eyebrow="overlay" size="lg">
            <div className="space-y-5">
                {/* Preview with draggable overlay */}
                <div className="flex justify-center">
                    <div
                        ref={containerRef}
                        className="relative bg-black rounded-input overflow-hidden touch-none select-none"
                        style={{ aspectRatio: '9 / 16', width: '100%', maxWidth: '320px' }}
                    >
                        <video
                            src={currentVideoUrl}
                            className="w-full h-full object-contain pointer-events-none"
                            muted
                            playsInline
                        />
                        {logoUrl && (
                            <img
                                src={logoUrl}
                                alt="watermark"
                                onLoad={handleLogoLoad}
                                onPointerDown={handlePointerDown}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                className="absolute cursor-grab active:cursor-grabbing"
                                style={{
                                    left: `${xRatio * 100}%`,
                                    top: `${yRatio * 100}%`,
                                    width: `${widthRatio * 100}%`,
                                    opacity,
                                    touchAction: 'none',
                                }}
                                draggable={false}
                            />
                        )}
                    </div>
                </div>

                {/* Uploaded logos — the source for a new overlay. Without this
                    pick there is no way to load a logo, so apply and save-preset
                    are both dead ends (the preset selector only loads existing
                    presets). */}
                <div>
                    <label className="block text-sm text-muted mb-1.5">Logo</label>
                    {uploads.length > 0 ? (
                        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                            {uploads.map((u) => (
                                <button
                                    key={u.filename}
                                    type="button"
                                    onClick={() => selectLogo(u)}
                                    className={`flex items-center justify-center p-1.5 rounded-input border transition-colors ${
                                        logoFilename === u.filename
                                            ? 'border-brass bg-paper3'
                                            : 'border-rule hover:bg-paper3'
                                    }`}
                                    title={u.filename}
                                >
                                    <img src={u.url} alt={u.filename} className="max-h-10 object-contain" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-muted">
                            No logos uploaded yet — add one in Settings.
                        </p>
                    )}
                </div>

                {/* Preset selector */}
                <div>
                    <label className="block text-sm text-muted mb-1.5">Preset</label>
                    <select
                        value={selectedPresetId}
                        onChange={(e) => loadPreset(e.target.value)}
                        className="input-field"
                    >
                        <option value="">— select a preset —</option>
                        {presets.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                </div>

                {/* Sliders */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs text-muted mb-1">
                            width: {Math.round(widthRatio * 100)}%
                        </label>
                        <input
                            type="range"
                            min={5}
                            max={100}
                            value={Math.round(widthRatio * 100)}
                            onChange={(e) => setWidthRatio(Number(e.target.value) / 100)}
                            className="w-full"
                        />
                    </div>
                    <div>
                        <label className="block text-xs text-muted mb-1">
                            opacity: {Math.round(opacity * 100)}%
                        </label>
                        <input
                            type="range"
                            min={0}
                            max={100}
                            value={Math.round(opacity * 100)}
                            onChange={(e) => setOpacity(Number(e.target.value) / 100)}
                            className="w-full"
                        />
                    </div>
                </div>

                <p className="text-xs text-muted">
                    {logoUrl
                        ? 'drag the logo to position it'
                        : 'pick a logo or a preset to start'}
                </p>

                {/* Save as preset */}
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={presetName}
                        onChange={(e) => setPresetName(e.target.value)}
                        placeholder="preset name"
                        className="input-field flex-1"
                    />
                    <button
                        onClick={handleSavePreset}
                        disabled={!presetName.trim() || !logoFilename}
                        className="btn-quiet py-2 px-4 text-sm whitespace-nowrap"
                    >
                        Save preset
                    </button>
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-rule">
                    <button
                        onClick={handleApply}
                        disabled={!logoFilename || isProcessing}
                        className="btn-primary py-2 px-4 text-sm flex-1 flex items-center justify-center gap-2"
                    >
                        {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Stamp size={14} />}
                        {isProcessing ? 'applying…' : 'Apply watermark'}
                    </button>
                    {hasWatermark && (
                        <button
                            onClick={onRemove}
                            disabled={isProcessing}
                            className="btn-quiet py-2 px-4 text-sm flex items-center gap-2"
                        >
                            <Trash2 size={14} /> Remove
                        </button>
                    )}
                </div>
            </div>
        </Modal>
    );
}