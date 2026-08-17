import React, { useState, useEffect, useMemo } from 'react';
import { OBRStorage } from '../obr';
import { Icons } from './ui/Icons';
import clsx from 'clsx';
import { motion, AnimatePresence } from 'framer-motion';

interface MiroBoardEmbedProps {
  onRollStat?: (statKey: string, statValue: number) => void;
  isActive?: boolean;
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

export const MiroBoardEmbed: React.FC<MiroBoardEmbedProps> = ({ isActive = true }) => {
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
          <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto border border-amber-500/30">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7v10" />
              <path d="M12 7v10" />
              <path d="M17 7v10" />
            </svg>
          </div>

          <div>
            <h3 className="text-lg font-bold text-white">Connect Miro Character Board</h3>
            <p className="text-xs text-zinc-400 mt-1">
              Paste your Miro board share link below. It will be embedded directly into this panel.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div>
              <label className="block text-xs font-semibold text-zinc-300 mb-1">
                Miro Board URL
              </label>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://miro.com/app/board/uXjVO...=/"
                className="w-full px-3 py-2 bg-zinc-950 border border-zinc-700 rounded-xl text-xs text-white focus:outline-none focus:border-accent"
              />
            </div>

            <div className="p-2.5 rounded-xl bg-zinc-950/60 border border-zinc-800 text-[11px] text-zinc-400 space-y-1">
              <div className="font-semibold text-zinc-300 flex items-center gap-1">
                <span>💡 Tip for Miro permissions:</span>
              </div>
              <p>
                Ensure your Miro board share setting is set to <strong>"Anyone with the link can view/edit"</strong> so all players can access it.
              </p>
            </div>
          </div>

          <div className="flex gap-2">
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

  // Active Miro Iframe Display with content-visibility CPU/GPU resource optimization
  return (
    <div
      className={clsx(
        "relative flex-1 w-full h-full flex flex-col bg-zinc-950 overflow-hidden",
        !isActive && "pointer-events-none invisible"
      )}
      style={{
        contentVisibility: isActive ? 'visible' : 'hidden',
        containIntrinsicSize: '100vw 100vh',
      }}
    >
      {/* Top Mini Control Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800/80 z-20 text-xs">
        <div className="flex items-center gap-2">
          <span className={clsx("w-2 h-2 rounded-full", isActive ? "bg-emerald-400 animate-pulse" : "bg-zinc-500")} />
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
          loading="lazy"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
    </div>
  );
};
