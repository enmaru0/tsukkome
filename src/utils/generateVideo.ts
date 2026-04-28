import type { AnyBoke } from "../data/bokes";

const VIDEO_W = 1280;
const VIDEO_H = 720;
const FONT_FAMILY =
  '"Hiragino Maru Gothic ProN", "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif';

const MIME_CANDIDATES = [
  "video/mp4;codecs=avc1.42E01E,mp4a.40.2",
  "video/mp4",
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm",
];

export type VideoResult = {
  blob: Blob;
  mimeType: string;
  ext: "mp4" | "webm";
};

export type GenerateVideoOptions = {
  audioUrl: string;
  boke: AnyBoke;
  tsukkomi: string;
  onProgress?: (pct: number) => void;
};

export const isVideoSupported = (): boolean => {
  if (typeof window === "undefined") return false;
  if (!("MediaRecorder" in window)) return false;
  if (typeof HTMLCanvasElement.prototype.captureStream !== "function") {
    return false;
  }
  return MIME_CANDIDATES.some((t) => MediaRecorder.isTypeSupported(t));
};

const pickMimeType = (): string | null => {
  for (const t of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(t)) return t;
  }
  return null;
};

export const generateVideo = async (
  opts: GenerateVideoOptions,
): Promise<VideoResult> => {
  const { audioUrl, boke, tsukkomi, onProgress } = opts;
  const mimeType = pickMimeType();
  if (!mimeType) throw new Error("動画形式に対応していません");

  const audio = new Audio();
  audio.src = audioUrl;
  audio.preload = "auto";

  await new Promise<void>((resolve, reject) => {
    if (audio.readyState >= 3) return resolve();
    const onCanPlay = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(new Error("音声の読み込みに失敗"));
    };
    const cleanup = () => {
      audio.removeEventListener("canplay", onCanPlay);
      audio.removeEventListener("error", onError);
    };
    audio.addEventListener("canplay", onCanPlay);
    audio.addEventListener("error", onError);
    audio.load();
  });

  let duration = audio.duration;
  if (!Number.isFinite(duration) || duration <= 0) duration = 8;

  const canvas = document.createElement("canvas");
  canvas.width = VIDEO_W;
  canvas.height = VIDEO_H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas context が取得できません");

  drawFrame(ctx, boke, tsukkomi, 0, duration);

  const audioContext = new AudioContext();
  const source = audioContext.createMediaElementSource(audio);
  const dest = audioContext.createMediaStreamDestination();
  source.connect(dest);

  const canvasStream = canvas.captureStream(30);
  const combinedStream = new MediaStream([
    ...canvasStream.getVideoTracks(),
    ...dest.stream.getAudioTracks(),
  ]);

  const recorder = new MediaRecorder(combinedStream, {
    mimeType,
    videoBitsPerSecond: 1_800_000,
    audioBitsPerSecond: 128_000,
  });

  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };

  let rafId = 0;
  const startTime = performance.now();
  const animate = () => {
    const elapsed = (performance.now() - startTime) / 1000;
    drawFrame(ctx, boke, tsukkomi, elapsed, duration);
    onProgress?.(Math.min(elapsed / duration, 0.99));
    if (elapsed < duration + 0.3) {
      rafId = requestAnimationFrame(animate);
    }
  };

  return new Promise<VideoResult>((resolve, reject) => {
    const finish = (err?: Error) => {
      cancelAnimationFrame(rafId);
      try {
        audio.pause();
      } catch {
        // ignore
      }
      try {
        audioContext.close();
      } catch {
        // ignore
      }
      if (err) {
        reject(err);
        return;
      }
      const blob = new Blob(chunks, { type: mimeType });
      const ext: "mp4" | "webm" = mimeType.startsWith("video/mp4")
        ? "mp4"
        : "webm";
      onProgress?.(1);
      resolve({ blob, mimeType, ext });
    };

    recorder.onstop = () => finish();
    recorder.onerror = () => finish(new Error("録画エラー"));

    audio.onended = () => {
      window.setTimeout(() => {
        if (recorder.state !== "inactive") recorder.stop();
      }, 200);
    };

    try {
      recorder.start(100);
    } catch (e) {
      finish(e instanceof Error ? e : new Error("録画開始失敗"));
      return;
    }
    audio.play().catch((e) => finish(e instanceof Error ? e : new Error(String(e))));
    rafId = requestAnimationFrame(animate);
  });
};

// ===== Drawing =====

