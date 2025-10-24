(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};

  const SCHEDULED_DAY_OPTIONS = [
    { value: 'saturday', short: 'Sat', full: 'Saturday' },
    { value: 'sunday', short: 'Sun', full: 'Sunday' }
  ];
  const SCHEDULED_DAY_ORDER = SCHEDULED_DAY_OPTIONS.map((opt) => opt.value);
  const SCHEDULED_DAY_MAP = SCHEDULED_DAY_OPTIONS.reduce((acc, opt) => {
    acc[opt.value] = opt;
    return acc;
  }, {});

  function normalizeScheduledDays(list) {
    if (!Array.isArray(list)) return [];
    const seen = new Set();
    const out = [];
    list.forEach((item) => {
      const key = String(item || '').toLowerCase();
      if (SCHEDULED_DAY_ORDER.includes(key) && !seen.has(key)) {
        seen.add(key);
        out.push(key);
      }
    });
    out.sort((a, b) => SCHEDULED_DAY_ORDER.indexOf(a) - SCHEDULED_DAY_ORDER.indexOf(b));
    return out;
  }

  function formatScheduledDays(list, { short = false } = {}) {
    const normalized = normalizeScheduledDays(list);
    if (!normalized.length) return 'Not scheduled';
    if (normalized.length === SCHEDULED_DAY_ORDER.length) return 'Saturday & Sunday';
    return normalized
      .map((value) => {
        const opt = SCHEDULED_DAY_MAP[value];
        if (!opt) return value;
        if (short && opt.short) return opt.short;
        return opt.full || opt.short || value;
      })
      .join(short ? ' / ' : ', ');
  }

  const RETURN_VENDOR_TEXT = {
    true: 'Returning vendor',
    false: 'First-time vendor'
  };

  function formatReturnVendor(flag) {
    return flag ? RETURN_VENDOR_TEXT.true : RETURN_VENDOR_TEXT.false;
  }

  MCPP.SCHEDULED_DAY_OPTIONS = SCHEDULED_DAY_OPTIONS;
  MCPP.normalizeScheduledDays = normalizeScheduledDays;
  MCPP.formatScheduledDays = formatScheduledDays;
  MCPP.formatReturnVendor = formatReturnVendor;

  const $ = (id) => document.getElementById(id);
