export type BokeCategory =
  | "daily"
  | "food"
  | "animal"
  | "family"
  | "school"
  | "work"
  | "travel"
  | "sports"
  | "fantasy"
  | "money";

export type BokeDifficulty = "easy" | "medium" | "hard";

export const CATEGORIES: { id: BokeCategory; label: string; emoji: string }[] = [
  { id: "daily", label: "日常・生活", emoji: "🏠" },
  { id: "food", label: "食べ物", emoji: "🍜" },
  { id: "animal", label: "動物", emoji: "🐶" },
  { id: "family", label: "家族", emoji: "👨‍👩‍👧" },
  { id: "school", label: "学校", emoji: "🎒" },
  { id: "work", label: "仕事・お店", emoji: "💼" },
  { id: "travel", label: "旅行・乗り物", emoji: "🚆" },
  { id: "sports", label: "スポーツ", emoji: "⚽" },
  { id: "fantasy", label: "ファンタジー", emoji: "🛸" },
  { id: "money", label: "お金", emoji: "💰" },
];

export const DIFFICULTIES: { id: BokeDifficulty; label: string }[] = [
  { id: "easy", label: "初級" },
  { id: "medium", label: "中級" },
  { id: "hard", label: "上級" },
];

export const categoryLabel = (id: BokeCategory): string =>
  CATEGORIES.find((c) => c.id === id)?.label ?? id;

export const difficultyLabel = (id: BokeDifficulty): string =>
  DIFFICULTIES.find((d) => d.id === id)?.label ?? id;