function drawFrame(
  ctx: CanvasRenderingContext2D,
  boke: AnyBoke,
  tsukkomi: string,
  elapsed: number,
  duration: number,
) {
  drawBackground(ctx);
  drawTitle(ctx, elapsed);
  drawBokeBubble(ctx, boke);
  drawTsukkomiBubble(ctx, tsukkomi, elapsed);
  drawFooter(ctx, elapsed, duration);
}

function drawBackground(ctx: CanvasRenderingContext2D) {
  const W = VIDEO_W;
  const H = VIDEO_H;

  ctx.fillStyle = "#fff5d6";
  ctx.fillRect(0, 0, W, H);

  // diagonal stripes (pink)
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.rotate(Math.PI / 4);
  ctx.fillStyle = "rgba(255, 61, 127, 0.08)";
  for (let x = -W; x < W; x += 56) {
    ctx.fillRect(x, -H, 28, 2 * H);
  }
  ctx.restore();

  // corner glows
  const g1 = ctx.createRadialGradient(
    W * 0.18,
    H * 0.18,
    0,
    W * 0.18,
    H * 0.18,
    480,
  );
  g1.addColorStop(0, "rgba(255, 61, 127, 0.32)");
  g1.addColorStop(1, "transparent");
  ctx.fillStyle = g1;
  ctx.fillRect(0, 0, W, H);

  const g2 = ctx.createRadialGradient(
    W * 0.85,
    H * 0.85,
    0,
    W * 0.85,
    H * 0.85,
    560,
  );
  g2.addColorStop(0, "rgba(255, 220, 0, 0.45)");
  g2.addColorStop(1, "transparent");
  ctx.fillStyle = g2;
  ctx.fillRect(0, 0, W, H);
}

function drawTitle(ctx: CanvasRenderingContext2D, elapsed: number) {
  const W = VIDEO_W;
  const bounce = Math.sin(elapsed * 4) * 4;
  ctx.save();
  ctx.translate(W / 2, 70 + bounce);
  ctx.rotate(-0.04);
  ctx.font = `900 64px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  // shadow layers
  ctx.fillStyle = "#ff3d7f";
  ctx.fillText("ツッコめッ！！", 9, 9);
  ctx.fillStyle = "#ffd400";
  ctx.fillText("ツッコめッ！！", 5, 5);
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText("ツッコめッ！！", 0, 0);

  ctx.restore();
}

type BubbleOpts = {
  cx: number;
  cy: number;
  width: number;
  height: number;
  fill: string;
  stroke: string;
  rotation: number;
  shadowOffset: { x: number; y: number };
  tail: "bottom-left" | "top-right" | null;
};

function drawSpeechBubble(ctx: CanvasRenderingContext2D, opts: BubbleOpts) {
  const { cx, cy, width, height, fill, stroke, rotation, shadowOffset, tail } =
    opts;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(rotation);

  const x = -width / 2;
  const y = -height / 2;
  const r = 24;

  // shadow first (drawn at offset, then bubble on top)
  drawBubblePath(ctx, x + shadowOffset.x, y + shadowOffset.y, width, height, r, tail);
  ctx.fillStyle = "#1a1a1a";
  ctx.fill();

  drawBubblePath(ctx, x, y, width, height, r, tail);
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.lineWidth = 6;
  ctx.strokeStyle = stroke;
  ctx.stroke();

  ctx.restore();
}

function drawBubblePath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  r: number,
  tail: "bottom-left" | "top-right" | null,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);

  if (tail === "top-right") {
    ctx.lineTo(x + width, y + r + 10);
    ctx.lineTo(x + width + 60, y - 28);
    ctx.lineTo(x + width, y + r + 40);
  }

  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);

  if (tail === "bottom-left") {
    ctx.lineTo(x + 100, y + height);
    ctx.lineTo(x + 50, y + height + 60);
    ctx.lineTo(x + 60, y + height);
  }

  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawBadge(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  text: string,
  fill: string,
  textColor: string,
  rotation: number,
) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.font = `900 28px ${FONT_FAMILY}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const padX = 22;
  const padY = 10;
  const metrics = ctx.measureText(text);
  const w = metrics.width + padX * 2;
  const h = 50;

  // shadow
  ctx.fillStyle = "#1a1a1a";
  roundRect(ctx, -w / 2 + 4, -h / 2 + 4, w, h, 999);
  ctx.fill();

  // body
  ctx.fillStyle = fill;
  roundRect(ctx, -w / 2, -h / 2, w, h, 999);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = "#1a1a1a";
  ctx.stroke();

  // text
  ctx.fillStyle = textColor;
  ctx.fillText(text, 0, 2);
  ctx.restore();

  void padY;
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.quadraticCurveTo(x + w, y + h, x + w - rr, y + h);
  ctx.lineTo(x + rr, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - rr);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.closePath();
}

