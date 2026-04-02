/**
 * Mobile viewer — standalone script for /mobile. No shared desktop code.
 * Requires mobile-detail-html.js (McppMobileDetailHtml) before this file.
 */
(function () {
  "use strict";

  const FT = 0.3048;
  const DEFAULT_CENTER = { lat: 45.783611, lng: -108.542778 };
  const CAT = {
    standard: { f: "#1e392f", s: "#4ea186" },
    collaborator: { f: "#2f3346", s: "#7582d8" },
    foodbeverage: { f: "#4a2c1b", s: "#e28850" },
    activity: { f: "#2f1f3f", s: "#c06ae6" },
    misc: { f: "#353535", s: "#8a8a8a" }
  };

  const CAT_NAMES = {
    standard: "Plant Vendor",
    collaborator: "Craft Vendor",
    foodbeverage: "Food & Drink",
    activity: "Entertainment",
    misc: "Miscellaneous"
  };
  const CAT_EMOJI = {
    standard: "\uD83E\uDEB4",
    collaborator: "\uD83C\uDFA8",
    foodbeverage: "\uD83C\uDF7D",
    activity: "\uD83C\uDFAA",
    misc: "\u2728"
  };

  const ROTATION_PRESETS = [0, 22.5, 45, 67.5, 90];
  function snapRotationToPreset(deg) {
    var d = Number(deg);
    if (!Number.isFinite(d)) d = 0;
    d = ((d % 360) + 360) % 360;
    var best = ROTATION_PRESETS[0];
    var bestDiff = Math.abs(((d - best + 180) % 360) - 180);
    for (var i = 1; i < ROTATION_PRESETS.length; i++) {
      var diff = Math.abs(((d - ROTATION_PRESETS[i] + 180) % 360) - 180);
      if (diff < bestDiff) { bestDiff = diff; best = ROTATION_PRESETS[i]; }
    }
    return best;
  }
  function getBadgeRotation(preset) {
    if (preset === 67.5) return -22.5;
    if (preset === 90) return 0;
    return preset;
  }

  const BADGE_RIBBON_MIN_ZOOM = 20.7;

  var _days = window.__MCPP_SCHEDULED_DAYS__ || {};
  var SCHEDULED_DAY_OPTIONS = _days.options || [
    { value: "saturday", short: "Sat", full: "Saturday", date: "Saturday, May 16, 2026" },
    { value: "sunday", short: "Sun", full: "Sunday", date: "Sunday, May 17, 2026" }
  ];
  var SCHEDULED_DAY_ORDER = _days.order || SCHEDULED_DAY_OPTIONS.map(function (o) { return o.value; });
  var normalizeScheduledDays = _days.normalize || function (list) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var key = String(list[i] || "").toLowerCase();
      if (SCHEDULED_DAY_ORDER.indexOf(key) !== -1 && !seen[key]) { seen[key] = true; out.push(key); }
    }
    return out.sort(function (a, b) { return SCHEDULED_DAY_ORDER.indexOf(a) - SCHEDULED_DAY_ORDER.indexOf(b); });
  };

  /** Vendors visible for the selected map day (single day only). */
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

  function normalizeCategoryKey(k) {
    return window.McppMobileDetailHtml.normalizeCategoryKey(k);
  }

  function d2ll(lat0, dx, dy) {
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos((lat0 * Math.PI) / 180));
    return { lat: lat0 + dLat, dLng };
  }

  function rot(dx, dy, a) {
    const t = (a * Math.PI) / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [dx * c - dy * s, dx * s + dy * c];
  }

  /** Returns 4 LatLng for booth rectangle (same math as desktop utils-geo rect). */
  function boothRectPath(booth) {
    if (!window.google || !google.maps) return [];
    const c = booth.center || {};
    const lat0 = Number(c.lat) || DEFAULT_CENTER.lat;
    const lng0 = Number(c.lng) || DEFAULT_CENTER.lng;
    const wf = Number(booth.width_feet) || 10;
    const lf = Number(booth.length_feet) || 10;
    const a = -(Number(booth.rotation_deg) || 0);
    const w = wf * FT;
    const l = lf * FT;
    const hw = w / 2;
    const hl = l / 2;
    const base = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    return base.map(([x, y]) => {
      const [dx, dy] = rot(x, y, a);
      const { lat, dLng } = d2ll(lat0, dx, dy);
      return new google.maps.LatLng(lat, lng0 + dLng);
    });
  }

  const LOGO_BADGE_MIN_ZOOM = 19.7;
  const LABEL_HIDE_ZOOM = 19.5;
  const LABEL_FONT_MIN_PX = 12;
  const LABEL_FONT_AT_ZOOM_21_PX = 16;
  const LOGO_BADGE_BASE_PX = 48;
  const LOGO_BADGE_MIN_PX = 20;
  const LOGO_BADGE_MAX_PX = 96;

  // Logo scales with zoom like polygon size (2x per zoom level) so it stays in proportion
  function logoBadgeSizePxForZoom(z) {
    const factor = Math.pow(2, z - 21);
    const px = LOGO_BADGE_BASE_PX * factor;
    return Math.max(LOGO_BADGE_MIN_PX, Math.min(LOGO_BADGE_MAX_PX, px));
  }

  function labelFontPxForZoom(z) {
    if (z == null || z < LABEL_HIDE_ZOOM) return LABEL_FONT_MIN_PX;
    var t = (z - LABEL_HIDE_ZOOM) / (21 - LABEL_HIDE_ZOOM);
    var px = LABEL_FONT_MIN_PX + t * (LABEL_FONT_AT_ZOOM_21_PX - LABEL_FONT_MIN_PX);
    return Math.round(Math.max(LABEL_FONT_MIN_PX, Math.min(LABEL_FONT_AT_ZOOM_21_PX, px)));
  }

  const state = {
    vendors: {},
    map: null,
    polygons: {},
    logoOverlays: {},
    labelOverlays: {},
    badgeOverlays: {},
    proj: null,
    selectedId: null,
    mapsApiReady: false,
    mapLabelsOn: false,
    selectedMapDay: "saturday",
    /** Next drawMapPolygons should not fitBounds (opened from /mobile?booth= vendor list). */
    _preserveViewportAfterListDeepLink: false,
    /** After /mobile?booth=id&view=map — pan to booth, no detail sheet. */
    _panToBoothIdFromList: null,
    /** While true, do not persist map center/zoom (programmatic pan/zoom). */
    _suppressViewportSave: false,
    /** Vendor-list → map pan scheduled; ignore duplicate tryPanToBoothFromVendorListNav. */
    _vendorListPanAwaitingIdle: false,
    /** While true, skip logo/label/badge resize on zoom_changed (programmatic zoom animation). */
    _suppressOverlayZoomSync: false
  };

  function latLngFromAny(pos) {
    if (!pos) return null;
    if (typeof pos.lat === "function" && typeof pos.lng === "function") return pos;
    if (typeof pos.lat === "number" && typeof pos.lng === "number" && window.google && google.maps) {
      return new google.maps.LatLng(pos.lat, pos.lng);
    }
    return null;
  }

  function createDomOverlay(map, element, position, options) {
    if (!map || !window.google || !google.maps || typeof google.maps.OverlayView !== "function") return null;
    const opts = options || {};
    const zIndex = opts.zIndex != null ? opts.zIndex : 0;
    const pane = opts.pane || "overlayLayer";
    const el = element;
    el.style.position = "absolute";
    el.style.pointerEvents = el.style.pointerEvents || "none";
    function DomOverlay() {
      google.maps.OverlayView.call(this);
      this.position = latLngFromAny(position);
      this.zIndex = zIndex;
      this.visible = true;
      this.container = document.createElement("div");
      this.container.style.position = "absolute";
      this.container.style.pointerEvents = "none";
      this.container.appendChild(el);
      this.setMap(map);
    }
    DomOverlay.prototype = Object.create(google.maps.OverlayView.prototype);
    DomOverlay.prototype.constructor = DomOverlay;
    DomOverlay.prototype.onAdd = function () {
      const panes = this.getPanes();
      if (!panes) return;
      const paneEl = panes[pane] || panes.overlayLayer || panes.overlayImage;
      if (paneEl) paneEl.appendChild(this.container);
    };
    DomOverlay.prototype.onRemove = function () {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    };
    DomOverlay.prototype.draw = function () {
      if (!this.position) return;
      const projection = this.getProjection();
      if (!projection) return;
      const point = projection.fromLatLngToDivPixel(this.position);
      if (!point) return;
      this.container.style.left = point.x + "px";
      this.container.style.top = point.y + "px";
      this.container.style.zIndex = String(this.zIndex);
      this.container.style.display = this.visible ? "" : "none";
    };
    DomOverlay.prototype.setPosition = function (pos) {
      const ll = latLngFromAny(pos);
      if (!ll) return;
      this.position = ll;
      this.draw();
    };
    const overlay = new DomOverlay();
    return {
      element: el,
      setPosition: function (pos) { overlay.setPosition(pos); },
      setVisible: function (v) { overlay.visible = !!v; overlay.draw(); },
      remove: function () { overlay.setMap(null); }
    };
  }

  function createBadgePositionOverlay(map, element, path, cornerIndex, nudgePxOrGetNudge, options) {
    if (!map || !path || path.length <= cornerIndex || !window.google || !google.maps || typeof google.maps.OverlayView !== "function") return null;
    const opts = options || {};
    const zIndex = opts.zIndex != null ? opts.zIndex : 0;
    const pane = opts.pane || "floatPane";
    const el = element;
    el.style.position = "absolute";
    el.style.pointerEvents = el.style.pointerEvents || "none";
    function BadgeOverlay() {
      google.maps.OverlayView.call(this);
      this.path = path;
      this.cornerIndex = cornerIndex;
      this.nudgePxOrGetNudge = nudgePxOrGetNudge;
      this.zIndex = zIndex;
      this.visible = true;
      this.container = document.createElement("div");
      this.container.style.position = "absolute";
      this.container.style.pointerEvents = "none";
      this.container.appendChild(el);
      this.setMap(map);
    }
    BadgeOverlay.prototype = Object.create(google.maps.OverlayView.prototype);
    BadgeOverlay.prototype.constructor = BadgeOverlay;
    BadgeOverlay.prototype.onAdd = function () {
      const panes = this.getPanes();
      if (!panes) return;
      const paneEl = panes[pane] || panes.overlayLayer;
      if (paneEl) paneEl.appendChild(this.container);
    };
    BadgeOverlay.prototype.onRemove = function () {
      if (this.container && this.container.parentNode) {
        this.container.parentNode.removeChild(this.container);
      }
    };
    BadgeOverlay.prototype.draw = function () {
      const projection = this.getProjection();
      if (!projection || !this.path[this.cornerIndex]) return;
      const point = projection.fromLatLngToDivPixel(this.path[this.cornerIndex]);
      if (!point) return;
      const nudge = typeof this.nudgePxOrGetNudge === "function" ? this.nudgePxOrGetNudge(projection) : this.nudgePxOrGetNudge;
      const dx = (nudge && nudge.dx) || 0;
      const dy = (nudge && nudge.dy) || 0;
      this.container.style.left = (point.x + dx) + "px";
      this.container.style.top = (point.y + dy) + "px";
      this.container.style.zIndex = String(this.zIndex);
      this.container.style.display = this.visible ? "" : "none";
    };
    const overlay = new BadgeOverlay();
    return {
      element: el,
      setVisible: function (v) { overlay.visible = !!v; overlay.draw(); },
      remove: function () { overlay.setMap(null); }
    };
  }

  function createPulseRingDom(map, path, durationMs) {
    if (!map || !path || path.length < 3 || !window.google || !google.maps.OverlayView) return;
    var PULSE_Z_INDEX = 99999;
    var padding = 12;
    function getMapCanvasOffset(map) {
      var div = map.getDiv && map.getDiv();
      if (!div || !div.firstElementChild) return { x: 0, y: 0 };
      var divRect = div.getBoundingClientRect();
      var child = div.firstElementChild;
      var childRect = child.getBoundingClientRect();
      return { x: childRect.left - divRect.left, y: childRect.top - divRect.top };
    }
    function PulsePositionerOverlay() {
      google.maps.OverlayView.call(this);
      this.path = path;
      this.padding = padding;
      this.wrapper = null;
      this.inner = null;
      this.svg = null;
      this.poly = null;
    }
    PulsePositionerOverlay.prototype = Object.create(google.maps.OverlayView.prototype);
    PulsePositionerOverlay.prototype.onAdd = function () {
      this.wrapper = document.createElement("div");
      this.wrapper.className = "mv-pulse-ring-wrap";
      this.wrapper.style.cssText = "position:absolute;left:0;top:0;width:100%;height:100%;pointer-events:none;overflow:visible;z-index:" + PULSE_Z_INDEX + ";";
      this.inner = document.createElement("div");
      this.inner.style.cssText = "position:absolute;pointer-events:none;visibility:hidden;";
      this.svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      this.svg.setAttribute("class", "mv-booth-pulse-ring");
      this.svg.setAttribute("preserveAspectRatio", "none");
      this.poly = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      this.svg.appendChild(this.poly);
      this.inner.appendChild(this.svg);
      this.wrapper.appendChild(this.inner);
      var panes = this.getPanes();
      if (panes && (panes.floatPane || panes.overlayLayer)) {
        (panes.floatPane || panes.overlayLayer).appendChild(this.wrapper);
      }
    };
    PulsePositionerOverlay.prototype.draw = function () {
      var proj = this.getProjection();
      if (!proj || !proj.fromLatLngToDivPixel || !this.inner || !this.inner.parentNode) return;
      var path = this.path;
      var points = [];
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (var i = 0; i < path.length; i++) {
        var ll = path[i];
        if (!ll) continue;
        var pt = proj.fromLatLngToDivPixel(ll);
        if (!pt) continue;
        var x = pt.x, y = pt.y;
        points.push({ x: x, y: y });
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
      if (points.length < 3) return;
      var w = maxX - minX, h = maxY - minY;
      if (w < 2) w = 2;
      if (h < 2) h = 2;
      var pad = this.padding;
      var offset = getMapCanvasOffset(this.getMap());
      var left = (minX - pad) + offset.x;
      var top = (minY - pad) + offset.y;
      this.inner.style.left = left + "px";
      this.inner.style.top = top + "px";
      this.inner.style.width = (w + 2 * pad) + "px";
      this.inner.style.height = (h + 2 * pad) + "px";
      this.inner.style.visibility = "visible";
      this.svg.setAttribute("viewBox", "0 0 " + (w + 2 * pad) + " " + (h + 2 * pad));
      this.svg.setAttribute("width", "100%");
      this.svg.setAttribute("height", "100%");
      var pts = points.map(function (p) { return (p.x - minX + pad) + "," + (p.y - minY + pad); }).join(" ");
      this.poly.setAttribute("points", pts);
    };
    PulsePositionerOverlay.prototype.onRemove = function () {
      if (this.wrapper && this.wrapper.parentNode) this.wrapper.parentNode.removeChild(this.wrapper);
    };
    var positioner = new PulsePositionerOverlay();
    positioner.setMap(map);
    var fadeOutMs = 350;
    setTimeout(function () {
      if (positioner.wrapper) {
        positioner.wrapper.classList.add("mv-pulse-ring-wrap--fade-out");
      }
      setTimeout(function () {
        positioner.setMap(null);
      }, fadeOutMs);
    }, durationMs || 2000);
  }

  function getLogoBadgeRotationDeg(booth) {
    const deg = Number(booth && booth.rotation_deg) || 0;
    if (deg === 67.5) return -22.5;
    if (deg === 90) return 0;
    return deg;
  }

  function getDefaults() {
    try {
      return window.__MV_DEFAULTS__ || {};
    } catch (_) {
      return {};
    }
  }

  function getMapId() {
    try {
      return window.__MV_MAP_ID__ || "";
    } catch (_) {
      return "";
    }
  }

  var MAP_MAX_ZOOM = 23;

  function openDetail(id) {
    closeMenu();
    state.selectedId = id;
    const sheet = document.getElementById("mvDetailSheet");
    const body = document.getElementById("mvDetailBody");
    const idEl = document.getElementById("mvDetailBoothId");
    if (!sheet || !body || !idEl) return;
    const booth = state.vendors[id];
    idEl.textContent = id || "—";
    if (!booth) {
      body.innerHTML = "<p class=\"mv-detail-value\">No details.</p>";
    } else {
      body.innerHTML = window.McppMobileDetailHtml.buildDetailHtml(booth);
    }
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
  }

  function maybeOpenBoothFromQuery() {
    try {
      var params = new URLSearchParams(window.location.search);
      var booth = params.get("booth");
      if (!booth || !state.vendors[booth]) return;
      state._preserveViewportAfterListDeepLink = true;
      // From vendor list "View on Map": map + pan only, no detail card.
      if (params.get("view") === "map") {
        state._panToBoothIdFromList = booth;
        history.replaceState({}, "", window.location.pathname);
        return;
      }
      openDetail(booth);
      history.replaceState({}, "", window.location.pathname);
    } catch (e) { /* ignore */ }
  }

  var DETAIL_CLOSE_DURATION_MS = 300;
  /** After switching to map tab, wait this long before closing the card so the map can lay out and paint. */
  var VIEW_ON_MAP_TAB_SETTLE_MS = 180;
  /** After close animation ends, wait this long before panning so resize from close doesn't override the pan. */
  var VIEW_ON_MAP_PAN_AFTER_CLOSE_MS = 60;
  /** Extra pause with map visible before pan starts so the user sees the current view, then the pan. */
  var VIEW_ON_MAP_DELAY_BEFORE_PAN_MS = 100;
  /** Duration of the pan animation so the move to the booth is visible (ms). */
  var VIEW_ON_MAP_PAN_DURATION_MS = 400;
  /** After pan + zoom settle, short wait before booth highlight pulse (detail sheet → View on Map). */
  var VIEW_ON_MAP_PULSE_AFTER_PAN_MS = 120;
  /**
   * Minimum time from runWhenMapReadyForAnimation() entry before starting pan/zoom.
   * iOS Safari often needs layout + one frame after idle before setCenter updates paint.
   */
  var MAP_ANIM_MIN_READY_MS = 120;

  function nowMs() {
    return typeof performance !== "undefined" && typeof performance.now === "function"
      ? performance.now()
      : Date.now();
  }

  /**
   * Pan the map from its current center to target over durationMs so the movement is visible.
   * Uses setTimeout (not requestAnimationFrame): on many mobile browsers rAF is throttled until the user
   * interacts with the page, so the pan would not run until the user moved the map.
   * @param {google.maps.Map} map
   * @param {google.maps.LatLng} target
   * @param {number} durationMs
   * @param {function} onComplete called when the pan finishes
   */
  /**
   * Nudge the map so WebKit / Mobile Safari actually composites camera updates (resize + zero pan).
   * Without this, setCenter loops can run but the canvas stays frozen until the user pans.
   */
  function wakeMapForProgrammaticCamera(map) {
    if (!map || !window.google) return;
    try {
      if (google.maps.event) google.maps.event.trigger(map, "resize");
    } catch (e) { /* ignore */ }
    try {
      if (typeof map.panBy === "function") map.panBy(0, 0);
    } catch (e2) { /* ignore */ }
  }

  function slowPanTo(map, target, durationMs, onComplete) {
    if (!map || !target || durationMs <= 0) {
      if (onComplete) onComplete();
      return;
    }
    var start = map.getCenter();
    if (!start) {
      map.panTo(target);
      if (onComplete) onComplete();
      return;
    }
    var startLat = start.lat(), startLng = start.lng();
    var endLat = target.lat(), endLng = target.lng();
    var t0 = nowMs();
    var tickMs = 16;
    var wokeCamera = false;
    function tick() {
      if (!wokeCamera) {
        wokeCamera = true;
        wakeMapForProgrammaticCamera(map);
      }
      var elapsed = nowMs() - t0;
      var t = Math.min(elapsed / durationMs, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      var lat = startLat + (endLat - startLat) * eased;
      var lng = startLng + (endLng - startLng) * eased;
      map.setCenter({ lat: lat, lng: lng });
      if (t < 1) {
        setTimeout(tick, tickMs);
      } else {
        map.setCenter(target);
        if (onComplete) onComplete();
      }
    }
    setTimeout(tick, 0);
  }

  var MV_MAP_VIEWPORT_KEY = "mvMapViewport";
  var _viewportSaveTimer = null;

  function readSavedMapViewport() {
    try {
      var raw = localStorage.getItem(MV_MAP_VIEWPORT_KEY);
      if (!raw) return null;
      var o = JSON.parse(raw);
      if (!o || typeof o.lat !== "number" || typeof o.lng !== "number") return null;
      if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng)) return null;
      if (Math.abs(o.lat) > 90 || Math.abs(o.lng) > 180) return null;
      var z = Number(o.zoom);
      if (!Number.isFinite(z)) z = 20;
      z = Math.max(10, Math.min(24, z));
      return { lat: o.lat, lng: o.lng, zoom: z };
    } catch (e) {
      return null;
    }
  }

  function scheduleSaveMapViewport() {
    if (!state.map || state._suppressViewportSave) return;
    if (_viewportSaveTimer) clearTimeout(_viewportSaveTimer);
    _viewportSaveTimer = setTimeout(function () {
      _viewportSaveTimer = null;
      if (!state.map || state._suppressViewportSave) return;
      try {
        var c = state.map.getCenter();
        if (!c) return;
        var z = state.map.getZoom();
        if (z == null || !Number.isFinite(z)) return;
        z = Math.round(z);
        localStorage.setItem(
          MV_MAP_VIEWPORT_KEY,
          JSON.stringify({ lat: c.lat(), lng: c.lng(), zoom: z })
        );
      } catch (e) { /* ignore quota / private mode */ }
    }, 650);
  }

  /** Smooth zoom so the camera does not jump after pan (vendor list → map). */
  function animateZoomTo(map, targetZoom, durationMs, onDone) {
    function finishOverlaySync() {
      state._suppressOverlayZoomSync = false;
      if (typeof state._updateMobileLogoBadgeSizes === "function") {
        state._updateMobileLogoBadgeSizes();
      }
    }
    if (!map || targetZoom == null || !Number.isFinite(targetZoom)) {
      if (onDone) onDone();
      return;
    }
    var startZ = map.getZoom();
    if (startZ == null || !Number.isFinite(startZ)) {
      map.setZoom(targetZoom);
      if (onDone) onDone();
      return;
    }
    if (Math.abs(startZ - targetZoom) < 0.05) {
      map.setZoom(targetZoom);
      if (onDone) onDone();
      return;
    }
    state._suppressOverlayZoomSync = true;
    var t0 = nowMs();
    var tickMs = 16;
    var wokeCamera = false;
    function stepZoom() {
      if (!wokeCamera) {
        wokeCamera = true;
        wakeMapForProgrammaticCamera(map);
      }
      var elapsed = nowMs() - t0;
      var t = Math.min(elapsed / durationMs, 1);
      var eased = 1 - Math.pow(1 - t, 2);
      var z = startZ + (targetZoom - startZ) * eased;
      map.setZoom(Math.round(z));
      if (t < 1) {
        setTimeout(stepZoom, tickMs);
      } else {
        map.setZoom(Math.round(targetZoom));
        finishOverlaySync();
        if (onDone) onDone();
      }
    }
    setTimeout(stepZoom, 0);
  }

  /** Pan/zoom to booth when opening /mobile?booth=id&view=map from vendor list. */
  var LIST_NAV_PAN_DURATION_MS = 1100;
  /** Zoom-in animation length (ms); runs in parallel with the end of the pan when overlap is used. */
  var LIST_NAV_ZOOM_DURATION_MS = 550;
  /** Start zoom when pan progress reaches this fraction (0–1) so zoom begins before the pan fully stops. */
  var LIST_NAV_ZOOM_START_AT_PAN_T = 0.68;
  /** After pan + zoom both finish, brief pause before pulse (lets overlay sync finish). */
  var LIST_NAV_PULSE_AFTER_ZOOM_MS = 30;

  function runVendorListPanToBooth(id) {
    var booth = state.vendors[id];
    if (!booth || !state.map) {
      state._suppressViewportSave = false;
      return;
    }
    var c = booth.center;
    if (!c || !Number.isFinite(Number(c.lat)) || !Number.isFinite(Number(c.lng))) {
      state._suppressViewportSave = false;
      return;
    }
    try {
      state.map.setTilt(0);
      state.map.setHeading(0);
    } catch (e) { /* ignore */ }
    var map = state.map;
    var centerLl = new google.maps.LatLng(Number(c.lat), Number(c.lng));
    var endLat = centerLl.lat();
    var endLng = centerLl.lng();
    state._suppressViewportSave = true;

    function finishVendorListNavToBooth() {
      if (state._updateMobileBadgePositions) state._updateMobileBadgePositions();
      setTimeout(function () {
        var path = boothRectPath(booth);
        if (path.length >= 3) createPulseRingDom(state.map, path, 2000);
        state._suppressViewportSave = false;
        scheduleSaveMapViewport();
      }, LIST_NAV_PULSE_AFTER_ZOOM_MS);
    }

    setTimeout(function () {
      if (!state.map) {
        state._suppressViewportSave = false;
        return;
      }
      var start = map.getCenter();
      if (!start) {
        wakeMapForProgrammaticCamera(map);
        map.panTo(centerLl);
        animateZoomTo(map, MAP_MAX_ZOOM, LIST_NAV_ZOOM_DURATION_MS, finishVendorListNavToBooth);
        return;
      }
      var startLat = start.lat();
      var startLng = start.lng();
      var panMs = LIST_NAV_PAN_DURATION_MS;
      var zoomStartT = LIST_NAV_ZOOM_START_AT_PAN_T;
      var panStartTime = null;
      var zoomScheduled = false;
      var panComplete = false;
      var zoomComplete = false;
      var wokeCamera = false;

      function tryFinishVendorListNav() {
        if (!panComplete || !zoomComplete) return;
        finishVendorListNavToBooth();
      }

      function scheduleZoom() {
        if (zoomScheduled) return;
        zoomScheduled = true;
        animateZoomTo(map, MAP_MAX_ZOOM, LIST_NAV_ZOOM_DURATION_MS, function () {
          zoomComplete = true;
          tryFinishVendorListNav();
        });
      }

      function panStep() {
        if (!wokeCamera) {
          wokeCamera = true;
          wakeMapForProgrammaticCamera(map);
        }
        if (panStartTime == null) panStartTime = nowMs();
        var elapsed = nowMs() - panStartTime;
        var t = Math.min(elapsed / panMs, 1);
        var eased = 1 - Math.pow(1 - t, 3);
        var lat = startLat + (endLat - startLat) * eased;
        var lng = startLng + (endLng - startLng) * eased;
        map.setCenter({ lat: lat, lng: lng });

        if (!zoomScheduled && t >= zoomStartT) {
          scheduleZoom();
        }

        if (t < 1) {
          setTimeout(panStep, 16);
        } else {
          map.setCenter(centerLl);
          panComplete = true;
          if (!zoomScheduled) {
            scheduleZoom();
          }
          tryFinishVendorListNav();
        }
      }
      setTimeout(panStep, 0);
    }, 0);
  }

  function tryPanToBoothFromVendorListNav() {
    var boothId = state._panToBoothIdFromList;
    if (!boothId || !state.map || !window.google || !google.maps) return;
    if (!state.vendors[boothId]) {
      state._panToBoothIdFromList = null;
      return;
    }
    if (state._vendorListPanAwaitingIdle) return;
    state._vendorListPanAwaitingIdle = true;
    var done = false;
    var idleListener = null;
    var fallbackTimer = null;
    function finish() {
      if (done) return;
      done = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try {
        if (idleListener) google.maps.event.removeListener(idleListener);
      } catch (e) { /* ignore */ }
      state._vendorListPanAwaitingIdle = false;
      if (state._panToBoothIdFromList !== boothId) return;
      state._panToBoothIdFromList = null;
      if (!state.vendors[boothId]) return;
      setTimeout(function () {
        runVendorListPanToBooth(boothId);
      }, 0);
    }
    idleListener = google.maps.event.addListenerOnce(state.map, "idle", finish);
    fallbackTimer = setTimeout(finish, 800);
  }

  function closeDetail() {
    state.selectedId = null;
    const sheet = document.getElementById("mvDetailSheet");
    if (!sheet) return;
    if (document.activeElement && sheet.contains(document.activeElement)) {
      var menuBtn = document.getElementById("mvMenuBtn");
      if (menuBtn && typeof menuBtn.focus === "function") menuBtn.focus();
      else if (document.activeElement && typeof document.activeElement.blur === "function") document.activeElement.blur();
    }
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
    setTimeout(function () {
      finishClose();
      scheduleMapLayoutRecovery();
    }, DETAIL_CLOSE_DURATION_MS);
  }

  /**
   * @param {{ preserveViewport?: boolean }} [options] If preserveViewport, keep center/zoom (e.g. event day change).
   */
  function drawMapPolygons(options) {
    if (!state.map || !window.google || !google.maps) return;
    var opts = options || {};
    var preserveViewport = opts.preserveViewport === true;
    if (state._preserveViewportAfterListDeepLink) {
      preserveViewport = true;
      state._preserveViewportAfterListDeepLink = false;
    }
    Object.keys(state.polygons).forEach((id) => {
      state.polygons[id].setMap(null);
    });
    state.polygons = {};
    Object.keys(state.logoOverlays || {}).forEach((id) => {
      const o = state.logoOverlays[id];
      if (o && o.remove) o.remove();
    });
    state.logoOverlays = {};
    Object.keys(state.labelOverlays || {}).forEach((id) => {
      const o = state.labelOverlays[id];
      if (o && o.remove) o.remove();
    });
    state.labelOverlays = {};
    Object.keys(state.badgeOverlays || {}).forEach((id) => {
      var b = state.badgeOverlays[id];
      if (b && b.category && b.category.remove) b.category.remove();
      if (b && b.status && b.status.remove) b.status.remove();
    });
    state.badgeOverlays = {};
    if (state.proj && state.proj.setMap) state.proj.setMap(null);
    state.proj = null;
    function ProjectionOverlay() {}
    ProjectionOverlay.prototype = Object.create(google.maps.OverlayView.prototype);
    ProjectionOverlay.prototype.constructor = ProjectionOverlay;
    ProjectionOverlay.prototype.onAdd = function () {};
    ProjectionOverlay.prototype.draw = function () {};
    ProjectionOverlay.prototype.onRemove = function () {};
    var projOverlay = new ProjectionOverlay();
    projOverlay.setMap(state.map);
    state.proj = projOverlay;
    if (state._logoZoomListener) {
      try { google.maps.event.removeListener(state._logoZoomListener); } catch (e) {}
      state._logoZoomListener = null;
    }
    const bounds = new google.maps.LatLngBounds();
    let hasBounds = false;
    const visibleVendors = getVisibleVendors();
    Object.entries(visibleVendors).forEach(([id, booth]) => {
      const path = boothRectPath(booth);
      if (path.length < 3) return;
      path.forEach((ll) => { bounds.extend(ll); hasBounds = true; });
      const catKey = normalizeCategoryKey(booth.category);
      const style = CAT[catKey] || CAT.standard;
      const poly = new google.maps.Polygon({
        paths: path,
        strokeColor: style.s,
        strokeOpacity: 1,
        strokeWeight: 1,
        fillColor: style.f,
        fillOpacity: 0.75,
        clickable: true,
        zIndex: 1000
      });
      poly.setMap(state.map);
      poly.addListener("click", () => openDetail(id));
      state.polygons[id] = poly;
    });
    Object.entries(visibleVendors).forEach(([id, booth]) => {
      const logoUrl = (booth.logo_url || "").trim();
      if (!logoUrl) return;
      const c = booth.center || {};
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const anchor = new google.maps.LatLng(lat, lng);
      const wrap = document.createElement("div");
      wrap.style.cssText = "position:relative;width:0;height:0;pointer-events:none;";
      const el = document.createElement("div");
      el.className = "mv-logo-badge";
      const zoom = state.map.getZoom();
      const size = logoBadgeSizePxForZoom(zoom);
      el.style.position = "absolute";
      el.style.left = "50%";
      el.style.top = "50%";
      el.style.width = size + "px";
      el.style.height = size + "px";
      el.style.transformOrigin = "center center";
      const rot = getLogoBadgeRotationDeg(booth);
      el.style.transform = "translate(-50%,-50%) rotate(" + rot + "deg)";
      const img = document.createElement("img");
      img.alt = "Vendor logo";
      img.referrerPolicy = "no-referrer";
      img.loading = "lazy";
      img.src = logoUrl;
      el.appendChild(img);
      wrap.appendChild(el);
      const marker = createDomOverlay(state.map, wrap, anchor, { zIndex: 200, pane: "floatPane" }); // below ribbon badges (500/501)
      if (marker) {
        const show = (zoom >= LOGO_BADGE_MIN_ZOOM);
        marker.setVisible(show);
        state.logoOverlays[id] = { remove: marker.remove, setVisible: marker.setVisible, el: el, booth: booth };
      }
    });
    Object.entries(visibleVendors).forEach(function (entry) {
      const id = entry[0];
      const booth = entry[1];
      if ((booth.logo_url || "").trim()) return;
      const c = booth.center || {};
      const lat = Number(c.lat);
      const lng = Number(c.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const anchor = new google.maps.LatLng(lat, lng);
      const labelEl = document.createElement("div");
      labelEl.textContent = id;
      var labelFontPx = labelFontPxForZoom(state.map.getZoom());
      labelEl.style.cssText = [
        "color:#eaf6f5",
        "font-weight:700",
        "font-size:" + labelFontPx + "px",
        "font-family:-apple-system,BlinkMacSystemFont,\"Segoe UI\",Roboto,\"Helvetica Neue\",Arial,sans-serif",
        "text-shadow:0 0 2px rgba(0,0,0,.6)",
        "transform:translate(-50%,-50%)",
        "display:flex",
        "align-items:center",
        "justify-content:center",
        "text-align:center",
        "width:3ch",
        "height:1.6em",
        "white-space:nowrap",
        "line-height:1.6em",
        "padding:0",
        "pointer-events:none"
      ].join(";");
      const labelOverlay = createDomOverlay(state.map, labelEl, anchor, { zIndex: 100, pane: "overlayMouseTarget" });
      if (labelOverlay) {
        var z = state.map.getZoom();
        labelOverlay.setVisible(z >= LABEL_HIDE_ZOOM);
        state.labelOverlays[id] = { remove: labelOverlay.remove, setVisible: labelOverlay.setVisible, el: labelEl };
      }
    });
    Object.entries(visibleVendors).forEach(function (entry) {
      var id = entry[0];
      var booth = entry[1];
      var path = boothRectPath(booth);
      if (path.length < 4) return;
      var presetRot = snapRotationToPreset(booth.rotation_deg || 0);
      var badgeRot = getBadgeRotation(presetRot);
      var catKey = normalizeCategoryKey(booth.category);
      var catEmoji = CAT_EMOJI[catKey] || CAT_EMOJI.standard;
      var catRibbonColor = (CAT[catKey] && CAT[catKey].s) ? CAT[catKey].s : "#4ea186";
      var centerLatLng = path[0] && path[1] && path[2] && path[3] ? new google.maps.LatLng(
        (path[0].lat() + path[1].lat() + path[2].lat() + path[3].lat()) / 4,
        (path[0].lng() + path[1].lng() + path[2].lng() + path[3].lng()) / 4
      ) : new google.maps.LatLng(Number(booth.center && booth.center.lat) || DEFAULT_CENTER.lat, Number(booth.center && booth.center.lng) || DEFAULT_CENTER.lng);
      var catWrap = document.createElement("div");
      catWrap.style.cssText = "position:relative;width:0;height:0;pointer-events:none;";
      var catEl = document.createElement("div");
      catEl.className = "booth-badge booth-category-badge";
      if (badgeRot === 45) catEl.classList.add("booth-badge-rot-45");
      else if (badgeRot === 22.5) catEl.classList.add("booth-badge-rot-22-5");
      else if (badgeRot === -22.5) catEl.classList.add("booth-badge-rot-minus-22-5");
      else catEl.classList.add("booth-badge-rot-0");
      catEl.style.position = "absolute";
      catEl.style.left = "0";
      catEl.style.top = "0";
      var svgNS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(svgNS, "svg");
      svg.setAttribute("viewBox", "0 0 32 32");
      svg.setAttribute("width", "100%");
      svg.setAttribute("height", "100%");
      svg.setAttribute("aria-hidden", "true");
      svg.style.color = catRibbonColor;
      var use = document.createElementNS(svgNS, "use");
      use.setAttribute("href", "#badge-ribbon-only");
      svg.appendChild(use);
      catEl.appendChild(svg);
      var emojiSpan = document.createElement("span");
      emojiSpan.className = "booth-category-emoji";
      emojiSpan.textContent = catEmoji;
      catEl.appendChild(emojiSpan);
      catWrap.appendChild(catEl);
      var catNudgeRight = 23;
      var catNudgePx = (presetRot === 67.5) ? { dx: -10 + catNudgeRight, dy: 5 } : (presetRot === 90) ? { dx: -11 + catNudgeRight, dy: 1 } : (presetRot !== 0 && presetRot !== 22.5 && presetRot !== 45) ? { dx: catNudgeRight, dy: -1 } : { dx: catNudgeRight, dy: 0 };
      var catMarker = createBadgePositionOverlay(state.map, catWrap, path, 3, catNudgePx, { zIndex: 500, pane: "floatPane" });
      if (!catMarker) return;
      var showBadgesNow = (state.map.getZoom() || 0) >= BADGE_RIBBON_MIN_ZOOM;
      catMarker.setVisible(showBadgesNow);
      state.badgeOverlays[id] = { category: catMarker, status: null, booth: booth, path: path };
      var badgeType = null;
      var badgeId = null;
      var badgeTitle = null;
      var badgeColor = null;
      if (booth.is_event_staff) { badgeType = "event-staff"; badgeId = "#badge-event-staff"; badgeTitle = "Event staff"; badgeColor = "var(--danger)"; }
      else if (booth.is_partner_vendor) { badgeType = "partner-vendor"; badgeId = "#badge-partner-vendor"; badgeTitle = "Partner vendor"; badgeColor = "#3498DB"; }
      else if (booth.is_featured_vendor) { badgeType = "featured-vendor"; badgeId = "#badge-featured-vendor"; badgeTitle = "Featured vendor"; badgeColor = "#FFD700"; }
      else if (booth.is_return_vendor) { badgeType = "returning-vendor"; badgeId = "#badge-returning-vendor"; badgeTitle = "Returning vendor"; badgeColor = "var(--mv-hi)"; }
      if (badgeType && badgeId) {
        var wrap = document.createElement("div");
        wrap.style.cssText = "position:relative;width:0;height:0;pointer-events:none;";
        var el = document.createElement("div");
        el.className = "booth-badge booth-" + badgeType + "-badge";
        if (badgeRot === 45) el.classList.add("booth-badge-rot-45");
        else if (badgeRot === 22.5) el.classList.add("booth-badge-rot-22-5");
        else if (badgeRot === -22.5) el.classList.add("booth-badge-rot-minus-22-5");
        else el.classList.add("booth-badge-rot-0");
        el.style.position = "absolute";
        el.style.left = "0";
        el.style.top = "0";
        el.setAttribute("title", badgeTitle);
        var svg2 = document.createElementNS(svgNS, "svg");
        svg2.setAttribute("viewBox", "0 0 32 32");
        svg2.setAttribute("width", "100%");
        svg2.setAttribute("height", "100%");
        svg2.setAttribute("aria-hidden", "true");
        var use2 = document.createElementNS(svgNS, "use");
        use2.setAttribute("href", badgeId);
        use2.setAttribute("style", "color:" + badgeColor);
        svg2.appendChild(use2);
        el.appendChild(svg2);
        wrap.appendChild(el);
        var BADGE_SIZE_PX_STATUS = 22;
        var statusGetNudge = function (proj) {
          if (presetRot === 67.5) {
            var catPx = proj.fromLatLngToDivPixel(path[3]);
            var statusPx = proj.fromLatLngToDivPixel(path[2]);
            var catRightX = catPx.x - 10 + BADGE_SIZE_PX_STATUS * Math.cos(-22.5 * Math.PI / 180);
            return { dx: catRightX - statusPx.x - 3, dy: -11 };
          }
          if (presetRot === 90) return { dx: 0, dy: -11 };
          return { dx: 0, dy: 0 };
        };
        var statusMarker = createBadgePositionOverlay(state.map, wrap, path, 2, statusGetNudge, { zIndex: 501, pane: "floatPane" });
        if (statusMarker) {
          state.badgeOverlays[id].status = statusMarker;
          statusMarker.setVisible(showBadgesNow);
        }
      }
    });
    var idleHandle = state.map.addListener("idle", function () {
      updateMobileBadgePositions();
      google.maps.event.removeListener(idleHandle);
    });
    function applyPixelNudge(proj, ll, nudgePx) {
      if (!proj || !ll || (nudgePx.dx === 0 && nudgePx.dy === 0)) return ll;
      var p = proj.fromLatLngToDivPixel(ll);
      var q = { x: p.x + (nudgePx.dx || 0), y: p.y + (nudgePx.dy || 0) };
      try { return proj.fromDivPixelToLatLng(q); } catch (e) { return ll; }
    }
    function updateMobileBadgePositions() {
      if (!state.map || !state.proj) return;
      var proj = state.proj.getProjection && state.proj.getProjection();
      if (!proj) return;
    }
    function updateMobileLogoBadgeSizes() {
      if (!state.map) return;
      if (state._suppressOverlayZoomSync) return;
      var z = state.map.getZoom();
      var size = logoBadgeSizePxForZoom(z);
      var showLogo = (z >= LOGO_BADGE_MIN_ZOOM);
      if (state.logoOverlays) {
        Object.keys(state.logoOverlays).forEach(function (id) {
          var o = state.logoOverlays[id];
          if (!o || !o.el) return;
          o.el.style.width = size + "px";
          o.el.style.height = size + "px";
          if (o.setVisible) o.setVisible(showLogo);
        });
      }
      var showLabel = (z >= LABEL_HIDE_ZOOM);
      var labelFontPx = labelFontPxForZoom(z);
      if (state.labelOverlays) {
        Object.keys(state.labelOverlays).forEach(function (id) {
          var o = state.labelOverlays[id];
          if (!o) return;
          if (o.el) o.el.style.fontSize = labelFontPx + "px";
          if (o.setVisible) o.setVisible(showLabel);
        });
      }
      var showBadges = (z >= BADGE_RIBBON_MIN_ZOOM);
      if (state.badgeOverlays) {
        Object.keys(state.badgeOverlays).forEach(function (id) {
          var b = state.badgeOverlays[id];
          if (!b) return;
          if (b.category && b.category.setVisible) b.category.setVisible(showBadges);
          if (b.status && b.status.setVisible) b.status.setVisible(showBadges);
        });
      }
      updateMobileBadgePositions();
    }
    state._updateMobileBadgePositions = updateMobileBadgePositions;
    state._updateMobileLogoBadgeSizes = updateMobileLogoBadgeSizes;
    state._logoZoomListener = state.map.addListener("zoom_changed", updateMobileLogoBadgeSizes);
    updateMobileLogoBadgeSizes();
    if (!preserveViewport && hasBounds && !bounds.isEmpty()) {
      var padding = { top: 40, bottom: 40, left: 20, right: 20 };
      state.map.fitBounds(bounds, padding);
      var fitIdle = state.map.addListener("idle", function () {
        google.maps.event.removeListener(fitIdle);
        state.map.setZoom(20);
      });
    }
  }

  function isGoogleMapsAvailable() {
    return !!(window.google && google.maps && typeof google.maps.Map === "function");
  }

  /**
   * Run fn once the Maps JS API is present (async script may load after this bundle).
   * Avoids ensureMap() returning null when "View on Map" runs before initMobileMap.
   */
  function whenMapsReady(fn) {
    if (typeof fn !== "function") return;
    if (isGoogleMapsAvailable()) {
      fn();
      return;
    }
    var attempts = 0;
    var maxAttempts = 300;
    var t = setInterval(function () {
      attempts++;
      if (isGoogleMapsAvailable()) {
        clearInterval(t);
        fn();
      } else if (attempts >= maxAttempts) {
        clearInterval(t);
        console.warn("mobile-viewer: Google Maps API not available after waiting");
      }
    }, 50);
  }

  /**
   * After tab/detail layout changes, Maps often needs resize + idle to repaint tiles and overlays.
   * Keeps a single Map instance; does not reload the API (tile cache remains browser-managed).
   */
  function scheduleMapLayoutRecovery() {
    if (!state.map || !window.google || !google.maps.event) return;
    var map = state.map;
    function bump() {
      google.maps.event.trigger(map, "resize");
    }
    bump();
    setTimeout(function () {
      bump();
      setTimeout(bump, 0);
    }, 0);
    setTimeout(bump, 50);
    setTimeout(bump, 200);
    setTimeout(bump, 500);
    google.maps.event.addListenerOnce(map, "idle", function () {
      bump();
      if (state._updateMobileBadgePositions) state._updateMobileBadgePositions();
    });
  }

  /**
   * Run fn after resize + idle (or fallback), so programmatic pan/zoom runs when the map can paint.
   * Mitigates blank/stuck map until user touch on some mobile WebViews after closing the detail sheet.
   */
  function runWhenMapReadyForAnimation(map, fn) {
    if (!map || typeof fn !== "function") return;
    if (!window.google || !google.maps.event) {
      fn();
      return;
    }
    var done = false;
    var idleListener = null;
    var fallbackTimer = null;
    var t0 = nowMs();
    function run() {
      if (done) return;
      done = true;
      if (fallbackTimer) clearTimeout(fallbackTimer);
      try {
        if (idleListener) google.maps.event.removeListener(idleListener);
      } catch (e) { /* ignore */ }
      var elapsed = nowMs() - t0;
      var wait = Math.max(0, MAP_ANIM_MIN_READY_MS - elapsed);
      setTimeout(function () {
        triggerMapResize();
        wakeMapForProgrammaticCamera(map);
        setTimeout(function () {
          triggerMapResize();
          wakeMapForProgrammaticCamera(map);
          fn();
        }, 0);
      }, wait);
    }
    idleListener = google.maps.event.addListenerOnce(map, "idle", run);
    fallbackTimer = setTimeout(run, 650);
  }

  function triggerMapResize() {
    if (!state.map || !window.google || !google.maps.event) return;
    google.maps.event.trigger(state.map, "resize");
  }

  var CENTER_MAP_ZOOM = 20;

  function centerMapOnBooths() {
    if (!state.map || !window.google || !google.maps.LatLngBounds) return;
    var visible = getVisibleVendors();
    var bounds = new google.maps.LatLngBounds();
    var hasBounds = false;
    Object.entries(visible).forEach(function (entry) {
      var path = boothRectPath(entry[1]);
      if (path.length < 3) return;
      path.forEach(function (ll) { bounds.extend(ll); hasBounds = true; });
    });
    if (!hasBounds || bounds.isEmpty()) return;
    var z = state.map.getZoom();
    if (z != null && Math.round(z) === CENTER_MAP_ZOOM) {
      state.map.panTo(bounds.getCenter());
      if (state._updateMobileBadgePositions) state._updateMobileBadgePositions();
      return;
    }
    var padding = { top: 40, bottom: 40, left: 20, right: 20 };
    state.map.fitBounds(bounds, padding);
    var idleOnce = state.map.addListener("idle", function () {
      google.maps.event.removeListener(idleOnce);
      state.map.setZoom(CENTER_MAP_ZOOM);
      if (state._updateMobileBadgePositions) state._updateMobileBadgePositions();
    });
  }

  function updateMapLabelsButton() {
    var btn = document.getElementById("mvMapLabels");
    if (!btn) return;
    var on = state.map && state.map.getMapTypeId() === "hybrid";
    if (on) btn.classList.add("on"); else btn.classList.remove("on");
  }

  function ensureMap() {
    if (state.map) return state.map;
    const mapEl = document.getElementById("mvMap");
    if (!mapEl || !isGoogleMapsAvailable()) return null;
    const defs = getDefaults();
    const saved = readSavedMapViewport();
    const defaultCenter = (defs.center && { lat: defs.center.lat, lng: defs.center.lng }) || DEFAULT_CENTER;
    const defaultZoom = (defs.zoom != null && defs.zoom >= 0) ? defs.zoom : 20;
    const center = saved ? { lat: saved.lat, lng: saved.lng } : defaultCenter;
    const zoom = Math.round(saved ? saved.zoom : defaultZoom);
    const opts = {
      center,
      zoom,
      mapTypeId: "satellite",
      /* Top-down 2D — avoid 3D / 45° imagery warping overlays and satellite tiles. */
      tilt: 0,
      heading: 0,
      isFractionalZoomEnabled: false,
      // Hide native zoom / map-type / fullscreen UI; users pan & pinch-zoom on the map canvas.
      disableDefaultUI: true,
      scrollwheel: true,
      gestureHandling: "auto"
    };
    state.map = new google.maps.Map(mapEl, opts);
    try {
      state.map.setTilt(0);
      state.map.setHeading(0);
    } catch (e) { /* ignore */ }
    state.map.addListener("tilt_changed", function () {
      try {
        if (state.map && Number(state.map.getTilt()) > 0) state.map.setTilt(0);
      } catch (e2) { /* ignore */ }
    });
    state.map.addListener("idle", scheduleSaveMapViewport);
    drawMapPolygons({});
    updateMapLabelsButton();
    tryPanToBoothFromVendorListNav();
    setTimeout(function () {
      triggerMapResize();
      setTimeout(triggerMapResize, 100);
      setTimeout(triggerMapResize, 350);
    }, 0);
    return state.map;
  }

  function closeMenu() {
    var drawer = document.getElementById("mvMenuDrawer");
    var backdrop = document.getElementById("mvMenuBackdrop");
    var btn = document.getElementById("mvMenuBtn");
    if (!drawer) return;
    drawer.classList.remove("mv-menu-drawer--open");
    drawer.setAttribute("aria-hidden", "true");
    if (backdrop) {
      backdrop.classList.remove("mv-menu-backdrop--visible");
      backdrop.setAttribute("aria-hidden", "true");
    }
    document.body.classList.remove("mv-menu-open");
    if (btn) {
      btn.setAttribute("aria-expanded", "false");
    }
  }

  function openMenu() {
    var drawer = document.getElementById("mvMenuDrawer");
    var backdrop = document.getElementById("mvMenuBackdrop");
    var btn = document.getElementById("mvMenuBtn");
    if (!drawer) return;
    drawer.classList.add("mv-menu-drawer--open");
    drawer.setAttribute("aria-hidden", "false");
    if (backdrop) {
      backdrop.classList.add("mv-menu-backdrop--visible");
      backdrop.setAttribute("aria-hidden", "false");
    }
    document.body.classList.add("mv-menu-open");
    if (btn) {
      btn.setAttribute("aria-expanded", "true");
    }
    var closeBtn = document.getElementById("mvMenuClose");
    if (closeBtn && typeof closeBtn.focus === "function") {
      try {
        closeBtn.focus();
      } catch (e) { /* ignore */ }
    }
  }

  function initMenuDrawer() {
    var btn = document.getElementById("mvMenuBtn");
    var closeBtn = document.getElementById("mvMenuClose");
    var backdrop = document.getElementById("mvMenuBackdrop");
    var drawer = document.getElementById("mvMenuDrawer");
    if (!btn || !drawer) return;
    btn.addEventListener("click", function () {
      if (drawer.classList.contains("mv-menu-drawer--open")) {
        closeMenu();
        btn.focus();
      } else {
        openMenu();
      }
    });
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        closeMenu();
        btn.focus();
      });
    }
    if (backdrop) {
      backdrop.addEventListener("click", function () {
        closeMenu();
        btn.focus();
      });
    }
    document.addEventListener("keydown", function (ev) {
      if (ev.key !== "Escape") return;
      if (!drawer.classList.contains("mv-menu-drawer--open")) return;
      closeMenu();
      btn.focus();
    });
  }

  /**
   * Ensures the (singleton) map exists and kicks layout recovery.
   * @param {function(): void} [onReady] runs after map is available (may wait for async Maps API).
   */
  function switchToMapTab(onReady) {
    function activate() {
      ensureMap();
      scheduleMapLayoutRecovery();
      setTimeout(triggerMapResize, 50);
      if (typeof onReady === "function") onReady();
    }
    if (isGoogleMapsAvailable()) activate();
    else whenMapsReady(activate);
  }

  function initDetailSheet() {
    const closeBtn = document.getElementById("mvDetailClose");
    const backdrop = document.getElementById("mvDetailBackdrop");
    const viewOnMapBtn = document.getElementById("mvDetailViewOnMap");
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
    var PULSE_RING_DURATION_MS = 2000;

    function runBoothPulseRing(boothId) {
      var booth = boothId && state.vendors ? state.vendors[boothId] : null;
      if (!state.map || !booth) return;
      var path = boothRectPath(booth);
      if (path.length < 3) return;
      createPulseRingDom(state.map, path, PULSE_RING_DURATION_MS);
    }

    if (viewOnMapBtn) {
      viewOnMapBtn.addEventListener("click", function () {
        var id = state.selectedId;
        var booth = id && state.vendors ? state.vendors[id] : null;
        // Wait until Maps API + map exist before scheduling pan (LatLng needs google.maps).
        switchToMapTab(function () {
          var centerLl = null;
          if (booth && booth.center && Number.isFinite(Number(booth.center.lat)) && Number.isFinite(Number(booth.center.lng))) {
            var c = booth.center;
            centerLl = new google.maps.LatLng(Number(c.lat), Number(c.lng));
          }
          setTimeout(function () {
            scheduleMapLayoutRecovery();
            closeDetail();
            var delayBeforePan = DETAIL_CLOSE_DURATION_MS + VIEW_ON_MAP_PAN_AFTER_CLOSE_MS + VIEW_ON_MAP_DELAY_BEFORE_PAN_MS;
            setTimeout(function () {
              if (!state.map || !centerLl) return;
              runWhenMapReadyForAnimation(state.map, function () {
                slowPanTo(state.map, centerLl, VIEW_ON_MAP_PAN_DURATION_MS, function () {
                  state.map.setZoom(MAP_MAX_ZOOM);
                  if (state._updateMobileBadgePositions) state._updateMobileBadgePositions();
                  setTimeout(function () { runBoothPulseRing(id); }, VIEW_ON_MAP_PULSE_AFTER_PAN_MS);
                });
              });
            }, delayBeforePan);
          }, VIEW_ON_MAP_TAB_SETTLE_MS);
        });
      });
    }
  }

  function loadVendors() {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((data) => {
        state.vendors = data && typeof data === "object" ? data : {};
        // Open detail from ?booth= first so we can set _preserveViewportAfterListDeepLink before any redraw.
        maybeOpenBoothFromQuery();
        if (state.map) drawMapPolygons({});
        tryPanToBoothFromVendorListNav();
      })
      .catch(() => {
        state.vendors = {};
        maybeOpenBoothFromQuery();
      });
  }

  window.initMobileMap = function initMobileMap() {
    state.mapsApiReady = true;
    var mapPanel = document.getElementById("mvMapPanel");
    if (mapPanel && mapPanel.classList.contains("active")) {
      ensureMap();
      scheduleMapLayoutRecovery();
      setTimeout(triggerMapResize, 150);
      setTimeout(triggerMapResize, 500);
    }
  };

  function initMapControls() {
    var centerBtn = document.getElementById("mvMapCenter");
    var labelsBtn = document.getElementById("mvMapLabels");
    if (centerBtn) {
      centerBtn.addEventListener("click", function () {
        centerMapOnBooths();
      });
    }
    if (labelsBtn) {
      labelsBtn.addEventListener("click", function () {
        if (!state.map) return;
        var type = state.map.getMapTypeId();
        state.map.setMapTypeId(type === "satellite" ? "hybrid" : "satellite");
        state.mapLabelsOn = (type === "satellite");
        updateMapLabelsButton();
      });
      updateMapLabelsButton();
    }
  }

  var MV_DAY_KEY = "mvSelectedMapDay";

  function scheduledDayOptionForValue(value) {
    for (var i = 0; i < SCHEDULED_DAY_OPTIONS.length; i++) {
      if (SCHEDULED_DAY_OPTIONS[i].value === value) return SCHEDULED_DAY_OPTIONS[i];
    }
    return null;
  }

  /** Match desktop map day label: `date` is DoW, Month D, YYYY (see core-state initMapDayFilter). */
  function mapDayTitleForOption(opt) {
    if (!opt) return "";
    return opt.date || opt.full || opt.short || opt.value || "";
  }

  function updateMapDayBar() {
    var el = document.getElementById("mvMapDayBarText");
    if (!el) return;
    var opt = scheduledDayOptionForValue(state.selectedMapDay);
    var text = mapDayTitleForOption(opt);
    el.textContent = text;
  }

  function initDayFilter() {
    var sel = document.getElementById("mvMapDaySelect");
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
    updateMapDayBar();
    sel.addEventListener("change", function () {
      state.selectedMapDay = sel.value || SCHEDULED_DAY_ORDER[0] || "saturday";
      try {
        localStorage.setItem(MV_DAY_KEY, state.selectedMapDay);
      } catch (e2) { /* ignore */ }
      updateMapDayBar();
      if (state.selectedId && !getVisibleVendors()[state.selectedId]) {
        closeDetail();
      }
      if (state.map) drawMapPolygons({ preserveViewport: true });
    });
  }

  function initBadgeLegend() {
    var legend = document.getElementById("mvBadgeLegend");
    var header = legend && legend.querySelector(".mv-legend-header");
    if (!legend || !header) return;
    var storageKey = "mvBadgeLegendCollapsed";
    function syncAria() {
      var collapsed = legend.classList.contains("collapsed");
      header.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
    try {
      if (localStorage.getItem(storageKey) === "true") {
        legend.classList.add("collapsed");
      }
    } catch (e) { /* ignore */ }
    syncAria();
    function toggleLegend() {
      var collapsed = legend.classList.toggle("collapsed");
      try {
        localStorage.setItem(storageKey, collapsed ? "true" : "false");
      } catch (e2) { /* ignore */ }
      syncAria();
    }
    header.addEventListener("click", function (ev) {
      ev.preventDefault();
      toggleLegend();
    });
    header.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        toggleLegend();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initMenuDrawer();
    initDetailSheet();
    initMapControls();
    initDayFilter();
    initBadgeLegend();
    loadVendors();
    document.addEventListener("visibilitychange", function () {
      if (document.hidden || !state.map) return;
      scheduleMapLayoutRecovery();
    });
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted && state.map) scheduleMapLayoutRecovery();
    });
  });
})();
