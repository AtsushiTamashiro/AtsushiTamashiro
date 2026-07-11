/**
 * 青年会マスタデータ
 * baseLat / baseLng は各字(あざ)のおおよその位置。
 * 実際の道ジュネー現在地は報告データで上書きされ、ここは初期表示にのみ使う。
 * 青年会の追加・修正はこの配列を編集する。
 */
const KAI_LIST = [
  // 沖縄市
  { id: "sonda",      name: "園田青年会",   region: "沖縄市",   baseLat: 26.3346, baseLng: 127.8090 },
  { id: "goeku",      name: "越来青年会",   region: "沖縄市",   baseLat: 26.3438, baseLng: 127.7998 },
  { id: "yamazato",   name: "山里青年会",   region: "沖縄市",   baseLat: 26.3271, baseLng: 127.7871 },
  { id: "moromizato", name: "諸見里青年会", region: "沖縄市",   baseLat: 26.3222, baseLng: 127.7925 },
  { id: "kubota",     name: "久保田青年会", region: "沖縄市",   baseLat: 26.3178, baseLng: 127.7950 },
  { id: "murokawa",   name: "室川青年会",   region: "沖縄市",   baseLat: 26.3405, baseLng: 127.8123 },

  // うるま市
  { id: "heshikiya",  name: "平敷屋青年会", region: "うるま市", baseLat: 26.3122, baseLng: 127.8950 },
  { id: "yakena",     name: "屋慶名青年会", region: "うるま市", baseLat: 26.3712, baseLng: 127.9730 },
  { id: "agena",      name: "安慶名青年会", region: "うるま市", baseLat: 26.3792, baseLng: 127.8570 },
  { id: "taba",       name: "田場青年会",   region: "うるま市", baseLat: 26.3720, baseLng: 127.8500 },
  { id: "akano",      name: "赤野青年会",   region: "うるま市", baseLat: 26.3660, baseLng: 127.8330 },

  // 那覇市・南部
  { id: "kokuba",     name: "国場青年会",   region: "那覇市・南部", baseLat: 26.1963, baseLng: 127.6940 },
  { id: "teratcho",   name: "汀良町青年会", region: "那覇市・南部", baseLat: 26.2220, baseLng: 127.7270 },

  // 浦添市・宜野湾市
  { id: "uchima",     name: "内間青年会",   region: "浦添市・宜野湾市", baseLat: 26.2520, baseLng: 127.7200 },
  { id: "isahama",    name: "伊佐浜青年会", region: "浦添市・宜野湾市", baseLat: 26.2810, baseLng: 127.7440 },
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

/** 地図の初期表示(沖縄本島中部) */
const MAP_DEFAULT = { lat: 26.32, lng: 127.81, zoom: 12 };
