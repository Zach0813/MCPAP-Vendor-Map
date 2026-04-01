/**
 * Shared mobile vendor list rendering for /mobile/vendors (and tooling).
 * Depends on scheduled-days.js (window.__MCPP_SCHEDULED_DAYS__).
 */
(function () {
  "use strict";

  var CAT = {
    standard: { f: "#1e392f", s: "#4ea186" },
    collaborator: { f: "#2f3346", s: "#7582d8" },
    foodbeverage: { f: "#4a2c1b", s: "#e28850" },
    activity: { f: "#2f1f3f", s: "#c06ae6" },
    misc: { f: "#353535", s: "#8a8a8a" }
  };
  var CAT_NAMES = {
    standard: "Plant Vendor",
    collaborator: "Craft Vendor",
    foodbeverage: "Food & Drink",
    activity: "Entertainment",
    misc: "Miscellaneous"
  };
  var CAT_EMOJI = {
    standard: "\uD83E\uDEB4",
    collaborator: "\uD83C\uDFA8",
    foodbeverage: "\uD83C\uDF7D",
    activity: "\uD83C\uDFAA",
    misc: "\u2728"
  };
  var CATEGORY_ORDER = ["standard", "collaborator", "foodbeverage", "activity", "misc"];

  var _days = window.__MCPP_SCHEDULED_DAYS__ || {};
  var SCHEDULED_DAY_ORDER = _days.order || ["saturday", "sunday"];
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

  function normalizeCategoryKey(k) {
    var key = String(k || "standard").toLowerCase().replace(/[^a-z]/g, "");
    var alias = {
      standard: "standard", plant: "standard", plantvendor: "standard",
      collaborator: "collaborator", craft: "collaborator",
      foodbeverage: "foodbeverage", food: "foodbeverage", beverage: "foodbeverage",
      activity: "activity", entertainment: "activity",
      misc: "misc", miscellaneous: "misc", other: "misc"
    };
    return alias[key] || "standard";
  }

  function categoryLabel(key) {
    return CAT_NAMES[key] ? CAT_NAMES[key] : (key ? key.charAt(0).toUpperCase() + key.slice(1) : "Vendor");
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

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function getVisibleVendors(vendors, selectedMapDay) {
    var day = selectedMapDay || SCHEDULED_DAY_ORDER[0] || "saturday";
    if (!vendors) return {};
    var filtered = {};
    Object.keys(vendors).forEach(function (id) {
      var booth = vendors[id];
      if (!booth) return;
      var days = normalizeScheduledDays(booth.scheduled_days || []);
      if (days.indexOf(day) !== -1) filtered[id] = booth;
    });
    return filtered;
  }

  /**
   * @param {HTMLElement} listEl
   * @param {{ vendors: object, selectedMapDay: string, searchQuery: string, listCollapsed: object }} state
   * @param {{ onBoothClick: function(string): void }} handlers
   */
  function render(listEl, state, handlers) {
    if (!listEl) return;
    var onBoothClick = handlers && typeof handlers.onBoothClick === "function" ? handlers.onBoothClick : function () {};
    var q = (state.searchQuery || "").toLowerCase().trim();
    var grouped = {};
    Object.entries(getVisibleVendors(state.vendors, state.selectedMapDay)).forEach(function (entry) {
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
    var listCollapsed = state.listCollapsed || {};
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
        item.addEventListener("click", function () {
          onBoothClick(id);
        });
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

  window.McppMobileVendorList = { render: render };
})();
