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
  const eventStaffCheckbox = els.eventStaff || null;
  const panelEventStaffBadgeEl = els.panelEventStaffBadge || (typeof document !== 'undefined' ? document.getElementById('panelEventStaffBadge') : null);
  const panelPartnerVendorBadgeEl = els.panelPartnerVendorBadge || (typeof document !== 'undefined' ? document.getElementById('panelPartnerVendorBadge') : null);
  const panelFeaturedVendorBadgeEl = els.panelFeaturedVendorBadge || (typeof document !== 'undefined' ? document.getElementById('panelFeaturedVendorBadge') : null);
  const panelReturnVendorBadgeEl = els.panelReturnVendorBadge || (typeof document !== 'undefined' ? document.getElementById('panelReturnVendorBadge') : null);
  const panelBadgesContainer = (typeof document !== 'undefined' ? document.getElementById('panelBadges') : null);

  // Clipboard copy helper
  function copyToClipboard(text, onSuccess) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
        // Fallback
        try {
          const ta = document.createElement('textarea');
          ta.value = text;
          ta.style.position = 'fixed';
          ta.style.left = '-9999px';
          document.body.appendChild(ta);
          ta.select();
          document.execCommand('copy');
          ta.remove();
          onSuccess();
        } catch (_) {}
      });
    } else {
      try {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.position = 'fixed';
        ta.style.left = '-9999px';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
        onSuccess();
      } catch (_) {}
    }
  }

  // Small accessible toast helper. Usage: showToast('Message', ms = 2000, anchorEl = null)
  // If anchorEl is provided, the toast will appear just above that element.
  function showToast(msg, ms = 2000, anchorEl = null) {
    try {
      let el = document.getElementById('mcppToast');
      if (!el) {
        el = document.createElement('div');
        el.id = 'mcppToast';
        el.className = 'mcpp-toast';
        el.setAttribute('aria-live', 'polite');
        el.setAttribute('aria-atomic', 'true');
        document.body.appendChild(el);
      }
      el.textContent = msg || '';
      // Reset inline styles to default bottom-centered position
      el.style.left = '50%';
      el.style.bottom = '24px';
      el.style.top = 'auto';
      el.style.transform = 'translateX(-50%) translateY(10px)';

      if (anchorEl && typeof anchorEl.getBoundingClientRect === 'function') {
        try {
          const r = anchorEl.getBoundingClientRect();
          const x = r.left + (r.width / 2) + window.scrollX;
          const y = r.top + window.scrollY;
          // place the toast centered horizontally over the anchor
          el.style.left = `${x}px`;
          el.style.bottom = 'auto';
          // measure the toast height so we can place it above the anchor reliably
          // ensure it's rendered (it may be hidden), so force reflow
          el.style.visibility = 'hidden';
          el.classList.add('show');
          void el.offsetHeight;
          const toastH = el.offsetHeight || 28;
          el.classList.remove('show');
          el.style.visibility = '';
          // position the toast above the anchor using the toast's height + gap
          const gap = 20; // larger gap in px to avoid overlap
          const top = Math.max(8, Math.round(y - toastH - gap));
          el.style.top = `${top}px`;
          // start slightly below the final position so the transition moves it up
          el.style.transform = 'translateX(-50%) translateY(6px)';
        } catch (_) {
          /* ignore and use default */
        }
      }

      // reset show class to trigger transition
      el.classList.remove('show');
      // force reflow
      void el.offsetWidth;
      el.classList.add('show');

      if (showToast._t) clearTimeout(showToast._t);
      showToast._t = setTimeout(() => {
        try { el.classList.remove('show'); } catch (_) {}
        // after transition, reset inline positioning back to default so next use uses bottom placement
        setTimeout(() => {
          try {
            el.style.left = '50%';
            el.style.bottom = '24px';
            el.style.top = 'auto';
            el.style.transform = 'translateX(-50%) translateY(10px)';
          } catch (_) {}
        }, 220);
      }, ms);
    } catch (_) {}
  }

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
    // Update checkbox visibility based on admin mode
    if (MCPP.updateScheduledDaysCheckboxStates) MCPP.updateScheduledDaysCheckboxStates();
  }

  // Update all panel badges (shows ALL badges that apply to this booth)
  function updateAllPanelBadges(booth) {
    // Event Staff Badge
    if (panelEventStaffBadgeEl) {
      const isEventStaff = !!(booth && booth.is_event_staff);
      panelEventStaffBadgeEl.classList.toggle('hidden', !isEventStaff);
      panelEventStaffBadgeEl.setAttribute('aria-hidden', isEventStaff ? 'false' : 'true');
    }
    
    // Partner Vendor Badge
    if (panelPartnerVendorBadgeEl) {
      const isPartnerVendor = !!(booth && booth.is_partner_vendor);
      panelPartnerVendorBadgeEl.classList.toggle('hidden', !isPartnerVendor);
      panelPartnerVendorBadgeEl.setAttribute('aria-hidden', isPartnerVendor ? 'false' : 'true');
    }
    
    // Featured Vendor Badge
    if (panelFeaturedVendorBadgeEl) {
      const isFeaturedVendor = !!(booth && booth.is_featured_vendor);
      panelFeaturedVendorBadgeEl.classList.toggle('hidden', !isFeaturedVendor);
      panelFeaturedVendorBadgeEl.setAttribute('aria-hidden', isFeaturedVendor ? 'false' : 'true');
    }
    
    // Returning Vendor Badge
    if (panelReturnVendorBadgeEl) {
      const isReturnVendor = !!(booth && booth.is_return_vendor);
      panelReturnVendorBadgeEl.classList.toggle('hidden', !isReturnVendor);
      panelReturnVendorBadgeEl.setAttribute('aria-hidden', isReturnVendor ? 'false' : 'true');
    }
  }

  function updateReturnVendorUI(booth) {
    const flag = !!(booth && booth.is_return_vendor);
    if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
    if (returnVendorCheckbox) returnVendorCheckbox.checked = flag;
    // Update all panel badges
    updateAllPanelBadges(booth);
  }

  function updateEventStaffUI(booth) {
    const flag = !!(booth && booth.is_event_staff);
    if (eventStaffCheckbox) eventStaffCheckbox.checked = flag;
    // Update all panel badges
    updateAllPanelBadges(booth);
  }

  // Helper to ensure website has a scheme
  function normalizeWebsite(url) {
    if (!url) return '';
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return trimmed;
    return 'https://' + trimmed;
  }

  function listRow(id, booth) {
    const name = (booth.biz && booth.biz.trim()) || (booth.vendor_name || '');
    const displayId = MCPP.formatBoothId ? MCPP.formatBoothId(id) : id;
    const el = document.createElement('div'); el.className = 'list-item'; el.tabIndex = 0;
    const sw = document.createElement('div'); sw.className = 'legend-swatch';
    const s = CAT[booth.category || 'standard'] || CAT.standard;
    sw.style.background = s.f; sw.style.borderColor = s.s;
    const logoUrl = (booth.logo_url || '').trim();

    const tx = document.createElement('div');
    tx.innerHTML = `<div><b class='mono'>${displayId}</b> — ${name || '<em>Unassigned</em>'}</div>`;
    
    // Add elements in order: swatch, text, then logo badge at the end
    el.appendChild(sw);
    el.appendChild(tx);

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

    // (previously we showed a small clickable website icon in the list row)
    // Removed per request — keep list rows cleaner.
    el.addEventListener('click', () => {
      select(id);
      if (S.booths[id] && S.map) {
        S.map.panTo(S.booths[id].center);
        const idleOnce = S.map.addListener('idle', () => {
          google.maps.event.removeListener(idleOnce);
          S.map.setZoom(23);
        });
      }
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
    return MCPP.catNameForKey ? MCPP.catNameForKey(key) : (key.charAt(0).toUpperCase() + key.slice(1));
  }

  function refreshList() {
    if (!els.boothList) return;
    const q = (els.listSearch && els.listSearch.value || '').toLowerCase();
    els.boothList.innerHTML = '';

    const boothsForList = (typeof MCPP.getBoothsForCurrentDay === 'function') ? MCPP.getBoothsForCurrentDay() : S.booths;
    const grouped = {};
    Object.entries(boothsForList)
      .sort((a, b) => a[0].localeCompare(b[0], undefined, { numeric: true, sensitivity: 'base' }))
      .forEach(([id, booth]) => {
        const formattedId = MCPP.formatBoothId ? MCPP.formatBoothId(id) : id;
        const hay = [id, formattedId, booth.biz || '', booth.vendor_name || '', booth.phone || '', booth.email || '', booth.website || '', booth.notes || '']
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
      const setPos = MCPP.setPos || ((target, pos) => target && target.setPosition && target.setPosition(pos));
      // If we're switching away from a booth with unsaved admin edits, revert it first.
      if (MCPP.boothEdit && MCPP.boothEdit.revertIfDirty) {
        try { MCPP.boothEdit.revertIfDirty(); } catch (_) {}
      }
      const prevSelected = S.selected;
      S.selected = id;
      const booth = S.booths[id];
      if (!booth) return;

      // Capture saved state only when opening a different booth (not when refreshing same booth after Unassign)
      const willCapture = MCPP.boothEdit && typeof MCPP.boothEdit.capture === 'function' && prevSelected !== id;
      try {
        if (willCapture) {
          MCPP.boothEdit.capture(id);
        }
      } catch (_) {}

      const displayId = MCPP.formatBoothId ? MCPP.formatBoothId(id) : id;
      if (els.boothId) {
        try {
          if (els.boothId.textContent !== undefined) els.boothId.textContent = displayId;
          if ('value' in els.boothId) els.boothId.value = displayId;
        } catch (_) {}
      }

      const fmtPhone = MCPP.formatPhoneNumber ? MCPP.formatPhoneNumber(booth.phone || '') : (booth.phone || '');
      booth.phone = fmtPhone;

      if (els.widthFeet) els.widthFeet.value = booth.width_feet;
      if (els.lengthFeet) els.lengthFeet.value = booth.length_feet;
      if (els.rotationDeg) {
        const deg = (typeof window.snapRotationToPreset === 'function')
          ? window.snapRotationToPreset(booth.rotation_deg || 0)
          : Math.round(booth.rotation_deg || 0);
        booth.rotation_deg = deg;
        els.rotationDeg.value = String(deg);
      }
      if (els.category) {
        const key = MCPP.normalizeCategoryKey ? MCPP.normalizeCategoryKey(booth.category || 'standard') : (booth.category || 'standard');
        els.category.value = key;
      }
      if (MCPP.updateCategoryPill) MCPP.updateCategoryPill();
      // Update logo preview when selecting booth (logo URL is now in modal)
      // Also update modal's logo URL field if modal is open
      if (els.logoUrl) els.logoUrl.value = booth.logo_url || '';
      if (els.logoUpload) els.logoUpload.value = ''; // Clear file input when selecting booth
      if (els.logoPreview) {
        const url = (booth.logo_url || '').trim();
        els.logoPreview.src = url || LOGO_BADGE_PLACEHOLDER;
        els.logoPreview.style.display = 'block';
        els.logoPreview.setAttribute('draggable', 'false');
      }
      // Update remove logo button state
      if (MCPP.updateRemoveLogoButton) MCPP.updateRemoveLogoButton();
      if (els.biz) els.biz.value = booth.biz || '';
      if (els.vendorName) els.vendorName.value = booth.vendor_name || '';
      // Only show phone/email values if field has data AND (admin OR public)
      const hasPhone = !!(booth.phone && booth.phone.trim());
      const hasEmail = !!(booth.email && booth.email.trim());
      if (els.phone) els.phone.value = (hasPhone && (S.isAdmin || booth.phone_public !== false)) ? fmtPhone : '';
      if (els.email) els.email.value = (hasEmail && (S.isAdmin || booth.email_public !== false)) ? (booth.email || '') : '';
      if (els.website) els.website.value = booth.website || '';
      if (els.businessAddress) els.businessAddress.value = booth.business_address || '';
      if (els.businessAddressViewer) els.businessAddressViewer.value = booth.business_address || '';
      // Check "Hidden" only if booth was saved as hidden (phone_public === false)
      // Don't auto-check just because field is empty - that only happens on save
      if (els.phonePublic) els.phonePublic.checked = booth.phone_public === false;
      if (els.emailPublic) els.emailPublic.checked = booth.email_public === false;
      if (els.notes) els.notes.value = booth.notes || '';
  updateScheduledDaysUI(booth);
  updateReturnVendorUI(booth);
  updateEventStaffUI(booth);

      const phoneRowSel = document.getElementById('phoneRow');
      const emailRowSel = document.getElementById('emailRow');
      if (!S.isAdmin) {
        // Only show phone/email rows if field has data AND is public
        const showPhone = !!(booth.phone && booth.phone.trim() && booth.phone_public !== false);
        const showEmail = !!(booth.email && booth.email.trim() && booth.email_public !== false);
        if (phoneRowSel) phoneRowSel.style.display = showPhone ? '' : 'none';
        if (emailRowSel) emailRowSel.style.display = showEmail ? '' : 'none';
      } else {
        if (phoneRowSel) phoneRowSel.style.display = '';
        if (emailRowSel) emailRowSel.style.display = '';
      }

      // Update viewer-only clickable links for email and website
      // Replace the viewer-only clickable anchors with small inline chain emoji
      // placed next to the input fields. Respect email privacy (only show
      // to admin or when email_public is true) and show website chain when
      // a website value is present.
      try {
        const emailChain = document.getElementById('emailChain');
        if (emailChain) {
          const showEmail = !!(booth.email && booth.email.trim() && (S.isAdmin || booth.email_public !== false));
          emailChain.classList.toggle('hidden', !showEmail);
          emailChain.setAttribute('aria-hidden', showEmail ? 'false' : 'true');
          if (showEmail) {
            // Show a page emoji anchor that copies the email to clipboard on click.
            emailChain.title = 'Copy email address';
            emailChain.href = '#';
            // override onclick to perform copy — use property to avoid multiple listeners
            emailChain.onclick = function (e) {
              try {
                e.preventDefault();
                const txt = (booth.email || '').trim();
                if (!txt) return;
                copyToClipboard(txt, () => {
                  const prev = emailChain.title;
                  emailChain.title = 'Copied!';
                  try { showToast('Email copied', 2000, emailChain); } catch (_) {}
                  setTimeout(() => { emailChain.title = prev; }, 1400);
                });
              } catch (_) {}
            };
          } else {
            emailChain.title = '';
            emailChain.href = '#';
            emailChain.onclick = null;
          }
        }
      } catch (_) {}
      try {
        const websiteChain = document.getElementById('websiteChain');
        if (websiteChain) {
          const showSite = !!(booth.website && booth.website.trim());
          websiteChain.classList.toggle('hidden', !showSite);
          websiteChain.setAttribute('aria-hidden', showSite ? 'false' : 'true');
          if (showSite) {
            websiteChain.title = booth.website || 'Website available';
            try { websiteChain.href = normalizeWebsite(booth.website || ''); } catch (_) { websiteChain.href = '#'; }
            websiteChain.setAttribute('target', '_blank');
            websiteChain.setAttribute('rel', 'noopener noreferrer');
          } else {
            websiteChain.title = '';
            websiteChain.href = '#';
            websiteChain.removeAttribute('target');
            websiteChain.removeAttribute('rel');
          }
        }
      } catch (_) {}

      // Handle business address viewer mode display and pin click
      try {
        const hasAddress = !!(booth.business_address && booth.business_address.trim());
        if (els.businessAddressViewerWrap) {
          // Only show viewer wrapper in viewer mode (read-only), never in admin mode
          els.businessAddressViewerWrap.style.display = (S.isAdmin || !hasAddress) ? 'none' : '';
        }
        if (els.businessAddressPin) {
          els.businessAddressPin.classList.toggle('hidden', !hasAddress);
          els.businessAddressPin.setAttribute('aria-hidden', hasAddress ? 'false' : 'true');
          if (hasAddress) {
            els.businessAddressPin.title = 'Open in Google Maps';
            els.businessAddressPin.onclick = function(e) {
              e.preventDefault();
              const addr = (booth.business_address || '').trim();
              if (addr) {
                const encodedAddr = encodeURIComponent(addr);
                window.open('https://www.google.com/maps/search/?api=1&query=' + encodedAddr, '_blank');
              }
            };
          } else {
            els.businessAddressPin.title = '';
            els.businessAddressPin.onclick = null;
          }
        }
        if (els.businessAddressCopy) {
          els.businessAddressCopy.classList.toggle('hidden', !hasAddress);
          els.businessAddressCopy.setAttribute('aria-hidden', hasAddress ? 'false' : 'true');
          if (hasAddress) {
            els.businessAddressCopy.title = 'Copy address';
            els.businessAddressCopy.onclick = function(e) {
              e.preventDefault();
              const txt = (booth.business_address || '').trim();
              if (!txt) return;
              copyToClipboard(txt, () => {
                const prev = els.businessAddressCopy.title;
                els.businessAddressCopy.title = 'Copied!';
                showToast('Address copied', 2000, els.businessAddressCopy);
                setTimeout(() => { els.businessAddressCopy.title = prev; }, 2000);
              });
            };
          } else {
            els.businessAddressCopy.title = '';
            els.businessAddressCopy.onclick = null;
          }
        }
      } catch (_) {}

      // In viewer mode, hide empty fields
      if (!S.isAdmin) {
        // Hide biz/business name if empty
        const bizLabel = els.biz ? els.biz.closest('label') : null;
        if (bizLabel) {
          bizLabel.style.display = (booth.biz && booth.biz.trim()) ? '' : 'none';
        }
        
        // Hide vendor name if empty
        const vendorNameLabel = els.vendorName ? els.vendorName.closest('label') : null;
        if (vendorNameLabel) {
          vendorNameLabel.style.display = (booth.vendor_name && booth.vendor_name.trim()) ? '' : 'none';
        }
        
        // Hide website if empty
        const websiteLabel = els.website ? els.website.closest('label') : null;
        if (websiteLabel) {
          websiteLabel.style.display = (booth.website && booth.website.trim()) ? '' : 'none';
        }
        
        // Hide notes if empty
        const notesLabel = els.notes ? els.notes.closest('label') : null;
        if (notesLabel) {
          notesLabel.style.display = (booth.notes && booth.notes.trim()) ? '' : 'none';
        }
        
        // Hide scheduled days if empty
        const scheduleWrap = document.querySelector('.schedule-wrap');
        if (scheduleWrap) {
          const hasDays = booth.scheduled_days && booth.scheduled_days.length > 0;
          const viewerElements = scheduleWrap.querySelectorAll('.viewer-only');
          viewerElements.forEach(el => {
            el.style.display = hasDays ? '' : 'none';
          });
        }
      } else {
        // In admin mode, show all fields
        if (els.biz) {
          const bizLabel = els.biz.closest('label');
          if (bizLabel) bizLabel.style.display = '';
        }
        if (els.vendorName) {
          const vendorNameLabel = els.vendorName.closest('label');
          if (vendorNameLabel) vendorNameLabel.style.display = '';
        }
        if (els.website) {
          const websiteLabel = els.website.closest('label');
          if (websiteLabel) websiteLabel.style.display = '';
        }
        if (els.notes) {
          const notesLabel = els.notes.closest('label');
          if (notesLabel) notesLabel.style.display = '';
        }
        const scheduleWrap = document.querySelector('.schedule-wrap');
        if (scheduleWrap) {
          const viewerElements = scheduleWrap.querySelectorAll('.viewer-only');
          viewerElements.forEach(el => {
            el.style.display = '';
          });
        }
      }

      const styleFn = MCPP.style || (() => ({ stroke: '#3f7f7f' }));
      const getCenter = MCPP.getVisualCenterAdjusted || ((b) => b && b.center);

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
          if (shape.updateLabelStyle) shape.updateLabelStyle();
        }
        if (shape.lab) setPos(shape.lab, pos);
        if (shape.centerDbg) {
          setPos(shape.centerDbg, pos);
          if (!shape.centerDbg.map && typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(S.map);
        }
      });

      if (els.editPanel) els.editPanel.classList.remove('hidden');
      if (MCPP.showEditor) MCPP.showEditor();
      if (S.map) S.map.setOptions({ keyboardShortcuts: false });
      
      // Update remove logo button state after selection
      if (MCPP.updateRemoveLogoButton) {
        setTimeout(() => MCPP.updateRemoveLogoButton(), 100);
      }
      if (typeof MCPP.applyEditLockState === 'function') MCPP.applyEditLockState();
    } catch (err) {
      console.error('select() failed:', err);
      if (MCPP.showEditor) MCPP.showEditor();
    }
  }

  function clearSelection() {
    if (!S.selected) {
      if (S.map) S.map.setOptions({ keyboardShortcuts: true });
      if (typeof MCPP.showList === 'function') MCPP.showList();
      return;
    }
    // If admin backs out without saving, restore last captured state first.
    if (MCPP.boothEdit) {
      try {
        if (MCPP.boothEdit.revertIfDirty) MCPP.boothEdit.revertIfDirty();
        if (MCPP.boothEdit.clear) MCPP.boothEdit.clear();
      } catch (_) {}
    }
    S.selected = null;
      if (els.boothId) {
        try {
          if (els.boothId.textContent !== undefined) els.boothId.textContent = '—';
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
          if (shape.updateLabelStyle) shape.updateLabelStyle();
        }
      if (shape.centerDbg) {
        if ('map' in shape.centerDbg) shape.centerDbg.map = null;
        else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
      }
    });
    if (S.map) S.map.setOptions({ keyboardShortcuts: true });
    if (MCPP.showList) MCPP.showList();
  }

  function redraw() {
      Object.values(S.shapes).forEach((shape) => {
        if (typeof MCPP.removeShapeRecord === 'function') MCPP.removeShapeRecord(shape);
        else {
          if (shape.poly) shape.poly.setMap(null);
          if (shape.lab) { if (shape.lab.remove) shape.lab.remove(); else if (shape.lab.setMap) shape.lab.setMap(null); }
          if (shape.centerDbg) { if (typeof shape.centerDbg.remove === 'function') shape.centerDbg.remove(); else if (shape.centerDbg.setMap) shape.centerDbg.setMap(null); }
          if (shape.badgeOverlay) { try { if (shape.badgeOverlay.remove) shape.badgeOverlay.remove(); else if (shape.badgeOverlay.setMap) shape.badgeOverlay.setMap(null); } catch (e) {} }
          if (shape.categoryOverlay) { try { if (shape.categoryOverlay.remove) shape.categoryOverlay.remove(); else if (shape.categoryOverlay.setMap) shape.categoryOverlay.setMap(null); } catch (e) {} }
        }
      });
    S.shapes = {};

    const visibleBooths = (typeof MCPP.getBoothsForCurrentDay === 'function') ? MCPP.getBoothsForCurrentDay() : S.booths;
    const visibleIds = new Set(Object.keys(visibleBooths));
    if (typeof MCPP.destroyLogoBadge === 'function') {
      Object.keys(S.booths || {}).forEach((id) => {
        if (!visibleIds.has(id)) MCPP.destroyLogoBadge(id);
      });
    }

    const bounds = new google.maps.LatLngBounds();
    const rect = MCPP.rect || (() => []);
    Object.entries(visibleBooths).forEach(([id, booth]) => {
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
    if (MCPP.postViewportSync) MCPP.postViewportSync();
    if (MCPP.updateCategoryPill) MCPP.updateCategoryPill();
  }

  // Expose copyToClipboard for use in other modules
  MCPP.copyToClipboard = copyToClipboard;

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
