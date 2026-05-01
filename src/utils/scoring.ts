import type { AnyBoke } from "../data/bokes";

export type ScoreAxis = {
  score: number; // 0..100
  detail?: string;
};

export type ScoreCard = {
  total: number; // 0..100
  rank: "S" | "A" | "B" | "C" | "D";
  speed: ScoreAxis;
  kire: ScoreAxis;
  tempo: ScoreAxis;
  originality: ScoreAxis;
  comment: string;
  reactionMs: number; // 入りまでの時間
  completionMs: number; // 完了までの時間
};

export type ScoringInput = {
  tsukkomi: string;
  boke: AnyBoke;
  reactionMs: number;
  completionMs: number;
  /** 喋った/打った時間。voice なら audioDuration、text なら completion - reaction */
  speakingMs: number;
  hasAudio: boolean;
};

// ===== 速さ =====

const reactionScore = (ms: number): number => {
  const s = ms / 1000;
  if (s < 0.8) return 100;
  if (s < 1.5) return 95;
  if (s < 2.5) return 88;
  if (s < 4) return 75;
  if (s < 7) return 60;
  if (s < 12) return 45;
  if (s < 20) return 30;
  return 20;
};

const completionScore = (ms: number): number => {
  const s = ms / 1000;
  if (s < 3) return 100;
  if (s < 5) return 92;
  if (s < 8) return 80;
  if (s < 12) return 65;
  if (s < 20) return 45;
  if (s < 30) return 30;
  return 20;
};

const speedAxis = (reactionMs: number, completionMs: number): ScoreAxis => {
  const r = reactionScore(reactionMs);
  const c = completionScore(completionMs);
  // 入り 40% + 完了 60%
  const score = Math.round(r * 0.4 + c * 0.6);
  return {
    score,
    detail: `入り ${(reactionMs / 1000).toFixed(1)}秒 / 完了 ${(completionMs / 1000).toFixed(1)}秒`,
  };
};

// ===== キレ =====

const KANSAI_MARKERS = [
  "やん",
  "やろ",
  "ねん",
  "やわ",
  "ちゃう",
  "あかん",
  "おる",
  "しとる",
  "せや",
  "ほな",
  "やで",
  "なんで",
  "あんた",
  "ええ",
  "ホンマ",
  "ほんま",
];

const PATTERN_RULES: { re: RegExp; bonus: number }[] = [
  { re: /[ぁ-んァ-ヴ一-龥a-zA-Z0-9]+かお前は[！!]/, bonus: 14 },
  { re: /[ぁ-んァ-ヴ一-龥a-zA-Z0-9ー]+か[！!]$/, bonus: 12 },
  { re: /^なんで.+(ねん|や|の)[！!]?$/, bonus: 12 },
  { re: /やない(か|わ)[！!]?$/, bonus: 10 },
  { re: /すぎ(や|るやろ|るわ)?[！!]?/, bonus: 8 },
  { re: /ちゃう(やろ|わ|ねん)?[！!]?/, bonus: 6 },
  { re: /[！!]$/, bonus: 8 },
];

const lengthBonus = (len: number): number => {
  if (len < 3) return 5;
  if (len < 6) return 16;
  if (len <= 25) return 30;
  if (len <= 35) return 24;
  if (len <= 45) return 16;
  return 8;
};

const patternBonus = (text: string): number => {
  let total = 0;
  for (const rule of PATTERN_RULES) {
    if (rule.re.test(text)) total += rule.bonus;
  }
  return Math.min(total, 40);
};

const energyBonus = (text: string): number => {
  let count = 0;
  for (const m of KANSAI_MARKERS) {
    if (text.includes(m)) count += 1;
  }
  if (count === 0) return 5;
  if (count === 1) return 14;
  if (count === 2) return 22;
  return 30;
};

const kireAxis = (text: string): ScoreAxis => {
  const len = text.length;
  const score = Math.min(
    100,
    lengthBonus(len) + patternBonus(text) + energyBonus(text),
  );
  return { score };
};

// ===== テンポ =====

const tempoAxis = (
  chars: number,
  speakingMs: number,
  hasAudio: boolean,
): ScoreAxis => {
  if (chars === 0 || speakingMs < 100) {
    return { score: 50, detail: "—" };
  }
  const cps = chars / (speakingMs / 1000);
  // Sweet spot: 4-7 chars/sec for voice, 3-6 for text typing
  const lo = hasAudio ? 4 : 3;
  const hi = hasAudio ? 8 : 7;
  let score: number;
  if (cps >= lo && cps <= hi) score = 100;
  else if (cps >= lo - 1 && cps <= hi + 2) score = 80;
  else if (cps >= lo - 2 && cps <= hi + 4) score = 60;
  else if (cps >= 1) score = 40;
  else score = 25;
  return {
    score,
    detail: `${cps.toFixed(1)} 字/秒`,
  };
};

// ===== 個性 =====

const ngrams = (s: string, n: number): Set<string> => {
  const set = new Set<string>();
  for (let i = 0; i <= s.length - n; i++) {
    set.add(s.substring(i, i + n));
  }
  return set;
};

