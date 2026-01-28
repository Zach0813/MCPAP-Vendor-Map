(() => {
  "use strict";

  const MCPP = window.MCPP = window.MCPP || {};
  const S = MCPP.S || (window.S = window.S || {});
  const els = MCPP.els || {};

  if (!Object.keys(els).length) return;

  // ------------------------------------------------------------
  // Admin editor: revert unsaved edits when leaving the booth
  // ------------------------------------------------------------
  const cloneBooth = (booth) => {
    if (!booth) return booth;
    try {
      // modern browsers
      if (typeof structuredClone === 'function') return structuredClone(booth);
    } catch (_) {}
    // fallback: booth data is plain JSON
    try { return JSON.parse(JSON.stringify(booth)); } catch (_) { return booth; }
  };

  const boothEdit = MCPP.boothEdit = MCPP.boothEdit || {};
  boothEdit.snapshotId = boothEdit.snapshotId || null;
  boothEdit.snapshot = boothEdit.snapshot || null;
  boothEdit.dirty = !!boothEdit.dirty;
  // Debug: set MCPP.boothEditDebug = true in the browser console to log capture/revert/refill
  const boothEditLog = (msg, detail) => {
    if (typeof MCPP !== 'undefined' && MCPP.boothEditDebug) {
      console.log('[boothEdit] ' + msg, detail !== undefined ? detail : '');
    }
  };

  boothEdit.capture = (id) => {
    if (!id || !S.booths || !S.booths[id]) {
      boothEditLog('capture SKIP (no id or booth)', { id, hasBooth: !!(id && S.booths && S.booths[id]) });
      return;
    }
    boothEdit.snapshotId = id;
    boothEdit.snapshot = cloneBooth(S.booths[id]);
    boothEdit.dirty = false;
    const b = S.booths[id];
    boothEditLog('capture OK', { id, biz: (b && b.biz) || '', vendor_name: (b && b.vendor_name) || '' });
  };

  boothEdit.markDirty = () => {
    if (!S.isAdmin) return;
    if (!S.selected) return;
    if (boothEdit.snapshotId !== S.selected) return;
    boothEdit.dirty = true;
    boothEditLog('markDirty', { id: S.selected });
  };

  boothEdit.clear = () => {
    boothEditLog('clear', { wasId: boothEdit.snapshotId });
    boothEdit.snapshotId = null;
    boothEdit.snapshot = null;
    boothEdit.dirty = false;
  };

  boothEdit.revertIfDirty = () => {
    if (!S.isAdmin) { boothEdit.clear(); boothEditLog('revertIfDirty SKIP (not admin)'); return false; }
    const id = S.selected;
    const reason = !id ? 'no id' : boothEdit.snapshotId !== id ? 'snapshotId !== id' : !boothEdit.dirty ? 'not dirty' : !boothEdit.snapshot ? 'no snapshot' : !S.booths || !S.booths[id] ? 'no booth' : null;
    if (reason) {
      boothEditLog('revertIfDirty SKIP', { id, snapshotId: boothEdit.snapshotId, dirty: boothEdit.dirty, hasSnapshot: !!boothEdit.snapshot, reason });
      return false;
    }

    // Restore last captured (saved) state
    S.booths[id] = cloneBooth(boothEdit.snapshot);
    const snap = boothEdit.snapshot;
    boothEditLog('revertIfDirty RESTORED', { id, snapshotBiz: (snap && snap.biz) || '', snapshotVendor: (snap && snap.vendor_name) || '' });

    // Refresh visuals/list to match restored state (rotation/geometry/etc.)
    try { if (typeof MCPP.draw === 'function') MCPP.draw(id); } catch (_) {}
    try { if (typeof MCPP.refreshList === 'function') MCPP.refreshList(); } catch (_) {}
    try { if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync(); } catch (_) {}
    try { if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill(); } catch (_) {}
    try { if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges(); } catch (_) {}

    boothEdit.dirty = false;
    return true;
  };

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
      boothEdit.markDirty();
    });
  }

  if (returnVendorCheckbox) {
    returnVendorCheckbox.addEventListener('change', () => {
      const flag = !!returnVendorCheckbox.checked;
      if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
    });
  }

  if (eventStaffCheckbox) {
    // Update booth and UI only; persist when user clicks Assign / Save
    eventStaffCheckbox.addEventListener('change', () => {
      if (!S.selected) return;
      const flag = !!eventStaffCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_event_staff = flag;
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      boothEdit.markDirty();
    });
  }

  if (partnerVendorCheckbox) {
    partnerVendorCheckbox.addEventListener('change', () => {
      if (!S.selected) return;
      const flag = !!partnerVendorCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_partner_vendor = flag;
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      boothEdit.markDirty();
    });
  }

  if (featuredVendorCheckbox) {
    featuredVendorCheckbox.addEventListener('change', () => {
      if (!S.selected) return;
      const flag = !!featuredVendorCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_featured_vendor = flag;
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      boothEdit.markDirty();
    });
  }

  if (returnVendorCheckbox) {
    returnVendorCheckbox.addEventListener('change', () => {
      if (!S.selected) return;
      const flag = !!returnVendorCheckbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth.is_return_vendor = flag;
      if (returnVendorDisplay) returnVendorDisplay.textContent = formatReturnVendor(flag);
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      boothEdit.markDirty();
    });
  }

  // Update preview when logo URL changes (in modal)
  function updateLogoPreview(url) {
    const previewUrl = (url || '').trim() || LOGO_BADGE_PLACEHOLDER;
    if (els.logoPreview) {
      els.logoPreview.src = previewUrl;
      els.logoPreview.style.display = 'block';
    }
    if (els.logoModalPreview) {
      if (previewUrl === LOGO_BADGE_PLACEHOLDER) {
        els.logoModalPreview.src = '';
        els.logoModalPreview.style.display = 'none';
      } else {
        els.logoModalPreview.src = previewUrl;
        els.logoModalPreview.style.display = 'block';
      }
    }
  }

  if (els.logoUrl) {
    els.logoUrl.addEventListener('input', () => {
      const url = (els.logoUrl.value || '').trim();
      updateLogoPreview(url);
      // URL given → clear upload so only one source is used
      if (els.logoUpload) els.logoUpload.value = '';
      setFileInputLabel('Select file – no file chosen', false);
      lastUploadedLogoUrl = '';
    });
  }

  // Modal open/close handlers
  function openLogoModal() {
    if (!els.logoModal) {
      console.error('Logo modal element not found');
      return;
    }
    if (!S.selected || !S.booths[S.selected]) {
      alert('Please select a booth first');
      return;
    }
    const currentUrl = (S.booths[S.selected].logo_url) || '';
    lastUploadedLogoUrl = '';
    if (els.logoUrl) els.logoUrl.value = currentUrl;
    if (els.logoUpload) els.logoUpload.value = '';
    setFileInputLabel('Select file – no file chosen', false);
    updateLogoPreview(currentUrl);
    els.logoModal.classList.remove('hidden');
    // Ensure modal is visible
    els.logoModal.style.display = 'flex';
  }

  function closeLogoModal() {
    if (!els.logoModal) return;
    els.logoModal.classList.add('hidden');
    els.logoModal.style.display = 'none';
  }

  if (els.addLogoBtn) {
    els.addLogoBtn.addEventListener('click', () => {
      if (!S.isAdmin) return;
      openLogoModal();
    });
  }

  // Handle remove logo button
  if (els.removeLogoBtn) {
    els.removeLogoBtn.addEventListener('click', async () => {
      if (!S.isAdmin || !S.selected || !S.booths[S.selected]) return;
      
      if (!confirm('Remove logo/image for this booth?')) return;
      
      S.booths[S.selected].logo_url = '';
      updateLogoPreview('');
      updateRemoveLogoButton();
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
      
      if (typeof showToast === 'function') {
        showToast('Logo removed', 2000, els.removeLogoBtn);
      }
    });
  }

  // Update remove button state based on whether logo exists
  function updateRemoveLogoButton() {
    if (!els.removeLogoBtn) return;
    const hasLogo = !!(S.selected && S.booths[S.selected] && S.booths[S.selected].logo_url && S.booths[S.selected].logo_url.trim());
    els.removeLogoBtn.disabled = !hasLogo;
    if (!hasLogo) {
      els.removeLogoBtn.style.opacity = '0.5';
      els.removeLogoBtn.style.cursor = 'not-allowed';
    } else {
      els.removeLogoBtn.style.opacity = '1';
      els.removeLogoBtn.style.cursor = 'pointer';
    }
  }

  // Expose updateRemoveLogoButton globally so it can be called from other modules
  if (typeof MCPP !== 'undefined') {
    MCPP.updateRemoveLogoButton = updateRemoveLogoButton;
  }

  if (els.logoModalClose) {
    els.logoModalClose.addEventListener('click', closeLogoModal);
  }

  if (els.logoModalCancel) {
    els.logoModalCancel.addEventListener('click', closeLogoModal);
  }

  // Close modal when clicking overlay
  if (els.logoModal) {
    const overlay = els.logoModal.querySelector('.modal-overlay');
    if (overlay) {
      overlay.addEventListener('click', closeLogoModal);
    }
    
    // Close modal on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !els.logoModal.classList.contains('hidden')) {
        closeLogoModal();
      }
    });
  }

  // Track URL from upload so we don't put it in the URL field (stays blank when file uploaded)
  let lastUploadedLogoUrl = '';

  function setFileInputLabel(text, hasFile) {
    if (els.logoUploadLabel) els.logoUploadLabel.textContent = text || 'Select file – no file chosen';
    if (els.logoUploadFake) {
      if (hasFile) els.logoUploadFake.classList.add('has-file');
      else els.logoUploadFake.classList.remove('has-file');
    }
  }

  // Clear logo fields in modal (wrong file/link entered)
  if (els.logoModalClear) {
    els.logoModalClear.addEventListener('click', () => {
      lastUploadedLogoUrl = '';
      if (els.logoUrl) els.logoUrl.value = '';
      if (els.logoUpload) els.logoUpload.value = '';
      setFileInputLabel('Select file – no file chosen', false);
      updateLogoPreview('');
    });
  }

  // Save logo from modal (use uploaded URL if set, else URL field)
  if (els.logoModalSave) {
    els.logoModalSave.addEventListener('click', async () => {
      if (!S.selected || !S.booths[S.selected]) return;
      const url = (lastUploadedLogoUrl || (els.logoUrl && els.logoUrl.value || '').trim());
      S.booths[S.selected].logo_url = url;
      updateLogoPreview(url);
      updateRemoveLogoButton();
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      if (typeof MCPP.save === 'function') await MCPP.save(false);
      boothEdit.capture(S.selected);
      closeLogoModal();
      if (typeof showToast === 'function') {
        showToast('Logo updated', 2000, els.logoModalSave);
      }
    });
  }

  // Handle logo file upload (auto-upload on file select; URL field stays blank)
  if (els.logoUpload) {
    els.logoUpload.addEventListener('change', async () => {
      const fileInput = els.logoUpload;
      if (!fileInput.files || !fileInput.files.length) {
        setFileInputLabel('Select file – no file chosen', false);
        return;
      }

      const file = fileInput.files[0];
      setFileInputLabel(file.name, true);
      // Upload given → clear URL so only one source is used
      if (els.logoUrl) els.logoUrl.value = '';
      lastUploadedLogoUrl = '';

      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        setFileInputLabel('Select file – no file chosen', false);
        fileInput.value = '';
        alert(`File is too large. Maximum size is 100MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        return;
      }

      if (els.logoUploadLabel) els.logoUploadLabel.textContent = 'Uploading…';

      try {
        const formData = new FormData();
        formData.append('file', file);
        const response = await fetch('/api/upload-logo', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.ok && result.url) {
          lastUploadedLogoUrl = result.url;
          if (els.logoUrl) els.logoUrl.value = ''; // keep URL field blank when file uploaded
          updateLogoPreview(result.url);
          updateRemoveLogoButton();
          setFileInputLabel(file.name, true);
          if (typeof showToast === 'function') {
            showToast('Image uploaded successfully', 2000);
          }
        } else {
          setFileInputLabel('Select file – no file chosen', false);
          fileInput.value = '';
          alert(result.error || 'Upload failed');
        }
      } catch (error) {
        console.error('Upload error:', error);
        setFileInputLabel('Select file – no file chosen', false);
        fileInput.value = '';
        alert('Upload failed: ' + (error.message || 'Unknown error'));
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
        phone_public: true,
        email_public: true,
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
        phone_public: true,
        email_public: true,
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
      booth.logo_url = (els.logoUrl && els.logoUrl.value || '').trim();
      // If phone/email fields are empty, treat as hidden (no empty fields for viewers)
      booth.phone_public = (!booth.phone || !booth.phone.trim()) ? false : !els.phonePublic.checked;
      booth.email_public = (!booth.email || !booth.email.trim()) ? false : !els.emailPublic.checked;
      // Update checkboxes to reflect saved state (empty fields = checked/hidden)
      if (els.phonePublic) els.phonePublic.checked = booth.phone_public === false;
      if (els.emailPublic) els.emailPublic.checked = booth.email_public === false;
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
      boothEdit.capture(S.selected);
      
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
      boothEdit.markDirty();
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
      
      // Manually clear all form fields to match cleared booth state
      if (els.biz) els.biz.value = '';
      if (els.vendorName) els.vendorName.value = '';
      if (els.phone) els.phone.value = '';
      if (els.email) els.email.value = '';
      if (els.website) els.website.value = '';
      if (els.businessAddress) els.businessAddress.value = '';
      if (els.notes) els.notes.value = '';
      if (els.logoUrl) els.logoUrl.value = '';
      if (els.logoUpload) els.logoUpload.value = '';
      // Show standard placeholder in panel (no broken image); modal preview cleared/hidden
      updateLogoPreview('');
      if (els.phonePublic) els.phonePublic.checked = false;
      if (els.emailPublic) els.emailPublic.checked = false;
      
      if (typeof MCPP.draw === 'function') MCPP.draw(S.selected);
      // Refresh logo badges on map so the booth's logo disappears (no auto-save)
      if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync();
      if (typeof MCPP.updateRemoveLogoButton === 'function') MCPP.updateRemoveLogoButton();
      if (typeof MCPP.updateCategoryPill === 'function') MCPP.updateCategoryPill();
      if (typeof MCPP.updateAllPanelBadges === 'function') MCPP.updateAllPanelBadges();
      boothEdit.markDirty();
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
        if (shape.poly) shape.poly.setMap(null);
        
        // Remove label overlay properly
        if (shape.lab) {
          if (typeof shape.lab.remove === 'function') shape.lab.remove();
          else if (typeof shape.lab.setMap === 'function') shape.lab.setMap(null);
          else if ('map' in shape.lab) shape.lab.map = null;
        }
        
        // Remove badge overlay (status badges like event staff, partner vendor, etc.)
        if (shape.badgeOverlay) {
          try {
            if (typeof shape.badgeOverlay.remove === 'function') shape.badgeOverlay.remove();
            else if (typeof shape.badgeOverlay.setMap === 'function') shape.badgeOverlay.setMap(null);
          } catch (e) {}
          shape.badgeOverlay = null;
        }
        
        // Remove center debug marker
        if (shape.centerDbg) {
          if ('map' in shape.centerDbg) shape.centerDbg.map = null;
          else if (typeof shape.centerDbg.setMap === 'function') shape.centerDbg.setMap(null);
        }
        
        // Remove debug lines if they exist
        if (Array.isArray(shape.debugLines)) {
          shape.debugLines.forEach((line) => {
            if (line && typeof line.setMap === 'function') line.setMap(null);
          });
        }
        
        delete S.shapes[id];
      }
      
      // Clean up logo badges (matching pattern from badges.js destroyLogoBadge)
      if (S.logoBadges && S.logoBadges[id]) {
        const badge = S.logoBadges[id];
        if (badge && badge.marker) {
          if (typeof badge.marker.remove === 'function') badge.marker.remove();
          else if (typeof badge.marker.setMap === 'function') badge.marker.setMap(null);
          else try { badge.marker.map = null; } catch (e) {}
        }
        delete S.logoBadges[id];
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
      // If admin made changes but didn't save, restore the last captured state
      try { boothEdit.revertIfDirty(); } catch (_) {}
      if (typeof MCPP.clearSelection === 'function') MCPP.clearSelection();
    });
  }

  // Mark the editor dirty when admin changes fields (these changes are not persisted until Save)
  const markDirtyOn = (el, evt = 'input') => {
    if (!el) return;
    el.addEventListener(evt, () => boothEdit.markDirty());
  };
  markDirtyOn(els.biz, 'input');
  markDirtyOn(els.vendorName, 'input');
  markDirtyOn(els.phone, 'input');
  markDirtyOn(els.email, 'input');
  markDirtyOn(els.website, 'input');
  markDirtyOn(els.notes, 'input');
  markDirtyOn(els.businessAddress, 'input');
  markDirtyOn(els.widthFeet, 'input');
  markDirtyOn(els.lengthFeet, 'input');
  markDirtyOn(els.category, 'change');
  markDirtyOn(els.phonePublic, 'change');
  markDirtyOn(els.emailPublic, 'change');


  // Prevent Enter in edit-panel inputs from activating Assign / Save or other buttons
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const target = e.target;
    if (!target || typeof target.closest !== 'function') return;
    const editPanel = els.editPanel;
    if (!editPanel || !editPanel.contains(target)) return;
    const tag = (target.tagName || '').toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select') {
      e.preventDefault();
    }
  });

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
    // Store the location marker at module scope
    let locationMarker = null;
    
    // Helper function to remove location marker
    const removeLocationMarker = () => {
      if (locationMarker) {
        try {
          locationMarker.setMap(null);
          google.maps.event.clearInstanceListeners(locationMarker);
        } catch (e) {
          console.error('Error removing marker:', e);
        }
        locationMarker = null;
      }
    };
    
    // Expose globally so other parts can clear it
    MCPP.removeLocationMarker = removeLocationMarker;
    
    // Initialize Google Places Autocomplete on the address input
    const initAutocomplete = () => {
      if (!els.addr) return;
      if (!window.google || !google.maps || !google.maps.places || !google.maps.places.Autocomplete) {
        console.warn('Google Places API not loaded yet');
        return;
      }
      
      const autocomplete = new google.maps.places.Autocomplete(els.addr, {
        fields: ['geometry', 'formatted_address', 'name', 'address_components'],
        types: ['address']
      });

      // Listen for place selection from autocomplete dropdown
      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        
        if (!place.geometry || !place.geometry.location) {
          // User pressed Enter without selecting from dropdown
          return;
        }

        // Update input with formatted address immediately when selected
        const displayAddress = place.formatted_address || place.name || '';
        els.addr.value = displayAddress;

        // Remove previous location marker if it exists
        removeLocationMarker();

        // Add a standard red marker at the location
        if (S.map) {
          locationMarker = new google.maps.Marker({
            position: place.geometry.location,
            map: S.map,
            title: displayAddress,
            animation: google.maps.Animation.DROP,
            zIndex: 9999,
            clickable: true,
            cursor: 'pointer'
          });
          
          // Remove marker when clicked
          google.maps.event.addListener(locationMarker, 'click', function() {
            removeLocationMarker();
          });
        }

        // Valid place selected from dropdown - navigate to it at zoom level 18
        if (S.map) {
          const vp = place.geometry.viewport || new google.maps.LatLngBounds(
            place.geometry.location,
            place.geometry.location
          );
          const prevMin = S.map.get('minZoom');
          S.map.setOptions({ minZoom: 18 });
          S.map.fitBounds(vp, { top: 40, bottom: 40, left: 20, right: 20 });
          const once = S.map.addListener('idle', () => {
            S.map.setOptions({ minZoom: (prevMin == null ? 2 : prevMin) });
            S.didInitialViewport = true;
            if (typeof MCPP.postViewportSync === 'function') MCPP.postViewportSync();
            google.maps.event.removeListener(once);
          });
        }
      });
      
      console.log('Places Autocomplete initialized');
    };
    
    // Initialize autocomplete for business address field
    const initBusinessAddressAutocomplete = () => {
      if (!els.businessAddress) return;
      if (!window.google || !google.maps || !google.maps.places || !google.maps.places.Autocomplete) {
        return;
      }
      
      const businessAutocomplete = new google.maps.places.Autocomplete(els.businessAddress, {
        fields: ['formatted_address', 'address_components'],
        types: ['address']
      });

      // Update field with formatted address in mailing format when selected
      businessAutocomplete.addListener('place_changed', () => {
        const place = businessAutocomplete.getPlace();
        if (place.address_components && place.address_components.length) {
          // Parse address components to format as mailing address
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
          
          // Format as two lines: "Street\nCity, State ZIP"
          const line1 = street.trim();
          const line2 = [city, state, zip].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/(\w+)\s+(\w{2})\s+/, '$1, $2 ');
          const formattedAddress = [line1, line2].filter(Boolean).join('\n');
          
          els.businessAddress.value = formattedAddress || place.formatted_address;
          // Don't write into booth data until admin clicks Save.
          boothEdit.markDirty();
        } else if (place.formatted_address) {
          els.businessAddress.value = place.formatted_address;
          // Don't write into booth data until admin clicks Save.
          boothEdit.markDirty();
        }
      });
      
      console.log('Business Address Autocomplete initialized');
    };

    // Try to initialize immediately if API is ready
    if (window.google && google.maps && google.maps.places) {
      initAutocomplete();
      initBusinessAddressAutocomplete();
    }
    
    // Also try after a short delay to handle async loading
    setTimeout(() => {
      initAutocomplete();
      initBusinessAddressAutocomplete();
    }, 1000);
    
    // And expose it globally so map-init can call it when ready
    MCPP.initAutocomplete = initAutocomplete;
    MCPP.initBusinessAddressAutocomplete = initBusinessAddressAutocomplete;

    els.locate.addEventListener('click', () => {
      const q = els.addr && els.addr.value.trim();
      if (!q) return;
      
      // Fall back to geocoding the address string
      if (!S.geocoder) S.geocoder = new google.maps.Geocoder();
      S.geocoder.geocode({ address: q }, (res, status) => {
        if (status === 'OK' && res[0]) {
          // Remove previous location marker if it exists
          removeLocationMarker();

          // Add a standard red marker at the location
          locationMarker = new google.maps.Marker({
            position: res[0].geometry.location,
            map: S.map,
            title: res[0].formatted_address || q,
            animation: google.maps.Animation.DROP,
            zIndex: 9999,
            clickable: true,
            cursor: 'pointer'
          });
          
          // Remove marker when clicked
          google.maps.event.addListener(locationMarker, 'click', function() {
            removeLocationMarker();
          });

          const vp = res[0].geometry.viewport || new google.maps.LatLngBounds(res[0].geometry.location, res[0].geometry.location);
          const prevMin = S.map.get('minZoom');
          S.map.setOptions({ minZoom: 18 });
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
