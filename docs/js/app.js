/* エイサー道ジュネーなう - メインアプリケーション */
(() => {
  "use strict";

  // ---------- 状態 ----------
  const markers = {};   // kaiId -> L.Marker (報告あり)
  const baseDots = {};  // kaiId -> L.CircleMarker (報告なしの拠点表示)
  const trails = {};    // kaiId -> L.Polyline
  let reports = {};
  let pendingLocation = null; // 報告フォームで選択中の位置 {lat, lng}
  let picking = false;        // 地図タップで位置指定中か

  // ---------- 地図 ----------
  const map = L.map("map", { zoomControl: false }).setView(
    [MAP_DEFAULT.lat, MAP_DEFAULT.lng],
    MAP_DEFAULT.zoom
  );
  L.control.zoom({ position: "bottomright" }).addTo(map);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  // ---------- DOM ----------
  const $ = (id) => document.getElementById(id);
  const elDayIndicator = $("day-indicator");
  const elModeBanner = $("mode-banner");
  const elPanelList = $("panel-list");
  const elKaiList = $("kai-list");
  const elFilterRegion = $("filter-region");
  const elFilterActive = $("filter-active");
  const elModalReport = $("modal-report");
  const elReportKai = $("report-kai");
  const elReportStatus = $("report-status");
  const elReportComment = $("report-comment");
  const elLocationStatus = $("location-status");
  const elBtnSubmit = $("btn-submit-report");
  const elPickGuide = $("pick-guide");

  // ---------- ユーティリティ ----------
  function kaiById(id) {
    return KAI_LIST.find((k) => k.id === id);
  }

  function relativeTime(ms) {
    const diff = Math.floor((Date.now() - ms) / 60000);
    if (diff < 1) return "たった今";
    if (diff < 60) return `${diff}分前`;
    return `${Math.floor(diff / 60)}時間${diff % 60}分前`;
  }

  function isStale(report) {
    return Date.now() - report.updatedAt > STALE_MINUTES * 60 * 1000;
  }

  function todayJst() {
    return new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0, 10);
  }

  // ---------- 旧盆の日表示 ----------
  function renderDayIndicator() {
    const today = todayJst();
    const day = KYUBON_DAYS.find((d) => d.date === today);
    if (day) {
      const idx = KYUBON_DAYS.indexOf(day) + 1;
      elDayIndicator.textContent = `旧盆${idx}日目 ${day.label}`;
      return;
    }
    const first = new Date(KYUBON_DAYS[0].date + "T00:00:00+09:00");
    const diffDays = Math.ceil((first - Date.now()) / 86400000);
    if (diffDays > 0) {
      elDayIndicator.textContent = `旧盆(${KYUBON_DAYS[0].date.replaceAll("-", "/")}〜)まであと${diffDays}日`;
    } else {
      elDayIndicator.textContent = "今年の旧盆は終了しました";
    }
  }

  // ---------- マーカー ----------
  function markerIcon(kai, report) {
    const cls = isStale(report) ? "marker-stale" : `marker-${report.status}`;
    const emoji = STATUS_DEF[report.status] ? STATUS_DEF[report.status].emoji : "🥁";
    return L.divIcon({
      className: "",
      html: `<div class="eisa-marker ${cls}">
               <div class="marker-pin"><span>${emoji}</span></div>
               <div class="marker-label">${kai.name}</div>
             </div>`,
      iconSize: [0, 0],
    });
  }

  function popupHtml(kai, report) {
    const st = STATUS_DEF[report.status] || STATUS_DEF.parading;
    const stale = isStale(report)
      ? '<p class="popup-time">⚠️ 情報が古い可能性があります</p>'
      : "";
    const comment = report.comment
      ? `<div class="popup-comment">💬 ${escapeHtml(report.comment)}</div>`
      : "";
    return `<div class="popup-kai">
      <h3>${kai.name}</h3>
      <p class="popup-region">${kai.region}</p>
      <p class="popup-status">${st.emoji} ${st.label}</p>
      ${comment}
      <p class="popup-time">最終報告: ${relativeTime(report.updatedAt)}</p>
      ${stale}
    </div>`;
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    }[c]));
  }

  function renderMarkers() {
    KAI_LIST.forEach((kai) => {
      const report = reports[kai.id];

      if (report) {
        // 拠点ドットは報告が入ったら消す
        if (baseDots[kai.id]) {
          map.removeLayer(baseDots[kai.id]);
          delete baseDots[kai.id];
        }
        if (!markers[kai.id]) {
          markers[kai.id] = L.marker([report.lat, report.lng]).addTo(map);
        }
        markers[kai.id]
          .setLatLng([report.lat, report.lng])
          .setIcon(markerIcon(kai, report))
          .bindPopup(popupHtml(kai, report));

        // 道ジュネーの軌跡
        const trailPoints = (report.trail || []).map((p) => [p.lat, p.lng]);
        if (trailPoints.length >= 2) {
          if (!trails[kai.id]) {
            trails[kai.id] = L.polyline(trailPoints, {
              color: "#c53030",
              weight: 3,
              opacity: 0.55,
              dashArray: "6 8",
            }).addTo(map);
          } else {
            trails[kai.id].setLatLngs(trailPoints);
          }
        }
      } else if (!baseDots[kai.id]) {
        baseDots[kai.id] = L.circleMarker([kai.baseLat, kai.baseLng], {
          radius: 6,
          color: "#a0aec0",
          fillColor: "#cbd5e0",
          fillOpacity: 0.8,
          weight: 2,
        })
          .bindPopup(`<div class="popup-kai"><h3>${kai.name}</h3>
            <p class="popup-region">${kai.region}</p>
            <p class="popup-time">まだ本日の報告はありません</p></div>`)
          .addTo(map);
      }
    });
  }

  // ---------- 青年会リスト ----------
  function renderRegionFilter() {
    const regions = [...new Set(KAI_LIST.map((k) => k.region))];
    regions.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r;
      opt.textContent = r;
      elFilterRegion.appendChild(opt);
    });
  }

  function renderKaiList() {
    const region = elFilterRegion.value;
    const activeOnly = elFilterActive.checked;
    elKaiList.innerHTML = "";

    KAI_LIST.filter((kai) => {
      if (region && kai.region !== region) return false;
      if (activeOnly) {
        const r = reports[kai.id];
        return r && r.status === "parading" && !isStale(r);
      }
      return true;
    }).forEach((kai) => {
      const report = reports[kai.id];
      const li = document.createElement("li");
      li.className = "kai-item";

      const dotColor = report
        ? isStale(report)
          ? "var(--color-stale)"
          : `var(--color-${report.status})`
        : "#e2e8f0";
      const meta = report
        ? `${STATUS_DEF[report.status].emoji} ${STATUS_DEF[report.status].label} ・ ${relativeTime(report.updatedAt)}` +
          (report.comment ? ` ・ ${report.comment}` : "")
        : "本日の報告なし";

      li.innerHTML = `
        <span class="kai-status-dot" style="background:${dotColor}"></span>
        <div class="kai-info">
          <p class="kai-name">${kai.name}</p>
          <p class="kai-meta">${escapeHtml(meta)}</p>
        </div>`;

      li.addEventListener("click", () => {
        const target = report ? [report.lat, report.lng] : [kai.baseLat, kai.baseLng];
        map.setView(target, 16);
        const layer = markers[kai.id] || baseDots[kai.id];
        if (layer) layer.openPopup();
        if (window.innerWidth < 720) elPanelList.classList.add("hidden");
      });

      elKaiList.appendChild(li);
    });
  }

  // ---------- 報告フォーム ----------
  function renderKaiSelect() {
    KAI_LIST.forEach((kai) => {
      const opt = document.createElement("option");
      opt.value = kai.id;
      opt.textContent = `${kai.name}(${kai.region})`;
      elReportKai.appendChild(opt);
    });
  }

  function setPendingLocation(lat, lng, sourceLabel) {
    pendingLocation = { lat, lng };
    elLocationStatus.textContent = `✅ 位置設定済み(${sourceLabel})`;
    elLocationStatus.classList.add("ok");
    elBtnSubmit.disabled = false;
  }

  function resetReportForm() {
    pendingLocation = null;
    elLocationStatus.textContent = "位置が未設定です";
    elLocationStatus.classList.remove("ok");
    elBtnSubmit.disabled = true;
    elReportComment.value = "";
  }

  $("btn-gps").addEventListener("click", () => {
    if (!navigator.geolocation) {
      alert("この端末では位置情報が利用できません。地図タップで指定してください。");
      return;
    }
    elLocationStatus.textContent = "📡 現在地を取得中…";
    navigator.geolocation.getCurrentPosition(
      (pos) => setPendingLocation(pos.coords.latitude, pos.coords.longitude, "GPS"),
      () => {
        elLocationStatus.textContent = "GPS取得に失敗しました。地図タップで指定してください。";
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  });

  $("btn-pick-map").addEventListener("click", () => {
    picking = true;
    elModalReport.classList.add("hidden");
    elPickGuide.classList.remove("hidden");
  });

  $("btn-cancel-pick").addEventListener("click", () => {
    picking = false;
    elPickGuide.classList.add("hidden");
    elModalReport.classList.remove("hidden");
  });

  map.on("click", (e) => {
    if (!picking) return;
    picking = false;
    elPickGuide.classList.add("hidden");
    setPendingLocation(e.latlng.lat, e.latlng.lng, "地図タップ");
    elModalReport.classList.remove("hidden");
  });

  $("form-report").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingLocation || !elReportKai.value) return;
    elBtnSubmit.disabled = true;
    try {
      await Store.submitReport(elReportKai.value, {
        lat: pendingLocation.lat,
        lng: pendingLocation.lng,
        status: elReportStatus.value,
        comment: elReportComment.value.trim(),
      });
      elModalReport.classList.add("hidden");
      resetReportForm();
      map.setView([reports[elReportKai.value].lat, reports[elReportKai.value].lng], 16);
    } catch (err) {
      alert("報告の送信に失敗しました。通信環境を確認して再度お試しください。");
      elBtnSubmit.disabled = false;
    }
  });

  // ---------- パネル/モーダルの開閉 ----------
  $("btn-toggle-list").addEventListener("click", () => {
    elPanelList.classList.toggle("hidden");
    renderKaiList();
  });

  $("btn-report").addEventListener("click", () => {
    resetReportForm();
    elModalReport.classList.remove("hidden");
  });

  document.querySelectorAll("[data-close]").forEach((btn) => {
    btn.addEventListener("click", () => $(btn.dataset.close).classList.add("hidden"));
  });

  elModalReport.addEventListener("click", (e) => {
    if (e.target === elModalReport) elModalReport.classList.add("hidden");
  });

  elFilterRegion.addEventListener("change", renderKaiList);
  elFilterActive.addEventListener("change", renderKaiList);

  // ---------- 起動 ----------
  renderDayIndicator();
  renderRegionFilter();
  renderKaiSelect();

  Store.init().then((mode) => {
    if (mode === "demo") {
      elModeBanner.textContent =
        "デモモードで動作中: 報告はこの端末内でのみ共有されます(全体共有には Firebase の設定が必要です)";
      elModeBanner.classList.remove("hidden");
    }
    Store.onReports((r) => {
      reports = r;
      renderMarkers();
      renderKaiList();
    });
  });

  // 経過時間表示・古い報告のグレー化を定期更新
  setInterval(() => {
    renderMarkers();
    renderKaiList();
  }, 60 * 1000);
})();
