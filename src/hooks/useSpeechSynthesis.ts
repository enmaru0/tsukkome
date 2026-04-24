import { useCallback, useEffect, useMemo, useRef, useState } from "react";

const STORAGE_KEY = "tsukkome:tts:voiceURI";

const pickPreferredVoice = (
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice | null => {
  if (voices.length === 0) return null;
  const preferred = voices.find((v) => /kyoko|otoya|google/i.test(v.name));
  return preferred ?? voices[0];
};

export const useSpeechSynthesis = () => {
  const supported =
    typeof window !== "undefined" && "speechSynthesis" in window;
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [selectedVoiceURI, setSelectedVoiceURI] = useState<string | null>(
    () => {
      if (typeof window === "undefined") return null;
      try {
        return window.localStorage.getItem(STORAGE_KEY);
      } catch {
        return null;
      }
    },
  );
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    if (!supported) return;
    const loadVoices = () => {
      const allVoices = window.speechSynthesis.getVoices();
      const jaVoices = allVoices.filter((v) =>
        v.lang.toLowerCase().startsWith("ja"),
      );
      setVoices(jaVoices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
    return () => {
      window.speechSynthesis.onvoiceschanged = null;
    };
  }, [supported]);

  const selectedVoice = useMemo<SpeechSynthesisVoice | null>(() => {
    if (voices.length === 0) return null;
    if (selectedVoiceURI) {
      const found = voices.find((v) => v.voiceURI === selectedVoiceURI);
      if (found) return found;
    }
    return pickPreferredVoice(voices);
  }, [voices, selectedVoiceURI]);

  const selectVoice = useCallback((voiceURI: string) => {
    setSelectedVoiceURI(voiceURI);
    try {
      window.localStorage.setItem(STORAGE_KEY, voiceURI);
    } catch {
      // ignore storage errors
    }
  }, []);

  const speak = useCallback(
    (text: string, onEnd?: () => void, onStart?: () => void) => {
      if (!supported || !text) {
        onEnd?.();
        return;
      }
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = "ja-JP";
      utterance.rate = 1.4;
      utterance.pitch = 1.0;
      if (selectedVoice) utterance.voice = selectedVoice;
      utterance.onstart = () => {
        setIsSpeaking(true);
        onStart?.();
      };
      utterance.onend = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utterance.onerror = () => {
        setIsSpeaking(false);
        onEnd?.();
      };
      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [supported, selectedVoice],
  );

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  }, [supported]);

  return {
    supported,
    isSpeaking,
    voices,
    selectedVoice,
    selectVoice,
    speak,
    cancel,
  };
};
