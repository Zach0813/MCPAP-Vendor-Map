(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S;

  function projReady() {
    return !!(S && S.proj && typeof S.proj.getProjection === 'function' && S.proj.getProjection());
  }

  function projection() {
    return projReady() ? S.proj.getProjection() : null;
  }

  function setPos(target, pos) {
    if (!target || !pos) return;
    if (typeof target.setPosition === 'function') {
      target.setPosition(pos);
    } else if ('position' in target) {
      target.position = pos;
    }
  }

  function setRotVisibility(rot, show) {
    if (!rot) return;
    const on = !!show;
    if (rot.content && rot.content.style) {
      rot.content.style.display = on ? '' : 'none';
      try { rot.gmpDraggable = on; } catch (_) {}
    }
    if (rot.element && rot.element.style) {
      rot.element.style.display = on ? '' : 'none';
      try { if (rot.setDraggable) rot.setDraggable(on); } catch (_) {}
    }
  }

  const ccwToCw = (deg) => ((-deg % 360) + 360) % 360;

  function d2ll(lat0, dx, dy) {
    const dLat = dy / 111320;
    const dLng = dx / (111320 * Math.cos(lat0 * Math.PI / 180));
    return { lat: lat0 + dLat, dLng };
  }

  function rot(dx, dy, a) {
    const t = a * Math.PI / 180;
    const c = Math.cos(t);
    const s = Math.sin(t);
    return [dx * c - dy * s, dx * s + dy * c];
  }

  function rect(c, wf, lf, a) {
    const w = wf * FT;
    const l = lf * FT;
    const hw = w / 2;
    const hl = l / 2;
    const lat0 = c.lat;
    const lng0 = c.lng;
    const base = [[-hw, -hl], [hw, -hl], [hw, hl], [-hw, hl]];
    return base
      .map(([x, y]) => rot(x, y, a))
      .map(([x, y]) => {
        const { lat, dLng } = d2ll(lat0, x, y);
        return new google.maps.LatLng(lat, lng0 + dLng);
      });
  }

  function style(cat, assigned) {
    const s = CAT[cat] || CAT.standard;
    return { fill: assigned ? s.f : '#0a1514', stroke: s.s };
  }

  function boothAnchorLatLng(booth) {
    if (!booth) return { lat: 0, lng: 0 };
    const anchorLiteral = booth.anchor ? {
      lat: Number(booth.anchor.lat),
      lng: Number(booth.anchor.lng)
    } : null;
    if (anchorLiteral && Number.isFinite(anchorLiteral.lat) && Number.isFinite(anchorLiteral.lng)) {
      return anchorLiteral;
    }
    const center = booth.center || {};
    const latFn = typeof center.lat === 'function' ? center.lat.bind(center) : () => center.lat;
    const lngFn = typeof center.lng === 'function' ? center.lng.bind(center) : () => center.lng;
    const latVal = Number(latFn()) || 0;
    const lngVal = Number(lngFn()) || 0;
    const derived = boothAnchorFromCenter({ lat: latVal, lng: lngVal }, booth);
    if (!booth.anchor) booth.anchor = derived;
    return derived;
  }

  function boothCenterLatLng(booth) {
    if (booth && booth.center) {
      const center = booth.center;
      const latFn = typeof center.lat === 'function' ? center.lat.bind(center) : () => center.lat;
      const lngFn = typeof center.lng === 'function' ? center.lng.bind(center) : () => center.lng;
      const lat = Number(latFn()) || 0;
      const lng = Number(lngFn()) || 0;
      if (typeof google !== 'undefined' && google.maps) {
        return new google.maps.LatLng(lat, lng);
      }
      return { lat, lng };
    }
    if (typeof MCPP.computeBoothCenter === 'function') {
      return MCPP.computeBoothCenter(booth);
    }
    const anchor = boothAnchorLatLng(booth);
    const rotation = -(Number(booth.rotation_deg) || 0);
    const halfW = (Number(booth.width_feet) || 0) * FT / 2;
    const halfL = (Number(booth.length_feet) || 0) * FT / 2;
    const [dx, dy] = rot(halfW, -halfL, rotation);
    const { lat, dLng } = d2ll(anchor.lat, dx, dy);
    return new google.maps.LatLng(lat, anchor.lng + dLng);
  }

  function boothAnchorFromCenter(centerLL, booth) {
    const rotation = -(Number(booth.rotation_deg) || 0);
    const halfW = (Number(booth.width_feet) || 0) * FT / 2;
    const halfL = (Number(booth.length_feet) || 0) * FT / 2;
    if (!halfW && !halfL) {
      const latFn0 = typeof centerLL.lat === 'function' ? centerLL.lat.bind(centerLL) : () => centerLL.lat;
      const lngFn0 = typeof centerLL.lng === 'function' ? centerLL.lng.bind(centerLL) : () => centerLL.lng;
      return { lat: Number(latFn0()) || 0, lng: Number(lngFn0()) || 0 };
    }
    const [dx, dy] = rot(-halfW, halfL, rotation);
    const latFn = typeof centerLL.lat === 'function' ? centerLL.lat.bind(centerLL) : () => centerLL.lat;
    const lngFn = typeof centerLL.lng === 'function' ? centerLL.lng.bind(centerLL) : () => centerLL.lng;
    const latVal = Number(latFn()) || 0;
    const lngVal = Number(lngFn()) || 0;
    const { lat, dLng } = d2ll(latVal, dx, dy);
    return { lat, lng: lngVal + dLng };
  }

  function normalizeCategoryKey(k) {
    const key = String(k || 'standard').toLowerCase().replace(/[^a-z]/g, '');
    const alias = {
      standard: 'standard',
      plant: 'standard',
      plantvendor: 'standard',
      plantvendors: 'standard',
      vendor: 'standard',

      collaborator: 'collaborator',
      craft: 'collaborator',
      craftvendor: 'collaborator',
      craftvendors: 'collaborator',
      artisan: 'collaborator',
      sponsor: 'collaborator',

      food: 'foodbeverage',
      beverage: 'foodbeverage',
      foodbev: 'foodbeverage',
      foodvendor: 'foodbeverage',
      foodvendors: 'foodbeverage',
      foodbeverage: 'foodbeverage',
      foodbeveragevendor: 'foodbeverage',

      activity: 'activity',
      entertainment: 'activity',
      activityentertainment: 'activity',
      entertainmentactivity: 'activity',
      eventstaff: 'activity',

      misc: 'misc',
      miscellaneous: 'misc',
      other: 'misc',
      uncategorized: 'misc',
      general: 'misc'
    };
    return alias[key] || 'standard';
  }

  function catNameForKey(key) {
    const map = {
      standard: 'Plant Vendor 🌿',
      collaborator: 'Craft Vendor 🎨',
      foodbeverage: 'Food/Beverage Vendor 🍽️',
      activity: 'Activity/Entertainment 🎪',
      misc: 'Miscellaneous 🧭'
    };
    const normalized = normalizeCategoryKey(key);
    return map[normalized] || map.standard;
  }

  function updateCategoryPill() {
    const el = document.getElementById('categoryText');
    if (!el) return;
    const booth = (S.selected && S.booths[S.selected]) ? S.booths[S.selected] : null;
    const fallbackKey = (MCPP.els.category && MCPP.els.category.value) || 'standard';
    const key = booth ? (booth.category || 'standard') : fallbackKey;
    el.textContent = catNameForKey(key);
  }

  function updateLabelVisibility() {
    if (!S || !S.map) return;
    const z = S.map.getZoom();
    const hide = (typeof z === 'number')
      ? (z < (typeof LABEL_HIDE_ZOOM !== 'undefined' ? LABEL_HIDE_ZOOM : 19))
      : false;

    Object.values(S.shapes).forEach((sh) => {
      if (!sh) return;
      if (typeof sh.setBaseLabelVisible === 'function') sh.setBaseLabelVisible(!hide);
      else if (typeof sh.setLabelVisible === 'function') sh.setLabelVisible(!hide);
      else if (sh.labelEl) sh.labelEl.style.display = hide ? 'none' : '';
      if (sh.lab && typeof sh.lab.setVisible === 'function') sh.lab.setVisible(!hide);
    });
  }

  function applyLabelStyles(el, fontPx) {
    if (!el) return;
    el.style.fontSize = fontPx + 'px';
    el.style.transform = 'translate(-50%, -50%)';
  }

  function updateLabelLayoutForZoom() {
    if (!S || !S.map) return;
    const z = S.map.getZoom() || START_ZOOM;
    const BASE = (typeof LABEL_FONT_BASE_PX !== 'undefined') ? LABEL_FONT_BASE_PX : 12;
    const MINPX = (typeof LABEL_FONT_MIN_PX !== 'undefined') ? LABEL_FONT_MIN_PX : 9;
    const MULT = (typeof LABEL_FONT_SCALE_MULT !== 'undefined') ? LABEL_FONT_SCALE_MULT : 1.0;
    const minFactor = Math.max(0.1, Math.min(1, MINPX / BASE));
    const factor = Math.max(minFactor, Math.min(1.0, (z / START_ZOOM) * MULT));
    const fontPx = Math.round(BASE * factor);

    Object.entries(S.booths).forEach(([id, booth]) => {
      const sh = S.shapes[id];
      if (!sh) return;
      const pos = getVisualCenterAdjusted(booth);
      if (sh.lab) setPos(sh.lab, pos);
      applyLabelStyles(sh.labelEl, fontPx);
      if (typeof sh.updateLabelStyle === 'function') sh.updateLabelStyle();
    });
  }

  function visualCenterForBooth(booth) {
    const proj = projection();
    if (!proj) return boothAnchorLatLng(booth);
    return boothCenterLatLng(booth);
  }

  function knobRadiusPxForBooth(booth) {
    const proj = projection();
    if (!proj || typeof proj.fromLatLngToContainerPixel !== 'function') {
      return KNOB_RADIUS_PX_FALLBACK + KNOB_EXTRA_PX;
    }
    const cs = rect(booth.center, booth.width_feet, booth.length_feet, -(booth.rotation_deg || 0))
      .map((ll) => proj.fromLatLngToContainerPixel(ll));
    const len12 = Math.hypot(cs[2].x - cs[1].x, cs[2].y - cs[1].y);
    const len30 = Math.hypot(cs[0].x - cs[3].x, cs[0].y - cs[3].y);
    const lengthPx = (len12 + len30) / 2;
    return (lengthPx / 2) + KNOB_EXTRA_PX;
  }

  function knobPosFromAngle(centerLL, angleDeg, radiusPx) {
    const proj = projection();
    if (!proj) return null;
    const angle = angleDeg * Math.PI / 180;
    const cp = proj.fromLatLngToContainerPixel(centerLL);
    const R = (typeof radiusPx === 'number' ? radiusPx : KNOB_RADIUS_PX_FALLBACK);
    let px = cp.x + R * Math.sin(angle);
    let py = cp.y - R * Math.cos(angle);
    px += KNOB_SELF_OFFSET_PX.x || 0;
    py += KNOB_SELF_OFFSET_PX.y || 0;
    return proj.fromContainerPixelToLatLng(new google.maps.Point(px, py));
  }

  function applyPixelOffset(ll, offset) {
    const proj = projection();
    if (!proj) return ll;
    const point = proj.fromLatLngToContainerPixel(ll);
    const withOffset = new google.maps.Point(
      point.x + (offset?.x || 0),
      point.y + (offset?.y || 0)
    );
    return proj.fromContainerPixelToLatLng(withOffset);
  }

  function getVisualCenterAdjusted(booth) {
    const proj = projection();
    if (!proj) return booth.center;
    const vc = visualCenterForBooth(booth);
    if (PER_BOOTH_OFFSETS && booth.center_offset_px) {
      return applyPixelOffset(vc, booth.center_offset_px);
    }
    return vc;
  }

  function makeCenterDebugEl() {
    const el = document.createElement('div');
    el.style.cssText = 'width:14px;height:14px;transform:translate(-50%,-50%);';
    el.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" xmlns="http://www.w3.org/2000/svg">
      <circle cx="7" cy="7" r="6" fill="none" stroke="#d6ff2e" stroke-width="1.5"/>
      <line x1="7" y1="2.2" x2="7" y2="5" stroke="#d6ff2e" stroke-width="1.5"/>
      <line x1="7" y1="9" x2="7" y2="11.8" stroke="#d6ff2e" stroke-width="1.5"/>
      <line x1="2.2" y1="7" x2="5" y2="7" stroke="#d6ff2e" stroke-width="1.5"/>
      <line x1="9" y1="7" x2="11.8" y2="7" stroke="#d6ff2e" stroke-width="1.5"/>
    </svg>`;
    return el;
  }

  function ensureCenterDebugMarker(id, pos) {
    if (!SHOW_CENTER_DEBUG) return null;
    if (typeof MCPP.ensureBoothCenterMarker === 'function') {
      const booth = (S.booths && S.booths[id]) ? S.booths[id] : null;
      const marker = MCPP.ensureBoothCenterMarker(id, booth);
      if (marker && pos) setPos(marker, pos);
      return marker;
    }
    const shape = S.shapes[id] || {};
    let m = shape.centerDbg || null;
    if (m) { setPos(m, pos); return m; }
    if (MCPP.canAdv) {
      m = new google.maps.marker.AdvancedMarkerElement({ map: S.map, position: pos, content: makeCenterDebugEl(), zIndex: 5 });
      if (m.content) m.content.classList.add('mcpp-label-center');
    } else {
      m = new google.maps.Marker({
        map: S.map, position: pos, zIndex: 5,
        icon: { path: google.maps.SymbolPath.CIRCLE, scale: 4, strokeColor: '#d6ff2e', strokeWeight: 2, fillOpacity: 0 }
      });
    }
    return m;
  }

  Object.assign(MCPP, {
    projReady,
    projection,
    setPos,
    setRotVisibility,
    ccwToCw,
    d2ll,
    rot,
    rect,
    style,
    normalizeCategoryKey,
    catNameForKey,
    updateCategoryPill,
    updateLabelVisibility,
    applyLabelStyles,
    updateLabelLayoutForZoom,
    visualCenterForBooth,
    knobRadiusPxForBooth,
    knobPosFromAngle,
    applyPixelOffset,
    getVisualCenterAdjusted,
    makeCenterDebugEl,
    ensureCenterDebugMarker,
    boothAnchorLatLng,
    boothCenterLatLng,
    boothAnchorFromCenter
  });

  window.getVisualCenterAdjusted = getVisualCenterAdjusted;
})();