function drawBokeBubble(ctx: CanvasRenderingContext2D, boke: AnyBoke) {
  const cx = VIDEO_W / 2;
  const cy = 240;
  const width = VIDEO_W - 200;
  const height = 200;

  drawSpeechBubble(ctx, {
    cx,
    cy,
    width,
    height,
    fill: "#ffffff",
    stroke: "#1a1a1a",
    rotation: -0.025,
    shadowOffset: { x: 7, y: 7 },
    tail: "bottom-left",
  });

  // badge
  drawBadge(
    ctx,
    cx - width / 2 + 60,
    cy - height / 2,
    "🎤 ボケ",
    "#ffd400",
    "#1a1a1a",
    -0.07,
  );

  // text
  const setupText = boke.kind === "text" ? boke.setup : `${boke.emoji}  ${boke.title}`;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.025);
  ctx.font = `700 36px ${FONT_FAMILY}`;
  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  drawWrappedText(ctx, setupText, 0, 8, width - 80, 50, 4);
  ctx.restore();
}

function drawTsukkomiBubble(
  ctx: CanvasRenderingContext2D,
  tsukkomi: string,
  elapsed: number,
) {
  const cx = VIDEO_W / 2;
  const baseY = 510;
  // pulse at the start when the tsukkomi appears
  const pulse = elapsed < 0.4 ? 1 + (0.4 - elapsed) : 1;
  const cy = baseY;
  const width = VIDEO_W - 200;
  const height = 220;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(pulse, pulse);
  ctx.translate(-cx, -cy);

  drawSpeechBubble(ctx, {
    cx,
    cy,
    width,
    height,
    fill: "#ff3d7f",
    stroke: "#1a1a1a",
    rotation: 0.025,
    shadowOffset: { x: 7, y: 7 },
    tail: "top-right",
  });

  // badge
  drawBadge(
    ctx,
    cx + width / 2 - 70,
    cy - height / 2,
    "💥 ツッコミ",
    "#1a1a1a",
    "#ffffff",
    0.07,
  );

  // text
  ctx.translate(cx, cy);
  ctx.rotate(0.025);
  ctx.font = `900 44px ${FONT_FAMILY}`;
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowOffsetX = 3;
  ctx.shadowOffsetY = 3;
  ctx.shadowBlur = 0;
  drawWrappedText(ctx, "「" + tsukkomi + "」", 0, 8, width - 80, 56, 3);
  ctx.shadowColor = "transparent";

  ctx.restore();
}

function drawFooter(
  ctx: CanvasRenderingContext2D,
  elapsed: number,
  duration: number,
) {
  const W = VIDEO_W;
  const H = VIDEO_H;

  // url
  ctx.font = `800 22px ui-monospace, monospace`;
  ctx.fillStyle = "#1a1a1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  const urlText = "tsukkome.vercel.app";
  const padX = 22;
  const metrics = ctx.measureText(urlText);
  const w = metrics.width + padX * 2;
  const h = 38;
  const y = H - 50;

  ctx.fillStyle = "#1a1a1a";
  roundRect(ctx, W / 2 - w / 2 + 3, y - h / 2 + 3, w, h, 999);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, W / 2 - w / 2, y - h / 2, w, h, 999);
  ctx.fill();
  ctx.lineWidth = 3;
  ctx.strokeStyle = "#1a1a1a";
  ctx.stroke();
  ctx.fillStyle = "#1a1a1a";
  ctx.fillText(urlText, W / 2, y);

  // progress bar
  const barH = 8;
  ctx.fillStyle = "#1a1a1a";
  ctx.fillRect(0, H - barH, W, barH);
  ctx.fillStyle = "#ff3d7f";
  ctx.fillRect(0, H - barH, W * Math.min(elapsed / duration, 1), barH);
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const lines: string[] = [];
  let current = "";
  for (const ch of text) {
    const test = current + ch;
    if (ctx.measureText(test).width > maxWidth && current.length > 0) {
      lines.push(current);
      current = ch;
      if (lines.length >= maxLines - 1) break;
    } else {
      current = test;
    }
  }
  if (current.length > 0) {
    if (lines.length >= maxLines) {
      const last = lines[maxLines - 1] ?? "";
      lines[maxLines - 1] = last.slice(0, Math.max(0, last.length - 1)) + "…";
    } else {
      lines.push(current);
    }
  }

  const totalH = (lines.length - 1) * lineHeight;
  const startY = cy - totalH / 2;
  for (let i = 0; i < lines.length; i++) {
    ctx.fillText(lines[i], cx, startY + i * lineHeight);
  }
}
