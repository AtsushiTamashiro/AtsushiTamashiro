/* エイサー道ジュネーなう 読谷村 — シミュレーションデモ
   実際の OpenStreetMap 上で、青年会マスタ(js/data.js)の団体が
   旧盆ナカビの夜(19時〜)を模した動きで練り歩く。
   位置報告はすべてメモリ上で完結し、本番アプリのデータには影響しない。 */
(() => {
  "use strict";

  // ---------- デモ用ルート定義 ----------
  // 各字の集落周辺を巡る模擬ルート(実際の道ジュネー経路ではありません)。
  // キーは data.js の KAI_LIST の id。ルートを持つ団体だけが自動で動く。
  const DEMO_ROUTES = {
    namihira: {
      route: [[26.3945,127.7300],[26.3975,127.7275],[26.4000,127.7290],[26.3990,127.7320],[26.3960,127.7325],[26.3945,127.7300]],
      startMin: 2, speed: 66,
      comments: [
        { frac: 0.02, text: "波平公民館前を出発!" },
        { frac: 0.4,  text: "集落内を北へ練り歩き中" },
        { frac: 0.8,  text: "終盤、盛り上がってます!" },
      ],
    },
    sobe: {
      route: [[26.3790,127.7330],[26.3820,127.7315],[26.3840,127.7345],[26.3820,127.7370],[26.3795,127.7360],[26.3790,127.7330]],
      startMin: 9, speed: 62,
      comments: [
        { frac: 0.02, text: "楚辺公民館からスタート" },
        { frac: 0.45, text: "楚辺の集落を練り歩き中" },
        { frac: 0.8,  text: "折り返して戻ります" },
      ],
    },
    takashiho: {
      route: [[26.4090,127.7215],[26.4120,127.7205],[26.4140,127.7235],[26.4115,127.7255],[26.4090,127.7240],[26.4090,127.7215]],
      startMin: 16, speed: 70,
      comments: [
        { frac: 0.02, text: "高志保公民館前を出発" },
        { frac: 0.4,  text: "残波岬方面へ北上中" },
        { frac: 0.85, text: "そろそろ折り返します" },
      ],
    },
    tokeshi: {
      route: [[26.4165,127.7185],[26.4195,127.7170],[26.4215,127.7200],[26.4190,127.7220],[26.4165,127.7185]],
      startMin: 23, speed: 64,
      comments: [
        { frac: 0.02, text: "渡慶次公民館を出発!" },
        { frac: 0.5,  text: "儀間向けに移動中" },
      ],
    },
    kina: {
      route: [[26.4075,127.7490],[26.4105,127.7480],[26.4125,127.7510],[26.4100,127.7530],[26.4075,127.7515],[26.4075,127.7490]],
      startMin: 30, speed: 60,
      comments: [
        { frac: 0.02, text: "喜名公民館前からスタート" },
        { frac: 0.55, text: "国道58号沿いを練り歩き中" },
      ],
    },
    zakimi: {
      route: [[26.4060,127.7405],[26.4085,127.7390],[26.4105,127.7420],[26.4080,127.7440],[26.4060,127.7425],[26.4060,127.7405]],
      startMin: 37, speed: 66,
      comments: [
        { frac: 0.02, text: "座喜味公民館を出発!" },
        { frac: 0.5,  text: "座喜味城跡入口方面へ" },
      ],
    },
  };

  const LAPS = 2;          // 各ルートを周回する回数
  const REST_FRAC = 0.5;   // 行程の半分で休憩
  const REST_MIN = 8;      // 休憩時間(シミュレーション分)
  const PREP_LEAD = 6;     // 出発何分前に「準備中」報告を出すか

  // ---------- ユーティリティ ----------
  const $ = (id) => document.getElementById(id);

  function demoOf(kai) {
    return DEMO_ROUTES[kai.id];
  }

  function metersBetween(a, b) {
    const dLat = (b[0] - a[0]) * 111320;
    const dLng = (b[1] - a[1]) * 111320 * Math.cos((a[0] * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  // ---------- 地図(実際の OpenStreetMap) ----------
  const map = L.map("map", { zoomControl: false }).setView(
    [MAP_DEFAULT.lat, MAP_DEFAULT.lng],
    MAP_DEFAULT.zoom
  );
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // ---------- 状態 ----------
  let simMin = 0;          // 19:00 からの経過(シミュレーション分)
  let playing = true;
  let speedMult = 2;
  const reports = {};      // kaiId -> { lat, lng, status, comment, updatedAt(simMin), trail }
  const simState = {};     // kaiId -> { phase, dist, rested, restUntil, commentIdx }
  const manual = {};       // kaiId -> true なら手動報告に切替済み
  const markers = {};
  const baseDots = {};
  const trails = {};

  function kaiBase(kai) {
    const demo = demoOf(kai);
    return demo ? demo.route[0] : [kai.baseLat, kai.baseLng];
  }

  function lapLength(demo) {
    let d = 0;
    for (let i = 1; i < demo.route.length; i++) d += metersBetween(demo.route[i - 1], demo.route[i]);
    return d;
  }

  function routeTotal(demo) {
    return lapLength(demo) * LAPS;
  }

  function pointAlong(demo, dist) {
    const lap = lapLength(demo);
    let remain = dist >= lap ? dist % lap : dist;
    for (let i = 1; i < demo.route.length; i++) {
      const seg = metersBetween(demo.route[i - 1], demo.route[i]);
      if (remain <= seg) {
        const f = seg === 0 ? 0 : remain / seg;
        return [
          demo.route[i - 1][0] + (demo.route[i][0] - demo.route[i - 1][0]) * f,
          demo.route[i - 1][1] + (demo.route[i][1] - demo.route[i - 1][1]) * f,
        ];
      }
      remain -= seg;
    }
    return demo.route[demo.route.length - 1];
  }

  function setReport(kaiId, lat, lng, status, comment) {
    const prev = reports[kaiId];
    const trail = prev ? prev.trail : [];
    const last = trail[trail.length - 1];
    if (!last || metersBetween([last.lat, last.lng], [lat, lng]) > 40) {
      trail.push({ lat, lng });
      if (trail.length > 80) trail.shift();
    }
    reports[kaiId] = { lat, lng, status, comment, updatedAt: simMin, trail };
  }

  // ---------- シミュレーション ----------
  function resetSim() {
    simMin = 0;
    KAI_LIST.forEach((kai) => {
      delete reports[kai.id];
      delete manual[kai.id];
      if (demoOf(kai)) simState[kai.id] = { phase: "none", dist: 0, rested: false, restUntil: 0, commentIdx: -1 };
      if (markers[kai.id]) { map.removeLayer(markers[kai.id]); delete markers[kai.id]; }
      if (trails[kai.id]) { map.removeLayer(trails[kai.id]); delete trails[kai.id]; }
    });
    $("demo-note").textContent = "読谷村の6団体が自動で練り歩きます";
    render();
  }

  function tickKai(kai, dt) {
    if (manual[kai.id]) return;
    const demo = demoOf(kai);
    const st = simState[kai.id];
    const total = routeTotal(demo);
    const start = demo.startMin;

    if (st.phase === "none") {
      if (simMin >= start - PREP_LEAD) {
        st.phase = "prep";
        const [lat, lng] = kaiBase(kai);
        setReport(kai.id, lat, lng, "preparing", "まもなく出発します");
      }
      return;
    }
    if (st.phase === "prep") {
      if (simMin >= start) st.phase = "parade";
      return;
    }
    if (st.phase === "rest") {
      if (simMin >= st.restUntil) {
        st.phase = "parade";
        const [lat, lng] = pointAlong(demo, st.dist);
        setReport(kai.id, lat, lng, "parading", "休憩終わり、再開します!");
      }
      return;
    }
    if (st.phase === "parade") {
      st.dist += demo.speed * dt;

      if (!st.rested && st.dist >= total * REST_FRAC) {
        st.rested = true;
        st.phase = "rest";
        st.restUntil = simMin + REST_MIN;
        const [lat, lng] = pointAlong(demo, st.dist);
        setReport(kai.id, lat, lng, "resting", "しばし休憩中");
        return;
      }
      if (st.dist >= total) {
        st.phase = "done";
        const [lat, lng] = pointAlong(demo, total);
        setReport(kai.id, lat, lng, "finished", "本日の道ジュネー終了。ありがとうございました!");
        return;
      }
      const frac = st.dist / total;
      let comment = reports[kai.id] ? reports[kai.id].comment : "";
      for (let i = st.commentIdx + 1; i < demo.comments.length; i++) {
        if (frac >= demo.comments[i].frac) { st.commentIdx = i; comment = demo.comments[i].text; }
      }
      const [lat, lng] = pointAlong(demo, st.dist);
      setReport(kai.id, lat, lng, "parading", comment);
    }
  }

  function tick(dt) {
    simMin += dt;
    KAI_LIST.filter((k) => demoOf(k)).forEach((k) => tickKai(k, dt));

    const autoKais = KAI_LIST.filter((k) => demoOf(k) && !manual[k.id]);
    if (autoKais.length && autoKais.every((k) => simState[k.id].phase === "done")) {
      $("demo-note").textContent = "全団体が終了しました。まもなく最初から再生します";
      if (!tick.resetAt) tick.resetAt = simMin + 5;
      if (simMin >= tick.resetAt) { tick.resetAt = 0; resetSim(); }
    }
    render();
  }

  // ---------- 描画 ----------
  function clockText() {
    const t = 19 * 60 + Math.floor(simMin);
    return `${String(Math.floor(t / 60) % 24).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
  }

  function relTime(updatedAt) {
    const diff = Math.floor(simMin - updatedAt);
    if (diff < 1) return "たった今";
    if (diff < 60) return `${diff}分前`;
    return `${Math.floor(diff / 60)}時間${diff % 60}分前`;
  }

  function markerIcon(kai, report) {
    const emoji = STATUS_DEF[report.status].emoji;
    return L.divIcon({
      className: "",
      html: `<div class="eisa-marker marker-${report.status}">
               <div class="marker-pin"><span>${emoji}</span></div>
               <div class="marker-label">${kai.name}</div>
             </div>`,
      iconSize: [0, 0],
    });
  }

  function popupHtml(kai, report) {
    const st = STATUS_DEF[report.status];
    const comment = report.comment
      ? `<div class="popup-comment">💬 ${escapeHtml(report.comment)}</div>` : "";
    return `<div class="popup-kai">
      <h3>${kai.name}</h3>
      <p class="popup-region">${kai.region}</p>
      <p class="popup-status">${st.emoji} ${st.label}</p>
      ${comment}
      <p class="popup-time">最終報告: ${relTime(report.updatedAt)}</p>
    </div>`;
  }

  function renderMarkers() {
    KAI_LIST.forEach((kai) => {
      const report = reports[kai.id];
      if (report) {
        if (baseDots[kai.id]) { map.removeLayer(baseDots[kai.id]); delete baseDots[kai.id]; }
        if (!markers[kai.id]) {
          markers[kai.id] = L.marker([report.lat, report.lng], {
            icon: markerIcon(kai, report),
          }).addTo(map);
        }
        markers[kai.id]
          .setLatLng([report.lat, report.lng])
          .setIcon(markerIcon(kai, report))
          .bindPopup(popupHtml(kai, report));

        const pts = report.trail.map((p) => [p.lat, p.lng]);
        if (pts.length >= 2) {
          if (!trails[kai.id]) {
            trails[kai.id] = L.polyline(pts, {
              color: "#c53030", weight: 3, opacity: 0.55, dashArray: "6 8", interactive: false,
            }).addTo(map);
          } else {
            trails[kai.id].setLatLngs(pts);
          }
        }
      } else {
        if (markers[kai.id]) { map.removeLayer(markers[kai.id]); delete markers[kai.id]; }
        if (trails[kai.id]) { map.removeLayer(trails[kai.id]); delete trails[kai.id]; }
        if (!baseDots[kai.id]) {
          const [lat, lng] = kaiBase(kai);
          baseDots[kai.id] = L.circleMarker([lat, lng], {
            radius: 6, color: "#a0aec0", fillColor: "#cbd5e0", fillOpacity: 0.9, weight: 2,
          }).bindPopup(`<div class="popup-kai"><h3>${kai.name}</h3>
            <p class="popup-region">${kai.region}</p>
            <p class="popup-time">まだ本日の報告はありません</p></div>`).addTo(map);
        }
      }
    });
  }

  function renderKaiList() {
    if ($("panel-list").classList.contains("hidden")) return;
    const region = $("filter-region").value;
    const activeOnly = $("filter-active").checked;
    const ul = $("kai-list");
    ul.innerHTML = "";

    KAI_LIST.filter((kai) => {
      if (region && kai.region !== region) return false;
      if (activeOnly) {
        const r = reports[kai.id];
        return r && r.status === "parading";
      }
      return true;
    }).forEach((kai) => {
      const report = reports[kai.id];
      const li = document.createElement("li");
      li.className = "kai-item";
      const dotColor = report ? `var(--color-${report.status})` : "#e2e8f0";
      const meta = report
        ? `${STATUS_DEF[report.status].emoji} ${STATUS_DEF[report.status].label} ・ ${relTime(report.updatedAt)}` +
          (report.comment ? ` ・ ${report.comment}` : "")
        : "本日の報告なし";
      li.innerHTML = `
        <span class="kai-status-dot" style="background:${dotColor}"></span>
        <div class="kai-info">
          <p class="kai-name">${kai.name}</p>
          <p class="kai-meta">${escapeHtml(meta)}</p>
        </div>`;
      li.addEventListener("click", () => {
        const target = report ? [report.lat, report.lng] : kaiBase(kai);
        map.setView(target, Math.max(map.getZoom(), 15));
        const layer = markers[kai.id] || baseDots[kai.id];
        if (layer) layer.openPopup();
        if (window.innerWidth < 720) $("panel-list").classList.add("hidden");
      });
      ul.appendChild(li);
    });
  }

  function render() {
    $("demo-clock").textContent = clockText();
    renderMarkers();
    renderKaiList();
  }

  // ---------- デモ操作 ----------
  $("btn-play").addEventListener("click", () => {
    playing = !playing;
    $("btn-play").textContent = playing ? "⏸ 一時停止" : "▶ 再生";
  });

  $("btn-speed").addEventListener("click", () => {
    speedMult = { 1: 2, 2: 4, 4: 8, 8: 1 }[speedMult];
    $("btn-speed").textContent = `×${speedMult}`;
  });

  $("btn-reset").addEventListener("click", resetSim);

  // ---------- パネル / 報告フォーム ----------
  $("btn-toggle-list").addEventListener("click", () => {
    $("panel-list").classList.toggle("hidden");
    renderKaiList();
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => $(btn.dataset.close).classList.add("hidden"));
  });

  $("modal-report").addEventListener("click", (e) => {
    if (e.target === $("modal-report")) $("modal-report").classList.add("hidden");
  });

  const regions = [...new Set(KAI_LIST.map((k) => k.region))];
  regions.forEach((r) => {
    const opt = document.createElement("option");
    opt.value = r; opt.textContent = r;
    $("filter-region").appendChild(opt);
  });
  $("filter-region").addEventListener("change", renderKaiList);
  $("filter-active").addEventListener("change", renderKaiList);

  KAI_LIST.forEach((kai) => {
    const opt = document.createElement("option");
    opt.value = kai.id;
    opt.textContent = `${kai.name}(${kai.region})`;
    $("report-kai").appendChild(opt);
  });

  let pendingLocation = null;
  let picking = false;

  function resetReportForm() {
    pendingLocation = null;
    $("location-status").textContent = "位置が未設定です(デモでは地図タップで指定します)";
    $("location-status").classList.remove("ok");
    $("btn-submit-report").disabled = true;
    $("report-comment").value = "";
  }

  $("btn-report").addEventListener("click", () => {
    resetReportForm();
    $("modal-report").classList.remove("hidden");
  });

  $("btn-pick-map").addEventListener("click", () => {
    picking = true;
    $("modal-report").classList.add("hidden");
    $("pick-guide").classList.remove("hidden");
  });

  $("btn-cancel-pick").addEventListener("click", () => {
    picking = false;
    $("pick-guide").classList.add("hidden");
    $("modal-report").classList.remove("hidden");
  });

  map.on("click", (e) => {
    if (!picking) return;
    picking = false;
    $("pick-guide").classList.add("hidden");
    pendingLocation = { lat: e.latlng.lat, lng: e.latlng.lng };
    $("location-status").textContent = "✅ 位置設定済み(地図タップ)";
    $("location-status").classList.add("ok");
    $("btn-submit-report").disabled = false;
    $("modal-report").classList.remove("hidden");
  });

  $("form-report").addEventListener("submit", (e) => {
    e.preventDefault();
    const kaiId = $("report-kai").value;
    if (!pendingLocation || !kaiId) return;
    manual[kaiId] = true; // 手動報告した団体は自動シミュレーションを止める
    setReport(kaiId, pendingLocation.lat, pendingLocation.lng,
      $("report-status").value, $("report-comment").value.trim());
    $("modal-report").classList.add("hidden");
    const kai = KAI_LIST.find((k) => k.id === kaiId);
    $("demo-note").textContent = `${kai.name}は手動報告に切り替わりました`;
    map.setView([pendingLocation.lat, pendingLocation.lng], Math.max(map.getZoom(), 15));
    resetReportForm();
    render();
  });

  // ---------- 開始 ----------
  resetSim();
  setInterval(() => {
    if (playing) tick(0.25 * speedMult); // 実時間250ms = シミュレーション0.25分 × 速度
  }, 250);
})();
