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
      <div className="flex-1 flex items-center justify-center p-8 bg-background text-muted select-none">
        <Icons.Refresh size={24} className="animate-spin text-white" />
      </div>
    );
  }

  // If no URL is configured yet or currently editing URL
  if (!rawUrl || isEditing) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 bg-background text-white overflow-y-auto select-none">
        <div className="max-w-md w-full p-6 bg-surface rounded-2xl border border-neutral-800 shadow-fey-xl space-y-5 text-center">
          <div className="w-12 h-12 rounded-2xl bg-elevated text-white flex items-center justify-center mx-auto border border-neutral-800">
            <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect width="18" height="18" x="3" y="3" rx="2" />
              <path d="M7 7v10" />
              <path d="M12 7v10" />
              <path d="M17 7v10" />
            </svg>
          </div>

          <div>
            <h3 className="text-base font-bold text-white tracking-tight">Connect Miro Character Board</h3>
            <p className="text-xs text-muted mt-1 font-mono">
              Paste your Miro board share link to embed it into this panel.
            </p>
          </div>

          <div className="space-y-3 text-left">
            <div>
              <label className="block text-[10px] font-bold text-muted uppercase font-mono tracking-widest mb-1.5">
                Miro Board URL
              </label>
              <input
                type="text"
                value={inputUrl}
                onChange={(e) => setInputUrl(e.target.value)}
                placeholder="https://miro.com/app/board/uXjVO...=/"
                className="w-full px-3 py-2 bg-elevated border border-neutral-800 rounded-xl text-xs font-mono text-white focus:outline-none focus:border-white/50"
              />
            </div>

            <div className="p-3 rounded-xl bg-elevated/60 border border-neutral-800 text-[11px] text-muted space-y-1 font-mono">
              <div className="font-semibold text-white flex items-center gap-1">
                <span>💡 Permissions Tip:</span>
              </div>
              <p>
                Set board sharing to <strong>"Anyone with the link can view/edit"</strong> for seamless access.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 pt-1">
            {rawUrl && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="flex-1 px-4 py-2 bg-elevated hover:bg-neutral-800 text-muted hover:text-white rounded-full text-xs font-semibold transition-all border border-neutral-800"
              >
                Cancel
              </button>
            )}
            <button
              type="button"
              onClick={handleSaveUrl}
              disabled={!inputUrl.trim()}
              className={clsx(
                "flex-1 px-4 py-2.5 rounded-full text-xs font-bold transition-all shadow-fey-subtle",
                inputUrl.trim()
                  ? "bg-white hover:bg-neutral-200 text-black active:scale-95"
                  : "bg-neutral-800 text-muted cursor-not-allowed"
              )}
            >
              Connect Board
            </button>
          </div>

          {rawUrl && (
            <button
              type="button"
              onClick={handleClearUrl}
              className="text-[11px] text-rose-400 hover:text-rose-300 font-mono underline pt-1"
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
        "relative flex-1 w-full h-full flex flex-col bg-background overflow-hidden select-none",
        !isActive && "pointer-events-none invisible"
      )}
      style={{
        contentVisibility: isActive ? 'visible' : 'hidden',
        containIntrinsicSize: '100vw 100vh',
      }}
    >
      {/* Top Mini Control Toolbar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-surface border-b border-neutral-800 z-20 text-xs">
        <div className="flex items-center gap-2">
          <span className={clsx("w-2 h-2 rounded-full", isActive ? "bg-growth animate-pulse" : "bg-neutral-600")} />
          <span className="font-bold text-white text-[11px] font-mono tracking-wide">Miro Board Active</span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Refresh Iframe */}
          <button
            onClick={handleRefresh}
            className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated transition-colors"
            title="Reload Miro Board"
          >
            <Icons.Refresh size={13} />
          </button>

          {/* Open in New Window */}
          <a
            href={rawUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1 rounded-full text-muted hover:text-white hover:bg-elevated transition-colors flex items-center gap-1"
            title="Open in new browser tab"
          >
            <Icons.ArrowRight size={13} className="-rotate-45" />
          </a>

          {/* Edit Board URL */}
          <button
            onClick={() => {
              setInputUrl(rawUrl);
              setIsEditing(true);
            }}
            className="px-2.5 py-0.5 rounded-full bg-elevated hover:bg-neutral-800 text-muted hover:text-white transition-colors text-[10px] font-mono font-semibold ml-1 border border-neutral-800"
            title="Change Miro Board Link"
          >
            Change Link
          </button>
        </div>
      </div>

      {/* Miro Iframe */}
      <div className="flex-1 w-full h-full relative bg-background">
        <iframe
          key={iframeKey}
          src={embedUrl}
          title="Miro Character Sheet Board"
          className="w-full h-full border-0 bg-background"
          loading="lazy"
          allow="fullscreen; clipboard-read; clipboard-write"
          allowFullScreen
        />
      </div>
    </div>
  );
};

