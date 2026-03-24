"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, Square, Trash2, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { AudioPlayer } from "./audio-player";
import { uploadVoiceAudio } from "@/lib/api/conversations";

const MAX_DURATION_SECONDS = 120; // 2 minutes

interface VoiceRecorderProps {
  /** Called after the audio has been uploaded successfully.
   *  Receives the object_path (to embed in attachment_ids as ``voice:<object_path>``). */
  onRecordingComplete: (objectPath: string) => void;
  /** Called when the user closes / cancels the recorder. */
  onCancel: () => void;
  disabled?: boolean;
}

type RecorderState = "idle" | "recording" | "preview" | "uploading";

function formatSeconds(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function VoiceRecorder({ onRecordingComplete, onCancel, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [blob, setBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTimer();
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];

      // Prefer webm/opus; fall back to default
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const recorded = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        setBlob(recorded);
        const url = URL.createObjectURL(recorded);
        setPreviewUrl(url);
        setState("preview");
        stream.getTracks().forEach((t) => t.stop());
      };

      recorder.start(100); // collect chunks every 100 ms
      setState("recording");
      setElapsed(0);

      timerRef.current = setInterval(() => {
        setElapsed((prev) => {
          const next = prev + 1;
          if (next >= MAX_DURATION_SECONDS) {
            stopRecording();
          }
          return next;
        });
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes("Permission") || msg.includes("NotAllowed")) {
        setError("Microphone permission denied. Please allow microphone access.");
      } else {
        setError("Could not start recording. Check microphone permissions.");
      }
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const stopRecording = useCallback(() => {
    stopTimer();
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const discardRecording = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setBlob(null);
    setPreviewUrl(null);
    setElapsed(0);
    setState("idle");
  };

  const sendRecording = async () => {
    if (!blob) return;
    setState("uploading");
    setError(null);
    try {
      const result = await uploadVoiceAudio(blob);
      onRecordingComplete(result.object_path);
    } catch {
      setError("Upload failed. Please try again.");
      setState("preview");
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-lg border bg-muted/40 p-3",
        disabled && "pointer-events-none opacity-50"
      )}
    >
      {/* Recording state */}
      {state === "idle" && (
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={startRecording}
            disabled={disabled}
          >
            <Mic className="h-4 w-4 text-destructive" />
            Record voice message
          </Button>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      )}

      {state === "recording" && (
        <div className="flex items-center gap-3">
          {/* Pulsing indicator */}
          <span className="relative flex h-3 w-3">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-destructive opacity-75" />
            <span className="relative inline-flex h-3 w-3 rounded-full bg-destructive" />
          </span>
          <span className="text-sm font-medium tabular-nums text-destructive">
            {formatSeconds(elapsed)}
          </span>
          <span className="text-xs text-muted-foreground">
            / {formatSeconds(MAX_DURATION_SECONDS)} max
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-2"
            onClick={stopRecording}
          >
            <Square className="h-4 w-4" />
            Stop
          </Button>
        </div>
      )}

      {(state === "preview" || state === "uploading") && previewUrl && blob && (
        <div className="flex items-center gap-2">
          <AudioPlayer
            objectPath=""
            initialUrl={previewUrl}
            className="flex-1 bg-transparent"
          />
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            onClick={discardRecording}
            disabled={state === "uploading"}
            title="Discard"
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
          <Button
            size="sm"
            className="shrink-0 gap-2"
            onClick={sendRecording}
            disabled={state === "uploading"}
          >
            {state === "uploading" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            {state === "uploading" ? "Sending…" : "Send"}
          </Button>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
