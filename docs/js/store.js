/**
 * データストア層
 *
 * - firebase-config.js が window.FIREBASE_CONFIG を定義していれば
 *   Firebase Realtime Database を使い、全ユーザー間でリアルタイム共有する。
 * - 定義がなければ localStorage を使った「デモモード」で動作する
 *   (同じ端末・ブラウザ内でのみ共有。タブ間は storage イベントで同期)。
 *
 * 公開 API:
 *   Store.init()                    -> Promise<"firebase" | "demo">
 *   Store.onReports(cb)             -> cb({ [kaiId]: report }) を購読登録(即時+更新時)
 *   Store.submitReport(kaiId, data) -> Promise<void>
 *
 * report = { lat, lng, status, comment, updatedAt(ms), trail: [{lat,lng,t}] }
 */
const Store = (() => {
  const TRAIL_MAX = 50; // 軌跡として保持する地点数の上限

  let mode = "demo";
  let db = null; // Firebase Realtime Database の参照
  const listeners = [];
  let cache = {};

  /** JST での今日の日付キー (YYYY-MM-DD)。日付ごとに報告を分ける */
  function todayKey() {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  function storageKey() {
    return "eisa-reports-" + todayKey();
  }

  function notify() {
    listeners.forEach((cb) => cb(cache));
  }

  // ---------- デモモード (localStorage) ----------

  function demoLoad() {
    try {
      cache = JSON.parse(localStorage.getItem(storageKey())) || {};
    } catch (e) {
      cache = {};
    }
    notify();
  }

  function demoSave() {
    localStorage.setItem(storageKey(), JSON.stringify(cache));
  }

  function initDemo() {
    demoLoad();
    // 他のタブでの更新を反映
    window.addEventListener("storage", (e) => {
      if (e.key === storageKey()) demoLoad();
    });
    return Promise.resolve("demo");
  }

  // ---------- Firebase モード ----------

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  async function initFirebase() {
    const V = "10.14.1";
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-app-compat.js`);
    await loadScript(`https://www.gstatic.com/firebasejs/${V}/firebase-database-compat.js`);
    firebase.initializeApp(window.FIREBASE_CONFIG);
    db = firebase.database();
    db.ref("reports/" + todayKey()).on("value", (snap) => {
      cache = snap.val() || {};
      notify();
    });
    return "firebase";
  }

  // ---------- 公開 API ----------

  async function init() {
    if (window.FIREBASE_CONFIG) {
      try {
        mode = await initFirebase();
      } catch (e) {
        console.warn("Firebase の初期化に失敗したためデモモードで起動します", e);
        mode = await initDemo();
      }
    } else {
      mode = await initDemo();
    }
    return mode;
  }

  function onReports(cb) {
    listeners.push(cb);
    cb(cache);
  }

  function buildReport(prev, data) {
    const now = Date.now();
    const trail = (prev && prev.trail ? prev.trail : []).slice(-TRAIL_MAX + 1);
    trail.push({ lat: data.lat, lng: data.lng, t: now });
    return {
      lat: data.lat,
      lng: data.lng,
      status: data.status,
      comment: data.comment || "",
      updatedAt: now,
      trail: trail,
    };
  }

  async function submitReport(kaiId, data) {
    const report = buildReport(cache[kaiId], data);
    if (mode === "firebase") {
      await db.ref("reports/" + todayKey() + "/" + kaiId).set(report);
      // cache は on("value") 経由で更新される
    } else {
      cache[kaiId] = report;
      demoSave();
      notify();
    }
  }

  return { init, onReports, submitReport, get mode() { return mode; } };
})();
