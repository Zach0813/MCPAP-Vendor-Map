(() => {
  "use strict";
  // #region MCPP: Vendor Logo Badges (overlay logos on booth centers)
  // Split target: badges.js — Advanced Marker logo overlays
  // Uses config from mcpp-config.js: SHOW_LOGO_BADGES, LOGO_BADGE_MIN_ZOOM,
  // LOGO_BADGE_BASE_PX, LOGO_BADGE_MIN_PX, LOGO_BADGE_MAX_PX, LOGO_BADGE_PLACEHOLDER

  (function(){
    if (!window.S) window.S = {};
    const MCPP = window.MCPP = window.MCPP || {};

    const badgesEnabled = () => (typeof SHOW_LOGO_BADGES === 'undefined') ? true : !!SHOW_LOGO_BADGES;
    const getMinZoom = () => (typeof LOGO_BADGE_MIN_ZOOM !== 'undefined') ? LOGO_BADGE_MIN_ZOOM : 20.75;
    const getRibbonBadgeMinZoom = () => (typeof BADGE_RIBBON_MIN_ZOOM !== 'undefined') ? BADGE_RIBBON_MIN_ZOOM : 20.75;

    const setMarkerPosition = (target, pos) => {
      if (!target || !pos) return;
      if (typeof MCPP.setPos === 'function') {
        MCPP.setPos(target, pos);
        return;
      }
      if ('position' in target) target.position = pos;
      else if (typeof target.setPosition === 'function') target.setPosition(pos);
    };

  // Small helpers to reduce repeated style code
  function __applyBadgeStyles(el, size){
    if (!el) return;
    el.style.width  = size + 'px';
    el.style.height = size + 'px';
    el.style.position = 'absolute';
    el.style.left = '50%';
    el.style.top  = '50%';
    el.style.transform = 'translate(-50%, -50%)';
    el.style.transformOrigin = 'center center';
  }
  // Logo rotation: match booth angle except 67.5→-22.5, 90→0 (same as category/status badges)
  function getLogoBadgeRotationDeg(booth) {
    const preset = (typeof window.snapRotationToPreset === 'function')
      ? window.snapRotationToPreset(Number(booth && booth.rotation_deg) || 0)
      : 0;
    if (preset === 67.5) return -22.5;
    if (preset === 90) return 0;
    return preset;
  }
  function __applyLogoBadgeRotation(el, booth) {
    if (!el || !booth) return;
    const deg = getLogoBadgeRotationDeg(booth);
    el.style.transform = 'translate(-50%, -50%) rotate(' + deg + 'deg)';
  }
  function __applyBadgeImgStyles(img){
    if (!img) return;
    img.style.width = '100%';
    img.style.height = '100%';
    img.style.objectFit = 'contain';
    img.style.objectPosition = 'center center';
    img.style.display = 'block';
  }


  // Use same centering logic as booth labels
  function getVisualCenterAdjusted(b) {
    if (typeof MCPP.getVisualCenterAdjusted === 'function') {
      return MCPP.getVisualCenterAdjusted(b);
    }
    if (!window.S || !S.proj || typeof S.proj.getProjection !== 'function' || !S.proj.getProjection()) {
      return (b && b.center)
        ? new google.maps.LatLng(b.center.lat, b.center.lng)
        : (S.map ? S.map.getCenter() : new google.maps.LatLng(0,0));
    }
    if (typeof window.getVisualCenterAdjusted === 'function') {
      return window.getVisualCenterAdjusted(b);
    }
    return (b && b.center)
      ? new google.maps.LatLng(b.center.lat, b.center.lng)
      : (S.map ? S.map.getCenter() : new google.maps.LatLng(0,0));
  }

  function badgeAnchorForBooth(b) {
    if (!b) return getVisualCenterAdjusted(b);
    const id = b.id || (b && b.id);
    if (id && S.shapes && S.shapes[id] && S.shapes[id].centerLL) {
      const ll = S.shapes[id].centerLL;
      if (ll && typeof ll.lat === 'function' && typeof ll.lng === 'function') return ll;
      if (ll && typeof google !== 'undefined' && google.maps && typeof google.maps.LatLng === 'function') {
        return new google.maps.LatLng(ll.lat, ll.lng);
      }
    }
    return getVisualCenterAdjusted(b);
  }

  // Logo scales with zoom like polygon size (2x per zoom level) so it stays in proportion
  function logoBadgeSizePxForZoom(z) {
    const factor = Math.pow(2, z - 21);
    const px = LOGO_BADGE_BASE_PX * factor;
    return Math.max(LOGO_BADGE_MIN_PX, Math.min(LOGO_BADGE_MAX_PX, px));
  }


  function ensureLogoBadgeForBooth(b, id) {
    if (!badgesEnabled() || !S.map) return;
    if (!MCPP.createDomOverlay) {
      // DOM overlay helper missing; skip gracefully
      destroyLogoBadge(id);
      return;
    }
    // Skip booths that have no actual logo_url (hide/destroy any prior badge)
    if (!b.logo_url || !b.logo_url.trim()) {
      destroyLogoBadge(id);
      return;
    }
    if (!S.logoBadges) S.logoBadges = {};

    const zoom = S.map.getZoom();
    const shouldShow = (zoom >= getMinZoom());
    const existing = S.logoBadges[id];
    if (existing) {
      if (!shouldShow) { setBadgeVisible(id, false); return; }
      const size = logoBadgeSizePxForZoom(zoom);
      __applyBadgeStyles(existing.el, size);
      __applyLogoBadgeRotation(existing.el, b);
      __applyBadgeImgStyles(existing.img);
      setMarkerPosition(existing.marker, badgeAnchorForBooth(b));
      const src = b.logo_url.trim();
      if (existing.img.src !== src) existing.img.src = src;
    const sh = S.shapes && S.shapes[id];
    if (sh) {
      if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(false);
      else if (sh.setLabelVisible) sh.setLabelVisible(false);
      else if (sh.labelEl) sh.labelEl.style.display = 'none';
      sh.logoBadgeOverlay = existing.marker;
      sh.badgeHiddenByOverlap = existing.hiddenByOverlap === true;
      sh.badgeBaseVisible = existing.baseVisible !== false;
    }
      existing.baseVisible = true;
      if (existing.wrap) existing.wrap.style.display = existing.hiddenByOverlap ? 'none' : '';
      if (existing.el) existing.el.style.display = existing.hiddenByOverlap ? 'none' : 'block';
      return;
    }

    if (!shouldShow) return; // don't create if not visible

    const size = logoBadgeSizePxForZoom(zoom);

    // zero-sized wrapper at the marker anchor; inner element is centered with -50%/-50%
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';

    const el = document.createElement('div');
    el.className = 'booth-logo-badge';
    __applyBadgeStyles(el, size);
    __applyLogoBadgeRotation(el, b);
    el.style.pointerEvents = 'none';

    const img = document.createElement('img');
    img.alt = 'Vendor logo';
    img.referrerPolicy = 'no-referrer';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.src = b.logo_url.trim();
    __applyBadgeImgStyles(img);

    el.appendChild(img);
    wrap.appendChild(el);

    const anchor = badgeAnchorForBooth(b);
    // Logo badge should be above label (zIndex: 100) but below status badge (zIndex: 300)
    const marker = MCPP.createDomOverlay(S.map, wrap, anchor, { zIndex: 200, pane: 'floatPane' });
    if (!marker) { return; }

    S.logoBadges[id] = { marker, wrap, el, img, hiddenByOverlap: false, baseVisible: true };
    const sh = S.shapes && S.shapes[id];
    if (sh) {
      if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(false);
      else if (sh.setLabelVisible) sh.setLabelVisible(false);
      else if (sh.labelEl) sh.labelEl.style.display = 'none';
      sh.logoBadgeOverlay = marker;
      sh.badgeHiddenByOverlap = false;
      sh.badgeBaseVisible = true;
    }
  }

  function destroyLogoBadge(id) {
    if (!S.logoBadges) return;
    const badge = S.logoBadges[id];
    if (!badge) return;
    if (badge.marker) {
      if (badge.marker.remove) badge.marker.remove();
      else if (badge.marker.setMap) badge.marker.setMap(null);
      else try { badge.marker.map = null; } catch (e) {}
    }
    delete S.logoBadges[id];
    const sh = S.shapes && S.shapes[id];
    if (sh) {
      if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(true);
      else if (sh.setLabelVisible) sh.setLabelVisible(true);
      else if (sh.labelEl) sh.labelEl.style.display = '';
      sh.logoBadgeOverlay = null;
      sh.badgeHiddenByOverlap = false;
      sh.badgeBaseVisible = false;
    }
  }

  function setBadgeVisible(id, visible) {
    if (!S.logoBadges) return;
    const badge = S.logoBadges[id];
    if (!badge) return;
    const show = !!visible;
    badge.hiddenByOverlap = !show;
    badge.baseVisible = show;
    if (badge.marker) {
      if (badge.marker.setVisible) badge.marker.setVisible(show);
      else if (badge.marker.setMap) badge.marker.setMap(show ? S.map : null);
      else try { badge.marker.map = show ? S.map : null; } catch (_) {}
    }
    if (badge.wrap) badge.wrap.style.display = show ? '' : 'none';
    if (badge.el) badge.el.style.display = show ? 'block' : 'none';
    const sh = S.shapes && S.shapes[id];
    if (sh) {
      sh.logoBadgeOverlay = badge.marker;
      sh.badgeHiddenByOverlap = badge.hiddenByOverlap;
      sh.badgeBaseVisible = show;
    }
  }

  function updateAllLogoBadges() {
    if (!badgesEnabled() || !S.map) return;
    // Early exit if Advanced Markers aren't available: clean up and bail
    if (!MCPP.createDomOverlay) {
      if (S.logoBadges) {
        Object.keys(S.logoBadges).forEach(destroyLogoBadge);
      }
      return;
    }
    if (!S.logoBadges) S.logoBadges = {};

    const visibleBooths = (typeof MCPP.getBoothsForCurrentDay === 'function') ? MCPP.getBoothsForCurrentDay() : (S.booths || {});
    Object.keys(S.logoBadges || {}).forEach((id) => {
      if (!visibleBooths[id]) destroyLogoBadge(id);
    });

    const z = S.map.getZoom();
    const hideAll    = z < (typeof LABEL_HIDE_ZOOM !== 'undefined' ? LABEL_HIDE_ZOOM : 19.5);   // < 19.5: no labels, no badges
    const showBadges = z >= getMinZoom();       // logos (pictures) at 19.7+
    const showRibbonBadges = z >= getRibbonBadgeMinZoom();  // category/status ribbons at 20.7+
    const midBand    = !hideAll && !showBadges;  // 19.5 <= z < 19.7: labels only

    if (visibleBooths) {
      for (const id in visibleBooths) {
        const b = visibleBooths[id];
        if (!b) continue;
        const hasLogo = !!(b.logo_url && b.logo_url.trim());

        if (hideAll) {
          // No labels, no badges
          const sh = S.shapes && S.shapes[id];
          if (sh) {
            if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(false);
            else if (sh.setLabelVisible) sh.setLabelVisible(false);
            else if (sh.labelEl) sh.labelEl.style.display = 'none';
          }
          destroyLogoBadge(id);
          // also hide any badge overlay when badges/labels are globally hidden
          try {
            const shHide = S.shapes && S.shapes[id];
            if (shHide) {
              if (shHide.badgeOverlay) {
                if (shHide.badgeOverlay.setVisible) shHide.badgeOverlay.setVisible(false);
                else if (shHide.badgeOverlay.setMap) shHide.badgeOverlay.setMap(null);
              }
              if (shHide.categoryOverlay && shHide.categoryOverlay.setVisible) {
                shHide.categoryOverlay.setVisible(false);
              }
            }
          } catch (e) {}
          continue;
        }

        if (midBand) {
          // Labels only
          const sh = S.shapes && S.shapes[id];
          if (sh) {
            if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(true);
            else if (sh.setLabelVisible) sh.setLabelVisible(true);
            else if (sh.labelEl) sh.labelEl.style.display = '';
          }
          destroyLogoBadge(id);
          // hide badge overlay in midBand (labels-only)
          try {
            const shMid = S.shapes && S.shapes[id];
            if (shMid) {
              if (shMid.badgeOverlay) {
                if (shMid.badgeOverlay.setVisible) shMid.badgeOverlay.setVisible(false);
                else if (shMid.badgeOverlay.setMap) shMid.badgeOverlay.setMap(null);
              }
              if (shMid.categoryOverlay && shMid.categoryOverlay.setVisible) {
                shMid.categoryOverlay.setVisible(false);
              }
            }
          } catch (e) {}
          continue;
        }

        // showBadges band (>= 20.75)
  if (hasLogo) {
          // Badge ON, label OFF
          ensureLogoBadgeForBooth(b, id);
          const badge = S.logoBadges[id];
          if (badge) {
            const showBadge = !badge.hiddenByOverlap;
            const size = logoBadgeSizePxForZoom(z);
            __applyBadgeStyles(badge.el, size);
            __applyLogoBadgeRotation(badge.el, b);
            __applyBadgeImgStyles(badge.img);
            setMarkerPosition(badge.marker, badgeAnchorForBooth(b));
            if (badge.wrap) badge.wrap.style.display = showBadge ? '' : 'none';
            if (badge.el) badge.el.style.display = showBadge ? 'block' : 'none';
          }
          const sh = S.shapes && S.shapes[id];
          if (sh) {
            if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(false);
            else if (sh.setLabelVisible) sh.setLabelVisible(false);
            else if (sh.labelEl) sh.labelEl.style.display = 'none';
          }
        } else {
          // No logo: label ON, no badge
          const sh = S.shapes && S.shapes[id];
          if (sh) {
            if (sh.setBaseLabelVisible) sh.setBaseLabelVisible(true);
            else if (sh.setLabelVisible) sh.setLabelVisible(true);
            else if (sh.labelEl) sh.labelEl.style.display = '';
          }
          destroyLogoBadge(id);
        }

        // Ribbon badges (category/status) only at higher zoom; logos use showBadges above
        try {
          const sh2 = S.shapes && S.shapes[id];
          if (sh2) {
            if (sh2.badgeOverlay && sh2.badgeOverlay.setVisible) {
              sh2.badgeOverlay.setVisible(showRibbonBadges);
            }
            if (sh2.categoryOverlay && sh2.categoryOverlay.setVisible) {
              sh2.categoryOverlay.setVisible(showRibbonBadges);
            }
          }
        } catch (e) { /* non-fatal */ }
      }
    }

    if (S._userInteracted && MCPP.updateOverlapVisibility) {
      try { MCPP.updateOverlapVisibility(); } catch (_) {}
    }

    // Cleanup badges for booths removed from S.booths
    for (const id in S.logoBadges) {
      if (!S.booths || !S.booths[id]) destroyLogoBadge(id);
    }
  }

  function repositionLogoBadge(id){
    if (!S.logoBadges || !S.logoBadges[id]) return;
    const booth = (S.booths && S.booths[id]) ? S.booths[id] : null;
    if (!booth) {
      destroyLogoBadge(id);
      return;
    }
    const anchor = badgeAnchorForBooth(booth);
    setMarkerPosition(S.logoBadges[id].marker, anchor);
  }

  // Hook into redraw if present so badges update after geometry/labels
  const __origRedraw = (typeof redraw === 'function') ? redraw : null;
  if (__origRedraw) {
    redraw = function(){
      const r = __origRedraw.apply(this, arguments);
      try { updateAllLogoBadges(); } catch(e) {}
      return r;
    };
  }

  // Bind to map when available
  (function waitForMap(){
    const badgesEnabled = () => ((typeof SHOW_LOGO_BADGES === "undefined") ? true : !!SHOW_LOGO_BADGES);

    if (badgesEnabled() && window.S && S.map && !S.__logoBadgeBound) {
      try {
        S.map.addListener('zoom_changed', updateAllLogoBadges);
        S.map.addListener('idle', updateAllLogoBadges);
        S.__logoBadgeBound = true;
        updateAllLogoBadges();
      } catch(e) {
        setTimeout(waitForMap, 300);
        return;
      }
    } else if (!S || !S.map) {
      setTimeout(waitForMap, 300);
    }
  })();

  // Tiny API for debugging
  window.mcppLogoBadges = {
    refresh: updateAllLogoBadges,
    reposition: repositionLogoBadge,
    setVisible: setBadgeVisible,
    destroy: function(){
      if (!S.logoBadges) return;
      Object.keys(S.logoBadges).forEach(destroyLogoBadge);
    }
  };

  Object.assign(MCPP, {
    repositionLogoBadge,
    updateAllLogoBadges,
    setBadgeVisible,
    destroyLogoBadge
  });
// #endregion MCPP: Vendor Logo Badges (overlay logos on booth centers)
})();

// #region Badge Legend Toggle
(() => {
  'use strict';

  // Initialize legend collapse functionality (whole title bar is clickable)
  function initLegendToggle() {
    const legend = document.getElementById('badgeLegend');
    const header = legend ? legend.querySelector('.legend-header') : null;
    
    if (!legend || !header) return;

    // Check localStorage for saved state
    const savedState = localStorage.getItem('badgeLegendCollapsed');
    if (savedState === 'true') {
      legend.classList.add('collapsed');
    }

    function toggleLegend() {
      const isCollapsed = legend.classList.toggle('collapsed');
      localStorage.setItem('badgeLegendCollapsed', isCollapsed.toString());
    }

    header.addEventListener('click', () => toggleLegend());
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLegendToggle);
  } else {
    initLegendToggle();
  }
})();
// #endregion Badge Legend Toggle
})();
