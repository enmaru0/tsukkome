import { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";
import { bokes, type Boke } from "./data/bokes";
import { useSpeechRecognition } from "./hooks/useSpeechRecognition";
import { useSpeechSynthesis } from "./hooks/useSpeechSynthesis";

type InputMode = "text" | "voice";

type HistoryEntry = {
  bokeId: number;
  setup: string;
  tsukkomi: string;
  mode: InputMode;
  timestamp: number;
};

const TIME_LIMIT = 30;

const pickRandomBoke = (exclude?: number): Boke => {
  if (bokes.length === 1) return bokes[0];
  let next = bokes[Math.floor(Math.random() * bokes.length)];
  while (exclude !== undefined && next.id === exclude) {
    next = bokes[Math.floor(Math.random() * bokes.length)];
  }
  return next;
};

function App() {
  const [currentBoke, setCurrentBoke] = useState<Boke>(() => pickRandomBoke());
  const [mode, setMode] = useState<InputMode>("text");
  const [text, setText] = useState("");
  const [showExamples, setShowExamples] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [timeLeft, setTimeLeft] = useState(TIME_LIMIT);
  const [timerRunning, setTimerRunning] = useState(false);
  const [autoSpeak, setAutoSpeak] = useState(true);
  const intervalRef = useRef<number | null>(null);

  const speech = useSpeechRecognition();
  const tts = useSpeechSynthesis();

  const startTimer = () => {
    setTimeLeft(TIME_LIMIT);
    setTimerRunning(true);
  };

  useEffect(() => {
    if (autoSpeak && tts.supported) {
      tts.speak(currentBoke.setup, () => startTimer());
    } else {
      startTimer();
    }
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

  const voiceText = useMemo(
    () => (speech.transcript + " " + speech.interim).trim(),
    [speech.transcript, speech.interim],
  );

  const currentInput = mode === "text" ? text : voiceText;

  const submit = () => {
    const value = currentInput.trim();
    if (!value) return;
    setHistory((prev) => [
      {
        bokeId: currentBoke.id,
        setup: currentBoke.setup,
        tsukkomi: value,
        mode,
        timestamp: Date.now(),
      },
      ...prev,
    ]);
    setShowExamples(true);
    setTimerRunning(false);
    if (mode === "voice" && speech.isListening) {
      speech.stop();
    }
  };

  const nextBoke = () => {
    tts.cancel();
    setCurrentBoke((prev) => pickRandomBoke(prev.id));
    setText("");
    speech.reset();
    setShowExamples(false);
    setTimerRunning(false);
  };

  const replaySetup = () => {
    if (tts.isSpeaking) {
      tts.cancel();
    } else {
      tts.speak(currentBoke.setup);
    }
  };

  const toggleVoice = () => {
    if (speech.isListening) {
      speech.stop();
    } else {
      speech.start();
    }
  };

  const switchMode = (next: InputMode) => {
    if (mode === next) return;
    if (next === "text" && speech.isListening) {
      speech.stop();
    }
    setMode(next);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>ツッコミ練習</h1>
        <p className="subtitle">お題のボケに、思いついたツッコミをどうぞ</p>
      </header>

      <section className="boke-card">
        <div className="boke-meta">
          <span className="badge">お題 #{currentBoke.id}</span>
          <span className={`timer ${timeLeft <= 5 && timerRunning ? "timer-warn" : ""}`}>
            {tts.isSpeaking
              ? "読み上げ中…"
              : timerRunning
                ? `残り ${timeLeft}秒`
                : timeLeft === 0
                  ? "時間切れ"
                  : "準備中"}
          </span>
        </div>
        <p className="boke-setup">{currentBoke.setup}</p>
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
            className={mode === "text" ? "tab active" : "tab"}
            onClick={() => switchMode("text")}
          >
            ⌨ テキスト入力
          </button>
          <button
            type="button"
            className={mode === "voice" ? "tab active" : "tab"}
            onClick={() => switchMode("voice")}
            disabled={!speech.supported}
            title={speech.supported ? "" : "このブラウザは音声入力に対応していません"}
          >
            🎤 音声入力
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
                submit();
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
                  className={speech.isListening ? "mic-button listening" : "mic-button"}
                  onClick={toggleVoice}
                >
                  {speech.isListening ? "● 録音中（タップで停止）" : "🎤 マイクをオン"}
                </button>
                <div className="voice-transcript">
                  {voiceText || (
                    <span className="placeholder">マイクをオンにして、声でツッコんでください</span>
                  )}
                </div>
                {speech.error && <p className="voice-error">エラー: {speech.error}</p>}
              </>
            )}
          </div>
        )}

        <div className="actions">
          <button
            type="button"
            className="primary"
            onClick={submit}
            disabled={!currentInput.trim()}
          >
            ツッコむ！
          </button>
          <button type="button" className="secondary" onClick={nextBoke}>
            次のお題 →
          </button>
        </div>

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
          <h2>練習履歴</h2>
          <ul>
            {history.map((entry, i) => (
              <li key={`${entry.timestamp}-${i}`} className="history-item">
                <div className="history-setup">
                  <span className="history-mode">
                    {entry.mode === "text" ? "⌨" : "🎤"}
                  </span>
                  {entry.setup}
                </div>
                <div className="history-tsukkomi">→ {entry.tsukkomi}</div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

export default App;
