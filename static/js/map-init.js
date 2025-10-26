(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S || (window.S = window.S || {});

  window.initMCPPMap = async function initMCPPMap() {
    try {
      if (typeof MCPP.who === 'function') await MCPP.who();
      if (typeof MCPP.load === 'function') await MCPP.load();

      S.map = new google.maps.Map(document.getElementById('map'), {
        center: DEFAULT_CENTER,
        zoom: START_ZOOM,
        mapTypeId: 'satellite',
        mapId: MCPP.hasMapId ? String(window.__MAP_ID__).trim() : undefined,
        gestureHandling: 'greedy',
        mapTypeControl: false,
        streetViewControl: false,
        fullscreenControl: true,
        rotateControl: false,
        maxZoom: 23,
        minZoom: 18
      });

      if (!MCPP.hasMapId) {
        try {
          console.warn('[MCPP] No Map ID detected. Advanced Markers and vector features may be limited. Set window.__MAP_ID__ to a valid Google Cloud Map ID.');
        } catch (_) {}
      }

      function ProjectionOverlay() {}
      ProjectionOverlay.prototype = new google.maps.OverlayView();
      ProjectionOverlay.prototype.onAdd = function onAdd() {};
      ProjectionOverlay.prototype.draw = function draw() {};
      ProjectionOverlay.prototype.onRemove = function onRemove() {};
      const overlay = new ProjectionOverlay();
      overlay.setMap(S.map);
      S.proj = overlay;

      MCPP.canAdv = !!(window.google && window.google.maps && window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement);
      if (!MCPP.canAdv) {
        try {
          console.warn('[MCPP] AdvancedMarkerElement not available (missing marker library?). Logo badges and rotation knob HTML fall back gracefully.');
        } catch (_) {}
      }

      (function waitForProjectionAndDraw(attempts = 0) {
        const ready = S.proj && typeof S.proj.getProjection === 'function' && S.proj.getProjection();
        if (ready) {
          if (typeof MCPP.redraw === 'function') MCPP.redraw();
          const syncOnce = S.map.addListener('idle', () => {
            if (typeof MCPP.syncOverlayCenters === 'function') MCPP.syncOverlayCenters();
            google.maps.event.removeListener(syncOnce);
          });
        } else if (attempts < 40) {
          requestAnimationFrame(() => waitForProjectionAndDraw(attempts + 1));
        }
      })();

      S.map.setTilt(0);
      S.map.setHeading(0);
      const clampTilt = () => {
        if (S.map.getTilt && S.map.getTilt() !== 0) S.map.setTilt(0);
        if (S.map.getHeading && S.map.getHeading() !== 0) S.map.setHeading(0);
      };

      const onZoomChanged = () => {
        clampTilt();
        if (typeof MCPP.updateLabelVisibility === 'function') MCPP.updateLabelVisibility();
        if (typeof MCPP.updateLabelLayoutForZoom === 'function') MCPP.updateLabelLayoutForZoom();
      };

      S.map.addListener('idle', clampTilt);
      S.map.addListener('maptypeid_changed', clampTilt);
      S.map.addListener('zoom_changed', onZoomChanged);

      const ensureMinZoom = () => {
        if (S.didInitialViewport) return;
        const z = S.map.getZoom();
        if (z < START_ZOOM) S.map.setZoom(START_ZOOM);
      };
      const initialIdle = S.map.addListener('idle', () => {
        ensureMinZoom();
        google.maps.event.removeListener(initialIdle);
      });

      S.map.addListener('click', () => {
        if (typeof MCPP.resetToListPanel === 'function') MCPP.resetToListPanel();
      });

      if (window.__DEFAULTS__ && window.__DEFAULTS__.address) {
        if (!S.geocoder) S.geocoder = new google.maps.Geocoder();
        S.geocoder.geocode({ address: window.__DEFAULTS__.address }, (res, status) => {
          if (status === 'OK' && res[0]) {
            const vp = res[0].geometry.viewport || new google.maps.LatLngBounds(res[0].geometry.location, res[0].geometry.location);
            const prevMin = S.map.get('minZoom');
            S.map.setOptions({ minZoom: START_ZOOM });
            S.map.fitBounds(vp, { top: 40, bottom: 40, left: 20, right: 20 });
            const onceGeo = S.map.addListener('idle', () => {
              S.map.setOptions({ minZoom: (prevMin == null ? 2 : prevMin) });
              S.didInitialViewport = true;
              requestAnimationFrame(() => {
                if (typeof MCPP.syncOverlayCenters === 'function') MCPP.syncOverlayCenters();
                if (typeof MCPP.updateLabelVisibility === 'function') MCPP.updateLabelVisibility();
                if (typeof MCPP.updateLabelLayoutForZoom === 'function') MCPP.updateLabelLayoutForZoom();
              });
              google.maps.event.removeListener(onceGeo);
            });
          }
        });
      }

      if (typeof MCPP.showList === 'function') MCPP.showList();
      if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill();
      
      // Initialize Places Autocomplete after map is ready
      if (typeof MCPP.initAutocomplete === 'function') {
        setTimeout(() => MCPP.initAutocomplete(), 500);
      }
      if (typeof MCPP.initBusinessAddressAutocomplete === 'function') {
        setTimeout(() => MCPP.initBusinessAddressAutocomplete(), 500);
      }
    } catch (err) {
      console.error('[MCPP] init failed', err);
      if (typeof MCPP.showBootError === 'function') {
        MCPP.showBootError(err && err.message ? err.message : String(err));
      }
    }
  };

  setTimeout(() => {
    if (!window.google || !google.maps) {
      if (typeof MCPP.showBootError === 'function') {
        MCPP.showBootError('Google Maps failed to load (403 or network). Check API key & restrictions.');
      }
    }
  }, 3500);
})();
