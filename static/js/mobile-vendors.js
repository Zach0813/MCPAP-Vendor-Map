/**
 * Mobile vendor list (/mobile/vendors) — tap opens detail card only; map opens via "View on Map".
 */
(function () {
  "use strict";

  var MV_DAY_KEY = "mvSelectedMapDay";
  var DETAIL_CLOSE_MS = 300;

  var _days = window.__MCPP_SCHEDULED_DAYS__ || {};
  var SCHEDULED_DAY_OPTIONS = _days.options || [];
  var SCHEDULED_DAY_ORDER = _days.order || SCHEDULED_DAY_OPTIONS.map(function (o) { return o.value; });

  var state = {
    vendors: {},
    selectedMapDay: SCHEDULED_DAY_ORDER[0] || "saturday",
    searchQuery: "",
    listCollapsed: {},
    selectedId: null
  };

  function openDetail(id) {
    state.selectedId = id;
    var sheet = document.getElementById("mvDetailSheet");
    var body = document.getElementById("mvDetailBody");
    var idEl = document.getElementById("mvDetailBoothId");
    if (!sheet || !body || !idEl || !window.McppMobileDetailHtml) return;
    var booth = state.vendors[id];
    idEl.textContent = id || "—";
    if (!booth) {
      body.innerHTML = "<p class=\"mv-detail-value\">No details.</p>";
    } else {
      body.innerHTML = window.McppMobileDetailHtml.buildDetailHtml(booth);
    }
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function closeDetail() {
    state.selectedId = null;
    var sheet = document.getElementById("mvDetailSheet");
    if (!sheet) return;
    sheet.classList.remove("open");
    sheet.classList.add("closing");
    var content = sheet.querySelector(".mv-detail-content");
    var done = false;
    function finishClose() {
      if (done) return;
      done = true;
      sheet.classList.remove("closing");
      sheet.setAttribute("aria-hidden", "true");
      if (content) content.removeEventListener("transitionend", onEnd);
    }
    function onEnd(e) {
      if (e.target === content && e.propertyName === "transform") finishClose();
    }
    if (content) content.addEventListener("transitionend", onEnd);
    setTimeout(finishClose, DETAIL_CLOSE_MS);
  }

  function initDetailSheet() {
    var closeBtn = document.getElementById("mvDetailClose");
    var backdrop = document.getElementById("mvDetailBackdrop");
    var viewOnMapBtn = document.getElementById("mvDetailViewOnMap");
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeDetail();
      });
    }
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeDetail();
      });
    }
    if (viewOnMapBtn) {
      viewOnMapBtn.addEventListener("click", function () {
        var id = state.selectedId;
        if (!id) return;
        var base = document.body.getAttribute("data-mobile-map-href") || "/mobile";
        var path = base.split("?")[0];
        window.location.href = path + "?booth=" + encodeURIComponent(id) + "&view=map";
      });
    }
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      var sheet = document.getElementById("mvDetailSheet");
      if (!sheet || !sheet.classList.contains("open")) return;
      closeDetail();
    });
  }

  function renderList() {
    var listEl = document.getElementById("mvBoothList");
    if (!listEl || !window.McppMobileVendorList) return;
    window.McppMobileVendorList.render(listEl, state, {
      onBoothClick: function (id) {
        openDetail(id);
      }
    });
  }

  function initSearch() {
    var searchEl = document.getElementById("mvSearch");
    if (!searchEl) return;
    searchEl.addEventListener("input", function () {
      state.searchQuery = searchEl.value;
      renderList();
    });
  }

  function initDayFilter() {
    var sel = document.getElementById("mvListDaySelect");
    if (!sel) return;
    sel.innerHTML = "";
    SCHEDULED_DAY_OPTIONS.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.date || opt.full || opt.short || opt.value;
      sel.appendChild(o);
    });
    try {
      var stored = localStorage.getItem(MV_DAY_KEY);
      if (stored && SCHEDULED_DAY_ORDER.indexOf(stored) !== -1) {
        sel.value = stored;
      }
    } catch (e) { /* ignore */ }
    state.selectedMapDay = sel.value || SCHEDULED_DAY_ORDER[0] || "saturday";
    if (sel.value !== state.selectedMapDay) sel.value = state.selectedMapDay;
    sel.addEventListener("change", function () {
      state.selectedMapDay = sel.value || SCHEDULED_DAY_ORDER[0] || "saturday";
      try {
        localStorage.setItem(MV_DAY_KEY, state.selectedMapDay);
      } catch (e2) { /* ignore */ }
      if (state.selectedId && !getVisibleVendors()[state.selectedId]) {
        closeDetail();
      }
      renderList();
    });
  }

  function normalizeScheduledDays(list) {
    if (!Array.isArray(list)) return [];
    if (_days.normalize) return _days.normalize(list);
    return [];
  }

  function getVisibleVendors() {
    var day = state.selectedMapDay || SCHEDULED_DAY_ORDER[0] || "saturday";
    if (!state.vendors) return {};
    var filtered = {};
    Object.keys(state.vendors).forEach(function (id) {
      var booth = state.vendors[id];
      if (!booth) return;
      var days = normalizeScheduledDays(booth.scheduled_days || []);
      if (days.indexOf(day) !== -1) filtered[id] = booth;
    });
    return filtered;
  }

  function loadVendors() {
    fetch("/api/vendors")
      .then(function (r) { return r.json(); })
      .then(function (data) {
        state.vendors = data && typeof data === "object" ? data : {};
        renderList();
      })
      .catch(function () {
        state.vendors = {};
        renderList();
      });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initDetailSheet();
    initDayFilter();
    initSearch();
    loadVendors();
  });
})();
