(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S || (window.S = window.S || {});

  const FT_IN_METERS = (typeof FT === 'number' && Number.isFinite(FT)) ? FT : 0.3048;

  const toNumber = (value, fallback = 0) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : fallback;
  };

  const hasGoogleLatLng = () => !!(window.google && google.maps && typeof google.maps.LatLng === 'function');
  const hasProjection = () => {
    if (typeof MCPP.projection === 'function') {
      const proj = MCPP.projection();
      if (proj) return proj;
    }
    return (S && S.proj && typeof S.proj.getProjection === 'function') ? S.proj.getProjection() : null;
  };

  const fallbackRot = (dx, dy) => [dx, dy];
  const fallbackD2ll = (lat0, dx, dy) => {
    const lat = lat0 + (dy / 111320);
    const dLng = dx / (111320 * Math.cos(lat0 * Math.PI / 180));
    return { lat, dLng };
  };

  const toLatLngLiteral = (raw, fallback = { lat: 0, lng: 0 }) => {
    const obj = raw || {};
    const lat = toNumber(obj.lat, fallback.lat);
    const lng = toNumber(obj.lng, fallback.lng);
    return { lat, lng };
  };

  function centerFromAnchor(anchor, widthFeet, lengthFeet, rotationDeg) {
    const width = Math.max(0, widthFeet);
    const length = Math.max(0, lengthFeet);
    if (!width && !length) return { lat: anchor.lat, lng: anchor.lng };
    const rotation = -(toNumber(rotationDeg, 0));
    const halfWidthMeters = (width * FT_IN_METERS) / 2;
    const halfLengthMeters = (length * FT_IN_METERS) / 2;
    const rotFn = (typeof MCPP.rot === 'function') ? MCPP.rot : fallbackRot;
    const d2llFn = (typeof MCPP.d2ll === 'function') ? MCPP.d2ll : fallbackD2ll;
    const [dx, dy] = rotFn(halfWidthMeters, -halfLengthMeters, rotation);
    const { lat, dLng } = d2llFn(anchor.lat, dx, dy);
    return { lat, lng: anchor.lng + dLng };
  }

  function anchorFromCenter(center, widthFeet, lengthFeet, rotationDeg) {
    const width = Math.max(0, widthFeet);
    const length = Math.max(0, lengthFeet);
    if (!center || (!width && !length)) return toLatLngLiteral(center, { lat: 0, lng: 0 });
    const rotation = -(toNumber(rotationDeg, 0));
    const halfWidthMeters = (width * FT_IN_METERS) / 2;
    const halfLengthMeters = (length * FT_IN_METERS) / 2;
    const rotFn = (typeof MCPP.rot === 'function') ? MCPP.rot : fallbackRot;
    const d2llFn = (typeof MCPP.d2ll === 'function') ? MCPP.d2ll : fallbackD2ll;
    const literal = toLatLngLiteral(center);
    const [dx, dy] = rotFn(-halfWidthMeters, halfLengthMeters, rotation);
    const { lat, dLng } = d2llFn(literal.lat, dx, dy);
    return { lat, lng: literal.lng + dLng };
  }

  function boothCornerLatLngs(anchor, widthFeet, lengthFeet, rotationDeg) {
    const width = Math.max(0, widthFeet);
    const length = Math.max(0, lengthFeet);
    if (!width || !length || !hasGoogleLatLng()) return [];
    const rotation = -(toNumber(rotationDeg, 0));
    const widthMeters = width * FT_IN_METERS;
    const lengthMeters = length * FT_IN_METERS;
    const rotFn = (typeof MCPP.rot === 'function') ? MCPP.rot : fallbackRot;
    const d2llFn = (typeof MCPP.d2ll === 'function') ? MCPP.d2ll : fallbackD2ll;
    const base = [
      [0, 0],
      [widthMeters, 0],
      [widthMeters, -lengthMeters],
      [0, -lengthMeters]
    ];
    return base.map(([dx, dy]) => {
      const [rx, ry] = rotFn(dx, dy, rotation);
      const { lat, dLng } = d2llFn(anchor.lat, rx, ry);
      return new google.maps.LatLng(lat, anchor.lng + dLng);
    });
  }

  function centerFromPixels(anchor, widthFeet, lengthFeet, rotationDeg) {
    const proj = hasProjection();
    if (!proj || typeof proj.fromLatLngToContainerPixel !== 'function' || typeof proj.fromContainerPixelToLatLng !== 'function') {
      return null;
    }
    const corners = boothCornerLatLngs(anchor, widthFeet, lengthFeet, rotationDeg);
    if (!corners.length) return null;
    let sumX = 0;
    let sumY = 0;
    let count = 0;
    for (const corner of corners) {
      const pt = proj.fromLatLngToContainerPixel(corner);
      if (!pt) return null;
      sumX += pt.x;
      sumY += pt.y;
      count += 1;
    }
    if (!count) return null;
    const centroidPoint = new google.maps.Point(sumX / count, sumY / count);
    const ll = proj.fromContainerPixelToLatLng(centroidPoint);
    if (!ll) return null;
    const latFn = typeof ll.lat === 'function' ? ll.lat.bind(ll) : () => ll.lat;
    const lngFn = typeof ll.lng === 'function' ? ll.lng.bind(ll) : () => ll.lng;
    return { lat: toNumber(latFn(), 0), lng: toNumber(lngFn(), 0) };
  }

  function computeBoothCenter(booth, { asLatLng = true } = {}) {
    if (!booth) return null;
    const shapeCenter = (() => {
      if (!booth || !booth.id) return null;
      if (!S || !S.shapes) return null;
      const shape = S.shapes[booth.id];
      if (!shape || !shape.centerLL) return null;
      return shape.centerLL;
    })();
    if (shapeCenter) {
      if (asLatLng) return shapeCenter;
      if (typeof shapeCenter.toJSON === 'function') return shapeCenter.toJSON();
      const latFn = typeof shapeCenter.lat === 'function' ? shapeCenter.lat.bind(shapeCenter) : () => shapeCenter.lat;
      const lngFn = typeof shapeCenter.lng === 'function' ? shapeCenter.lng.bind(shapeCenter) : () => shapeCenter.lng;
      return { lat: toNumber(latFn(), 0), lng: toNumber(lngFn(), 0) };
    }

    const widthFeet = Math.max(0, toNumber(booth.width_feet, 0));
    const lengthFeet = Math.max(0, toNumber(booth.length_feet, 0));
    const rotationDeg = toNumber(booth.rotation_deg, 0);

    let center = null;
    const storedCenter = booth && booth.center ? toLatLngLiteral(booth.center) : null;
    if (storedCenter && Number.isFinite(storedCenter.lat) && Number.isFinite(storedCenter.lng)) {
      center = storedCenter;
    } else {
      const anchor = booth && booth.anchor
        ? toLatLngLiteral(booth.anchor)
        : toLatLngLiteral((booth && booth.center) || { lat: 0, lng: 0 });
      center = centerFromAnchor(anchor, widthFeet, lengthFeet, rotationDeg);
    }

    if (!asLatLng || !hasGoogleLatLng()) return center;
    return new google.maps.LatLng(center.lat, center.lng);
  }

  function computeBoothCenterWithOffset(booth, offsetPx) {
    const baseCenter = computeBoothCenter(booth);
    if (!baseCenter) return null;
    if (!offsetPx) return baseCenter;
    if (typeof MCPP.applyPixelOffset === 'function') {
      return MCPP.applyPixelOffset(baseCenter, offsetPx);
    }
    return baseCenter;
  }

  function normalizeBoothGeometry(booth) {
    if (!booth || typeof booth !== 'object') return booth;
    const widthFeet = Math.max(0, toNumber(booth.width_feet, 0));
    const lengthFeet = Math.max(0, toNumber(booth.length_feet, 0));
    const rotationDeg = toNumber(booth.rotation_deg, 0);
    const anchorLiteral = booth.anchor ? toLatLngLiteral(booth.anchor) : null;
    const centerLiteral = booth.center ? toLatLngLiteral(booth.center) : null;
    const hasAnchor = anchorLiteral && Number.isFinite(anchorLiteral.lat) && Number.isFinite(anchorLiteral.lng);
    const hasCenter = centerLiteral && Number.isFinite(centerLiteral.lat) && Number.isFinite(centerLiteral.lng);

    if (hasAnchor && hasCenter) {
      booth.center = centerLiteral;
      booth.anchor = anchorLiteral;
    } else if (hasAnchor && !hasCenter) {
      booth.center = centerFromAnchor(anchorLiteral, widthFeet, lengthFeet, rotationDeg);
    } else if (!hasAnchor && hasCenter) {
      booth.center = centerLiteral;
      booth.anchor = anchorFromCenter(centerLiteral, widthFeet, lengthFeet, rotationDeg);
    } else {
      booth.center = { lat: 0, lng: 0 };
      booth.anchor = { lat: 0, lng: 0 };
    }
    return booth;
  }

  const CENTER_ICON_URL = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 14 14">
      <circle cx="7" cy="7" r="6" fill="rgba(10,21,20,0.65)" stroke="#d6ff2e" stroke-width="1.4"/>
      <line x1="7" y1="3.2" x2="7" y2="10.8" stroke="#d6ff2e" stroke-width="1.2" stroke-linecap="round"/>
      <line x1="3.2" y1="7" x2="10.8" y2="7" stroke="#d6ff2e" stroke-width="1.2" stroke-linecap="round"/>
    </svg>
  `);

  function ensureBoothCenterMarker(id, booth, opts = {}) {
    if (!booth || !S || !S.map) return null;
    if (!hasGoogleLatLng()) return null;
    const showMarker = opts.force || typeof SHOW_CENTER_DEBUG === 'undefined' || SHOW_CENTER_DEBUG;
    if (!showMarker) return null;

    const centerPos = computeBoothCenterWithOffset(booth, opts.offsetPx);
    if (!centerPos) return null;

    const shapes = S.shapes || (S.shapes = {});
    const prior = shapes[id] && shapes[id].centerDbg;
    const setPos = (target, pos) => {
      if (!target || !pos) return;
      if ('map' in target && target.map === null && opts.keepEvenIfHidden !== true) return;
      if (MCPP.canAdv && 'position' in target) {
        target.position = pos;
      } else if (typeof target.setPosition === 'function') {
        target.setPosition(pos);
      }
    };

    if (prior) {
      setPos(prior, centerPos);
      return prior;
    }

    const marker = new google.maps.Marker({
      map: S.map,
      position: centerPos,
      zIndex: opts.zIndex || 5,
      icon: {
        url: CENTER_ICON_URL,
        size: new google.maps.Size(14, 14),
        scaledSize: new google.maps.Size(14, 14),
        origin: new google.maps.Point(0, 0),
        anchor: new google.maps.Point(7, 7)
      },
      clickable: false,
      optimized: false
    });
    return marker;
  }

  Object.assign(MCPP, {
    computeBoothCenter,
    computeBoothCenterWithOffset,
    ensureBoothCenterMarker,
    normalizeBoothGeometry,
    boothCenterLatLng: computeBoothCenter
  });
})();
