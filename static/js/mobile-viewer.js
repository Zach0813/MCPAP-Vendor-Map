/**
 * Mobile viewer — standalone script for /mobile. No shared desktop code.
 * Viewer-only: list, map with booth polygons, detail sheet.
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
    const key = String(k || "standard").toLowerCase().replace(/[^a-z]/g, "");
    const alias = {
      standard: "standard", plant: "standard", plantvendor: "standard",
      collaborator: "collaborator", craft: "collaborator",
      foodbeverage: "foodbeverage", food: "foodbeverage", beverage: "foodbeverage",
      activity: "activity", entertainment: "activity",
      misc: "misc", miscellaneous: "misc", other: "misc"
    };
    return alias[key] || "standard";
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
    searchQuery: "",
    mapsApiReady: false,
    mapLabelsOn: false,
    selectedMapDay: "saturday"
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

  var CATEGORY_ORDER = ["standard", "collaborator", "foodbeverage", "activity", "misc"];
  var listCollapsed = {};

  function categoryLabel(key) {
    return (CAT_NAMES && CAT_NAMES[key]) ? CAT_NAMES[key] : (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Vendor");
  }

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== "string") return "rgba(0,0,0," + alpha + ")";
    var clean = hex.replace("#", "");
    if (clean.length !== 6) return "rgba(0,0,0," + alpha + ")";
    var r = parseInt(clean.slice(0, 2), 16);
    var g = parseInt(clean.slice(2, 4), 16);
    var b = parseInt(clean.slice(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function renderList() {
    var listEl = document.getElementById("mvBoothList");
    if (!listEl) return;
    var q = (state.searchQuery || "").toLowerCase().trim();
    var grouped = {};
    Object.entries(getVisibleVendors()).forEach(function (entry) {
      var id = entry[0];
      var booth = entry[1];
      if (q) {
        var hay = [
          id || "",
          booth.biz || "",
          booth.vendor_name || "",
          booth.phone || "",
          booth.email || "",
          booth.website || "",
          booth.notes || ""
        ].join(" ").toLowerCase();
        if (!hay.includes(q)) return;
      }
      var key = normalizeCategoryKey(booth.category);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push([id, booth]);
    });
    var order = CATEGORY_ORDER.concat(Object.keys(grouped).filter(function (k) { return CATEGORY_ORDER.indexOf(k) === -1; }));
    listEl.innerHTML = "";
    var hasAny = false;
    order.forEach(function (catKey) {
      var items = grouped[catKey];
      if (!items || !items.length) return;
      hasAny = true;
      items.sort(function (a, b) { return String(a[0]).localeCompare(b[0], undefined, { numeric: true }); });
      var section = document.createElement("div");
      section.className = "mv-list-category";
      section.dataset.cat = catKey;
      var header = document.createElement("button");
      header.type = "button";
      header.className = "mv-category-header";
      header.setAttribute("aria-expanded", listCollapsed[catKey] ? "false" : "true");
      var catEmoji = CAT_EMOJI[catKey] || CAT_EMOJI.standard;
      header.innerHTML = "<span class=\"mv-category-label\"><span class=\"mv-category-caret\">▾</span><span class=\"mv-category-emoji\" aria-hidden=\"true\">" + catEmoji + "</span>" + escapeHtml(categoryLabel(catKey)) + "</span><span class=\"mv-category-count\">" + items.length + "</span>";
      var body = document.createElement("div");
      body.className = "mv-category-body";
      body.style.display = listCollapsed[catKey] ? "none" : "block";
      var catTheme = CAT[catKey] || CAT.standard;
      if (catTheme && catTheme.f) {
        header.style.background = catTheme.f;
        header.style.borderBottom = "1px solid " + (catTheme.s || "rgba(0,0,0,.2)");
        header.style.color = "#eaf6f5";
        section.style.borderColor = catTheme.s || catTheme.f;
        section.style.background = hexToRgba(catTheme.f, 0.18);
        body.style.background = hexToRgba(catTheme.f, 0.1);
      }
      header.addEventListener("click", function () {
        listCollapsed[catKey] = !listCollapsed[catKey];
        body.style.display = listCollapsed[catKey] ? "none" : "block";
        header.setAttribute("aria-expanded", listCollapsed[catKey] ? "false" : "true");
      });
      items.forEach(function (pair) {
        var id = pair[0];
        var booth = pair[1];
        var item = document.createElement("button");
        item.type = "button";
        item.className = "mv-list-item";
        item.dataset.boothId = id;
        var style = CAT[catKey] || CAT.standard;
        var swatchStyle = "background:" + style.f + ";border-color:" + style.s;
        var name = booth.biz || booth.vendor_name || "—";
        item.innerHTML = "<span class=\"mv-list-swatch\" style=\"" + escapeHtml(swatchStyle) + "\" aria-hidden=\"true\"></span><span class=\"mv-list-item-id\">" + escapeHtml(id) + "</span><span class=\"mv-list-item-name\"><span>" + escapeHtml(name) + "</span></span>";
        var logoUrl = (booth.logo_url || "").trim();
        if (logoUrl) {
          var logoWrap = document.createElement("span");
          logoWrap.className = "mv-list-item-logo";
          var img = document.createElement("img");
          img.src = logoUrl;
          img.alt = "";
          img.loading = "lazy";
          img.setAttribute("draggable", "false");
          logoWrap.appendChild(img);
          item.appendChild(logoWrap);
        }
        item.addEventListener("click", function () { openDetail(id); });
        body.appendChild(item);
      });
      section.appendChild(header);
      section.appendChild(body);
      listEl.appendChild(section);
    });
    if (!hasAny) {
      var empty = document.createElement("div");
      empty.className = "mv-empty-list";
      empty.textContent = q ? "No vendors match your search." : "No vendors yet.";
      listEl.appendChild(empty);
    }
  }

  function escapeHtml(s) {
    const div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  var MAP_MAX_ZOOM = 23;

  function openDetail(id) {
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
      body.innerHTML = buildDetailHtml(booth);
      // Do not center or zoom the map here. The map only pans to the booth when the user
      // clicks "View on Map", so the pan is visible when coming from the vendor list.
    }
    sheet.classList.add("open");
    sheet.setAttribute("aria-hidden", "false");
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

  /**
   * Pan the map from its current center to target over durationMs so the movement is visible.
   * @param {google.maps.Map} map
   * @param {google.maps.LatLng} target
   * @param {number} durationMs
   * @param {function} onComplete called when the pan finishes
   */
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
    var startTime = null;
    function step(timestamp) {
      if (startTime == null) startTime = timestamp;
      var elapsed = timestamp - startTime;
      var t = Math.min(elapsed / durationMs, 1);
      // ease-out cubic so the pan slows at the end
      var eased = 1 - Math.pow(1 - t, 3);
      var lat = startLat + (endLat - startLat) * eased;
      var lng = startLng + (endLng - startLng) * eased;
      map.setCenter({ lat: lat, lng: lng });
      if (t < 1) {
        requestAnimationFrame(step);
      } else {
        map.setCenter(target);
        if (onComplete) onComplete();
      }
    }
    requestAnimationFrame(step);
  }

  function closeDetail() {
    state.selectedId = null;
    const sheet = document.getElementById("mvDetailSheet");
    if (!sheet) return;
    if (document.activeElement && sheet.contains(document.activeElement)) {
      var activeTab = document.querySelector(".mv-tab.active");
      if (activeTab && typeof activeTab.focus === "function") activeTab.focus();
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
      if (state.map && state._updateMobileBadgePositions) {
        triggerMapResize();
        var idleOnce = state.map.addListener("idle", function () {
          google.maps.event.removeListener(idleOnce);
          state._updateMobileBadgePositions();
        });
      }
    }, DETAIL_CLOSE_DURATION_MS);
  }

  function buildDetailHtml(booth) {
    const catKey = normalizeCategoryKey(booth.category);
    const catName = CAT_NAMES[catKey] || "Vendor";
    const biz = booth.biz || booth.vendor_name || "—";
    const vendorName = booth.vendor_name ? escapeHtml(booth.vendor_name) : "";
    const showPhone = booth.phone && (booth.phone_public !== false);
    const showEmail = booth.email && (booth.email_public !== false);
    const website = (booth.website || "").trim();
    const address = (booth.business_address || "").trim();
    const days = Array.isArray(booth.scheduled_days) ? booth.scheduled_days : [];
    const logoUrl = (booth.logo_url || "").trim();
    var badgeList = [];
    if (booth.is_event_staff) badgeList.push({ id: "event-staff", label: "Event Staff", svgId: "badge-event-staff" });
    if (booth.is_partner_vendor) badgeList.push({ id: "partner-vendor", label: "Partner Vendor", svgId: "badge-partner-vendor" });
    if (booth.is_featured_vendor) badgeList.push({ id: "featured-vendor", label: "Featured Vendor", svgId: "badge-featured-vendor" });
    if (booth.is_return_vendor) badgeList.push({ id: "returning-vendor", label: "Returning Vendor", svgId: "badge-returning-vendor" });

    var html = "";
    html += '<div class="mv-detail-top">';
    html += '<div class="mv-detail-top-text">';
    var catEmoji = CAT_EMOJI[catKey] || "";
    html += '<div class="mv-detail-row"><div class="mv-detail-label">Category</div><div class="mv-detail-value">' + (catEmoji ? "<span class=\"mv-detail-cat-emoji\" aria-hidden=\"true\">" + catEmoji + "</span> " : "") + escapeHtml(catName) + '</div></div>';
    html += '<div class="mv-detail-row"><div class="mv-detail-label">Business / Booth</div><div class="mv-detail-value">' + escapeHtml(biz) + '</div></div>';
    if (vendorName) {
      html += '<div class="mv-detail-row"><div class="mv-detail-label">Vendor name</div><div class="mv-detail-value">' + vendorName + '</div></div>';
    }
    html += '</div>';
    if (logoUrl) {
      html += '<div class="mv-detail-logo-wrap"><img class="mv-detail-logo" src="' + escapeHtml(logoUrl) + '" alt="Vendor logo" referrerpolicy="no-referrer"></div>';
    }
    html += '</div>';
    if (badgeList.length) {
      html += '<div class="mv-detail-status-section"><div class="mv-detail-label">Vendor Status</div><div class="mv-detail-badges-wrap"><div class="mv-detail-badges">';
      badgeList.forEach(function(b) {
        html += '<span class="mv-detail-badge mv-detail-badge-' + escapeHtml(b.id) + '" title="' + escapeHtml(b.label) + '">';
        html += '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href="#' + escapeHtml(b.svgId) + '"/></svg>';
        html += '<span class="mv-detail-badge-text">' + escapeHtml(b.label) + '</span></span>';
      });
      html += '</div></div></div>';
    }
    if (days.length) {
      var dayToDate = { friday: 'Friday, May 15, 2026', saturday: 'Saturday, May 16, 2026', sunday: 'Sunday, May 17, 2026' };
      html += '<div class="mv-detail-section mv-detail-section-days"><div class="mv-detail-section-title">Scheduled Days</div><div class="mv-detail-schedule">';
      days.forEach(function(d) {
        var label = dayToDate[d] || d;
        html += '<span class="mv-detail-day">' + escapeHtml(label) + '</span>';
      });
      html += '</div></div>';
    }
    var hasContact = showPhone || showEmail || !!website || !!address;
    if (hasContact) {
      html += '<div class="mv-detail-section mv-detail-section-contact"><div class="mv-detail-section-title">Contact</div>';
      if (showPhone) {
        var tel = (booth.phone || "").replace(/\D/g, "");
        html += '<div class="mv-detail-row"><div class="mv-detail-label">Phone</div><div class="mv-detail-value"><a href="tel:' + escapeHtml(tel) + '">' + escapeHtml(booth.phone) + '</a></div></div>';
      }
      if (showEmail) {
        html += '<div class="mv-detail-row"><div class="mv-detail-label">Email</div><div class="mv-detail-value"><a href="mailto:' + escapeHtml(booth.email) + '">' + escapeHtml(booth.email) + '</a></div></div>';
      }
      if (website) {
        html += '<div class="mv-detail-row"><div class="mv-detail-label">Website</div><div class="mv-detail-value"><a href="' + escapeHtml(website) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(website) + '</a></div></div>';
      }
      if (address) {
        var mapsUrl = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(address);
        html += '<div class="mv-detail-row"><div class="mv-detail-label">Address</div><div class="mv-detail-value"><a href="' + escapeHtml(mapsUrl) + '" target="_blank" rel="noopener noreferrer">' + escapeHtml(address) + '</a></div></div>';
      }
      html += '</div>';
    }
    return html;
  }

  function drawMapPolygons() {
    if (!state.map || !window.google || !google.maps) return;
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
    const defs = getDefaults();
    const center = (defs.center && { lat: defs.center.lat, lng: defs.center.lng }) || DEFAULT_CENTER;
    state.map.setCenter(center);
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
    state._logoZoomListener = state.map.addListener("zoom_changed", updateMobileLogoBadgeSizes);
    updateMobileLogoBadgeSizes();
    if (hasBounds && !bounds.isEmpty()) {
      var padding = { top: 40, bottom: 40, left: 20, right: 20 };
      state.map.fitBounds(bounds, padding);
      var fitIdle = state.map.addListener("idle", function () {
        google.maps.event.removeListener(fitIdle);
        state.map.setZoom(20);
      });
    }
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
    if (!mapEl || !state.mapsApiReady || !window.google || !google.maps) return null;
    const defs = getDefaults();
    const center = (defs.center && { lat: defs.center.lat, lng: defs.center.lng }) || DEFAULT_CENTER;
    const zoom = (defs.zoom != null && defs.zoom >= 0) ? defs.zoom : 20;
    const opts = {
      center,
      zoom,
      mapTypeId: "satellite",
      mapTypeControl: false,
      rotateControl: false,
      streetViewControl: false,
      fullscreenControl: false,
      zoomControl: true,
      scrollwheel: true,
      gestureHandling: "auto"
    };
    state.map = new google.maps.Map(mapEl, opts);
    drawMapPolygons();
    updateMapLabelsButton();
    requestAnimationFrame(function () {
      triggerMapResize();
      setTimeout(triggerMapResize, 100);
      setTimeout(triggerMapResize, 350);
    });
    return state.map;
  }

  function showPanel(tabKey) {
    const listPanel = document.getElementById("mvListPanel");
    const mapPanel = document.getElementById("mvMapPanel");
    if (!listPanel || !mapPanel) return;
    listPanel.classList.toggle("active", tabKey === "list");
    mapPanel.classList.toggle("active", tabKey === "map");
    if (tabKey === "map") {
      ensureMap();
      setTimeout(triggerMapResize, 50);
    }
  }

  function initTabs() {
    const tabs = document.querySelectorAll(".mv-tab");
    const listPanel = document.getElementById("mvListPanel");
    const mapPanel = document.getElementById("mvMapPanel");
    if (!tabs.length || !listPanel || !mapPanel) return;
    tabs.forEach((tab) => {
      tab.addEventListener("click", function () {
        const t = tab.getAttribute("data-tab");
        if (!t) return;
        tabs.forEach(function (x) {
          x.classList.remove("active");
          x.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        showPanel(t);
      });
    });
  }

  function switchToMapTab() {
    const tabs = document.querySelectorAll(".mv-tab");
    tabs.forEach(function (t) {
      var isMap = t.getAttribute("data-tab") === "map";
      t.classList.toggle("active", isMap);
      t.setAttribute("aria-selected", isMap ? "true" : "false");
    });
    showPanel("map");
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
        var centerLl = null;
        if (booth && booth.center && Number.isFinite(Number(booth.center.lat)) && Number.isFinite(Number(booth.center.lng))) {
          var c = booth.center;
          centerLl = new google.maps.LatLng(Number(c.lat), Number(c.lng));
        }
        switchToMapTab();
        // Let the map panel lay out and paint before closing the card (avoids pan before map is visible).
        setTimeout(function () {
          if (state.map) triggerMapResize();
          closeDetail();
          // Pan after close animation + buffer + extra delay so user sees the map before it moves.
          var delayBeforePan = DETAIL_CLOSE_DURATION_MS + VIEW_ON_MAP_PAN_AFTER_CLOSE_MS + VIEW_ON_MAP_DELAY_BEFORE_PAN_MS;
          setTimeout(function () {
            if (state.map && centerLl) {
              slowPanTo(state.map, centerLl, VIEW_ON_MAP_PAN_DURATION_MS, function () {
                state.map.setZoom(MAP_MAX_ZOOM);
                if (state._updateMobileBadgePositions) state._updateMobileBadgePositions();
                setTimeout(function () { runBoothPulseRing(id); }, 350);
              });
            }
          }, delayBeforePan);
        }, VIEW_ON_MAP_TAB_SETTLE_MS);
      });
    }
  }

  function initSearch() {
    const searchEl = document.getElementById("mvSearch");
    if (!searchEl) return;
    searchEl.addEventListener("input", () => {
      state.searchQuery = searchEl.value;
      renderList();
    });
  }

  function loadVendors() {
    fetch("/api/vendors")
      .then((r) => r.json())
      .then((data) => {
        state.vendors = data && typeof data === "object" ? data : {};
        renderList();
        if (state.map) drawMapPolygons();
      })
      .catch(() => {
        state.vendors = {};
        renderList();
      });
  }

  window.initMobileMap = function initMobileMap() {
    state.mapsApiReady = true;
    var mapPanel = document.getElementById("mvMapPanel");
    if (mapPanel && mapPanel.classList.contains("active")) {
      ensureMap();
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

  function initDayFilter() {
    var sel = document.getElementById("mvMapDaySelect");
    if (!sel) return;
    sel.innerHTML = "";
    SCHEDULED_DAY_OPTIONS.forEach(function (opt) {
      var o = document.createElement("option");
      o.value = opt.value;
      o.textContent = (opt.dateShort != null ? opt.dateShort : opt.date) || opt.full || opt.value;
      sel.appendChild(o);
    });
    state.selectedMapDay = sel.value || SCHEDULED_DAY_ORDER[0] || "saturday";
    if (sel.value !== state.selectedMapDay) sel.value = state.selectedMapDay;
    sel.addEventListener("change", function () {
      state.selectedMapDay = sel.value || SCHEDULED_DAY_ORDER[0] || "saturday";
      if (state.selectedId && !getVisibleVendors()[state.selectedId]) {
        closeDetail();
      }
      renderList();
      if (state.map) drawMapPolygons();
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initTabs();
    initDetailSheet();
    initSearch();
    initMapControls();
    initDayFilter();
    loadVendors();
  });
})();
