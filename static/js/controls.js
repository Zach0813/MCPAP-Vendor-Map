(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S || (window.S = window.S || {});
  const els = MCPP.els || {};

  if (!Object.keys(els).length) return;

  const scheduledDaysOptions = els.scheduledDaysOptions || null;
  const normalizeScheduledDays = (typeof MCPP.normalizeScheduledDays === 'function')
    ? MCPP.normalizeScheduledDays
    : (list) => (Array.isArray(list) ? list : []);
  const formatScheduledDays = (typeof MCPP.formatScheduledDays === 'function')
    ? MCPP.formatScheduledDays
    : (list) => (list && list.length ? list.join(', ') : 'Not scheduled');
  const returnVendorCheckbox = els.returnVendor || null;
  const returnVendorDisplay = els.returnVendorDisplay || null;
  const formatReturnVendor = (typeof MCPP.formatReturnVendor === 'function')
    ? MCPP.formatReturnVendor
    : (flag) => flag ? 'Returning vendor' : 'First-time vendor';
  const eventStaffCheckbox = els.eventStaff || null;

  const getScheduledDayInputs = () => scheduledDaysOptions
    ? Array.from(scheduledDaysOptions.querySelectorAll('input[name="scheduledDayOption"]'))
    : [];

  const readScheduledDaysFromUI = () => {
    const selected = getScheduledDayInputs()
      .filter((input) => input.checked)
      .map((input) => input.value);
    const normalized = normalizeScheduledDays(selected);
    if (typeof MCPP.updateScheduledDaysUI === 'function') {
      MCPP.updateScheduledDaysUI({ scheduled_days: normalized });
    } else if (els.scheduledDaysDisplay) {
      els.scheduledDaysDisplay.textContent = formatScheduledDays(normalized);
    }
    return normalized;
  };

  const applyScheduledDaysToUI = (booth) => {
    const normalized = normalizeScheduledDays(booth && booth.scheduled_days);
    if (typeof MCPP.updateScheduledDaysUI === 'function') {
      MCPP.updateScheduledDaysUI({ scheduled_days: normalized });
    } else {
      getScheduledDayInputs().forEach((input) => {
        input.checked = normalized.includes(input.value);
      });
      if (els.scheduledDaysDisplay) {
        els.scheduledDaysDisplay.textContent = formatScheduledDays(normalized);
      }
    }
  };

  const applyReturnVendorUI = (booth) => {
    const flag = !!(booth && booth.is_return_vendor);
    if (returnVendorCheckbox) returnVendorCheckbox.checked = flag;
    if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
  };

  const applyEventStaffUI = (booth) => {
    const flag = !!(booth && booth.is_event_staff);
    if (eventStaffCheckbox) eventStaffCheckbox.checked = flag;
  };

  const getNormalizeKey = () => MCPP.normalizeCategoryKey || ((k) => k);
  const updateCategoryPill = () => {
    if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill();
  };

  if (scheduledDaysOptions) {
    scheduledDaysOptions.addEventListener('change', () => {
      readScheduledDaysFromUI();
    });
  }

  if (returnVendorCheckbox) {
    returnVendorCheckbox.addEventListener('change', () => {
      const flag = !!returnVendorCheckbox.checked;
      if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
    });
  }

  if (eventStaffCheckbox) {
    // When admin toggles event staff, apply immediately only to the selected booth
    eventStaffCheckbox.addEventListener('change', async () => {
      if (!S.selected) return;
      const flag = !!eventStaffCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_event_staff = flag;
      // redraw only the selected booth so we don't accidentally affect others
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (els.logoUrl && els.logoPreview) {
    els.logoUrl.addEventListener('input', () => {
      const url = (els.logoUrl.value || '').trim();
      els.logoPreview.src = url || LOGO_BADGE_PLACEHOLDER;
      els.logoPreview.style.display = 'block';
      if (S.selected && S.booths[S.selected]) {
        S.booths[S.selected].logo_url = url;
      }
    });
  }

  if (els.addBooth) {
    els.addBooth.addEventListener('click', async () => {
      if (!S.isAdmin) return;
      const id = 'B' + (S.seq++);
      const mapCenter = S.map ? S.map.getCenter() : { lat: DEFAULT_CENTER.lat, lng: DEFAULT_CENTER.lng };
      const centerLiteral = mapCenter && typeof mapCenter.lat === 'function'
        ? { lat: mapCenter.lat(), lng: mapCenter.lng() }
        : { lat: Number(mapCenter.lat) || DEFAULT_CENTER.lat, lng: Number(mapCenter.lng) || DEFAULT_CENTER.lng };
      const width = parseInt(els.defWidth && els.defWidth.value || 10, 10) || 10;
      const length = parseInt(els.defLength && els.defLength.value || 10, 10) || 10;
      const cat = (els.defCat && els.defCat.value) || 'standard';
      const baseBooth = {
        id,
        center: centerLiteral,
        width_feet: width,
        length_feet: length,
        rotation_deg: 0,
        biz: '',
        vendor_name: '',
        phone: '',
        email: '',
        website: '',
        notes: '',
        category: cat,
        logo_url: '',
        phone_public: false,
        email_public: false,
        scheduled_days: []
      };
      baseBooth.anchor = (typeof MCPP.boothAnchorFromCenter === 'function')
        ? MCPP.boothAnchorFromCenter(centerLiteral, baseBooth)
        : centerLiteral;
      if (typeof MCPP.normalizeBoothGeometry === 'function') {
        MCPP.normalizeBoothGeometry(baseBooth);
      }
      S.booths[id] = baseBooth;
      if (typeof MCPP.draw === 'function') MCPP.draw(id);
      if (typeof MCPP.select === 'function') MCPP.select(id);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (els.duplicateBooth) {
    els.duplicateBooth.addEventListener('click', async () => {
      if (!S.isAdmin || !S.selected) return;
      const src = S.booths[S.selected];
      const id = 'B' + (S.seq++);
      const d2ll = MCPP.d2ll || ((lat0) => ({ lat: lat0, dLng: 0 }));
      const srcCenterLL = (typeof MCPP.boothCenterLatLng === 'function')
        ? MCPP.boothCenterLatLng(src)
        : new google.maps.LatLng(src.center.lat, src.center.lng);
      const latFn = typeof srcCenterLL.lat === 'function' ? srcCenterLL.lat.bind(srcCenterLL) : () => srcCenterLL.lat;
      const lngFn = typeof srcCenterLL.lng === 'function' ? srcCenterLL.lng.bind(srcCenterLL) : () => srcCenterLL.lng;
      const { lat, dLng } = d2ll(latFn(), 8 * FT, 8 * FT);
      const newCenter = { lat, lng: lngFn() + dLng };
      const clone = {
        id,
        center: newCenter,
        width_feet: src.width_feet,
        length_feet: src.length_feet,
        rotation_deg: src.rotation_deg,
        category: src.category,
        biz: '',
        vendor_name: '',
        phone: '',
        email: '',
        website: '',
        notes: '',
        logo_url: '',
        phone_public: false,
        email_public: false,
        scheduled_days: normalizeScheduledDays(src.scheduled_days || [])
      };
      clone.anchor = (typeof MCPP.boothAnchorFromCenter === 'function')
        ? MCPP.boothAnchorFromCenter(newCenter, clone)
        : newCenter;
      if (typeof MCPP.normalizeBoothGeometry === 'function') {
        MCPP.normalizeBoothGeometry(clone);
      }
      S.booths[id] = clone;
      if (typeof MCPP.draw === 'function') MCPP.draw(id);
      if (typeof MCPP.select === 'function') MCPP.select(id);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  const normalizeRotation = (value) => {
    let deg = Number(value);
    if (!Number.isFinite(deg)) deg = 0;
    deg = deg % 360;
    if (deg < 0) deg += 360;
    return deg;
  };

  if (els.assign) {
    els.assign.addEventListener('click', async () => {
      if (!S.isAdmin || !S.selected) return;
      const booth = S.booths[S.selected];
      booth.biz = (els.biz.value || '').trim();
      booth.vendor_name = (els.vendorName.value || '').trim();
      const fmtPhone = (typeof MCPP.formatPhoneNumber === 'function')
        ? MCPP.formatPhoneNumber(els.phone.value)
        : (els.phone.value || '').trim();
      booth.phone = fmtPhone;
      if (els.phone) els.phone.value = fmtPhone;
      booth.email = (els.email.value || '').trim();
      booth.website = (els.website.value || '').trim();
      booth.notes = (els.notes.value || '').trim();
      booth.logo_url = (els.logoUrl.value || '').trim();
      booth.phone_public = !els.phonePublic.checked;
      booth.email_public = !els.emailPublic.checked;
      booth.scheduled_days = readScheduledDaysFromUI();
      applyScheduledDaysToUI(booth);
      booth.is_return_vendor = !!(returnVendorCheckbox && returnVendorCheckbox.checked);
  booth.is_event_staff = !!(eventStaffCheckbox && eventStaffCheckbox.checked);
      applyReturnVendorUI(booth);
  applyEventStaffUI(booth);
      booth.width_feet = Math.max(1, parseInt(els.widthFeet.value || booth.width_feet, 10) || booth.width_feet);
      booth.length_feet = Math.max(1, parseInt(els.lengthFeet.value || booth.length_feet, 10) || booth.length_feet);
      if (els.rotationDeg) {
        const deg = normalizeRotation(els.rotationDeg.value || booth.rotation_deg);
        booth.rotation_deg = deg;
        els.rotationDeg.value = Math.round(deg);
      }
      if (booth.center && typeof MCPP.boothAnchorFromCenter === 'function') {
        booth.anchor = MCPP.boothAnchorFromCenter(booth.center, booth);
      }
      if (typeof MCPP.normalizeBoothGeometry === 'function') {
        MCPP.normalizeBoothGeometry(booth);
      }
      booth.category = getNormalizeKey()(els.category.value || 'standard');
      updateCategoryPill();
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (els.rotationDeg) {
    const applyRotationInput = () => {
      if (!S.selected) return;
      const booth = S.booths[S.selected];
      if (!booth) return;
      const deg = normalizeRotation(els.rotationDeg.value);
      booth.rotation_deg = deg;
      els.rotationDeg.value = Math.round(deg);
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync();
    };
    els.rotationDeg.addEventListener('input', applyRotationInput);
    els.rotationDeg.addEventListener('change', applyRotationInput);
  }

  if (els.unassign) {
    els.unassign.addEventListener('click', async () => {
      if (!S.isAdmin || !S.selected) return;
      const booth = S.booths[S.selected];
      booth.logo_url = '';
      booth.biz = '';
      booth.vendor_name = '';
      booth.phone = '';
      booth.email = '';
      booth.website = '';
      booth.notes = '';
      booth.phone_public = false;
      booth.email_public = false;
      booth.scheduled_days = [];
      booth.is_return_vendor = false;
  booth.is_event_staff = false;
      applyScheduledDaysToUI(booth);
      applyReturnVendorUI(booth);
  applyEventStaffUI(booth);
      if (els.logoPreview) {
        els.logoPreview.src = LOGO_BADGE_PLACEHOLDER;
        els.logoPreview.style.display = 'block';
      }
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (els.deleteBooth) {
    els.deleteBooth.addEventListener('click', async () => {
      if (!S.isAdmin || !S.selected) return;
      const id = S.selected;
      if (!confirm(`Delete booth ${id}?`)) return;
      const shape = S.shapes[id];
      if (shape) {
        if (shape.poly) shape.poly.setMap(null);
        if (shape.lab) shape.lab.map = null;
        if (shape.centerDbg) {
          if ('map' in shape.centerDbg) shape.centerDbg.map = null;
          else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
        }
        delete S.shapes[id];
      }
      delete S.booths[id];
      S.selected = null;
      if (els.boothId && 'value' in els.boothId) els.boothId.value = '';
      if (typeof MCPP.save === 'function') await MCPP.save(false);
      if (typeof MCPP.refreshList === 'function') MCPP.refreshList();
      if (typeof MCPP.showList === 'function') MCPP.showList();
    });
  }

  if (els.exportCSV) {
    els.exportCSV.addEventListener('click', () => {
      if (typeof MCPP.dl === 'function' && typeof MCPP.csv === 'function') {
        MCPP.dl('booths.csv', MCPP.csv());
      }
    });
  }

  if (!MCPP.updateReturnVendorUI) {
    MCPP.updateReturnVendorUI = applyReturnVendorUI;
  }
  if (!MCPP.updateEventStaffUI) {
    MCPP.updateEventStaffUI = applyEventStaffUI;
  }

  if (els.exportJSON) {
    els.exportJSON.addEventListener('click', () => {
      if (typeof MCPP.dl === 'function') {
        MCPP.dl('booths.json', JSON.stringify(S.booths, null, 2), 'application/json');
      }
    });
  }

  if (els.backToList) {
    els.backToList.addEventListener('click', () => {
      if (typeof MCPP.clearSelection === 'function') MCPP.clearSelection();
    });
  }

  if (els.listSearch) {
    els.listSearch.addEventListener('input', () => {
      if (typeof MCPP.refreshList === 'function') MCPP.refreshList();
    });
  }

  if (els.phone) {
    const formatInputPhone = () => {
      if (typeof MCPP.formatPhoneNumber !== 'function') return;
      els.phone.value = MCPP.formatPhoneNumber(els.phone.value);
    };
    els.phone.addEventListener('blur', formatInputPhone);
    els.phone.addEventListener('change', formatInputPhone);
  }

  if (els.category) {
    els.category.addEventListener('change', () => {
      const key = getNormalizeKey()(els.category.value || 'standard');
      els.category.value = key;
      updateCategoryPill();
    });
  }

  document.addEventListener('click', (event) => {
    if (els.profileMenu && !els.profileMenu.contains(event.target) && event.target !== els.profileBtn) {
      els.profileMenu.classList.add('hidden');
    }
  });

  if (els.profileBtn) {
    els.profileBtn.addEventListener('click', (event) => {
      event.stopPropagation();
      if (els.profileMenu) els.profileMenu.classList.remove('hidden');
    });
  }

  const loginLogoutBtn = els.loginBtn || els.logoutBtn;
  if (loginLogoutBtn) {
    loginLogoutBtn.addEventListener('click', async () => {
      if (!S.isAdmin) {
        const pin = prompt('Enter admin PIN:');
        if (pin == null) return;
        const resp = await fetch('/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pin })
        });
        if (resp.ok) {
          if (typeof MCPP.who === 'function') await MCPP.who();
          if (typeof MCPP.resetToListPanel === 'function') MCPP.resetToListPanel();
          if (els.profileMenu) els.profileMenu.classList.add('hidden');
          loginLogoutBtn.textContent = 'Logout';
        } else {
          alert('Invalid PIN');
        }
      } else {
        await fetch('/logout', { method: 'POST' });
        if (typeof MCPP.who === 'function') await MCPP.who();
        if (typeof MCPP.resetToListPanel === 'function') MCPP.resetToListPanel();
        if (els.profileMenu) els.profileMenu.classList.add('hidden');
        loginLogoutBtn.textContent = 'Login';
      }
    });
  }

  if (els.locate) {
    els.locate.addEventListener('click', () => {
      const q = els.addr && els.addr.value.trim();
      if (!q) return;
      if (!S.geocoder) S.geocoder = new google.maps.Geocoder();
      S.geocoder.geocode({ address: q }, (res, status) => {
        if (status === 'OK' && res[0]) {
          const vp = res[0].geometry.viewport || new google.maps.LatLngBounds(res[0].geometry.location, res[0].geometry.location);
          const prevMin = S.map.get('minZoom');
          S.map.setOptions({ minZoom: START_ZOOM });
          S.map.fitBounds(vp, { top: 40, bottom: 40, left: 20, right: 20 });
          const once = S.map.addListener('idle', () => {
            S.map.setOptions({ minZoom: (prevMin == null ? 2 : prevMin) });
            S.didInitialViewport = true;
            if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync();
            google.maps.event.removeListener(once);
          });
        } else {
          alert('Address not found');
        }
      });
    });
  }

  if (els.fit) {
    els.fit.addEventListener('click', () => {
      if (!Object.keys(S.shapes).length) return;
      const bounds = new google.maps.LatLngBounds();
      Object.values(S.shapes).forEach((shape) => shape.poly.getPath().forEach((ll) => bounds.extend(ll)));
      const prevMin = S.map.get('minZoom');
      S.map.setOptions({ minZoom: START_ZOOM });
      S.map.fitBounds(bounds, { top: 40, bottom: 40, left: 20, right: 20 });
      const once = S.map.addListener('idle', () => {
        S.map.setOptions({ minZoom: (prevMin == null ? 2 : prevMin) });
        if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync();
        google.maps.event.removeListener(once);
      });
    });
  }

  if (els.toggleType) {
    els.toggleType.addEventListener('click', () => {
      if (!S.map) return;
      const type = S.map.getMapTypeId();
      S.map.setMapTypeId(type === 'satellite' ? 'hybrid' : 'satellite');
    });
  }

  document.addEventListener('keydown', (event) => {
    if (!S.isAdmin || !S.selected) return;
    const booth = S.booths[S.selected];
    const step = (event.shiftKey ? 5 : 1);
    let east = 0, north = 0, handled = false;
    if (event.key === 'ArrowLeft') { east -= step; handled = true; }
    if (event.key === 'ArrowRight') { east += step; handled = true; }
    if (event.key === 'ArrowUp') { north += step; handled = true; }
    if (event.key === 'ArrowDown') { north -= step; handled = true; }
    if (!handled) return;
    event.preventDefault();
    const d2ll = MCPP.d2ll || ((lat0) => ({ lat: lat0, dLng: 0 }));
    const dx = east * FT;
    const dy = north * FT;
    const { lat, dLng } = d2ll(booth.center.lat, dx, dy);
    booth.center = { lat, lng: booth.center.lng + dLng };
    if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
    if (typeof MCPP.save === 'function') MCPP.save(true);
  });
})();