const jaccard = (a: Set<string>, b: Set<string>): number => {
  if (a.size === 0 || b.size === 0) return 0;
  let inter = 0;
  for (const x of a) if (b.has(x)) inter += 1;
  const uni = a.size + b.size - inter;
  return uni === 0 ? 0 : inter / uni;
};

const similarity = (a: string, b: string): number => {
  if (a.length < 2 || b.length < 2) return a === b ? 1 : 0;
  return jaccard(ngrams(a, 2), ngrams(b, 2));
};

const originalityAxis = (text: string, boke: AnyBoke): ScoreAxis => {
  const examples = [...boke.examples, ...boke.examplesTatoe];
  if (examples.length === 0) return { score: 70 };
  let maxSim = 0;
  for (const ex of examples) {
    const sim = similarity(text, ex);
    if (sim > maxSim) maxSim = sim;
  }
  let score: number;
  if (maxSim >= 0.85) score = 25;
  else if (maxSim >= 0.65) score = 55;
  else if (maxSim >= 0.4) score = 95;
  else if (maxSim >= 0.2) score = 85;
  else score = 70;
  return {
    score,
    detail:
      maxSim >= 0.85
        ? "模範例とほぼ同じ"
        : maxSim >= 0.4
          ? "型を踏まえつつ独自路線"
          : "独自路線",
  };
};

// ===== Total =====

const rankFor = (total: number): "S" | "A" | "B" | "C" | "D" => {
  if (total >= 90) return "S";
  if (total >= 78) return "A";
  if (total >= 65) return "B";
  if (total >= 50) return "C";
  return "D";
};

const headlineFor = (total: number): string => {
  if (total >= 90) return "これ M-1 出れるやん！";
  if (total >= 80) return "ええツッコミ！センスあるな";
  if (total >= 70) return "悪くないで！";
  if (total >= 60) return "もうちょい突っ込めるで";
  if (total >= 50) return "もうちょい型を意識しよ";
  return "もっと修行せえ！";
};

const detectFlavor = (text: string): string[] => {
  const lines: string[] = [];
  if (/かお前は[！!]?$/.test(text)) lines.push("「お前は」型の決め言葉、効いとる");
  else if (/[ぁ-んァ-ヴ一-龥]+か[！!]$/.test(text))
    lines.push("たとえツッコミ型キレッキレ");
  else if (/^なんで.+(ねん|や|の)[！!]?$/.test(text))
    lines.push("ど直球のツッコミ！");
  else if (/すぎ/.test(text)) lines.push("「すぎ」系で誇張効いとる");
  else if (/やない(か|わ)/.test(text)) lines.push("関西人すぎるやろ！");

  if (/[0-9０-９]+/.test(text)) lines.push("数字使うた誇張、ええセンス");
  return lines;
};

const detectWeakness = (card: Omit<ScoreCard, "comment" | "rank">): string | null => {
  const items: { axis: keyof typeof axes; score: number }[] = [];
  const axes = {
    speed: card.speed.score,
    kire: card.kire.score,
    tempo: card.tempo.score,
    originality: card.originality.score,
  } as const;
  for (const k of Object.keys(axes) as (keyof typeof axes)[]) {
    items.push({ axis: k, score: axes[k] });
  }
  items.sort((a, b) => a.score - b.score);
  const lowest = items[0];
  if (lowest.score >= 65) return null;
  switch (lowest.axis) {
    case "speed":
      return "（次は反射神経も意識して）";
    case "kire":
      return "（もうちょい型 — 「〇〇か！」とか — を意識すると締まる）";
    case "tempo":
      return "（一呼吸でキメるとカッコいい）";
    case "originality":
      return "（次は違う角度から攻めてみよ）";
  }
};

const generateComment = (
  text: string,
  card: Omit<ScoreCard, "comment" | "rank">,
): string => {
  const head = headlineFor(card.total);
  const flavor = detectFlavor(text);
  const weak = detectWeakness(card);
  const parts = [head, ...flavor];
  if (weak) parts.push(weak);
  return parts.slice(0, 3).join("\n");
};

// ===== Public API =====

export const computeScoreCard = (input: ScoringInput): ScoreCard => {
  const { tsukkomi, boke, reactionMs, completionMs, speakingMs, hasAudio } =
    input;

  const speed = speedAxis(reactionMs, completionMs);
  const kire = kireAxis(tsukkomi);
  const tempo = tempoAxis(tsukkomi.length, speakingMs, hasAudio);
  const originality = originalityAxis(tsukkomi, boke);

  const total = Math.round(
    speed.score * 0.25 +
      kire.score * 0.3 +
      tempo.score * 0.2 +
      originality.score * 0.25,
  );

  const partial = {
    total,
    speed,
    kire,
    tempo,
    originality,
    reactionMs,
    completionMs,
  };

  return {
    ...partial,
    rank: rankFor(total),
    comment: generateComment(tsukkomi, partial),
  };
};

export const stars = (score: number): string => {
  // 5段階の★表示
  const filled = Math.round(score / 20);
  return "★".repeat(filled) + "☆".repeat(Math.max(0, 5 - filled));
};
