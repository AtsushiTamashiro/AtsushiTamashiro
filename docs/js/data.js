/**
 * 青年会マスタデータ(読谷村)
 * baseLat / baseLng は各字(あざ)のおおよその位置(公民館周辺を想定した概算値)。
 * 実際の道ジュネー現在地は報告データで上書きされ、ここは初期表示にのみ使う。
 * 青年会の追加・座標の修正はこの配列を編集する。
 */
const KAI_LIST = [
  // 北部(残波・長浜方面)
  { id: "tokeshi",   name: "渡慶次青年会", region: "読谷村北部", baseLat: 26.4180, baseLng: 127.7195 },
  { id: "gima",      name: "儀間青年会",   region: "読谷村北部", baseLat: 26.4225, baseLng: 127.7160 },
  { id: "uza",       name: "宇座青年会",   region: "読谷村北部", baseLat: 26.4290, baseLng: 127.7180 },
  { id: "senaha",    name: "瀬名波青年会", region: "読谷村北部", baseLat: 26.4230, baseLng: 127.7280 },
  { id: "nagahama",  name: "長浜青年会",   region: "読谷村北部", baseLat: 26.4300, baseLng: 127.7330 },

  // 中部(波平・喜名・座喜味方面)
  { id: "namihira",  name: "波平青年会",   region: "読谷村中部", baseLat: 26.3970, baseLng: 127.7290 },
  { id: "takashiho", name: "高志保青年会", region: "読谷村中部", baseLat: 26.4105, baseLng: 127.7230 },
  { id: "toya",      name: "都屋青年会",   region: "読谷村中部", baseLat: 26.3900, baseLng: 127.7270 },
  { id: "zakimi",    name: "座喜味青年会", region: "読谷村中部", baseLat: 26.4075, baseLng: 127.7415 },
  { id: "kina",      name: "喜名青年会",   region: "読谷村中部", baseLat: 26.4090, baseLng: 127.7500 },
  { id: "oyashi",    name: "親志青年会",   region: "読谷村中部", baseLat: 26.4180, baseLng: 127.7560 },

  // 南部(楚辺・古堅方面)
  { id: "sobe",      name: "楚辺青年会",   region: "読谷村南部", baseLat: 26.3810, baseLng: 127.7350 },
  { id: "ooki",      name: "大木青年会",   region: "読谷村南部", baseLat: 26.3860, baseLng: 127.7450 },
  { id: "iramina",   name: "伊良皆青年会", region: "読谷村南部", baseLat: 26.3880, baseLng: 127.7520 },
  { id: "oowan",     name: "大湾青年会",   region: "読谷村南部", baseLat: 26.3730, baseLng: 127.7440 },
  { id: "furugen",   name: "古堅青年会",   region: "読谷村南部", baseLat: 26.3690, baseLng: 127.7480 },
  { id: "hija",      name: "比謝青年会",   region: "読谷村南部", baseLat: 26.3670, baseLng: 127.7400 },
  { id: "toguchi",   name: "渡具知青年会", region: "読谷村南部", baseLat: 26.3620, baseLng: 127.7380 },
];

/** 報告状況の定義 */
const STATUS_DEF = {
  parading:  { label: "道ジュネー中", emoji: "🥁" },
  preparing: { label: "準備中",       emoji: "🏮" },
  resting:   { label: "休憩中",       emoji: "🍵" },
  finished:  { label: "本日終了",     emoji: "🌙" },
};

/**
 * 旧盆の日程(旧暦7月13日〜15日)。毎年ここを更新する。
 * 2026年の旧盆: 8/25(ウンケー)・8/26(ナカビ)・8/27(ウークイ)
 */
const KYUBON_DAYS = [
  { date: "2026-08-25", label: "ウンケー(お迎え)" },
  { date: "2026-08-26", label: "ナカビ(中日)" },
  { date: "2026-08-27", label: "ウークイ(お送り)" },
];

/** 位置報告がこの時間(分)を超えて古い場合、マーカーをグレー表示にする */
const STALE_MINUTES = 60;

/** 地図の初期表示(読谷村役場周辺) */
const MAP_DEFAULT = { lat: 26.3965, lng: 127.7375, zoom: 13 };
