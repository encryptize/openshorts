import React, { useState, useEffect } from 'react';
import { Bot, Eye, EyeOff, Check, ExternalLink } from 'lucide-react';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1';

export default function LlmConfigInput({ onSave, onClear, savedConfig }) {
    const [apiKey, setApiKey] = useState(savedConfig?.apiKey || '');
    const [baseUrl, setBaseUrl] = useState(savedConfig?.baseUrl || '');
    const [model, setModel] = useState(savedConfig?.model || '');
    const [isVisible, setIsVisible] = useState(false);
    const [isSaved, setIsSaved] = useState(!!savedConfig);

    useEffect(() => {
        if (savedConfig) {
            setApiKey(savedConfig.apiKey || '');
            setBaseUrl(savedConfig.baseUrl || '');
            setModel(savedConfig.model || '');
            setIsSaved(true);
        }
    }, [savedConfig]);

    const handleSave = () => {
        const config = {};
        if (apiKey.trim()) config.apiKey = apiKey.trim();
        if (baseUrl.trim()) config.baseUrl = baseUrl.trim();
        if (model.trim()) config.model = model.trim();
        if (Object.keys(config).length > 0) {
            onSave(config);
            setIsSaved(true);
        }
    };

    const handleClear = () => {
        setApiKey('');
        setBaseUrl('');
        setModel('');
        setIsSaved(false);
        onClear();
    };

    const presetOpenRouter = () => {
        if (!baseUrl.trim()) setBaseUrl(OPENROUTER_URL);
    };

    return (
        <div className="card p-4 sm:p-6 mb-8 animate-fade">
            <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-paper3 rounded-input text-brass">
                    <Bot size={18} />
                </div>
                <h2 className="font-display lowercase text-lg text-ink">Custom LLM / OpenRouter</h2>
                <span className="badge-brass ml-auto">Optional</span>
            </div>

            <p className="text-xs text-muted mb-4 leading-relaxed">
                Use any OpenAI-compatible model instead of Gemini. Supports OpenRouter,
                Ollama, LM Studio, vLLM, and other <code>/chat/completions</code> endpoints.
                Vision stages (layout, hooks, subtitles) need a vision-capable model.
            </p>

            <div className="space-y-3">
                <div>
                    <label className="block text-xs text-muted mb-1">API Key</label>
                    <div className="relative">
                        <input
                            type={isVisible ? "text" : "password"}
                            value={apiKey}
                            onChange={(e) => { setApiKey(e.target.value); setIsSaved(false); }}
                            placeholder="sk-or-..."
                            className="input-field pr-12 font-mono"
                        />
                        <button
                            onClick={() => setIsVisible(!isVisible)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-ink transition-colors"
                        >
                            {isVisible ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-xs text-muted mb-1">
                        Base URL
                        <button
                            onClick={presetOpenRouter}
                            className="ml-2 text-brass hover:underline inline-flex items-center gap-1"
                        >
                            <ExternalLink size={10} /> Use OpenRouter
                        </button>
                    </label>
                    <input
                        type="text"
                        value={baseUrl}
                        onChange={(e) => { setBaseUrl(e.target.value); setIsSaved(false); }}
                        placeholder="https://openrouter.ai/api/v1"
                        className="input-field font-mono"
                    />
                </div>

                <div>
                    <label className="block text-xs text-muted mb-1">Model</label>
                    <input
                        type="text"
                        value={model}
                        onChange={(e) => { setModel(e.target.value); setIsSaved(false); }}
                        placeholder="anthropic/claude-3.5-sonnet"
                        className="input-field font-mono"
                    />
                </div>
            </div>

            <div className="flex gap-3 mt-4">
                <button
                    onClick={handleSave}
                    disabled={(!apiKey && !baseUrl && !model) || isSaved}
                    className={isSaved ? 'badge-ok px-4 cursor-default' : 'btn-primary'}
                >
                    {isSaved ? <><Check size={14} /> Ready</> : 'Set Config'}
                </button>
                {(apiKey || baseUrl || model) && (
                    <button onClick={handleClear} className="btn-ghost px-4 text-sm">
                        Clear
                    </button>
                )}
            </div>

            <p className="mt-3 text-xs text-muted">
                Config is stored locally in your browser. Get an OpenRouter key at{' '}
                <a
                    href="https://openrouter.ai/keys"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-brass hover:underline"
                >
                    openrouter.ai/keys
                </a>.
            </p>
        </div>
    );
}