const els = {
    profileBtn: $('profileBtn'), profileMenu: $('profileMenu'), loginBtn: $('loginBtn'), logoutBtn: $('logoutBtn'),
    roleBadge: $('roleBadge'), adminBar: $('adminBar'),
    addr: $('addr'), locate: $('locate'), fit: $('fit'), toggleType: $('toggleType'),
    defWidth: $('defWidth'), defLength: $('defLength'), defCat: $('defCat'),
    addBooth: $('addBooth'), duplicateBooth: $('duplicateBooth'),
    exportCSV: $('exportCSV'), exportJSON: $('exportJSON'),
    drawer: $('drawer'), panels: $('panels'), listPanel: $('listPanel'), boothList: $('boothList'), listSearch: $('listSearch'),
    editPanel: $('editPanel'), legendPanel: $('legendPanel'), backToList: $('backToList'),
    boothId: $('boothId'), widthFeet: $('widthFeet'), lengthFeet: $('lengthFeet'), rotationDeg: $('rotationDeg'), category: $('category'),
    logoUrl: $('logoUrl'), logoPreview: $('logoPreview'), biz: $('biz'), vendorName: $('vendorName'),
    phone: $('phone'), phonePublic: $('phonePublic'), email: $('email'), emailPublic: $('emailPublic'),
    website: $('website'), notes: $('notes'),
    scheduledDaysFieldset: $('scheduledDaysFieldset'),
    scheduledDaysOptions: $('scheduledDaysOptions'),
    scheduledDaysDisplay: $('scheduledDaysDisplay'),
    returnVendorDisplay: $('returnVendorDisplay'),
    returnVendor: $('returnVendor'),
    eventStaff: $('eventStaff'),
    panelStaffBadge: $('panelStaffBadge'),
    assign: $('assign'), unassign: $('unassign'), deleteBooth: $('deleteBooth')
  };

  function initScheduledDaysOptions() {
    if (!els.scheduledDaysOptions) return;
    const container = els.scheduledDaysOptions;
    container.innerHTML = '';
    const frag = document.createDocumentFragment();
    SCHEDULED_DAY_OPTIONS.forEach(({ value, full }) => {
      const id = `scheduledDay_${value}`;
      const label = document.createElement('label');
      label.className = 'scheduled-day-option';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = value;
      input.name = 'scheduledDayOption';
      input.id = id;
      const span = document.createElement('span');
      span.textContent = full;
      label.appendChild(input);
      label.appendChild(span);
      frag.appendChild(label);
    });
    container.appendChild(frag);
    if (els.scheduledDaysDisplay) {
      els.scheduledDaysDisplay.textContent = formatScheduledDays([]);
    }
  }

  initScheduledDaysOptions();
  if (els.returnVendorDisplay) els.returnVendorDisplay.textContent = formatReturnVendor(false);

  const S = {
    isAdmin: false, map: null, geocoder: null,
    booths: {}, shapes: {}, selected: null, seq: 1,
    saveTimer: null, didInitialViewport: false,
    draggingRot: false, draggingBoothId: null, rotMoveListener: null,
    proj: null
  };

  window.S = S;

  MCPP.$ = $;
  MCPP.els = els;
  MCPP.S = S;
  MCPP.canAdv = false;
  MCPP.hasMapId = !!(window.__MAP_ID__ && String(window.__MAP_ID__).trim());

  function formatPhoneNumber(value) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let digits = raw.replace(/\D/g, '');
    if (!digits) return raw;
    if (digits.length === 11 && digits.startsWith('1')) {
      digits = digits.slice(1);
    } else if (digits.length > 10) {
      digits = digits.slice(-10);
    }
    if (digits.length === 10) {
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return digits;
  }

  function formatBoothId(id) {
    const raw = String(id == null ? '' : id).trim();
    if (!raw) return '';
    const match = raw.match(/^([A-Za-z]+)(\d+)$/);
    if (!match) return raw;
    const [, prefix, num] = match;
    const padded = num.padStart(2, '0');
    return `${prefix}${padded}`;
  }

  function roleBadge() {
    if (els.roleBadge) els.roleBadge.textContent = S.isAdmin ? 'Admin' : 'Viewer';
  }

  function showList() {
    els.panels && els.panels.classList.add('mode-list');
    els.panels && els.panels.classList.remove('mode-edit');
    els.drawer && els.drawer.classList.add('open');
  }

  function showEditor() {
    els.panels && els.panels.classList.remove('mode-list');
    els.panels && els.panels.classList.add('mode-edit');
    els.drawer && els.drawer.classList.add('open');
    if (els.editPanel) {
      els.editPanel.classList.remove('hidden');
      els.editPanel.scrollTop = 0;
    }
    els.legendPanel && els.legendPanel.classList.add('hidden');
  }

  function resetToListPanel() {
    if (S.selected) {
      const styleFn = MCPP.style;
      Object.entries(S.shapes).forEach(([bid, sh]) => {
        const booth = S.booths[bid];
        const assigned = !!(booth.biz || booth.vendor_name || booth.notes || booth.phone || booth.email);
        const st = styleFn ? styleFn(booth.category || 'standard', assigned) : { stroke: '#3f7f7f' };
        if (sh.poly) sh.poly.setOptions({ strokeColor: st.stroke, strokeWeight: 1, fillOpacity: 0.75 });
        if (sh.labelEl) {
          sh.labelEl.style.color = '#eaf6f5';
          if (typeof sh.updateLabelStyle === 'function') sh.updateLabelStyle();
        }
      });
    }
    S.selected = null;
    if (els.boothId) {
      try {
        if (typeof els.boothId.textContent === 'string') els.boothId.textContent = '—';
        if ('value' in els.boothId) els.boothId.value = '';
      } catch (_) {}
    }
    els.panels && els.panels.classList.add('mode-list');
    els.panels && els.panels.classList.remove('mode-edit');
    els.drawer && els.drawer.classList.add('open');
    els.editPanel && els.editPanel.classList.add('hidden');
    els.legendPanel && els.legendPanel.classList.add('hidden');
    if (S.map) S.map.setOptions({ keyboardShortcuts: true });
    if (typeof MCPP.refreshList === 'function') MCPP.refreshList();
  }

  function postViewportSync() {
    requestAnimationFrame(() => {
      try { MCPP.syncOverlayCenters && MCPP.syncOverlayCenters(); } catch (_) {}
      try { MCPP.updateLabelVisibility && MCPP.updateLabelVisibility(); } catch (_) {}
      try { MCPP.updateLabelLayoutForZoom && MCPP.updateLabelLayoutForZoom(); } catch (_) {}
      try {
        if (window.mcppLogoBadges && typeof window.mcppLogoBadges.refresh === 'function') {
          window.mcppLogoBadges.refresh();
        }
      } catch (_) {}
    });
  }

  function showBootError(msg) {
    const bar = document.createElement('div');
    bar.style.cssText = 'position:fixed;left:0;right:0;top:52px;z-index:9999;padding:10px 14px;background:#3b1a1a;color:#ffdede;border-bottom:1px solid #732;font:14px/1.35 system-ui,sans-serif';
    bar.textContent = 'Map failed to initialize: ' + msg;
    document.body.appendChild(bar);
  }

  function setRO(readOnly) {
    if (els.adminBar) els.adminBar.classList.remove('hidden');
    [
      els.biz, els.vendorName, els.phone, els.email, els.website, els.notes,
      els.category, els.widthFeet, els.lengthFeet, els.rotationDeg, els.logoUrl
    ].forEach((el) => {
      if (!el) return;
      el.disabled = readOnly;
      if (el.tagName === 'TEXTAREA') el.readOnly = readOnly;
    });

    document.querySelectorAll('.admin-only').forEach((el) => {
      el.style.display = readOnly ? 'none' : '';
    });
    document.querySelectorAll('.viewer-only').forEach((el) => {
      el.style.display = readOnly ? '' : 'none';
    });
    if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill();

    if (els.scheduledDaysFieldset) {
      els.scheduledDaysFieldset.disabled = readOnly;
    }

    const labelOf = (el) => el ? (el.closest ? el.closest('label') : (function findLabel(node) {
      while (node && node.tagName !== 'LABEL') node = node.parentElement;
      return node;
    })(el)) : null;
    [labelOf(els.widthFeet), labelOf(els.lengthFeet), labelOf(els.rotationDeg), labelOf(els.logoUrl)]
      .forEach((label) => { if (label) label.style.display = readOnly ? 'none' : ''; });

    const actions = document.querySelector('.actions-bottom');
    if (actions) actions.style.display = readOnly ? 'none' : '';
    const pLabel = els.phonePublic ? (els.phonePublic.closest ? els.phonePublic.closest('label') : els.phonePublic.parentElement) : null;
    const eLabel = els.emailPublic ? (els.emailPublic.closest ? els.emailPublic.closest('label') : els.emailPublic.parentElement) : null;
    if (pLabel) pLabel.style.display = readOnly ? 'none' : 'flex';
    if (eLabel) eLabel.style.display = readOnly ? 'none' : 'flex';

    const phoneRow = document.getElementById('phoneRow');
    const emailRow = document.getElementById('emailRow');
    if (readOnly) {
      const booth = S.selected ? S.booths[S.selected] : null;
      if (phoneRow) phoneRow.style.display = (booth && booth.phone_public) ? '' : 'none';
      if (emailRow) emailRow.style.display = (booth && booth.email_public) ? '' : 'none';
    } else {
      if (phoneRow) phoneRow.style.display = '';
      if (emailRow) emailRow.style.display = '';
    }

    ['addr', 'locate', 'fit', 'toggleType'].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.display = '';
      el.disabled = false;
    });

    Object.values(S.shapes).forEach((shape) => {
      if (shape.poly && typeof shape.poly.setDraggable === 'function') {
        shape.poly.setDraggable(!readOnly);
      }
    });

    if (typeof MCPP.updateScheduledDaysUI === 'function') {
      const booth = S.selected ? S.booths[S.selected] : null;
      MCPP.updateScheduledDaysUI(booth);
    }
  }

  async function who() {
    try {
      const resp = await fetch('/whoami');
      const json = await resp.json();
      S.isAdmin = !!json.is_admin;
    } catch {
      S.isAdmin = false;
    }
    roleBadge();
    if (els.loginBtn) els.loginBtn.textContent = S.isAdmin ? 'Logout' : 'Login';
    setRO(!S.isAdmin);
    resetToListPanel();
  }

  async function load() {
    try {
      const resp = await fetch('/api/vendors');
      if (resp.ok) S.booths = await resp.json();
    } catch {
      S.booths = {};
    }
    const normalize = MCPP.normalizeCategoryKey || ((key) => key);
    Object.values(S.booths).forEach((booth) => {
      if (booth.size_feet) {
        booth.width_feet = booth.length_feet = booth.size_feet;
        delete booth.size_feet;
      }
      let deg = Number(booth.rotation_deg);
      if (!Number.isFinite(deg)) deg = 0;
      deg = deg % 360;
      if (deg < 0) deg += 360;
      booth.rotation_deg = deg;
      booth.category = normalize(booth.category || 'standard');
      booth.phone = formatPhoneNumber(booth.phone || '');
      booth.is_return_vendor = !!booth.is_return_vendor;
      booth.scheduled_days = normalizeScheduledDays(booth.scheduled_days || []);
      if (typeof MCPP.normalizeBoothGeometry === 'function') {
        MCPP.normalizeBoothGeometry(booth);
      }
    });
    let maxSeq = 0;
    Object.keys(S.booths).forEach((id) => {
      const match = id.match(/\d+/);
      const num = parseInt((match || [0])[0], 10);
      if (num > maxSeq) maxSeq = num;
    });
    S.seq = maxSeq + 1;
  }

  async function save(debounce = true) {
    clearTimeout(S.saveTimer);
    const runSave = async () => {
      if (!S.isAdmin) return;
      try {
        const resp = await fetch('/api/vendors', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(S.booths)
        });
        if (!resp.ok) {
          console.warn('Save failed', resp.status, await resp.text());
        }
        if (typeof MCPP.refreshList === 'function') MCPP.refreshList();
      } catch (err) {
        console.warn('Save error', err);
      }
    };
    if (debounce) S.saveTimer = setTimeout(runSave, 350);
    else await runSave();
  }

  Object.assign(MCPP, {
    roleBadge,
    showList,
    showEditor,
    resetToListPanel,
    setRO,
    postViewportSync,
    showBootError,
    who,
    load,
    save,
    formatPhoneNumber,
    formatBoothId
  });
})();
