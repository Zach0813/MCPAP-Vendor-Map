/**
 * Shared scheduled day options and helpers for desktop and mobile.
 * Load before core-state.js (desktop) or mobile-viewer.js (mobile).
 */
(function () {
  "use strict";

  var SCHEDULED_DAY_OPTIONS = [
    { value: "saturday", short: "Sat", full: "Saturday", date: "Saturday, May 16, 2026", dateShort: "5/16/26" },
    { value: "sunday", short: "Sun", full: "Sunday", date: "Sunday, May 17, 2026", dateShort: "5/17/26" }
  ];
  var SCHEDULED_DAY_ORDER = SCHEDULED_DAY_OPTIONS.map(function (o) { return o.value; });

  function normalizeScheduledDays(list) {
    if (!Array.isArray(list)) return [];
    var seen = {};
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var key = String(list[i] || "").toLowerCase();
      if (SCHEDULED_DAY_ORDER.indexOf(key) !== -1 && !seen[key]) {
        seen[key] = true;
        out.push(key);
      }
    }
    return out.sort(function (a, b) { return SCHEDULED_DAY_ORDER.indexOf(a) - SCHEDULED_DAY_ORDER.indexOf(b); });
  }

  window.__MCPP_SCHEDULED_DAYS__ = {
    options: SCHEDULED_DAY_OPTIONS,
    order: SCHEDULED_DAY_ORDER,
    normalize: normalizeScheduledDays
  };
})();
