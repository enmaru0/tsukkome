import type { AnyBoke } from "../data/bokes";
import { bokes } from "../data/bokes";
import { imageBokes } from "../data/imageBokes";

const DAILY_KEY = "tsukkome:daily";
const STREAK_KEY = "tsukkome:streak";

export type DailyRecord = {
  date: string;
  completed: boolean;
  tsukkomi?: string;
};

export type StreakData = {
  currentStreak: number;
  longestStreak: number;
  lastCompleted: string | null;
};

const allBokes: AnyBoke[] = [...bokes, ...imageBokes];

const pad = (n: number) => String(n).padStart(2, "0");

const dateString = (d: Date): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const todayString = (): string => dateString(new Date());

const yesterdayString = (): string => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateString(d);
};

const hashString = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h << 5) - h + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
};

export const getDailyBoke = (): AnyBoke => {
  const idx = hashString(todayString()) % allBokes.length;
  return allBokes[idx];
};

const safeJSON = <T>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
};

export const loadDaily = (): DailyRecord => {
  const today = todayString();
  if (typeof window === "undefined") {
    return { date: today, completed: false };
  }
  try {
    const raw = window.localStorage.getItem(DAILY_KEY);
    const parsed = safeJSON<DailyRecord | null>(raw, null);
    if (parsed && parsed.date === today) return parsed;
    return { date: today, completed: false };
  } catch {
    return { date: today, completed: false };
  }
};

export const loadStreak = (): StreakData => {
  if (typeof window === "undefined") {
    return { currentStreak: 0, longestStreak: 0, lastCompleted: null };
  }
  try {
    const raw = window.localStorage.getItem(STREAK_KEY);
    return safeJSON<StreakData>(raw, {
      currentStreak: 0,
      longestStreak: 0,
      lastCompleted: null,
    });
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastCompleted: null };
  }
};

const writeStreak = (data: StreakData) => {
  try {
    window.localStorage.setItem(STREAK_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
};

const writeDaily = (rec: DailyRecord) => {
  try {
    window.localStorage.setItem(DAILY_KEY, JSON.stringify(rec));
  } catch {
    // ignore
  }
};

// Refresh streak on app load: if last completion is older than yesterday, reset to 0
export const refreshStreak = (): StreakData => {
  const data = loadStreak();
  const today = todayString();
  const yesterday = yesterdayString();
  if (
    data.lastCompleted !== null &&
    data.lastCompleted !== today &&
    data.lastCompleted !== yesterday
  ) {
    const updated: StreakData = { ...data, currentStreak: 0 };
    writeStreak(updated);
    return updated;
  }
  return data;
};

export const completeDaily = (
  tsukkomi: string,
): { daily: DailyRecord; streak: StreakData } => {
  const today = todayString();
  const yesterday = yesterdayString();
  const existing = loadDaily();
  const alreadyDoneToday = existing.completed && existing.date === today;

  const dailyRec: DailyRecord = { date: today, completed: true, tsukkomi };
  writeDaily(dailyRec);

  const streak = loadStreak();
  let newCurrent = streak.currentStreak;
  if (!alreadyDoneToday) {
    if (streak.lastCompleted === yesterday) {
      newCurrent = streak.currentStreak + 1;
    } else if (streak.lastCompleted === today) {
      newCurrent = streak.currentStreak;
    } else {
      newCurrent = 1;
    }
  }
  const newStreak: StreakData = {
    currentStreak: newCurrent,
    longestStreak: Math.max(streak.longestStreak, newCurrent),
    lastCompleted: today,
  };
  writeStreak(newStreak);

  return { daily: dailyRec, streak: newStreak };
};
