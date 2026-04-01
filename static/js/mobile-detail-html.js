/**
 * Shared booth detail HTML for mobile map + mobile vendor list (no desktop dependency).
 */
(function () {
  "use strict";

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

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  function buildDetailHtml(booth) {
    var catKey = normalizeCategoryKey(booth.category);
    var catName = CAT_NAMES[catKey] || "Vendor";
    var biz = booth.biz || booth.vendor_name || "—";
    var vendorName = booth.vendor_name ? escapeHtml(booth.vendor_name) : "";
    var showPhone = booth.phone && (booth.phone_public !== false);
    var showEmail = booth.email && (booth.email_public !== false);
    var website = (booth.website || "").trim();
    var address = (booth.business_address || "").trim();
    var days = Array.isArray(booth.scheduled_days) ? booth.scheduled_days : [];
    var logoUrl = (booth.logo_url || "").trim();
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
      badgeList.forEach(function (b) {
        html += '<span class="mv-detail-badge mv-detail-badge-' + escapeHtml(b.id) + '" title="' + escapeHtml(b.label) + '">';
        html += '<svg width="28" height="28" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><use href="#' + escapeHtml(b.svgId) + '"/></svg>';
        html += '<span class="mv-detail-badge-text">' + escapeHtml(b.label) + '</span></span>';
      });
      html += '</div></div></div>';
    }
    if (days.length) {
      var dayToDate = { friday: "Friday, May 15, 2026", saturday: "Saturday, May 16, 2026", sunday: "Sunday, May 17, 2026" };
      html += '<div class="mv-detail-section mv-detail-section-days"><div class="mv-detail-section-title">Scheduled Days</div><div class="mv-detail-schedule">';
      days.forEach(function (d) {
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
      html += "</div>";
    }
    return html;
  }

  window.McppMobileDetailHtml = {
    escapeHtml: escapeHtml,
    normalizeCategoryKey: normalizeCategoryKey,
    buildDetailHtml: buildDetailHtml,
    CAT_NAMES: CAT_NAMES,
    CAT_EMOJI: CAT_EMOJI
  };
})();
