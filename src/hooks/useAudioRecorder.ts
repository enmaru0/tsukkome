import { useCallback, useRef, useState } from "react";

export const useAudioRecorder = () => {
  const supported =
    typeof window !== "undefined" &&
    "MediaRecorder" in window &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia;

  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const start = useCallback(async (): Promise<boolean> => {
    if (!supported || isRecording) return false;
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
      return true;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[recorder] start failed", msg);
      setError(msg);
      cleanupStream();
      return false;
    }
  }, [supported, isRecording]);

  const stop = useCallback((): Promise<{ url: string; mimeType: string } | null> => {
    return new Promise((resolve) => {
      const recorder = recorderRef.current;
      if (!recorder || recorder.state === "inactive") {
        cleanupStream();
        setIsRecording(false);
        resolve(null);
        return;
      }
      recorder.addEventListener(
        "stop",
        () => {
          const mimeType = recorder.mimeType || "audio/webm";
          const blob = new Blob(chunksRef.current, { type: mimeType });
          const url = blob.size > 0 ? URL.createObjectURL(blob) : null;
          cleanupStream();
          recorderRef.current = null;
          chunksRef.current = [];
          setIsRecording(false);
          resolve(url ? { url, mimeType } : null);
        },
        { once: true },
      );
      try {
        recorder.stop();
      } catch (e) {
        console.warn("[recorder] stop failed", e);
        cleanupStream();
        setIsRecording(false);
        resolve(null);
      }
    });
  }, []);

  const cancel = useCallback(() => {
    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      try {
        recorder.stop();
      } catch {
        // ignore
      }
    }
    cleanupStream();
    recorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
  }, []);

  return { supported, isRecording, error, start, stop, cancel };
};
