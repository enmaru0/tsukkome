import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { bokes, type Boke } from "./data/bokes";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";

type InputMode = "text" | "voice";

type HistoryEntry = {
  bokeId: number;
  setup: string;
  tsukkomi: string;
  mode: InputMode;
  audioUrl: string | null;
  audioMime: string | null;
  timestamp: number;
};

const TIME_LIMIT = 30;
const SITE_URL = "https://tsukkome.vercel.app/";
const HASHTAG = "ツッコメッ";

const pickRandomBoke = (exclude?: number): Boke => {
  if (bokes.length === 1) return bokes[0];
  let next = bokes[Math.floor(Math.random() * bokes.length)];
  while (exclude !== undefined && next.id === exclude) {
    next = bokes[Math.floor(Math.random() * bokes.length)];
  }
  return next;
};

const buildShareText = (setup: string, tsukkomi: string): string =>
  `【お題】${setup}\n【ツッコミ】「${tsukkomi}」\n\n#${HASHTAG}`;

const openTwitterIntent = (setup: string, tsukkomi: string) => {
  const text = buildShareText(setup, tsukkomi);
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

const nativeShare = async (
  setup: string,
  tsukkomi: string,
): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({
      title: "ツッコメッ！！",
      text: buildShareText(setup, tsukkomi),
      url: SITE_URL,
    });
    return true;
  } catch {
    return false;
  }
};

const copyToClipboard = async (
  setup: string,
  tsukkomi: string,
): Promise<boolean> => {
  const text = `${buildShareText(setup, tsukkomi)}\n${SITE_URL}`;
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
};

const downloadAudio = (url: string, mimeType: string, timestamp: number) => {
  const ext = mimeType.includes("mp4")
    ? "m4a"
    : mimeType.includes("ogg")
      ? "ogg"
      : "webm";
  const date = new Date(timestamp);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mi = String(date.getMinutes()).padStart(2, "0");
  const ss = String(date.getSeconds()).padStart(2, "0");
  const a = document.createElement("a");
  a.href = url;
  a.download = `tsukkome_${yyyy}${mm}${dd}_${hh}${mi}${ss}.${ext}`;
  document.body.appendChild(a);
  a.click();
  a.remove();
};

