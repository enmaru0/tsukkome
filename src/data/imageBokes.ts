export type ImageBoke = {
  kind: "image";
  id: number;
  emoji: string;
  title: string;
  examples: string[];
  examplesTatoe: string[];
};

export const imageBokes: ImageBoke[] = [
  {
    kind: "image",
    id: 1,
    emoji: "🐘🏠",
    title: "朝の訪問者",
    examples: ["象が訪問してくるかい！", "どこから来たんや！"],
    examplesTatoe: [
      "サファリパークの営業マンか！",
      "朝刊配達の新人かお前は！",
    ],
  },
  {
    kind: "image",
    id: 2,
    emoji: "🍜🚿",
    title: "怪しいシャワー",
    examples: ["シャワーから麺出るかい！", "配管料理屋になっとるで！"],
    examplesTatoe: [
      "銭湯の裏メニューか！",
      "湯船がラーメン屋かお前の家は！",
    ],
  },
  {
    kind: "image",
    id: 3,
    emoji: "🦖📞",
    title: "白亜紀からの着信",
    examples: ["恐竜電話すんな！", "絶滅したんちゃうんかい！"],
    examplesTatoe: [
      "時代錯誤の営業電話か！",
      "化石界のセールスマンかお前は！",
    ],
  },
  {
    kind: "image",
    id: 4,
    emoji: "🐟👑",
    title: "深海の王様",
    examples: ["魚が王様気取るな！", "海底で何治めてんねん！"],
    examplesTatoe: [
      "水中独裁国家の君主か！",
      "深海の戴冠式の主役かお前は！",
    ],
  },
  {
    kind: "image",
    id: 5,
    emoji: "🐧☂️",
    title: "雨具ペンギン",
    examples: ["ペンギン濡れへんやろ！", "南極に傘いらんわ！"],
    examplesTatoe: [
      "紳士気取りの水鳥か！",
      "お天気に敏感すぎる南極住民かお前は！",
    ],
  },
  {
    kind: "image",
    id: 6,
    emoji: "🍕🚗",
    title: "疾走するピザ",
    examples: ["それピザやないか！", "なんで車輪付いてんねん！"],
    examplesTatoe: [
      "配達業界の究極形態か！",
      "自走式イタリアンかお前は！",
    ],
  },
  {
    kind: "image",
    id: 7,
    emoji: "🦒🚴",
    title: "サイクリングキリン",
    examples: ["キリン自転車乗れるかい！", "首ぶつけるやろ！"],
    examplesTatoe: [
      "サバンナのツール・ド・フランス出場者か！",
      "オリンピック強化選手の哺乳類かお前は！",
    ],
  },
  {
    kind: "image",
    id: 8,
    emoji: "🌭🎩",
    title: "紳士なホットドッグ",
    examples: ["食べ物に帽子いらんやろ！", "どこのジェントルマンやねん！"],
    examplesTatoe: [
      "貴族階級の軽食か！",
      "社交界デビュー中のソーセージかお前は！",
    ],
  },
  {
    kind: "image",
    id: 9,
    emoji: "🐌🚀",
    title: "急ぎのカタツムリ",
    examples: ["カタツムリにロケットいらんやろ！", "殻吹っ飛ぶわ！"],
    examplesTatoe: [
      "世界最速のカタツムリか！",
      "NASA 実験対象の軟体動物かお前は！",
    ],
  },
  {
    kind: "image",
    id: 10,
    emoji: "🍔👁️",
    title: "見つめるハンバーガー",
    examples: ["バーガーに目ついとる！", "食いにくいわ！"],
    examplesTatoe: [
      "客を審査するファストフードか！",
      "マクドナルドの監視役かお前は！",
    ],
  },
  {
    kind: "image",
    id: 11,
    emoji: "🐼🎤",
    title: "熱唱するパンダ",
    examples: ["パンダ歌うんかい！", "何歌っとんねん！"],
    examplesTatoe: [
      "上野動物園発の演歌歌手か！",
      "紅白出場狙いの絶滅危惧種かお前は！",
    ],
  },
  {
    kind: "image",
    id: 12,
    emoji: "🌵👠",
    title: "オシャレサボテン",
    examples: ["サボテンにヒール似合わんやろ！", "歩けるんかそれ！"],
    examplesTatoe: [
      "パリコレ出場の植物か！",
      "ファッション業界の新星サボテンかお前は！",
    ],
  },
  {
    kind: "image",
    id: 13,
    emoji: "🦑📚",
    title: "読書家のイカ",
    examples: ["イカ本読むかい！", "墨でページ汚すやろ！"],
    examplesTatoe: [
      "海底図書館の常連か！",
      "東大受験狙いの軟体動物かお前は！",
    ],
  },
  {
    kind: "image",
    id: 14,
    emoji: "🍄💪",
    title: "鍛えるキノコ",
    examples: ["キノコ鍛えてどうすんねん！", "菌類が筋肉つけるな！"],
    examplesTatoe: [
      "森のボディビルダーか！",
      "マッチョ界の新星キノコかお前は！",
    ],
  },
  {
    kind: "image",
    id: 15,
    emoji: "🐨📱",
    title: "スマホ中のコアラ",
    examples: ["コアラがスマホ触るな！", "木から落ちるで！"],
    examplesTatoe: [
      "オーストラリア発 TikToker か！",
      "Z世代の有袋類かお前は！",
    ],
  },
  {
    kind: "image",
    id: 16,
    emoji: "🦆🎸",
    title: "ギター弾きアヒル",
    examples: ["アヒル指ないやろ！", "コード押されへんわ！"],
    examplesTatoe: [
      "グラミー賞狙いの水鳥か！",
      "ロック界の新人アヒルかお前は！",
    ],
  },
  {
    kind: "image",
    id: 17,
    emoji: "🍩🕶️",
    title: "セレブなドーナツ",
    examples: ["ドーナツに顔ないやろ！", "穴から覗いとるんか！"],
    examplesTatoe: [
      "パパラッチから逃げる菓子か！",
      "ハリウッド進出狙いのドーナツかお前は！",
    ],
  },
  {
    kind: "image",
    id: 18,
    emoji: "🐙👨‍🍳",
    title: "料理するタコ",
    examples: ["タコが料理するかい！", "仲間売るんか！"],
    examplesTatoe: [
      "海底レストランのシェフか！",
      "8本足で鉄板焼きする職人かお前は！",
    ],
  },
  {
    kind: "image",
    id: 19,
    emoji: "🌮🎹",
    title: "演奏タコス",
    examples: ["タコスに手ないやろ！", "音楽かぶれすぎや！"],
    examplesTatoe: [
      "メキシコ料理界のマエストロか！",
      "ショパンの生まれ変わりの軽食かお前は！",
    ],
  },
  {
    kind: "image",
    id: 20,
    emoji: "🐸💒",
    title: "カエルの結婚式",
    examples: ["カエル結婚すんな！", "相手誰やねん！"],
    examplesTatoe: [
      "両生類界の大イベントか！",
      "水辺で愛を誓う新郎新婦かお前は！",
    ],
  },
];
