"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { getAudioPresignedUrl } from "@/lib/api/conversations";

interface AudioPlayerProps {
  /** MinIO object path (``voice_messages/…``). A fresh presigned URL will be
   *  fetched lazily when the user first presses play. */
  objectPath: string;
  /** Optional pre-resolved URL (e.g. from the upload response). Avoids an
   *  extra round-trip when the player is rendered immediately after upload. */
  initialUrl?: string;
  /** CSS class applied to the outermost container. */
  className?: string;
}

function formatSeconds(seconds: number): string {
  if (!isFinite(seconds) || isNaN(seconds)) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function AudioPlayer({ objectPath, initialUrl, className }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);

  const [url, setUrl] = useState<string | null>(initialUrl ?? null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Resolve the presigned URL on first play
  const resolveUrl = useCallback(async () => {
    if (url) return url;
    setIsLoading(true);
    try {
      const resolved = await getAudioPresignedUrl(objectPath);
      setUrl(resolved);
      return resolved;
    } catch {
      setError("Could not load audio.");
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [url, objectPath]);

  // Create / destroy Audio element
  useEffect(() => {
    const audio = new Audio();
    audioRef.current = audio;

    audio.addEventListener("loadedmetadata", () => setDuration(audio.duration));
    audio.addEventListener("timeupdate", () => setCurrentTime(audio.currentTime));
    audio.addEventListener("ended", () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });
    audio.addEventListener("error", () => setError("Playback error."));

    return () => {
      audio.pause();
      audio.src = "";
    };
  }, []);

  const handlePlayPause = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    // Load src if not already set
    if (!audio.src || audio.src === window.location.href) {
      const resolved = await resolveUrl();
      if (!resolved) return;
      audio.src = resolved;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setError("Playback failed.");
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    const bar = progressRef.current;
    if (!audio || !bar || duration === 0) return;

    const rect = bar.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = ratio * duration;
    setCurrentTime(audio.currentTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  if (error) {
    return (
      <div className={cn("flex items-center gap-2 text-xs text-destructive", className)}>
        🎙️ {error}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-full bg-background/20 px-3 py-1.5 min-w-[180px]",
        className
      )}
    >
      {/* Play / Pause / Loading */}
      <Button
        variant="ghost"
        size="icon"
        className="h-7 w-7 shrink-0 rounded-full"
        onClick={handlePlayPause}
        disabled={isLoading}
        aria-label={isPlaying ? "Pause" : "Play"}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-4 w-4" />
        ) : (
          <Play className="h-4 w-4" />
        )}
      </Button>

      {/* Progress bar */}
      <div
        ref={progressRef}
        className="relative h-1 flex-1 cursor-pointer rounded-full bg-background/40"
        onClick={handleSeek}
        role="slider"
        aria-valuenow={Math.round(currentTime)}
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-label="Seek"
      >
        <div
          className="h-full rounded-full bg-current transition-all"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Time */}
      <span className="shrink-0 tabular-nums text-xs opacity-80">
        {isPlaying || currentTime > 0
          ? formatSeconds(currentTime)
          : formatSeconds(duration)}
      </span>
    </div>
  );
}
