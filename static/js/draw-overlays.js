(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S || (window.S = window.S || {});
  S._userInteracted = !!S._userInteracted;

function latLngFromAny(pt) {
    if (!pt) return null;
    if (typeof pt.lat === 'function' && typeof pt.lng === 'function') return pt;
    if (typeof pt.lat === 'number' && typeof pt.lng === 'number' && window.google && google.maps) {
      return new google.maps.LatLng(pt.lat, pt.lng);
    }
    return null;
  }

  const latNum = (ll) => (typeof ll?.lat === 'function' ? ll.lat() : ll?.lat ?? 0);
  const lngNum = (ll) => (typeof ll?.lng === 'function' ? ll.lng() : ll?.lng ?? 0);

  function createDomOverlay(map, element, position, options = {}) {
    if (!map || !window.google || !google.maps || typeof google.maps.OverlayView !== 'function') return null;
    const { zIndex = 0, pane = 'overlayLayer' } = options;
    const el = element;
    el.style.position = 'absolute';
    el.style.pointerEvents = el.style.pointerEvents || 'none';

    class DomOverlay extends google.maps.OverlayView {
      constructor() {
        super();
        this.position = latLngFromAny(position);
        this.zIndex = zIndex;
        this.visible = true;
        this.container = document.createElement('div');
        this.container.style.position = 'absolute';
        this.container.style.pointerEvents = 'none';
        this.container.appendChild(el);
        this.setMap(map);
      }

      onAdd() {
        const panes = this.getPanes();
        if (!panes) return;
        const paneEl = panes[pane] || panes.overlayLayer || panes.overlayImage;
        if (paneEl) paneEl.appendChild(this.container);
      }

      onRemove() {
        if (this.container && this.container.parentNode) {
          this.container.parentNode.removeChild(this.container);
        }
      }

      draw() {
        if (!this.position) return;
        const projection = this.getProjection();
        if (!projection) return;
        const point = projection.fromLatLngToDivPixel(this.position);
        if (!point) return;
        this.container.style.left = point.x + 'px';
        this.container.style.top = point.y + 'px';
        this.container.style.zIndex = String(this.zIndex);
        this.container.style.display = this.visible ? '' : 'none';
      }

      setPosition(pos) {
        const ll = latLngFromAny(pos);
        if (!ll) return;
        this.position = ll;
        this.draw();
      }

      setZIndex(z) {
        this.zIndex = z;
        this.draw();
      }

      setVisible(v) {
        this.visible = !!v;
        this.draw();
      }
    }

    const overlay = new DomOverlay();

    return {
      element: el,
      setPosition: (pos) => overlay.setPosition(pos),
      setZIndex: (z) => overlay.setZIndex(z),
      setVisible: (v) => overlay.setVisible(v),
      remove: () => overlay.setMap(null)
    };
  }

  function setOverlayZ(overlay, z) {
    if (!overlay || z == null) return;
    if (typeof overlay.setZIndex === 'function') overlay.setZIndex(z);
    else if (typeof overlay.setOptions === 'function') overlay.setOptions({ zIndex: z });
    else if ('zIndex' in overlay) overlay.zIndex = z;
  }

  function computeBounds(points) {
    if (!Array.isArray(points) || !points.length || !window.google || !google.maps) return null;
    const bounds = new google.maps.LatLngBounds();
    let valid = false;
    points.forEach((pt) => {
      const ll = latLngFromAny(pt);
      if (ll) {
        bounds.extend(ll);
        valid = true;
      }
    });
    return valid ? bounds : null;
  }

  function updateOverlapVisibility() {
    if (!S || !S.shapes) return;
    
    // Check current zoom level to determine if badges should be visible at all
    const zcur = (S.map && typeof S.map.getZoom === 'function') ? S.map.getZoom() : null;
    const showBadgesAtZoom = (zcur != null) && (zcur >= (typeof LOGO_BADGE_MIN_ZOOM !== 'undefined' ? LOGO_BADGE_MIN_ZOOM : 20.75));
    
    Object.entries(S.shapes).forEach(([id, shape]) => {
      if (!shape) return;
      const baseLabel = shape.baseLabelVisible !== false;
      if (typeof shape.setLabelVisible === 'function') shape.setLabelVisible(baseLabel);
      else if (shape.labelEl) shape.labelEl.style.display = baseLabel ? '' : 'none';
      if (typeof shape.updateLabelStyle === 'function') shape.updateLabelStyle();

      const baseBadge = shape.badgeBaseVisible !== false;
      shape.badgeHiddenByOverlap = false;
      const badgeEntry = S.logoBadges && S.logoBadges[id];
      if (badgeEntry) badgeEntry.hiddenByOverlap = false;
      if (shape.badgeOverlay && typeof shape.badgeOverlay.setVisible === 'function') {
        // Only show badge if both baseBadge is true AND zoom level is appropriate
        shape.badgeOverlay.setVisible(baseBadge && showBadgesAtZoom);
      }
    });
  }

  function bringShapeToFront(id, { skipOverlap = false } = {}) {
    if (!S || !S.shapes) return;
    const shape = S.shapes[id];
    if (!shape) return;

    S._zCounter = (S._zCounter == null ? 0 : S._zCounter) + 10;
    const base = S._zCounter;

    const polyZ = base + 20;
    setOverlayZ(shape.poly, polyZ);
    if (Array.isArray(shape.debugLines)) {
      shape.debugLines.forEach((line, idx) => setOverlayZ(line, polyZ + 1 + idx));
    }
    setOverlayZ(shape.centerDbg, polyZ + 1);
    setOverlayZ(shape.lab, polyZ + 2);
    if (shape.badgeOverlay) {
      setOverlayZ(shape.badgeOverlay, polyZ + 3);
      shape.badgeHiddenByOverlap = false;
      // Only make badge visible if zoom level is appropriate
      const zcur = (S.map && typeof S.map.getZoom === 'function') ? S.map.getZoom() : null;
      const showBadges = (zcur != null) && (zcur >= (typeof LOGO_BADGE_MIN_ZOOM !== 'undefined' ? LOGO_BADGE_MIN_ZOOM : 20.75));
      if (typeof shape.badgeOverlay.setVisible === 'function') {
        shape.badgeOverlay.setVisible(showBadges);
      }
    }
    if (S.logoBadges && S.logoBadges[id]) {
      S.logoBadges[id].hiddenByOverlap = false;
    }

    if (!skipOverlap) {
      updateOverlapVisibility();
      S._topBoothId = id;
    }
  }

  function removeShapeRecord(shape) {
    if (!shape) return;
    if (shape.poly) shape.poly.setMap(null);
    if (shape.lab) {
      if (typeof shape.lab.remove === 'function') shape.lab.remove();
      else if (typeof shape.lab.setMap === 'function') shape.lab.setMap(null);
    }
    if (shape.centerDbg) {
      if (typeof shape.centerDbg.remove === 'function') shape.centerDbg.remove();
      else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
    }
    if (Array.isArray(shape.debugLines)) {
      shape.debugLines.forEach((line) => line && typeof line.setMap === 'function' && line.setMap(null));
    }
    if (shape.badgeOverlay) {
      try {
        if (typeof shape.badgeOverlay.remove === 'function') shape.badgeOverlay.remove();
        else if (typeof shape.badgeOverlay.setMap === 'function') shape.badgeOverlay.setMap(null);
      } catch (e) {}
      shape.badgeOverlay = null;
    }
  }

  function draw(id) {
    const prev = S.shapes && S.shapes[id];
    if (prev) {
      removeShapeRecord(prev);
      delete S.shapes[id];
    }

    const booth = S.booths[id];
    if (!booth) return;

    if (!S || !S.proj || typeof S.proj.getProjection !== 'function' || !S.proj.getProjection()) {
      if (!S.shapes) S.shapes = {};
      S.shapes[id] = { pending: true };
      setTimeout(() => draw(id), 50);
      return;
    }

    const assigned = !!(booth.biz || booth.vendor_name || booth.notes || booth.phone || booth.email);
    const styleFn = MCPP.style || ((/*cat, assigned*/) => ({ fill: '#0a1514', stroke: '#3f7f7f' }));
    const geom = MCPP.rect || (() => []);
    const st = styleFn(booth.category || 'standard', assigned);
    const sel = (S.selected === id);

    const computeCenter = (typeof MCPP.computeBoothCenter === 'function')
      ? MCPP.computeBoothCenter
      : (b => new google.maps.LatLng((b.center && b.center.lat) || 0, (b.center && b.center.lng) || 0));

    let centerLatLng = computeCenter(booth, { asLatLng: true });
    const centerForGeom = centerLatLng && typeof centerLatLng.toJSON === 'function'
      ? centerLatLng.toJSON()
      : centerLatLng;

    const computeRectPath = (centerLLVal) => {
      const centerObj = centerLLVal && typeof centerLLVal.toJSON === 'function'
        ? centerLLVal.toJSON()
        : centerLLVal;
      const angleDegDynamic = -(booth.rotation_deg || 0);
      return geom(centerObj, booth.width_feet, booth.length_feet, angleDegDynamic);
    };
    const rectPath = computeRectPath(centerLatLng);
    const poly = new google.maps.Polygon({
      paths: rectPath,
      strokeColor: sel ? '#d6ff2e' : st.stroke,
      strokeOpacity: 1,
      strokeWeight: sel ? 3 : 1,
      fillColor: st.fill,
      fillOpacity: sel ? 1.0 : 0.75,
      clickable: true,
      draggable: !!S.isAdmin,
      zIndex: 1000
    });
    poly.setMap(S.map);

    const debugEnabled = (typeof SHOW_CENTER_DEBUG !== 'undefined') ? SHOW_CENTER_DEBUG : false;
    const overlapsOtherPolygons = (candidateBounds) => {
      if (!candidateBounds || typeof candidateBounds.intersects !== 'function') return false;
      return Object.entries(S.shapes || {}).some(([otherId, otherShape]) => {
        if (otherId === id || !otherShape || !otherShape.bounds) return false;
        try { return candidateBounds.intersects(otherShape.bounds); }
        catch (_) { return false; }
      });
    };

    const shapeRecord = {
      poly,
      lab: null,
      labelEl: null,
      labelVisible: true,
      baseLabelVisible: true,
      setLabelVisible: null,
      setBaseLabelVisible: null,
      updateLabelStyle: null,
      centerDbg: null,
      centerLL: centerLatLng,
      bounds: computeBounds(rectPath),
      debugLines: [],
      badgeOverlay: null,
      badgeType: null,
      badgeHiddenByOverlap: false,
      badgeBaseVisible: true,
      isReturnVendor: !!booth.is_return_vendor,
      isEventStaff: !!booth.is_event_staff,
      isPartnerVendor: !!booth.is_partner_vendor,
      isFeaturedVendor: !!booth.is_featured_vendor,
      lastValidCenter: centerLatLng,
      lastValidPath: rectPath
    };

    if (!S.shapes) S.shapes = {};
    S.shapes[id] = shapeRecord;

    const setPos = MCPP.setPos || ((target, pos) => target && typeof target.setPosition === 'function' && target.setPosition(pos));

    const updateDebugLines = (corners) => {
      if (!debugEnabled) return;
      if (!Array.isArray(corners) || corners.length < 4) return;
      if (!shapeRecord.debugLines.length) {
        for (let i = 0; i < 4; i++) {
          shapeRecord.debugLines.push(new google.maps.Polyline({
            map: S.map,
            path: [],
            strokeColor: i < 2 ? (i === 0 ? '#ff00ff' : '#00ffff') : '#ff8800',
            strokeOpacity: 0.9,
            strokeWeight: i < 2 ? 1.2 : 1,
            zIndex: 3,
            clickable: false
          }));
        }
      }
      const latOf = (ll) => (typeof ll.lat === 'function' ? ll.lat() : ll.lat);
      const lngOf = (ll) => (typeof ll.lng === 'function' ? ll.lng() : ll.lng);
      const makeMid = (a, b) => new google.maps.LatLng((latOf(a) + latOf(b)) / 2, (lngOf(a) + lngOf(b)) / 2);
      const diag1 = [corners[0], corners[2]];
      const diag2 = [corners[1], corners[3]];
      const horiz = [makeMid(corners[0], corners[3]), makeMid(corners[1], corners[2])];
      const vert = [makeMid(corners[0], corners[1]), makeMid(corners[2], corners[3])];
      [diag1, diag2, horiz, vert].forEach((path, idx) => {
        const line = shapeRecord.debugLines[idx];
        if (line && typeof line.setPath === 'function') line.setPath(path);
      });
    };

    if (debugEnabled) updateDebugLines(rectPath.map(latLngFromAny));

    const syncCenters = (centerLL) => {
      if (!centerLL) return;
      shapeRecord.centerLL = centerLL;
      if (shapeRecord.lab && typeof shapeRecord.lab.setPosition === 'function') shapeRecord.lab.setPosition(centerLL);
      if (shapeRecord.centerDbg) setPos(shapeRecord.centerDbg, centerLL);
      if (typeof MCPP.repositionLogoBadge === 'function') MCPP.repositionLogoBadge(id);
    };

    const labelEl = document.createElement('div');
   labelEl.classList.add('mcpp-label-center');
   const displayId = (typeof MCPP.formatBoothId === 'function') ? MCPP.formatBoothId(id) : id;
   labelEl.textContent = displayId;
   labelEl.style.cssText = [
      `color:${sel ? '#d6ff2e' : '#eaf6f5'}`,
      'font-weight:700',
      'font-size:12px',
      'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif',
      'text-shadow:0 0 2px rgba(0,0,0,.6)',
      'transform:translate(-50%,-50%)',
      'display:flex',
      'align-items:center',
      'justify-content:center',
      'text-align:center',
      'width:3ch',
    'height:1.6em',
    'white-space:nowrap',
    /* ensure text is vertically centered inside the flex container */
    'line-height:1.6em',
     'padding:0',
     'font-variant-numeric:tabular-nums'
    ].join(';');

    const showLabels = (typeof SHOW_LABELS === 'undefined') ? true : SHOW_LABELS;
    // Try to place the booth label at a visual center if helper exists (keeps label truly centered)
    const labelAnchor = (typeof MCPP.getVisualCenterAdjusted === 'function')
      ? MCPP.getVisualCenterAdjusted(booth)
      : centerLatLng;
    // Label uses overlayMouseTarget pane to ensure it stays below badges in floatPane
    const labelOverlay = createDomOverlay(S.map, labelEl, labelAnchor, { zIndex: 100, pane: 'overlayMouseTarget' });
    shapeRecord.lab = labelOverlay;
    shapeRecord.labelEl = labelEl;
    
    // Determine initial label visibility based on current zoom level
    const zcur = (S.map && typeof S.map.getZoom === 'function') ? S.map.getZoom() : null;
    const hideAll = zcur != null && zcur < (typeof LABEL_HIDE_ZOOM !== 'undefined' ? LABEL_HIDE_ZOOM : 19.5);
    const initialLabelVisible = showLabels && !hideAll;
    
    shapeRecord.labelVisible = initialLabelVisible;
    shapeRecord.baseLabelVisible = initialLabelVisible;
    shapeRecord.setLabelVisible = (visible) => {
      const on = !!visible;
      shapeRecord.labelVisible = on;
      if (shapeRecord.lab && typeof shapeRecord.lab.setVisible === 'function') shapeRecord.lab.setVisible(on);
      if (shapeRecord.labelEl) shapeRecord.labelEl.style.display = on ? '' : 'none';
    };
    shapeRecord.setBaseLabelVisible = (visible) => {
      shapeRecord.baseLabelVisible = !!visible;
      shapeRecord.setLabelVisible(shapeRecord.baseLabelVisible);
    };
    shapeRecord.updateLabelStyle = () => {};
    shapeRecord.setLabelVisible(shapeRecord.labelVisible);

    const centerDbg = (typeof MCPP.ensureCenterDebugMarker === 'function')
      ? MCPP.ensureCenterDebugMarker(id, centerLatLng)
      : null;
    shapeRecord.centerDbg = centerDbg;

    if (S.logoBadges && S.logoBadges[id]) {
      const badgeInfo = S.logoBadges[id];
      shapeRecord.badgeOverlay = badgeInfo.marker;
      shapeRecord.badgeHiddenByOverlap = badgeInfo.hiddenByOverlap === true;
      shapeRecord.badgeBaseVisible = badgeInfo.baseVisible !== false;
    }

    // --- Badge Hierarchy System ---
    // Determine the highest priority badge for this booth based on hierarchy:
    // 1. Event Staff (highest priority)
    // 2. Partner Vendor
    // 3. Featured Vendor
    // 4. Returning Vendor (lowest priority)
    // Only one badge will be displayed per booth.
    
    shapeRecord.isEventStaff = !!booth.is_event_staff;
    shapeRecord.isPartnerVendor = !!booth.is_partner_vendor;
    shapeRecord.isFeaturedVendor = !!booth.is_featured_vendor;
    shapeRecord.isReturnVendor = !!booth.is_return_vendor;
    
    // Determine which badge to show based on hierarchy
    let badgeType = null;
    let badgeId = null;
    let badgeTitle = null;
    let badgeColor = null;
    
    if (shapeRecord.isEventStaff) {
      badgeType = 'event-staff';
      badgeId = '#badge-event-staff';
      badgeTitle = 'Event staff';
      badgeColor = 'var(--danger)';
    } else if (shapeRecord.isPartnerVendor) {
      badgeType = 'partner-vendor';
      badgeId = '#badge-partner-vendor';
      badgeTitle = 'Partner vendor';
      badgeColor = '#3498DB';
    } else if (shapeRecord.isFeaturedVendor) {
      badgeType = 'featured-vendor';
      badgeId = '#badge-featured-vendor';
      badgeTitle = 'Featured vendor';
      badgeColor = '#FFD700';
    } else if (shapeRecord.isReturnVendor) {
      badgeType = 'returning-vendor';
      badgeId = '#badge-returning-vendor';
      badgeTitle = 'Returning vendor';
      badgeColor = 'var(--hi)';
    }
    
    // Create the badge overlay if a badge type was determined
    if (badgeType && typeof MCPP.createDomOverlay === 'function') {
      // create the wrapped element (zero-sized wrapper like logo badges)
      const wrap = document.createElement('div');
      wrap.style.cssText = 'position:relative;width:0;height:0;pointer-events:none;';

      const el = document.createElement('div');
      el.className = `booth-badge booth-${badgeType}-badge`;
      // enable pointer events on the badge so hover/title works, but keep wrapper non-interactive
      // position the element so its top-right corner will align with the overlay anchor
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.top = '0';
      // shift badge 1px left and 2px down relative to the polygon corner (net: move right 1px)
      el.style.transform = 'translate(calc(-100% - 1px), 2px)';
      el.style.pointerEvents = 'auto';
      el.setAttribute('title', badgeTitle);
      
      // Use shared SVG definition via <use> element
      const svgNS = 'http://www.w3.org/2000/svg';
      const svg = document.createElementNS(svgNS, 'svg');
      svg.setAttribute('viewBox', '0 0 32 32');
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', '100%');
      svg.setAttribute('aria-hidden', 'true');

      const title = document.createElementNS(svgNS, 'title');
      title.textContent = badgeTitle;
      
      const use = document.createElementNS(svgNS, 'use');
      use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', badgeId);
      use.setAttribute('href', badgeId);
      use.setAttribute('style', `color: ${badgeColor};`);

      svg.appendChild(title);
      svg.appendChild(use);
      el.appendChild(svg);
      wrap.appendChild(el);

      // make the badge clickable/interactive: forward clicks to existing select behavior
      el.addEventListener('click', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        S._userInteracted = true;
        if (typeof MCPP.select === 'function') MCPP.select(id);
        if (S.map) {
          const target = shapeRecord.centerLL || centerLatLng;
          if (target) S.map.panTo(target);
        }
        bringShapeToFront(id);
      });

      // position initially at center; we'll reposition once we compute corners
      // Status badge should be above both label (100) and logo badge (200)
      const marker = MCPP.createDomOverlay(S.map, wrap, centerLatLng, { zIndex: 300, pane: 'floatPane' });
      if (marker) {
        shapeRecord.badgeOverlay = marker;
        shapeRecord.badgeType = badgeType;
        try {
          const zcur = (S.map && typeof S.map.getZoom === 'function') ? S.map.getZoom() : null;
          // Default to hiding badges if zoom is unavailable, rather than showing them
          const showBadges = (zcur != null) && (zcur >= (typeof LOGO_BADGE_MIN_ZOOM !== 'undefined' ? LOGO_BADGE_MIN_ZOOM : 20.75));
          if (!showBadges) {
            marker.setVisible(false);
          }
        } catch (e) {}
      }
    }

    poly.addListener('click', () => {
      S._userInteracted = true;
      if (typeof MCPP.select === 'function') MCPP.select(id);
      if (S.map) {
        const target = shapeRecord.centerLL || centerLatLng;
        if (target) S.map.panTo(target);
      }
      bringShapeToFront(id);
    });

    poly.addListener('dragstart', () => {
      S._userInteracted = true;
      bringShapeToFront(id);
    });

    function updateFromPolygon(centerLLVal, pathOverride) {
      const centerUse = centerLLVal || shapeRecord.lastValidCenter || centerLatLng;
      const pathUse = pathOverride || computeRectPath(centerUse);
      shapeRecord.lastValidCenter = centerUse;
      shapeRecord.lastValidPath = pathUse;
      shapeRecord.bounds = computeBounds(pathUse);
      // Reposition badge overlay to the polygon's visual top-right corner
      try {
        if (shapeRecord.badgeOverlay && Array.isArray(pathUse) && pathUse.length && S.proj && typeof S.proj.getProjection === 'function') {
          const proj = S.proj.getProjection();
          if (proj) {
            let best = null;
            for (let i = 0; i < pathUse.length; i++) {
              const pt = latLngFromAny(pathUse[i]);
              if (!pt) continue;
              const p = proj.fromLatLngToDivPixel(pt);
              if (!p) continue;
              if (!best || p.y < best.p.y || (p.y === best.p.y && p.x > best.p.x)) {
                best = { p, ll: pt };
              }
            }
            if (best && shapeRecord.badgeOverlay && typeof shapeRecord.badgeOverlay.setPosition === 'function') {
              // move the anchor part-way toward the polygon center so the badge sits inside the polygon
              try {
                // Align the top-right corner of the badge to the polygon corner: use the corner pixel directly
                const anchoredLL = proj.fromDivPixelToLatLng(best.p);
                shapeRecord.badgeOverlay.setPosition(anchoredLL);
              } catch (e) {
                // fallback to exact corner if projection conversion fails
                shapeRecord.badgeOverlay.setPosition(best.ll);
              }
            }
          }
        }
      } catch (e) { /* non-fatal */ }
      if (debugEnabled) updateDebugLines(pathUse);
    }

    updateFromPolygon(centerLatLng, rectPath);

    const revertToLastValid = () => {
      const lastCenter = shapeRecord.lastValidCenter || centerLatLng;
      const lastPath = shapeRecord.lastValidPath || rectPath;
      poly.setPaths(lastPath);
      const literal = { lat: latNum(lastCenter), lng: lngNum(lastCenter) };
      booth.center = literal;
      if (typeof MCPP.boothAnchorFromCenter === 'function') booth.anchor = MCPP.boothAnchorFromCenter(lastCenter, booth);
      else booth.anchor = literal;
      syncCenters(lastCenter);
      updateFromPolygon(lastCenter, lastPath);
      bringShapeToFront(id, { skipOverlap: true });
    };

    poly.addListener('drag', () => {
      if (!S.isAdmin) return;
      const path = poly.getPath();
      let latSum = 0;
      let lngSum = 0;
      const len = path.getLength();
      for (let i = 0; i < len; i++) {
        const ll = path.getAt(i);
        latSum += ll.lat();
        lngSum += ll.lng();
      }
      const centerLL = new google.maps.LatLng(latSum / len, lngSum / len);
      const lastCenter = shapeRecord.lastValidCenter || centerLatLng;
      const candidatePath = computeRectPath(centerLL);
      const candidateBounds = computeBounds(candidatePath);
      if (overlapsOtherPolygons(candidateBounds)) {
        const dLat = latNum(centerLL) - latNum(lastCenter);
        const dLng = lngNum(centerLL) - lngNum(lastCenter);
        if (Math.abs(dLat) < 1e-12 && Math.abs(dLng) < 1e-12) {
          revertToLastValid();
          updateOverlapVisibility();
          return;
        }
        let low = 0;
        let high = 1;
        let bestCenter = lastCenter;
        let bestPath = shapeRecord.lastValidPath || computeRectPath(lastCenter);
        for (let step = 0; step < 20; step++) {
          const mid = (low + high) / 2;
          const testCenter = new google.maps.LatLng(
            latNum(lastCenter) + dLat * mid,
            lngNum(lastCenter) + dLng * mid
          );
          const testPath = computeRectPath(testCenter);
          const testBounds = computeBounds(testPath);
          if (overlapsOtherPolygons(testBounds)) {
            high = mid;
          } else {
            low = mid;
            bestCenter = testCenter;
            bestPath = testPath;
          }
        }
        const literalBest = { lat: latNum(bestCenter), lng: lngNum(bestCenter) };
        booth.center = literalBest;
        if (typeof MCPP.boothAnchorFromCenter === 'function') booth.anchor = MCPP.boothAnchorFromCenter(bestCenter, booth);
        else booth.anchor = literalBest;
        poly.setPaths(bestPath);
        syncCenters(bestCenter);
        updateFromPolygon(bestCenter, bestPath);
        bringShapeToFront(id, { skipOverlap: true });
        updateOverlapVisibility();
        return;
      }
      const literal = { lat: latNum(centerLL), lng: lngNum(centerLL) };
      booth.center = literal;
      if (typeof MCPP.boothAnchorFromCenter === 'function') booth.anchor = MCPP.boothAnchorFromCenter(centerLL, booth);
      else booth.anchor = literal;
      poly.setPaths(candidatePath);
      syncCenters(centerLL);
      updateFromPolygon(centerLL, candidatePath);
      bringShapeToFront(id, { skipOverlap: true });
      updateOverlapVisibility();
    });

    poly.addListener('dragend', () => {
      if (!S.isAdmin) return;
      const lastCenter = shapeRecord.lastValidCenter || centerLatLng;
      const lastPath = shapeRecord.lastValidPath || computeRectPath(lastCenter);
      const literal = { lat: latNum(lastCenter), lng: lngNum(lastCenter) };
      booth.center = literal;
      if (typeof MCPP.boothAnchorFromCenter === 'function') booth.anchor = MCPP.boothAnchorFromCenter(lastCenter, booth);
      else booth.anchor = literal;
      poly.setPaths(lastPath);
      syncCenters(lastCenter);
      bringShapeToFront(id);
      updateOverlapVisibility();
      if (typeof MCPP.save === 'function') MCPP.save(false);
    });

    const updateRotationFromPoint = (pLatLng) => {
      if (!pLatLng || !S.proj || !S.proj.getProjection) return;
      const proj = S.proj.getProjection();
      if (!proj) return;
      const orbitC = shapeRecord.centerLL || centerLatLng;
      const C = proj.fromLatLngToDivPixel(orbitC);
      const P = proj.fromLatLngToDivPixel(pLatLng);
      const vx = P.x - C.x;
      const vy = P.y - C.y;
      let cw = Math.atan2(vx, -vy) * 180 / Math.PI;
      cw = (cw + 360) % 360;
      cw = Math.round(cw / (typeof SNAP !== 'undefined' ? SNAP : 10)) * (typeof SNAP !== 'undefined' ? SNAP : 10);
      cw = (cw + 360) % 360;
      booth.rotation_deg = cw;

      const rectFn = MCPP.rect || (() => []);
      const paths = rectFn(booth.center, booth.width_feet, booth.length_feet, -booth.rotation_deg);
      poly.setPaths(paths);
      updateFromPolygon(shapeRecord.centerLL, paths);
      bringShapeToFront(id);
      if (typeof MCPP.repositionLogoBadge === 'function') MCPP.repositionLogoBadge(id);
    };

    poly.addListener('rightclick', (ev) => updateRotationFromPoint(ev.latLng));

    syncCenters(centerLatLng);
    bringShapeToFront(id, { skipOverlap: !S._userInteracted });
    updateOverlapVisibility();
  }

  function syncOverlayCenters() {
    const setPos = MCPP.setPos || ((target, pos) => target && typeof target.setPosition === 'function' && target.setPosition(pos));
    Object.entries(S.booths).forEach(([id, booth]) => {
      const shape = S.shapes && S.shapes[id];
      if (!shape) return;
      const centerLL = shape.centerLL || latLngFromAny(booth.center);
      if (!centerLL) return;
      if (shape.lab && typeof shape.lab.setPosition === 'function') shape.lab.setPosition(centerLL);
      if (shape.centerDbg) setPos(shape.centerDbg, centerLL);
      if (typeof MCPP.repositionLogoBadge === 'function') MCPP.repositionLogoBadge(id);
    });
  }

  Object.assign(MCPP, {
    draw,
    syncOverlayCenters,
    createDomOverlay,
    updateOverlapVisibility
  });

  MCPP.createDomOverlay = createDomOverlay;
  MCPP.updateOverlapVisibility = updateOverlapVisibility;
})();
