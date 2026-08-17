import React, { useState, useEffect, useMemo } from 'react';
import { OBRStorage } from '../obr';
import { Icons } from './ui/Icons';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface MiroBoardEmbedProps {
  onRollStat?: (statKey: string, statValue: number) => void;
}

// Converts a regular Miro board link to an embeddable live-embed URL
export const formatMiroEmbedUrl = (rawUrl: string): string => {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (!trimmed) return '';

  try {
    const urlObj = new URL(trimmed);

    // If it's already a live-embed link, return with autoplay parameter
    if (urlObj.pathname.includes('/app/live-embed/')) {
      urlObj.searchParams.set('embedAutoplay', 'true');
      return urlObj.toString();
    }

    // Convert standard board URL /app/board/<boardId>/ to /app/live-embed/<boardId>/
    if (urlObj.pathname.includes('/app/board/')) {
      const parts = urlObj.pathname.split('/app/board/');
      if (parts[1]) {
        const boardId = parts[1].replace(/\/$/, '');
        return `https://miro.com/app/live-embed/${boardId}/?embedAutoplay=true`;
      }
    }

    // Fallback: If not recognized or standard URL, return trimmed original
    return trimmed;
  } catch (e) {
    // If not a valid URL yet, return raw string
    return trimmed;
  }
};

export const MiroBoardEmbed: React.FC<MiroBoardEmbedProps> = () => {
  const [rawUrl, setRawUrl] = useState<string>('');
  const [inputUrl, setInputUrl] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    const loadUrl = async () => {
      try {
        const savedUrl = await OBRStorage.getMiroUrl();
        if (savedUrl) {
          setRawUrl(savedUrl);
          setInputUrl(savedUrl);
        }
      } catch (e) {
        console.error('Failed to load Miro URL:', e);
      } finally {
        setIsLoading(false);
      }
    };
    loadUrl();
  }, []);

  const embedUrl = useMemo(() => formatMiroEmbedUrl(rawUrl), [rawUrl]);

  const handleSaveUrl = async () => {
    const cleaned = inputUrl.trim();
    setRawUrl(cleaned);
    await OBRStorage.setMiroUrl(cleaned);
    setIsEditing(false);
    setIframeKey((k) => k + 1);
  };

  const handleClearUrl = async () => {
    setRawUrl('');
    setInputUrl('');
    await OBRStorage.setMiroUrl('');
    setIsEditing(false);
  };

  const handleRefresh = () => {
    setIframeKey((k) => k + 1);
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-zinc-950 text-zinc-400">
        <Icons.Refresh size={28} className="animate-spin text-accent" />
      </div>
    );
  }

  // If no URL is configured yet or currently editing URL
  if (!rawUrl || isEditing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-zinc-950 text-white overflow-y-auto">
        <div className="max-w-md w-full p-6 bg-zinc-900/90 rounded-2xl border border-zinc-800 shadow-2xl space-y-5 text-center">
          {/* Header Icon */}
          <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shadow-lg">
            <svg
              className="w-10 h-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7v10" />
              <path d="M12 7v10" />
              <path d="M17 7v10" />
            </svg>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">Miro Character Sheet</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Paste your Miro board share link to view, navigate, and edit your character sheet directly in Owlbear Rodeo.
            </p>
          </div>

          {/* URL Input */}
          <div className="space-y-2 text-left">
            <label className="text-xs font-semibold text-zinc-300">Miro Board Link</label>
            <div className="relative">
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://miro.com/app/board/..."
                className="w-full px-3.5 py-2.5 bg-zinc-950 border border-zinc-700 rounded-xl text-white text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent font-mono text-xs"
                autoFocus
              />
            </div>
            <p className="text-[11px] text-zinc-500">
              💡 Tip: In Miro, click <strong>Share</strong> &rarr; ensure link access is enabled &rarr; click <strong>Copy board link</strong>.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2">
            {rawUrl && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded-xl text-xs font-medium transition-colors"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveUrl}
              disabled={!inputUrl.trim()}
              className={clsx(
                "flex-1 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md",
                inputUrl.trim()
                  ? "bg-accent hover:bg-accent/90 text-white shadow-accent/20 active:scale-95"
                  : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
              )}
            >
              Connect Board
            </button>
          </div>

          {rawUrl && (
            <button
              type="button"
              onClick={handleClearUrl}
              className="text-[11px] text-red-400 hover:text-red-300 underline pt-1"
            >
              Disconnect Miro Board
            </button>
          )}
        </div>
      </div>
    );
  }

  // Active Miro Iframe Display
  return (
    <div className="relative flex-1 w-full h-full flex flex-col bg-zinc-950 overflow-hidden">
      {/* Top Mini Control Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800/80 z-20 text-xs">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="font-semibold text-zinc-300 text-[11px]">Miro Active</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Refresh Iframe */}
          <button
            onClick={handleRefresh}
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Reload Miro Board"
          >
            <Icons.Refresh size={14} />
          </button>

          {/* Open in New Window */}
          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors flex items-center gap-1"
            title="Open in new browser tab"
          >
            <Icons.ArrowRight size={14} className="-rotate-45" />
          </a>

          {/* Edit Board URL */}
          <button
            onClick={() => {
              setInputUrl(rawUrl);
              setIsEditing(true);
            }}
            className="px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white transition-colors text-[11px] font-medium ml-1"
            title="Change Miro Board Link"
          >
            Change Link
          </button>
        </div>
      </div>

      {/* Miro Iframe */}
      <div className="flex-1 w-full h-full relative bg-zinc-950">
        <iframe
          key={iframeKey}
          src={embedUrl}
          title="Miro Character Sheet Board"
          className="w-full h-full border-0 bg-zinc-950"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
    </div>
  );
};
