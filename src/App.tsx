import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { bokes, type AnyBoke } from "./data/bokes";
import { imageBokes } from "./data/imageBokes";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";

type InputMode = "text" | "voice";
type Phase = "start" | "text" | "image";

type HistoryEntry = {
  boke: AnyBoke;
  tsukkomi: string;
  mode: InputMode;
  audioUrl: string | null;
  audioMime: string | null;
  timestamp: number;
};

const TIME_LIMIT = 30;
const SITE_URL = "https://tsukkome.vercel.app/";
const HASHTAG = "ツッコめッ";

const pickRandom = <T extends { id: number }>(list: T[], excludeId?: number): T => {
  if (list.length === 1) return list[0];
  let next = list[Math.floor(Math.random() * list.length)];
  while (excludeId !== undefined && next.id === excludeId) {
    next = list[Math.floor(Math.random() * list.length)];
  }
  return next;
};

const bokeToSetupText = (boke: AnyBoke): string =>
  boke.kind === "text" ? boke.setup : boke.title;

const bokeToShareSetup = (boke: AnyBoke): string =>
  boke.kind === "text" ? boke.setup : `${boke.emoji} ${boke.title}`;

const buildShareText = (boke: AnyBoke, tsukkomi: string): string => {
  const label = boke.kind === "image" ? "画像お題" : "お題";
  return `【${label}】${bokeToShareSetup(boke)}\n【ツッコミ】「${tsukkomi}」\n\n#${HASHTAG}`;
};

