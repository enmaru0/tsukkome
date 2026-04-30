import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { bokes, type AnyBoke } from "./data/bokes";
import {
  CATEGORIES,
  DIFFICULTIES,
  categoryLabel,
  difficultyLabel,
  type BokeCategory,
  type BokeDifficulty,
} from "./data/categories";
import { imageBokes } from "./data/imageBokes";
import { useAudioRecorder } from "./hooks/useAudioRecorder";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";
import type { InputMode } from "./types";
import { generateVideo, isVideoSupported } from "./utils/generateVideo";
import {
  loadAllEntries,
  saveEntry,
  type StoredEntry,
} from "./utils/storage";

type Phase = "start" | "text" | "image";

type HistoryEntry = {
  boke: AnyBoke;
  tsukkomi: string;
  mode: InputMode;
  audioUrl: string | null;
  audioMime: string | null;
  audioBlob: Blob | null;
  timestamp: number;
};

const TIME_LIMIT = 30;
const SITE_URL = "https://tsukkome.vercel.app/";
const HASHTAG = "ツッコめッ";

type FilterableBoke = {
  id: number;
  category: BokeCategory;
  difficulty: BokeDifficulty;
};

type Filters = {
  category: BokeCategory | "all";
  difficulty: BokeDifficulty | "all";
};

const FILTERS_KEY = "tsukkome:filters";

const loadFilters = (): Filters => {
  if (typeof window === "undefined") return { category: "all", difficulty: "all" };
  try {
    const raw = window.localStorage.getItem(FILTERS_KEY);
    if (!raw) return { category: "all", difficulty: "all" };
    const parsed = JSON.parse(raw);
    return {
      category: parsed.category ?? "all",
      difficulty: parsed.difficulty ?? "all",
    };
  } catch {
    return { category: "all", difficulty: "all" };
  }
};

const saveFilters = (f: Filters) => {
  try {
    window.localStorage.setItem(FILTERS_KEY, JSON.stringify(f));
  } catch {
    // ignore
  }
};

const applyFilters = <T extends FilterableBoke>(list: T[], f: Filters): T[] => {
  return list.filter(
    (b) =>
      (f.category === "all" || b.category === f.category) &&
      (f.difficulty === "all" || b.difficulty === f.difficulty),
  );
};

const pickRandom = <T extends { id: number }>(list: T[], excludeId?: number): T => {
  if (list.length === 0) throw new Error("empty list");
  if (list.length === 1) return list[0];
  let next = list[Math.floor(Math.random() * list.length)];
  while (excludeId !== undefined && next.id === excludeId) {
    next = list[Math.floor(Math.random() * list.length)];
  }
  return next;
};

