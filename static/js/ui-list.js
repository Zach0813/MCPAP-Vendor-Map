(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S || (window.S = window.S || {});
  const els = MCPP.els || {};

  const scheduledDaysDisplay = els.scheduledDaysDisplay || null;
  const scheduledDaysOptions = els.scheduledDaysOptions || null;
  const normalizeScheduledDays = (typeof MCPP.normalizeScheduledDays === 'function')
    ? MCPP.normalizeScheduledDays
    : (list) => (Array.isArray(list) ? list : []);
  const formatScheduledDays = (typeof MCPP.formatScheduledDays === 'function')
    ? MCPP.formatScheduledDays
    : (list) => (list && list.length ? list.join(', ') : 'Not scheduled');
  const formatReturnVendor = (typeof MCPP.formatReturnVendor === 'function')
    ? MCPP.formatReturnVendor
    : (flag) => flag ? 'Returning vendor' : 'First-time vendor';
  const returnVendorDisplay = els.returnVendorDisplay || null;
  const returnVendorCheckbox = els.returnVendor || null;
  const panelReturnBadgeEl = els.panelReturnBadge || (typeof document !== 'undefined' ? document.getElementById('panelReturnBadge') : null);
  const eventStaffCheckbox = els.eventStaff || null;
  const panelStaffBadgeEl = els.panelStaffBadge || (typeof document !== 'undefined' ? document.getElementById('panelStaffBadge') : null);
  const panelBadgesContainer = (typeof document !== 'undefined' ? document.getElementById('panelBadges') : null);

  function updateScheduledDaysUI(booth) {
    const normalized = normalizeScheduledDays(booth && booth.scheduled_days);
    if (scheduledDaysDisplay) {
      scheduledDaysDisplay.textContent = formatScheduledDays(normalized);
    }
    if (scheduledDaysOptions) {
      const inputs = scheduledDaysOptions.querySelectorAll('input[name="scheduledDayOption"]');
      inputs.forEach((input) => {
        input.checked = normalized.includes(input.value);
      });
    }
  }

  function updateReturnVendorUI(booth) {
    const flag = !!(booth && booth.is_return_vendor);
    if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
    if (returnVendorCheckbox) returnVendorCheckbox.checked = flag;
    // Toggle the small inline badge in the edit panel (if present)
    if (panelReturnBadgeEl) {
      try {
        // Use the shared .hidden utility so viewer/global readOnly toggles don't fight inline styles
        panelReturnBadgeEl.classList.toggle('hidden', !flag);
        panelReturnBadgeEl.setAttribute('aria-hidden', flag ? 'false' : 'true');
        // keep title updated for screen readers
        panelReturnBadgeEl.title = flag ? 'Returning vendor' : 'First-time vendor';
      } catch (_) {}
    }
  }

  function updateEventStaffUI(booth) {
    const flag = !!(booth && booth.is_event_staff);
    if (eventStaffCheckbox) eventStaffCheckbox.checked = flag;
    if (panelStaffBadgeEl) {
      try {
        panelStaffBadgeEl.classList.toggle('hidden', !flag);
        panelStaffBadgeEl.setAttribute('aria-hidden', flag ? 'false' : 'true');
        panelStaffBadgeEl.title = flag ? 'Event staff' : 'Not event staff';
      } catch (_) {}
    }
    // Toggle container state so the return badge shifts down when staff badge is present
    if (panelBadgesContainer) {
      try { panelBadgesContainer.classList.toggle('has-staff', !!flag); } catch (_) {}
    }
  }

  function listRow(id, booth) {
    const name = (booth.biz && booth.biz.trim()) || (booth.vendor_name || '');
    const displayId = (MCPP.formatBoothId ? MCPP.formatBoothId(id) : id);
    const el = document.createElement('div'); el.className = 'list-item'; el.tabIndex = 0;
    const sw = document.createElement('div'); sw.className = 'legend-swatch';
    const s = CAT[booth.category || 'standard'] || CAT.standard;
    sw.style.background = s.f; sw.style.borderColor = s.s;
    const logoUrl = (booth.logo_url || '').trim();

    const tx = document.createElement('div');
    tx.innerHTML = `<div><b class='mono'>${displayId}</b> — ${name || '<em>Unassigned</em>'}</div>`;
    el.appendChild(sw);

    if (logoUrl) {
      const badgeThumb = document.createElement('div');
      badgeThumb.className = 'badge-thumb';
      const img = document.createElement('img');
      img.src = logoUrl;
      img.alt = `${name || id} logo`;
      img.loading = 'lazy';
      img.decoding = 'async';
      badgeThumb.appendChild(img);
      el.appendChild(badgeThumb);
    }

    el.appendChild(tx);
    el.addEventListener('click', () => {
      select(id);
      if (S.booths[id] && S.map) S.map.panTo(S.booths[id].center);
    });
    return el;
  }

  const CATEGORY_ORDER = ['standard', 'collaborator', 'foodbeverage', 'activity', 'misc'];
  const listCollapsed = MCPP.listCollapsed = MCPP.listCollapsed || new Set();

  function hexToRgba(hex, alpha) {
    if (!hex || typeof hex !== 'string') return `rgba(0,0,0,${alpha})`;
    const clean = hex.replace('#', '');
    if (clean.length !== 6) return `rgba(0,0,0,${alpha})`;
    const r = parseInt(clean.slice(0, 2), 16);
    const g = parseInt(clean.slice(2, 4), 16);
    const b = parseInt(clean.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function categoryLabel(key) {
    if (typeof MCPP.catNameForKey === 'function') return MCPP.catNameForKey(key);
    const map = {
      standard: 'Plant Vendor 🌿',
      collaborator: 'Craft Vendor 🎨',
      foodbeverage: 'Food/Beverage Vendor 🍽️',
      activity: 'Activity/Entertainment 🎪',
      misc: 'Miscellaneous 🧭'
    };
    return map[key] || (key.charAt(0).toUpperCase() + key.slice(1));
  }

  function refreshList() {
    if (!els.boothList) return;
    const q = (els.listSearch && els.listSearch.value || '').toLowerCase();
    els.boothList.innerHTML = '';

    const grouped = {};
    Object.entries(S.booths)
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
      .forEach(([id, booth]) => {
        const hay = [id, booth.biz || '', booth.vendor_name || '', booth.phone || '', booth.email || '', booth.website || '', booth.notes || '']
          .join(' ').toLowerCase();
        if (q && !hay.includes(q)) return;
        const key = (booth.category || 'standard');
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push([id, booth]);
      });

    const order = CATEGORY_ORDER.concat(Object.keys(grouped).filter((key) => !CATEGORY_ORDER.includes(key)));
    let hasAny = false;

    order.forEach((catKey) => {
      const items = grouped[catKey];
      if (!items || !items.length) return;
      hasAny = true;

      const section = document.createElement('div');
      section.className = 'list-category';
      section.dataset.cat = catKey;

      const header = document.createElement('button');
      header.type = 'button';
      header.className = 'category-header';
      header.innerHTML = `<span class="label"><span class="caret">▾</span>${categoryLabel(catKey)}</span><span class="count">${items.length}</span>`;

      const body = document.createElement('div');
      body.className = 'category-body';

      const collapsed = listCollapsed.has(catKey);
      body.style.display = collapsed ? 'none' : 'block';
      header.setAttribute('aria-expanded', collapsed ? 'false' : 'true');

      const catTheme = CAT[catKey] || CAT.standard;
      if (catTheme && catTheme.f) {
        header.style.background = catTheme.f;
        header.style.borderBottom = `1px solid ${catTheme.s || 'rgba(0,0,0,.2)'}`;
        header.style.color = '#eaf6f5';
        section.style.borderColor = catTheme.s || catTheme.f;
        section.style.background = hexToRgba(catTheme.f, 0.18);
        body.style.background = hexToRgba(catTheme.f, 0.1);
      }

      header.addEventListener('click', () => {
        const wasCollapsed = listCollapsed.has(catKey);
        if (wasCollapsed) listCollapsed.delete(catKey);
        else listCollapsed.add(catKey);
        const nowCollapsed = listCollapsed.has(catKey);
        body.style.display = nowCollapsed ? 'none' : 'block';
        header.setAttribute('aria-expanded', nowCollapsed ? 'false' : 'true');
      });

      items
        .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
        .forEach(([id, booth]) => {
          body.appendChild(listRow(id, booth));
        });

      section.appendChild(header);
      section.appendChild(body);
      els.boothList.appendChild(section);
    });

    if (!hasAny) {
      const empty = document.createElement('div');
      empty.className = 'list-empty';
      empty.textContent = 'No booths match your search.';
      els.boothList.appendChild(empty);
    }
  }

  function csv() {
    const rows = [[
      "id","lat","lng","width_feet","length_feet","rotation_deg","category",
      "logo_url","business","vendor_name","phone","phone_public","email","email_public","website","notes"
    ]];
    Object.entries(S.booths).forEach(([id, booth]) => rows.push([
      id,
      booth.center.lat,
      booth.center.lng,
      booth.width_feet,
      booth.length_feet,
      booth.rotation_deg,
      booth.category || 'standard',
      booth.logo_url || '',
      booth.biz || '',
      booth.vendor_name || '',
      booth.phone || '',
      !!booth.phone_public,
      booth.email || '',
      !!booth.email_public,
      booth.website || '',
      (booth.notes || '').replace(/\n/g, ' ')
    ]));
    return rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');
  }

  function dl(name, txt, type = 'text/plain') {
    const blob = new Blob([txt], { type });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function select(id) {
    try {
      const setPos = MCPP.setPos || ((target, pos) => target && typeof target.setPosition === 'function' && target.setPosition(pos));
      S.selected = id;
      const booth = S.booths[id];
      if (!booth) return;

      const displayId = MCPP.formatBoothId ? MCPP.formatBoothId(id) : id;
      if (els.boothId) {
        try {
          if (typeof els.boothId.textContent === 'string') els.boothId.textContent = displayId;
          if ('value' in els.boothId) els.boothId.value = displayId;
        } catch (_) {}
      }

      const fmtPhone = (typeof MCPP.formatPhoneNumber === 'function')
        ? MCPP.formatPhoneNumber(booth.phone || '')
        : (booth.phone || '');
      booth.phone = fmtPhone;

      if (els.widthFeet) els.widthFeet.value = booth.width_feet;
      if (els.lengthFeet) els.lengthFeet.value = booth.length_feet;
      if (els.rotationDeg) els.rotationDeg.value = Math.round(booth.rotation_deg || 0);
      if (els.category) {
        const key = (MCPP.normalizeCategoryKey || ((k) => k))(booth.category || 'standard');
        els.category.value = key;
      }
      if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill();
      if (els.logoUrl) els.logoUrl.value = booth.logo_url || '';
      if (els.logoPreview) {
        const url = (booth.logo_url || '').trim();
        els.logoPreview.src = url || LOGO_BADGE_PLACEHOLDER;
        els.logoPreview.style.display = 'block';
        els.logoPreview.setAttribute('draggable', 'false');
      }
      if (els.biz) els.biz.value = booth.biz || '';
      if (els.vendorName) els.vendorName.value = booth.vendor_name || '';
      if (els.phone) els.phone.value = (S.isAdmin || booth.phone_public) ? fmtPhone : '';
      if (els.email) els.email.value = (S.isAdmin || booth.email_public) ? (booth.email || '') : '';
      if (els.website) els.website.value = booth.website || '';
      if (els.phonePublic) els.phonePublic.checked = !booth.phone_public;
      if (els.emailPublic) els.emailPublic.checked = !booth.email_public;
      if (els.notes) els.notes.value = booth.notes || '';
  updateScheduledDaysUI(booth);
  updateReturnVendorUI(booth);
  updateEventStaffUI(booth);

      const phoneRowSel = document.getElementById('phoneRow');
      const emailRowSel = document.getElementById('emailRow');
      if (!S.isAdmin) {
        if (phoneRowSel) phoneRowSel.style.display = booth.phone_public ? '' : 'none';
        if (emailRowSel) emailRowSel.style.display = booth.email_public ? '' : 'none';
      } else {
        if (phoneRowSel) phoneRowSel.style.display = '';
        if (emailRowSel) emailRowSel.style.display = '';
      }

      const styleFn = MCPP.style || (() => ({ stroke: '#3f7f7f' }));
      const getCenter = MCPP.getVisualCenterAdjusted || ((b) => b.center);

      Object.entries(S.shapes).forEach(([bid, shape]) => {
        const sel = (bid === id);
        const boothData = S.booths[bid];
        const assigned = !!(boothData.biz || boothData.vendor_name || boothData.notes || boothData.phone || boothData.email);
        const st = styleFn(boothData.category || 'standard', assigned);
        if (shape.poly) shape.poly.setOptions({
          fillOpacity: sel ? 1 : 0.75,
          strokeColor: sel ? '#d6ff2e' : st.stroke,
          strokeWeight: sel ? 3 : 1
        });
        const pos = getCenter(boothData);
        if (shape.labelEl) {
          shape.labelEl.style.color = sel ? '#d6ff2e' : '#eaf6f5';
          if (typeof shape.updateLabelStyle === 'function') shape.updateLabelStyle();
        }
        if (shape.lab) setPos(shape.lab, pos);
        if (shape.centerDbg) {
          setPos(shape.centerDbg, pos);
          if (!shape.centerDbg.map && typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(S.map);
        }
      });

      if (els.editPanel) els.editPanel.classList.remove('hidden');
      if (typeof MCPP.showEditor === 'function') MCPP.showEditor();
      if (S.map) S.map.setOptions({ keyboardShortcuts: false });
    } catch (err) {
      console.error('select() failed:', err);
      if (typeof MCPP.showEditor === 'function') MCPP.showEditor();
    }
  }

  function clearSelection() {
    if (!S.selected) {
      if (S.map) S.map.setOptions({ keyboardShortcuts: true });
      if (typeof MCPP.showList === 'function') MCPP.showList();
      return;
    }
    S.selected = null;
    if (els.boothId) {
      try {
        if (typeof els.boothId.textContent === 'string') els.boothId.textContent = '—';
        if ('value' in els.boothId) els.boothId.value = '';
      } catch (_) {}
    }
  updateScheduledDaysUI(null);
  updateReturnVendorUI(null);
  updateEventStaffUI(null);
    const styleFn = MCPP.style || (() => ({ stroke: '#3f7f7f' }));
    Object.entries(S.shapes).forEach(([bid, shape]) => {
      const boothData = S.booths[bid];
      const assigned = !!(boothData.biz || boothData.vendor_name || boothData.notes || boothData.phone || boothData.email);
      const st = styleFn(boothData.category || 'standard', assigned);
      if (shape.poly) shape.poly.setOptions({ strokeColor: st.stroke, strokeWeight: 1, fillOpacity: 0.75 });
      if (shape.labelEl) {
        shape.labelEl.style.color = '#eaf6f5';
        if (typeof shape.updateLabelStyle === 'function') shape.updateLabelStyle();
      }
      if (shape.centerDbg) {
        if ('map' in shape.centerDbg) shape.centerDbg.map = null;
        else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
      }
    });
    if (S.map) S.map.setOptions({ keyboardShortcuts: true });
    if (typeof MCPP.showList === 'function') MCPP.showList();
  }

  function redraw() {
    Object.values(S.shapes).forEach((shape) => {
      if (shape.poly) shape.poly.setMap(null);
      if (shape.lab) shape.lab.map = null;
      if (shape.centerDbg) {
        if ('map' in shape.centerDbg) shape.centerDbg.map = null;
        else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
      }
    });
    S.shapes = {};

    const bounds = new google.maps.LatLngBounds();
    const rect = MCPP.rect || (() => []);
    Object.entries(S.booths).forEach(([id, booth]) => {
      if (typeof MCPP.draw === 'function') MCPP.draw(id);
      rect((MCPP.boothCenterLatLng ? MCPP.boothCenterLatLng(booth).toJSON?.() || MCPP.boothCenterLatLng(booth) : booth.center), booth.width_feet, booth.length_feet, -(booth.rotation_deg || 0))
        .forEach((ll) => bounds.extend(ll));
    });
    if (!bounds.isEmpty() && !S.didInitialViewport && S.map) {
      const prevMin = S.map.get('minZoom');
      S.map.setOptions({ minZoom: START_ZOOM });
      S.map.fitBounds(bounds, { top: 40, bottom: 40, left: 20, right: 20 });
      const once = S.map.addListener('idle', () => {
        S.map.setOptions({ minZoom: (prevMin == null ? 2 : prevMin) });
        S.didInitialViewport = true;
        google.maps.event.removeListener(once);
      });
    }
    refreshList();
    if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync();
    if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill();
  }

Object.assign(MCPP, {
    listRow,
    refreshList,
    csv,
    dl,
    select,
    clearSelection,
    updateScheduledDaysUI,
  updateReturnVendorUI,
  updateEventStaffUI,
    redraw
  });

  window.redraw = redraw;
})();