const openTwitterIntent = (boke: AnyBoke, tsukkomi: string) => {
  const text = buildShareText(boke, tsukkomi);
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(SITE_URL)}`;
  window.open(url, "_blank", "noopener,noreferrer");
};

const nativeShare = async (
  boke: AnyBoke,
  tsukkomi: string,
): Promise<boolean> => {
  if (typeof navigator === "undefined" || !navigator.share) return false;
  try {
    await navigator.share({
      title: "ツッコめッ！！",
      text: buildShareText(boke, tsukkomi),
      url: SITE_URL,
    });
    return true;
  } catch {
    return false;
  }
};

const copyToClipboard = async (
  boke: AnyBoke,
  tsukkomi: string,
): Promise<boolean> => {
  const text = `${buildShareText(boke, tsukkomi)}\n${SITE_URL}`;
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
  const [phase, setPhase] = useState<Phase>("start");
  const [currentBoke, setCurrentBoke] = useState<AnyBoke>(() =>
    pickRandom(bokes),
  );
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

  const bokeKey = `${currentBoke.kind}:${currentBoke.id}`;

  useEffect(() => {
    if (phase === "start") return;
    const run = async () => {
      if (modeRef.current === "voice" && recorder.supported) {
        await recorder.start();
      }
      const speakText = bokeToSetupText(currentBoke);
      if (autoSpeak && tts.supported) {
        tts.speak(speakText, () => {
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
  }, [phase, bokeKey]);

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

  const startMode = (next: "text" | "image") => {
    const initialBoke =
      next === "text" ? pickRandom(bokes) : pickRandom(imageBokes);
    setCurrentBoke(initialBoke);
    setShowExamples(false);
    setLastSubmission(null);
    setText("");
    speech.reset();
    setTimerRunning(false);
    setPhase(next);
  };

  const goToStart = () => {
    tts.cancel();
    if (speech.isListening) speech.stop();
    recorder.cancel();
    setPhase("start");
    setShowExamples(false);
    setLastSubmission(null);
    setTimerRunning(false);
    setTimeLeft(TIME_LIMIT);
  };

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
      boke: currentBoke,
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
    setCurrentBoke((prev) =>
      phase === "image"
        ? pickRandom(imageBokes, prev.id)
        : pickRandom(bokes, prev.id),
    );
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
      tts.speak(bokeToSetupText(currentBoke));
    }
  };

  const previewVoice = () => {
    tts.cancel();
    tts.speak("ちょっと待て待て、何やそれ！");
  };

  const switchMode = async (next: InputMode) => {
    if (mode === next) return;
    if (next === "text") {
      if (speech.isListening) speech.stop();
      recorder.cancel();
      setMode(next);
      return;
    }
    setMode(next);
    if (recorder.supported && !recorder.isRecording) {
      await recorder.start();
    }
    if (!tts.isSpeaking && speech.supported && !speech.isListening) {
      speech.start();
    }
  };

  const handleNativeShare = async (entry: HistoryEntry) => {
    const ok = await nativeShare(entry.boke, entry.tsukkomi);
    if (!ok) {
      setCopyToast("シェアをキャンセルしました");
    }
  };

  const handleCopy = async (entry: HistoryEntry) => {
    const ok = await copyToClipboard(entry.boke, entry.tsukkomi);
    setCopyToast(ok ? "コピーしました！" : "コピーに失敗しました");
  };

  const isMicActive = speech.isListening || recorder.isRecording;

  if (phase === "start") {
    return (
      <div className="app">
        <header className="header start">
          <div className="title-row">
            <span className="title-mark left">▼</span>
            <h1 className="title">ツッコめッ<span className="title-bang">！！</span></h1>
            <span className="title-mark right">▼</span>
          </div>
          <p className="subtitle">ボケのお題に、ノリと勢いでツッコめ！</p>
        </header>

        <section className="start-screen">
          <p className="start-lead">モードを選んでスタート！</p>
          <div className="start-buttons">
            <button
              type="button"
              className="start-button text-mode"
              onClick={() => startMode("text")}
            >
              <div className="start-button-emoji">💬</div>
              <div className="start-button-title">通常モード</div>
              <div className="start-button-desc">文字のお題にツッコむ</div>
            </button>
            <button
              type="button"
              className="start-button image-mode"
              onClick={() => startMode("image")}
            >
              <div className="start-button-emoji">📷</div>
              <div className="start-button-title">画像モード</div>
              <div className="start-button-desc">絵のお題にツッコむ</div>
            </button>
          </div>
          <p className="start-note">
            初回はマイクの許可ダイアログが出ます。「許可」を押してください。
          </p>
        </section>
      </div>
    );
  }

  return (
    <div className="app">
      <div className="topbar">
        <button type="button" className="back-button" onClick={goToStart}>
          ← モードを変える
        </button>
      </div>

      <header className="header">
        <div className="title-row">
          <span className="title-mark left">▼</span>
          <h1 className="title">ツッコめッ<span className="title-bang">！！</span></h1>
          <span className="title-mark right">▼</span>
        </div>
        <p className="subtitle">
          {phase === "image"
            ? "📷 画像モード — この絵を見てツッコめ！"
            : "💬 通常モード — このボケにツッコめ！"}
        </p>
      </header>

      {currentBoke.kind === "text" ? (
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
      ) : (
        <section className="image-boke-card">
          <div className="boke-meta">
            <span className="badge">画像 #{currentBoke.id}</span>
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
          <div className="image-frame">
            <div className="image-emoji">{currentBoke.emoji}</div>
          </div>
          <p className="image-title">{currentBoke.title}</p>
          {tts.supported && (
            <div className="boke-tts">
              <button
                type="button"
                className="speak-button"
                onClick={replaySetup}
              >
                {tts.isSpeaking ? "■ 停止" : "🔊 タイトル読み上げ"}
              </button>
              <label className="auto-speak">
                <input
                  type="checkbox"
                  checked={autoSpeak}
                  onChange={(e) => setAutoSpeak(e.target.checked)}
                />
                自動でタイトル読み上げ
              </label>
            </div>
          )}
        </section>
      )}

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
                <div
                  className={
                    isMicActive
                      ? "voice-transcript active"
                      : "voice-transcript"
                  }
                >
                  {isMicActive && (
                    <span className="recording-indicator">
                      <span className="recording-dot" />
                      録音中
                    </span>
                  )}
                  <div className="voice-transcript-text">
                    {voiceText || (
                      <span className="placeholder">
                        {isMicActive
                          ? "聴いてます…ツッコんでください"
                          : "「💥 ツッコめッ！」を押すと送信、「次のお題」で新しいボケへ"}
                      </span>
                    )}
                  </div>
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
                <span className="share-label">
                  {lastSubmission.boke.kind === "image" ? "画像" : "お題"}
                </span>
                {bokeToShareSetup(lastSubmission.boke)}
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
                  openTwitterIntent(lastSubmission.boke, lastSubmission.tsukkomi)
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
            <div className="examples-block">
              <h3>💥 模範ツッコミ例</h3>
              <ul>
                {currentBoke.examples.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </div>
            <div className="examples-block tatoe">
              <h3>✨ たとえツッコミ例</h3>
              <ul>
                {currentBoke.examplesTatoe.map((ex, i) => (
                  <li key={i}>{ex}</li>
                ))}
              </ul>
            </div>
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
                    {entry.boke.kind === "image" ? (
                      <>
                        <span className="history-image-emoji">
                          {entry.boke.emoji}
                        </span>
                        {entry.boke.title}
                      </>
                    ) : (
                      entry.boke.setup
                    )}
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
                  onClick={() => openTwitterIntent(entry.boke, entry.tsukkomi)}
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

      {tts.supported && tts.voices.length > 0 && (
        <section className="settings">
          <h2>⚙ 設定</h2>
          <div className="settings-row">
            <label className="voice-select-label">読み上げの声</label>
            <select
              className="voice-select"
              value={tts.selectedVoice?.voiceURI ?? ""}
              onChange={(e) => tts.selectVoice(e.target.value)}
            >
              {tts.voices.map((v) => (
                <option key={v.voiceURI} value={v.voiceURI}>
                  {v.name}
                  {v.localService ? "（オフライン）" : "（オンライン）"}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="speak-button"
              onClick={previewVoice}
              disabled={tts.isSpeaking}
              title="この声で試し聴き"
            >
              🔉 試し聴き
            </button>
          </div>
        </section>
      )}

      {copyToast && <div className="toast">{copyToast}</div>}
    </div>
  );
}

export default App;