const pickFiltered = <T extends FilterableBoke>(
  list: T[],
  filters: Filters,
  excludeId?: number,
): T => {
  const filtered = applyFilters(list, filters);
  if (filtered.length === 0) {
    // fall back to whole list if filter yields nothing
    return pickRandom(list, excludeId);
  }
  return pickRandom(filtered, excludeId);
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
  const [historyLoaded, setHistoryLoaded] = useState(false);
  const [filters, setFiltersState] = useState<Filters>(() => loadFilters());

  const setFilters = (f: Filters) => {
    setFiltersState(f);
    saveFilters(f);
  };

  const filteredCounts = useMemo(
    () => ({
      text: applyFilters(bokes, filters).length,
      image: applyFilters(imageBokes, filters).length,
    }),
    [filters],
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
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoProgress, setVideoProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const modeRef = useRef<InputMode>("voice");
  const canNativeShare =
    typeof navigator !== "undefined" && typeof navigator.share === "function";
  const canMakeVideo = isVideoSupported();

  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();
  const recorder = useAudioRecorder();

  useEffect(() => {
    modeRef.current = mode;
  }, [mode]);

  useEffect(() => {
    let alive = true;
    loadAllEntries().then((stored: StoredEntry[]) => {
      if (!alive) return;
      const entries: HistoryEntry[] = stored.map((s) => ({
        boke: s.boke,
        tsukkomi: s.tsukkomi,
        mode: s.mode,
        audioBlob: s.audioBlob,
        audioMime: s.audioMime,
        audioUrl: s.audioBlob ? URL.createObjectURL(s.audioBlob) : null,
        timestamp: s.timestamp,
      }));
      setHistory(entries);
      setHistoryLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

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
      next === "text"
        ? pickFiltered(bokes, filters)
        : pickFiltered(imageBokes, filters);
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
    let audioBlob: Blob | null = null;
    if (mode === "voice") {
      if (speech.isListening) speech.stop();
      const result = await recorder.stop();
      if (result) {
        audioUrl = result.url;
        audioMime = result.mimeType;
        audioBlob = result.blob;
      }
    }

    const timestamp = Date.now();
    const entry: HistoryEntry = {
      boke: currentBoke,
      tsukkomi: value,
      mode,
      audioUrl,
      audioMime,
      audioBlob,
      timestamp,
    };
    setHistory((prev) => [entry, ...prev]);
    setLastSubmission(entry);
    setShowExamples(true);
    setTimerRunning(false);

    void saveEntry({
      timestamp,
      boke: currentBoke,
      tsukkomi: value,
      mode,
      audioBlob,
      audioMime,
    });
  };

  const nextBoke = () => {
    tts.cancel();
    if (speech.isListening) speech.stop();
    recorder.cancel();
    setCurrentBoke((prev) =>
      phase === "image"
        ? pickFiltered(imageBokes, filters, prev.id)
        : pickFiltered(bokes, filters, prev.id),
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

  const handleVideoTweet = async (entry: HistoryEntry) => {
    if (!entry.audioUrl || videoBusy) return;
    setVideoBusy(true);
    setVideoProgress(0);
    try {
      const result = await generateVideo({
        audioUrl: entry.audioUrl,
        boke: entry.boke,
        tsukkomi: entry.tsukkomi,
        onProgress: (p) => setVideoProgress(p),
      });
      const url = URL.createObjectURL(result.blob);
      const date = new Date(entry.timestamp);
      const ts = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}${String(date.getDate()).padStart(2, "0")}_${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}${String(date.getSeconds()).padStart(2, "0")}`;
      const a = document.createElement("a");
      a.href = url;
      a.download = `tsukkome_${ts}.${result.ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
      window.setTimeout(() => {
        openTwitterIntent(entry.boke, entry.tsukkomi);
        setCopyToast("動画ダウンロード完了！ツイート画面で添付してください");
      }, 400);
    } catch (e) {
      console.error("[video]", e);
      setCopyToast(
        e instanceof Error ? `動画生成失敗: ${e.message}` : "動画生成に失敗しました",
      );
    } finally {
      setVideoBusy(false);
      setVideoProgress(0);
    }
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
              disabled={filteredCounts.text === 0}
              title={
                filteredCounts.text === 0
                  ? "現在のフィルタに該当するお題がありません"
                  : ""
              }
            >
              <div className="start-button-emoji">💬</div>
              <div className="start-button-title">通常モード</div>
              <div className="start-button-desc">
                文字のお題にツッコむ（{filteredCounts.text}）
              </div>
            </button>
            <button
              type="button"
              className="start-button image-mode"
              onClick={() => startMode("image")}
              disabled={filteredCounts.image === 0}
              title={
                filteredCounts.image === 0
                  ? "現在のフィルタに該当するお題がありません"
                  : ""
              }
            >
              <div className="start-button-emoji">📷</div>
              <div className="start-button-title">画像モード</div>
              <div className="start-button-desc">
                絵のお題にツッコむ（{filteredCounts.image}）
              </div>
            </button>
          </div>

          <div className="filter-panel">
            <div className="filter-row">
              <label htmlFor="f-difficulty">難易度</label>
              <select
                id="f-difficulty"
                value={filters.difficulty}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    difficulty: e.target.value as BokeDifficulty | "all",
                  })
                }
              >
                <option value="all">全て</option>
                {DIFFICULTIES.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="filter-row">
              <label htmlFor="f-category">カテゴリ</label>
              <select
                id="f-category"
                value={filters.category}
                onChange={(e) =>
                  setFilters({
                    ...filters,
                    category: e.target.value as BokeCategory | "all",
                  })
                }
              >
                <option value="all">全て</option>
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.emoji} {c.label}
                  </option>
                ))}
              </select>
            </div>
            {(filters.category !== "all" || filters.difficulty !== "all") && (
              <button
                type="button"
                className="filter-reset"
                onClick={() =>
                  setFilters({ category: "all", difficulty: "all" })
                }
              >
                フィルタをクリア
              </button>
            )}
          </div>

          <p className="start-note">
            初回はマイクの許可ダイアログが出ます。「許可」を押してください。
            {historyLoaded && history.length > 0 && (
              <>
                <br />
                ツッコミ履歴は端末に保存されています（{history.length}件）。
              </>
            )}
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
          <div className="boke-tags">
            <span className={`tag difficulty d-${currentBoke.difficulty}`}>
              {difficultyLabel(currentBoke.difficulty)}
            </span>
            <span className="tag category">
              {categoryLabel(currentBoke.category)}
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
          <div className="boke-tags">
            <span className={`tag difficulty d-${currentBoke.difficulty}`}>
              {difficultyLabel(currentBoke.difficulty)}
            </span>
            <span className="tag category">
              {categoryLabel(currentBoke.category)}
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
            {lastSubmission.audioUrl && canMakeVideo && (
              <button
                type="button"
                className="share-button video"
                onClick={() => void handleVideoTweet(lastSubmission)}
                disabled={videoBusy}
              >
                {videoBusy
                  ? `🎬 動画作成中… ${Math.round(videoProgress * 100)}%`
                  : "🎬 動画にしてツイート（音声付き）"}
              </button>
            )}
            {lastSubmission.audioUrl && canMakeVideo && (
              <p className="video-help">
                生成された動画を、開いたツイート画面に
                <strong>ドラッグ＆ドロップで添付</strong>してください。
              </p>
            )}
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
