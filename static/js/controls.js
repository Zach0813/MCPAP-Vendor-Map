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
  const partnerVendorCheckbox = els.partnerVendor || null;
  const featuredVendorCheckbox = els.featuredVendor || null;

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

  const applyPartnerVendorUI = (booth) => {
    const flag = !!(booth && booth.is_partner_vendor);
    if (partnerVendorCheckbox) partnerVendorCheckbox.checked = flag;
  };

  const applyFeaturedVendorUI = (booth) => {
    const flag = !!(booth && booth.is_featured_vendor);
    if (featuredVendorCheckbox) featuredVendorCheckbox.checked = flag;
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
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (partnerVendorCheckbox) {
    partnerVendorCheckbox.addEventListener('change', async () => {
      if (!S.selected) return;
      const flag = !!partnerVendorCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_partner_vendor = flag;
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (featuredVendorCheckbox) {
    featuredVendorCheckbox.addEventListener('change', async () => {
      if (!S.selected) return;
      const flag = !!featuredVendorCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_featured_vendor = flag;
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      if (typeof MCPP.save === 'function') await MCPP.save(false);
    });
  }

  if (returnVendorCheckbox) {
    returnVendorCheckbox.addEventListener('change', async () => {
      if (!S.selected) return;
      const flag = !!returnVendorCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_return_vendor = flag;
      if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
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
        // Immediately update the logo badge on the map without needing to save or redraw
        const booth = S.booths[S.selected];
        const id = S.selected;
        if (typeof MCPP.ensureLogoBadgeForBooth === 'function') {
          MCPP.ensureLogoBadgeForBooth(booth, id);
        } else if (window.mcppLogoBadges && typeof window.mcppLogoBadges.refresh === 'function') {
          // Fallback to full refresh if per-booth update isn't exposed
          window.mcppLogoBadges.refresh();
        }
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
        business_address: '',
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
        business_address: '',
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
      booth.business_address = (els.businessAddress && els.businessAddress.value || '').trim();
      booth.notes = (els.notes.value || '').trim();
      booth.logo_url = (els.logoUrl.value || '').trim();
      booth.phone_public = !els.phonePublic.checked;
      booth.email_public = !els.emailPublic.checked;
      booth.scheduled_days = readScheduledDaysFromUI();
      applyScheduledDaysToUI(booth);
      booth.is_return_vendor = !!(returnVendorCheckbox && returnVendorCheckbox.checked);
      booth.is_event_staff = !!(eventStaffCheckbox && eventStaffCheckbox.checked);
      booth.is_partner_vendor = !!(partnerVendorCheckbox && partnerVendorCheckbox.checked);
      booth.is_featured_vendor = !!(featuredVendorCheckbox && featuredVendorCheckbox.checked);
      applyReturnVendorUI(booth);
      applyEventStaffUI(booth);
      applyPartnerVendorUI(booth);
      applyFeaturedVendorUI(booth);
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
      
      // Show toast notification
      showToast('Changes saved successfully');
    });
  }

  // Toast notification function
  function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'save-toast';
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    // Position centered above the assign button after appending to get toast dimensions
    if (els.assign) {
      const rect = els.assign.getBoundingClientRect();
      const toastRect = toast.getBoundingClientRect();
      toast.style.position = 'fixed';
      toast.style.left = (rect.left + rect.width / 2 - toastRect.width / 2) + 'px';
      toast.style.bottom = (window.innerHeight - rect.top + 10) + 'px';
    }
    
    // Trigger animation
    requestAnimationFrame(() => {
      toast.classList.add('show');
    });
    
    // Remove after 2 seconds
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300); // Wait for fade out animation
    }, 2000);
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
      booth.business_address = '';
      booth.notes = '';
      booth.phone_public = false;
      booth.email_public = false;
      booth.scheduled_days = [];
      booth.is_return_vendor = false;
      booth.is_event_staff = false;
      booth.is_partner_vendor = false;
      booth.is_featured_vendor = false;
      applyScheduledDaysToUI(booth);
      applyReturnVendorUI(booth);
      applyEventStaffUI(booth);
      applyPartnerVendorUI(booth);
      applyFeaturedVendorUI(booth);
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
        // Remove polygon
        if (shape.poly && typeof shape.poly.setMap === 'function') shape.poly.setMap(null);
        // Remove label overlay (createDomOverlay returns an object with remove())
        if (shape.lab) {
          if (typeof shape.lab.remove === 'function') shape.lab.remove();
          else if (typeof shape.lab.setMap === 'function') shape.lab.setMap(null);
          else try { shape.lab.map = null; } catch (e) {}
        }
        // Remove center debug marker
        if (shape.centerDbg) {
          if (typeof shape.centerDbg.remove === 'function') shape.centerDbg.remove();
          else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
          else try { shape.centerDbg.map = null; } catch (e) {}
        }
        // Remove badge overlay attached to the shape
        if (shape.badgeOverlay) {
          try {
            if (typeof shape.badgeOverlay.remove === 'function') shape.badgeOverlay.remove();
            else if (typeof shape.badgeOverlay.setMap === 'function') shape.badgeOverlay.setMap(null);
            else try { shape.badgeOverlay.map = null; } catch (e) {}
          } catch (e) {}
          shape.badgeOverlay = null;
        }
        // Remove any logo badge created in S.logoBadges
        try {
          if (S.logoBadges && S.logoBadges[id]) {
            const b = S.logoBadges[id];
            if (b && b.marker) {
              if (typeof b.marker.remove === 'function') b.marker.remove();
              else if (typeof b.marker.setMap === 'function') b.marker.setMap(null);
              else try { b.marker.map = null; } catch (e) {}
            }
            delete S.logoBadges[id];
          }
        } catch (e) {}
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
  if (!MCPP.updatePartnerVendorUI) {
    MCPP.updatePartnerVendorUI = applyPartnerVendorUI;
  }
  if (!MCPP.updateFeaturedVendorUI) {
    MCPP.updateFeaturedVendorUI = applyFeaturedVendorUI;
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

  
  // Initialize a focused legacy Autocomplete for the admin `businessAddress` input.
  // This keeps business-address place selection working in admin mode without the
  // full site-wide search UI.
  // Module-scoped handle for the business address widget so we can lazily init it
  let _businessAddressWidget = null;
  let _businessAddressLegacy = null;
  MCPP.initBusinessAddressAutocomplete = function initBusinessAddressAutocomplete() {
    try {
      if (!els.businessAddress) return;
      if (!window.google || !google.maps || !google.maps.places || !google.maps.places.Autocomplete) {
        return;
      }

      const businessAutocomplete = new google.maps.places.Autocomplete(els.businessAddress, {
        fields: ['formatted_address', 'address_components'],
        types: ['address']
      });

      businessAutocomplete.addListener('place_changed', () => {
        const place = businessAutocomplete.getPlace();
        if (place.address_components && place.address_components.length) {
          let street = '';
          let city = '';
          let state = '';
          let zip = '';

          for (const component of place.address_components) {
            const types = component.types;
            if (types.includes('street_number')) {
              street = component.long_name + ' ' + street;
            } else if (types.includes('route')) {
              street += component.long_name;
            } else if (types.includes('locality')) {
              city = component.long_name;
            } else if (types.includes('administrative_area_level_1')) {
              state = component.short_name;
            } else if (types.includes('postal_code')) {
              zip = component.long_name;
            }
          }

          const line1 = street.trim();
          const line2 = [city, state, zip].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/(\w+)\s+(\w{2})\s+/, '$1, $2 ');
          const formattedAddress = [line1, line2].filter(Boolean).join('\n');

          els.businessAddress.value = formattedAddress || place.formatted_address;
          if (S.selected && S.booths[S.selected]) {
            S.booths[S.selected].business_address = els.businessAddress.value;
          }
        } else if (place.formatted_address) {
          els.businessAddress.value = place.formatted_address;
          if (S.selected && S.booths[S.selected]) {
            S.booths[S.selected].business_address = place.formatted_address;
          }
        }
      });

  // Business address autocomplete initialized
    } catch (err) {
      console.warn('initBusinessAddressAutocomplete failed', err);
    }
  };

  // Defer init slightly to allow map & libs to finish loading elsewhere
  if (typeof MCPP.initBusinessAddressAutocomplete === 'function') {
    setTimeout(() => {
      try { MCPP.initBusinessAddressAutocomplete(); } catch (e) { /* ignore */ }
    }, 500);
  }

  // Lazy-init on focus/visibility: helps some Maps builds that error when constructing
  // PlaceAutocompleteElement while the input is not yet connected/visible.
  try {
    const bizInput = els.businessAddress;
    if (bizInput && bizInput.tagName === 'INPUT') {
      const ensureInit = () => {
        if (_businessAddressWidget) return;
        try { MCPP.initBusinessAddressAutocomplete(); } catch (e) { /* ignore */ }
      };
      bizInput.addEventListener('focus', ensureInit, { passive: true });
      // Also attempt when editPanel or drawer transitions end (input may become visible then)
      document.addEventListener('transitionend', ensureInit);
    }
  } catch (e) { /* ignore */ }

  // Permanent wiring: if the PlaceAutocompleteElement exposes an internal input
  // element, automatically forward visible input events and focus so suggestions
  // appear without requiring manual diagnostics. This keeps the newer widget but
  // ensures it listens to our admin `#businessAddress` field.
  try {
    const bizInput = els.businessAddress;
    if (bizInput && bizInput.tagName === 'INPUT') {
      const wire = () => {
        const w = _businessAddressWidget || window.__bizWidget;
        if (!w) return;
        const ie = w.inputElement || w.Dg || w.input || null;
        if (!ie) return;
        // Forward visible input -> widget internal input (value + events)
        const forward = (e) => {
          try {
            if (!ie) return;
            // keep internal input value in sync
            ie.value = bizInput.value;
            // dispatch an input event
            ie.dispatchEvent(new Event('input', { bubbles: true }));
          } catch (err) { /* ignore */ }
        };

        // Forward keyboard and composition events so the SDK picks up keystrokes
        const forwardKey = (ev) => {
          try {
            if (!ie) return;
            // Re-dispatch a KeyboardEvent of same type with the same key properties
            const props = {
              key: ev.key,
              code: ev.code,
              location: ev.location,
              ctrlKey: ev.ctrlKey,
              shiftKey: ev.shiftKey,
              altKey: ev.altKey,
              metaKey: ev.metaKey,
              repeat: ev.repeat,
              isComposing: ev.isComposing,
              bubbles: true,
              cancelable: true
            };
            const ke = new KeyboardEvent(ev.type, props);
            ie.dispatchEvent(ke);
          } catch (err) { /* ignore */ }
        };

        // Forward composition and paste events
        const forwardGeneric = (ev) => {
          try {
            if (!ie) return;
            ie.dispatchEvent(new Event(ev.type, { bubbles: true }));
          } catch (err) { /* ignore */ }
        };

        // Forward focus-related behavior removed: keep native focus on the
        // visible panel input so users can type there. We will only forward
        // events (input/keyboard/composition/paste) to the widget's internal
        // input without calling focus on it.
        bizInput.addEventListener('input', forward);
        // keyboard
        bizInput.addEventListener('keydown', forwardKey, true);
        bizInput.addEventListener('keypress', forwardKey, true);
        bizInput.addEventListener('keyup', forwardKey, true);
        // composition (IME)
  bizInput.addEventListener('compositionstart', forwardGeneric);
  bizInput.addEventListener('compositionend', forwardGeneric);
        // paste
        bizInput.addEventListener('paste', forwardGeneric);
        // initialize internal input value
        try { ie.value = bizInput.value || ''; } catch (e) {}

        // (diagnostic poll removed)
      };
      // Run wiring after a short delay to allow widget creation
      setTimeout(wire, 600);
    }
  } catch (e) { /* ignore */ }

  // Controlled autocomplete fallback using AutocompleteService + PlacesService
  // This is used when the native PlaceAutocompleteElement doesn't render a
  // visible dropdown. It is conservative, accessible, and uses the same
  // emitPlace behavior as the native widget.
  try {
    const input = els.businessAddress;
    if (input && input.tagName === 'INPUT' && window.google && google.maps && google.maps.places) {
      const svc = new google.maps.places.AutocompleteService();
      const detailsEl = document.createElement('div');
      const detailsSvc = new google.maps.places.PlacesService(detailsEl);
      let dd = null;
      let items = [];
      let active = -1;
      let sessionToken = null;
      try {
        if (google && google.maps && google.maps.places && typeof google.maps.places.AutocompleteSessionToken === 'function') {
          sessionToken = new google.maps.places.AutocompleteSessionToken();
        }
      } catch (e) { sessionToken = null; }

      const closeDropdown = () => {
        if (dd && dd.parentNode) dd.parentNode.removeChild(dd);
        dd = null; items = []; active = -1;
      };

      const positionDropdown = () => {
        if (!dd) return;
        const r = input.getBoundingClientRect();
        dd.style.left = (window.scrollX + r.left) + 'px';
        dd.style.top = (window.scrollY + r.bottom + 6) + 'px';
        dd.style.width = Math.max(220, r.width) + 'px';
      };

      const render = (preds) => {
        closeDropdown();
        dd = document.createElement('div');
        dd.className = 'mcpp-autocomplete-dropdown';
        if (!preds || !preds.length) {
          const no = document.createElement('div');
          no.className = 'mcpp-autocomplete-noresults';
          no.textContent = 'No suggestions';
          dd.appendChild(no);
        } else {
          preds.forEach((p, i) => {
            const it = document.createElement('div');
            it.className = 'mcpp-autocomplete-item';
            it.textContent = p.description || p.structured_formatting && p.structured_formatting.main_text || p.place_id;
            it.tabIndex = -1;
            it.dataset.placeid = p.place_id;
            it.addEventListener('mousedown', (ev) => {
              ev.preventDefault();
              selectIndex(i);
            });
            dd.appendChild(it);
          });
        }
        document.body.appendChild(dd);
        positionDropdown();
      };

      const selectIndex = (idx) => {
        if (!items || !items[idx]) return;
        const pid = items[idx].place_id;
        closeDropdown();
        const req = { placeId: pid, fields: ['formatted_address','address_components'] };
        try {
          detailsSvc.getDetails(req, (place, status) => {
            if (status === google.maps.places.PlacesServiceStatus.OK && place) {
              try {
                if (place.address_components && place.address_components.length) {
                  let street = '';
                  let city = '';
                  let state = '';
                  let zip = '';
                  for (const component of place.address_components) {
                    const types = component.types || [];
                    if (types.includes('street_number')) {
                      street = component.long_name + ' ' + street;
                    } else if (types.includes('route')) {
                      street += component.long_name;
                    } else if (types.includes('locality')) {
                      city = component.long_name;
                    } else if (types.includes('administrative_area_level_1')) {
                      state = component.short_name;
                    } else if (types.includes('postal_code')) {
                      zip = component.long_name;
                    }
                  }
                  const line1 = street.trim();
                  const line2 = [city, state, zip].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/(\w+)\s+(\w{2})\s+/, '$1, $2 ');
                  const formatted = [line1, line2].filter(Boolean).join('\n');
                  input.value = place.formatted_address || formatted;
                  if (els.businessAddressViewer) els.businessAddressViewer.value = formatted || place.formatted_address || '';
                  if (S.selected && S.booths[S.selected]) S.booths[S.selected].business_address = input.value;
                } else if (place.formatted_address) {
                  input.value = place.formatted_address;
                  if (els.businessAddressViewer) els.businessAddressViewer.value = place.formatted_address;
                  if (S.selected && S.booths[S.selected]) S.booths[S.selected].business_address = place.formatted_address;
                }
              } catch (e) { console.warn('apply place failed', e); }
            } else {
              console.warn('getDetails failed', status);
            }
          });
        } catch (e) { console.warn('detailsSvc.getDetails error', e); }
        try {
          if (google && google.maps && google.maps.places && typeof google.maps.places.AutocompleteSessionToken === 'function') {
            sessionToken = new google.maps.places.AutocompleteSessionToken();
          }
        } catch (e) { sessionToken = null; }
      };

      const onInput = (() => {
        let to = null;
        return (ev) => {
          const v = input.value && input.value.trim();
          if (to) clearTimeout(to);
          if (!v) { closeDropdown(); return; }
          to = setTimeout(() => {
            try {
              const req = { input: v, sessionToken };
              svc.getPlacePredictions(req, (preds, status) => {
                try {
                  if (status === google.maps.places.PlacesServiceStatus.OK && preds && preds.length) {
                    items = preds.slice(0, 7);
                    render(items);
                  } else {
                    items = [];
                    render([]);
                  }
                } catch (e) { console.warn('preds render err', e); }
              });
            } catch (e) { console.warn('getPlacePredictions error', e); }
          }, 250);
        };
      })();

      const onKey = (ev) => {
        if (!dd) return;
        const len = items.length;
        if (ev.key === 'ArrowDown') { ev.preventDefault(); active = (active + 1) % len; updateActive(); }
        else if (ev.key === 'ArrowUp') { ev.preventDefault(); active = (active - 1 + len) % len; updateActive(); }
        else if (ev.key === 'Enter') { ev.preventDefault(); if (active >= 0) selectIndex(active); }
        else if (ev.key === 'Escape') { closeDropdown(); }
      };

      const updateActive = () => {
        if (!dd) return;
        Array.from(dd.querySelectorAll('.mcpp-autocomplete-item')).forEach((el, i) => {
          if (i === active) el.classList.add('active'); else el.classList.remove('active');
        });
      };

      input.addEventListener('focus', () => {
        try {
          if (!sessionToken && google && google.maps && google.maps.places && typeof google.maps.places.AutocompleteSessionToken === 'function') {
            sessionToken = new google.maps.places.AutocompleteSessionToken();
          }
        } catch (e) { sessionToken = null; }
      }, { passive: true });

      input.addEventListener('input', onInput);
      input.addEventListener('keyup', onInput);
      input.addEventListener('paste', onInput);
      input.addEventListener('keydown', onKey);
      window.addEventListener('resize', positionDropdown);
      window.addEventListener('scroll', positionDropdown, { passive: true });
      input.addEventListener('blur', () => { setTimeout(closeDropdown, 150); });
    }
  } catch (e) { /* ignore */ }

  // Experimental DOM host movement removed — the widget should attach to the
  // existing panel input; moving its host caused duplicate visible inputs and
  // focus issues.

  if (els.fit) {
    els.fit.addEventListener('click', () => {
      // Remove location marker when re-centering
      if (typeof MCPP.removeLocationMarker === 'function') {
        MCPP.removeLocationMarker();
      }
      
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