function App() {
  const [currentBoke, setCurrentBoke] = useState<Boke>(() => pickRandomBoke());
  const [mode, setMode] = useState<InputMode>("voice");
  const [text, setText] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [timerRunning, setTimerRunning] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const [lastSubmission, setLastSubmission] = useState<HistoryEntry | null>(null);
  const [copyToast, setCopyToast] = useState<string | null>(null);
  const intervalRef = useRef<number | null>(null);
  const modeRef = useRef<InputMode>("voice");
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";

  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();
  const recorder = useAudioRecorder();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  const startTimer = () => {
    setTimeLeft(TIME_LIMIT);
    setTimerRunning(true);
  };

  const beginVoiceCapture = async () => {
    if (!speech.supported) return;
    if (recorder.supported) {
      await recorder.start();
    }
    speech.start();
  };

  useEffect(() => {
    const run = async () => {
      if (modeRef.current === "voice" && recorder.supported) {
        await recorder.start();
      }
      if (autoSpeak && tts.supported) {
        tts.speak(currentBoke.setup, () => {
          startTimer();
          if (modeRef.current === "voice" && speech.supported) {
            speech.start();
          }
        });
      } else {
        startTimer();
        if (modeRef.current === "voice" && speech.supported) {
          speech.start();
        }
      }
    };
    void run();
    return () => {
      tts.cancel();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentBoke.id]);

  useEffect(() => {
    if (!timerRunning) return;
    intervalRef.current = window.setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => {
      if (intervalRef.current !== null) {
        window.clearInterval(intervalRef.current);
      }
    };
  }, [timerRunning]);

  useEffect(() => {
    if (!copyToast) return;
    const id = window.setTimeout(() => setCopyToast(null), 2000);
    return () => window.clearTimeout(id);
  }, [copyToast]);

  const voiceText = useMemo(
    () => (speech.transcript + " " + speech.interim).trim(),
    [speech.transcript, speech.interim],
  );

  const currentInput = mode === "text" ? text : voiceText;

  const submit = async () => {
    const value = currentInput.trim();
    if (!value) return;

    let audioUrl: string | null = null;
    let audioMime: string | null = null;
    if (mode === "voice") {
      if (speech.isListening) speech.stop();
      const result = await recorder.stop();
      if (result) {
        audioUrl = result.url;
        audioMime = result.mimeType;
      }
    }

    const entry: HistoryEntry = {
      bokeId: currentBoke.id,
      setup: currentBoke.setup,
      tsukkomi: value,
      mode,
      audioUrl,
      audioMime,
      timestamp: Date.now(),
    };
    setHistory((prev) => [entry, ...prev]);
    setLastSubmission(entry);
    setShowExamples(true);
    setTimerRunning(false);
  };

  const nextBoke = () => {
    tts.cancel();
    if (speech.isListening) speech.stop();
    recorder.cancel();
    setCurrentBoke((prev) => pickRandomBoke(prev.id));
    setText("");
    speech.reset();
    setShowExamples(false);
    setLastSubmission(null);
    setTimerRunning(false);
  };

  const replaySetup = () => {
    if (tts.isSpeaking) {
      tts.cancel();
    } else {
      tts.speak(currentBoke.setup);
    }
  };

  const toggleVoice = async () => {
    if (speech.isListening || recorder.isRecording) {
      if (speech.isListening) speech.stop();
      await recorder.stop();
    } else {
      await beginVoiceCapture();
    }
  };

  const switchMode = (next: InputMode) => {
    if (mode === next) return;
    if (next === "text") {
      if (speech.isListening) speech.stop();
      recorder.cancel();
    }
    setMode(next);
  };

  const handleNativeShare = async (entry: HistoryEntry) => {
    const ok = await nativeShare(entry.setup, entry.tsukkomi);
    if (!ok) {
      setCopyToast("シェアをキャンセルしました");
    }
  };

  const handleCopy = async (entry: HistoryEntry) => {
    const ok = await copyToClipboard(entry.setup, entry.tsukkomi);
    setCopyToast(ok ? "コピーしました！" : "コピーに失敗しました");
  };

  const isMicActive = speech.isListening || recorder.isRecording;

  return (
    <div className="app">
      <header className="header">
        <div className="title-row">
          <span className="title-mark left">▼</span>
          <h1 className="title">ツッコメッ<span className="title-bang">！！</span></h1>
          <span className="title-mark right">▼</span>
        </div>
        <p className="subtitle">ボケのお題に、ノリと勢いでツッコめ！</p>
      </header>

      <section className="boke-card">
        <div className="boke-meta">
          <span className="badge">ボケ #{currentBoke.id}</span>
          <span className={`timer ${timeLeft <= 5 && timerRunning ? "timer-warn" : ""}`}>
            {tts.isSpeaking
              ? "🔊 読み上げ中…"
              : timerRunning
                ? `⏱ 残り ${timeLeft}秒`
                : timeLeft === 0
                  ? "💥 時間切れ！"
                  : "準備中"}
          </span>
        </div>
        <div className="boke-bubble">
          <p className="boke-setup">{currentBoke.setup}</p>
        </div>
        {tts.supported && (
          <div className="boke-tts">
            <button
              type="button"
              className="speak-button"
              onClick={replaySetup}
            >
              {tts.isSpeaking ? "■ 停止" : "🔊 もう一度読み上げ"}
            </button>
            <label className="auto-speak">
              <input
                type="checkbox"
                checked={autoSpeak}
                onChange={(e) => setAutoSpeak(e.target.checked)}
              />
              新しいお題を自動で読み上げる
            </label>
          </div>
        )}
      </section>

      <section className="input-area">
        <div className="mode-tabs">
          <button
            type="button"
            className={mode === "voice" ? "tab active" : "tab"}
            onClick={() => switchMode("voice")}
            disabled={!speech.supported}
            title={speech.supported ? "" : "このブラウザは音声入力に対応していません"}
          >
            🎤 音声入力
          </button>
          <button
            type="button"
            className={mode === "text" ? "tab active" : "tab"}
            onClick={() => switchMode("text")}
          >
            ⌨ テキスト入力
          </button>
        </div>

        {mode === "text" ? (
          <textarea
            className="text-input"
            placeholder="ここにツッコミを入力（例：「いるわけないやろ！」）"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void submit();
              }
            }}
            rows={3}
          />
        ) : (
          <div className="voice-area">
            {!speech.supported ? (
              <p className="voice-warning">
                このブラウザは音声入力に対応していません。Chrome / Safari でお試しください。
              </p>
            ) : (
              <>
                <button
                  type="button"
                  className={isMicActive ? "mic-button listening" : "mic-button"}
                  onClick={() => void toggleVoice()}
                >
                  {isMicActive
                    ? "● 録音中（タップで停止）"
                    : "🎤 マイクをオン"}
                </button>
                <div className="voice-transcript">
                  {voiceText || (
                    <span className="placeholder">
                      {isMicActive
                        ? "聴いてます…ツッコんでください"
                        : "マイクをオンにして、声でツッコんでください"}
                    </span>
                  )}
                </div>
                {(speech.error || recorder.error) && (
                  <p className="voice-error">
                    エラー: {speech.error || recorder.error}
                  </p>
                )}
              </>
            )}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={() => void submit()}
            disabled={!currentInput.trim()}
          >
            💥 ツッコめッ！
          </button>
          <button type="button" className="secondary" onClick={nextBoke}>
            次のお題 →
          </button>
        </div>

        {lastSubmission && (
          <div className="share-panel">
            <h3>このツッコミをシェア</h3>
            <div className="share-preview">
              <div className="share-line">
                <span className="share-label">お題</span>
                {lastSubmission.setup}
              </div>
              <div className="share-line">
                <span className="share-label">ツッコミ</span>
                「{lastSubmission.tsukkomi}」
              </div>
            </div>
            {lastSubmission.audioUrl && (
              <div className="audio-row">
                <audio
                  controls
                  src={lastSubmission.audioUrl}
                  className="audio-player"
                />
                <button
                  type="button"
                  className="audio-download"
                  onClick={() =>
                    downloadAudio(
                      lastSubmission.audioUrl!,
                      lastSubmission.audioMime || "audio/webm",
                      lastSubmission.timestamp,
                    )
                  }
                  title="録音をダウンロード"
                  aria-label="録音をダウンロード"
                >
                  ⬇
                </button>
              </div>
            )}
            <div className="share-buttons">
              <button
                type="button"
                className="share-button x"
                onClick={() =>
                  openTwitterIntent(lastSubmission.setup, lastSubmission.tsukkomi)
                }
              >
                𝕏 でシェア
              </button>
              {canNativeShare && (
                <button
                  type="button"
                  className="share-button native"
                  onClick={() => handleNativeShare(lastSubmission)}
                >
                  📤 シェア
                </button>
              )}
              <button
                type="button"
                className="share-button copy"
                onClick={() => handleCopy(lastSubmission)}
              >
                📋 コピー
              </button>
            </div>
          </div>
        )}

        {showExamples && (
          <div className="examples">
            <h3>模範ツッコミ例</h3>
            <ul>
              {currentBoke.examples.map((ex, i) => (
                <li key={i}>{ex}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {history.length > 0 && (
        <section className="history">
          <h2>🎤 ツッコミ履歴</h2>
          <ul>
            {history.map((entry, i) => (
              <li key={`${entry.timestamp}-${i}`} className="history-item">
                <div className="history-content">
                  <div className="history-setup">
                    <span className="history-mode">
                      {entry.mode === "text" ? "⌨" : "🎤"}
                    </span>
                    {entry.setup}
                  </div>
                  <div className="history-tsukkomi">→ {entry.tsukkomi}</div>
                  {entry.audioUrl && (
                    <div className="audio-row">
                      <audio
                        controls
                        src={entry.audioUrl}
                        className="audio-player"
                      />
                      <button
                        type="button"
                        className="audio-download small"
                        onClick={() =>
                          downloadAudio(
                            entry.audioUrl!,
                            entry.audioMime || "audio/webm",
                            entry.timestamp,
                          )
                        }
                        title="録音をダウンロード"
                        aria-label="録音をダウンロード"
                      >
                        ⬇
                      </button>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="history-share"
                  onClick={() => openTwitterIntent(entry.setup, entry.tsukkomi)}
                  title="𝕏 でシェア"
                  aria-label="𝕏 でシェア"
                >
                  𝕏
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {copyToast && <div className="toast">{copyToast}</div>}
    </div>
  );
}

export default App;
