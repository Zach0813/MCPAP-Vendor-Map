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
  boothEdit.capture = (id) => {
    if (!id || !S.booths || !S.booths[id]) return;
    boothEdit.snapshotId = id;
    boothEdit.snapshot = cloneBooth(S.booths[id]);
    boothEdit.dirty = false;
  };

  boothEdit.markDirty = () => {
    if (!S.isAdmin || !S.selected || boothEdit.snapshotId !== S.selected) return;
    boothEdit.dirty = true;
  };

  boothEdit.clear = () => {
    boothEdit.snapshotId = null;
    boothEdit.snapshot = null;
    boothEdit.dirty = false;
  };

  boothEdit.revertIfDirty = () => {
    if (!S.isAdmin || !S.selected || boothEdit.snapshotId !== S.selected || !boothEdit.dirty || !boothEdit.snapshot || !S.booths[S.selected]) {
      if (!S.isAdmin) boothEdit.clear();
      return false;
    }

    // Restore last captured (saved) state
    S.booths[S.selected] = cloneBooth(boothEdit.snapshot);

    // Refresh visuals/list to match restored state
    const refresh = () => {
      if (MCPP.draw) MCPP.draw(S.selected);
      if (MCPP.refreshList) MCPP.refreshList();
      if (MCPP.postViewportSync) MCPP.postViewportSync();
      if (MCPP.updateCategoryPill) MCPP.updateCategoryPill();
      if (MCPP.updateAllPanelBadges) MCPP.updateAllPanelBadges();
    };
    try { refresh(); } catch (_) {}

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

  // Note: returnVendor checkbox handler is below (consolidated with other badge handlers)

  // Consolidated badge checkbox handler
  const handleBadgeChange = (checkbox, property, updateDisplay) => {
    if (!checkbox) return;
    checkbox.addEventListener('change', () => {
      if (!S.selected) return;
      const flag = !!checkbox.checked;
      const booth = S.booths[S.selected];
      if (!booth) return;
      booth[property] = flag;
      if (updateDisplay && returnVendorDisplay) {
        returnVendorDisplay.textContent = formatReturnVendor(flag);
      }
      if (MCPP.draw) MCPP.draw(S.selected);
      if (MCPP.updateAllPanelBadges) MCPP.updateAllPanelBadges();
      boothEdit.markDirty();
    });
  };

  handleBadgeChange(eventStaffCheckbox, 'is_event_staff');
  handleBadgeChange(partnerVendorCheckbox, 'is_partner_vendor');
  handleBadgeChange(featuredVendorCheckbox, 'is_featured_vendor');
  handleBadgeChange(returnVendorCheckbox, 'is_return_vendor', true);

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
        if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'none';
      } else {
        els.logoModalPreview.src = previewUrl;
        els.logoModalPreview.style.display = 'block';
        els.logoModalPreview.onload = function () { if (logoCanCrop) applyLogoCropPreview(); };
        if (els.logoModalPreview.complete && els.logoModalPreview.naturalWidth) applyLogoCropPreview();
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
      // URL logos are not cropped in-app; hide crop controls
      logoSelectedFile = null;
      logoCanCrop = false;
      setLogoCropSlider(0);
      if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'none';
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
    revokeLogoObjectUrl();
    logoSelectedFile = null;
    logoCanCrop = false;
    const currentUrl = (S.booths[S.selected].logo_url) || '';
    lastUploadedLogoUrl = '';
    if (els.logoUrl) els.logoUrl.value = currentUrl;
    if (els.logoUpload) els.logoUpload.value = '';
    setFileInputLabel('Select file – no file chosen', false);
    setLogoCropSlider(0);
    // If this booth already uses an internal upload URL, allow cropping immediately
    if (currentUrl && currentUrl.indexOf('/static/uploads/') === 0) {
      logoCanCrop = true;
      if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'block';
    } else {
      logoCanCrop = false;
      if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'none';
    }
    updateLogoPreview(currentUrl);
    els.logoModal.classList.remove('hidden');
    els.logoModal.style.display = 'flex';
  }

  function closeLogoModal() {
    if (!els.logoModal) return;
    revokeLogoObjectUrl();
    logoSelectedFile = null;
    logoCanCrop = false;
    els.logoModal.classList.add('hidden');
    els.logoModal.style.display = 'none';
  }

  // When modal preview image loads, apply current crop slider to preview
  if (els.logoModalPreview) {
    els.logoModalPreview.addEventListener('load', function () {
      applyLogoCropPreview();
    });
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
      if (MCPP.draw) MCPP.draw(S.selected);
      if (MCPP.save) await MCPP.save(false);
      
      if (showToast) showToast('Logo removed', 2000, els.removeLogoBtn);
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
  MCPP.updateRemoveLogoButton = updateRemoveLogoButton;

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

  // Track URL from upload; object URL and selected file so we can crop/upload on Save
  let lastUploadedLogoUrl = '';
  let logoObjectUrl = null;
  let logoSelectedFile = null;
  let logoCropAmount = 0; // 0–100: 0 = full image, 100 = zoom to center
  let logoCanCrop = false; // only true for uploaded files (not external URLs)

  function revokeLogoObjectUrl() {
    if (logoObjectUrl) {
      try { URL.revokeObjectURL(logoObjectUrl); } catch (e) {}
      logoObjectUrl = null;
    }
    logoSelectedFile = null;
    logoCanCrop = false;
  }

  function setLogoCropSlider(value) {
    logoCropAmount = Math.max(0, Math.min(100, Number(value) || 0));
    if (els.logoCropSlider) els.logoCropSlider.value = logoCropAmount;
    if (els.logoCropSliderValue) els.logoCropSliderValue.textContent = Math.round(logoCropAmount);
    applyLogoCropPreview();
  }

  // Crop = center rectangle that shrinks from full image (0%) to 10% of size (100%). No forced square.
  // Output is 512×512 with crop scaled to fit and centered; letterboxing is transparent.
  function getLogoCropRect(img) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    var w = img.naturalWidth;
    var h = img.naturalHeight;
    var pct = logoCropAmount / 100;
    var cropW = Math.max(1, w * (1 - 0.9 * pct));
    var cropH = Math.max(1, h * (1 - 0.9 * pct));
    var sx = (w - cropW) / 2;
    var sy = (h - cropH) / 2;
    return { sx: sx, sy: sy, cropW: cropW, cropH: cropH, w: w, h: h };
  }

  function applyLogoCropPreview() {
    var img = els.logoModalPreview;
    if (!img || !img.src || img.src === LOGO_BADGE_PLACEHOLDER) return;
    if (!logoCanCrop) {
      img.style.transform = 'scale(1)';
      img.style.display = 'block';
      if (window._logoCropPreviewCanvas) {
        window._logoCropPreviewCanvas.style.display = 'none';
      }
      return;
    }
    var r = getLogoCropRect(img);
    if (!r) return;
    var wrap = img.parentElement;
    if (!wrap) return;
    var previewSize = 280;
    if (!window._logoCropPreviewCanvas) {
      var can = document.createElement('canvas');
      can.width = previewSize;
      can.height = previewSize;
      can.style.position = 'absolute';
      can.style.left = '0';
      can.style.top = '0';
      can.style.pointerEvents = 'none';
      wrap.appendChild(can);
      window._logoCropPreviewCanvas = can;
    }
    var can = window._logoCropPreviewCanvas;
    img.style.display = 'none';
    can.style.display = 'block';
    var ctx = can.getContext('2d');
    ctx.clearRect(0, 0, previewSize, previewSize);
    var scale = previewSize / Math.max(r.cropW, r.cropH);
    var dW = r.cropW * scale;
    var dH = r.cropH * scale;
    var dx = (previewSize - dW) / 2;
    var dy = (previewSize - dH) / 2;
    ctx.drawImage(img, r.sx, r.sy, r.cropW, r.cropH, dx, dy, dW, dH);
  }

  function getCenterCropCanvas(img, cropPct, outSize) {
    if (!img || !img.naturalWidth || !img.naturalHeight) return null;
    var r = getLogoCropRect(img);
    if (!r) return null;
    var size = outSize || 512;
    var canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var scale = size / Math.max(r.cropW, r.cropH);
    var dW = r.cropW * scale;
    var dH = r.cropH * scale;
    var dx = (size - dW) / 2;
    var dy = (size - dH) / 2;
    ctx.drawImage(img, r.sx, r.sy, r.cropW, r.cropH, dx, dy, dW, dH);
    return canvas;
  }

  function getCenterCropRect(img) {
    var r = getLogoCropRect(img);
    if (!r) return null;
    return { sx: r.sx, sy: r.sy, side: r.cropW, w: r.w, h: r.h, cropW: r.cropW, cropH: r.cropH };
  }

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
      revokeLogoObjectUrl();
      lastUploadedLogoUrl = '';
       logoSelectedFile = null;
       logoCanCrop = false;
      setLogoCropSlider(0);
      if (els.logoUrl) els.logoUrl.value = '';
      if (els.logoUpload) els.logoUpload.value = '';
      setFileInputLabel('Select file – no file chosen', false);
      updateLogoPreview('');
    });
  }

  if (els.logoCropSlider) {
    els.logoCropSlider.addEventListener('input', function () {
      setLogoCropSlider(this.value);
    });
  }

  // Debug: show exactly which region of the original image will be cropped (red box)
  if (els.logoCropDebugBtn) {
    els.logoCropDebugBtn.addEventListener('click', function () {
      var img = els.logoModalPreview;
      if (!img || !img.src || img.src === LOGO_BADGE_PLACEHOLDER || !img.naturalWidth) {
        alert('Load an image and use the crop slider first.');
        return;
      }
      var r = getCenterCropRect(img);
      if (!r) return;
      try {
        var canvas = document.createElement('canvas');
        canvas.width = r.w;
        canvas.height = r.h;
        var ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0);
        ctx.strokeStyle = 'red';
        ctx.lineWidth = Math.max(2, Math.min(r.w, r.h) / 80);
        ctx.strokeRect(r.sx, r.sy, r.cropW, r.cropH);
        var win = window.open('', '_blank');
        win.document.write(
          '<html><body style="margin:0;background:#222;">' +
          '<img src="' + canvas.toDataURL() + '" style="max-width:100%;height:auto;display:block;" alt="Crop region" />' +
          '<p style="color:#ccc;font-family:sans-serif;padding:8px;font-size:12px;">Red box = area saved. Image: ' + r.w + '×' + r.h + ', crop: ' + Math.round(r.cropW) + '×' + Math.round(r.cropH) + ', left: ' + Math.round(r.sx) + ', top: ' + Math.round(r.sy) + '</p></body></html>'
        );
        win.document.close();
      } catch (e) {
        console.error(e);
        alert('Could not draw crop region (image may be cross-origin). Try with an uploaded or imported logo.');
      }
    });
  }

  // Import existing URL logo as uploaded image so it can be cropped
  if (els.logoImportFromUrl) {
    els.logoImportFromUrl.addEventListener('click', async () => {
      if (!S.selected || !S.booths[S.selected]) return;
      const currentUrl = (els.logoUrl && els.logoUrl.value || '').trim() || (S.booths[S.selected].logo_url || '').trim();
      if (!currentUrl) {
        alert('Enter a logo URL first.');
        return;
      }
      // If this is already an internal upload URL, just enable cropping and skip the import call
      if (currentUrl.indexOf('/static/uploads/') === 0) {
        S.booths[S.selected].logo_url = currentUrl;
        if (els.logoUrl) els.logoUrl.value = currentUrl;
        lastUploadedLogoUrl = currentUrl;
        logoSelectedFile = null;
        logoCanCrop = true;
        if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'block';
        setLogoCropSlider(0);
        updateLogoPreview(currentUrl);
        boothEdit.capture(S.selected);
        return;
      }
      try {
        els.logoImportFromUrl.disabled = true;
        els.logoImportFromUrl.textContent = 'Importing…';
        const resp = await fetch('/api/import-logo-from-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: currentUrl })
        });
        const result = await resp.json();
        if (!result.ok || !result.url) {
          console.error('Import URL failed', result);
          alert(result.error || 'Import failed');
          return;
        }
        // Switch booth to use the imported upload URL
        const newUrl = result.url;
        S.booths[S.selected].logo_url = newUrl;
        if (els.logoUrl) els.logoUrl.value = newUrl;
        lastUploadedLogoUrl = newUrl;
        // Enable cropping on the now first-party image
        logoSelectedFile = null;
        logoCanCrop = true;
        if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'block';
        setLogoCropSlider(0);
        updateLogoPreview(newUrl);
        // Persist booth update
        if (MCPP.draw) MCPP.draw(S.selected);
        if (MCPP.save) await MCPP.save(false);
        boothEdit.capture(S.selected);
      } catch (e) {
        console.error('Import from URL error:', e);
        alert('Import failed: ' + (e.message || 'Unknown error'));
      } finally {
        els.logoImportFromUrl.disabled = false;
        els.logoImportFromUrl.textContent = 'Import URL for cropping';
      }
    });
  }

  // Save logo from modal
  if (els.logoModalSave) {
    els.logoModalSave.addEventListener('click', async () => {
      if (!S.selected || !S.booths[S.selected]) return;
      let url = (lastUploadedLogoUrl || (els.logoUrl && els.logoUrl.value || '').trim());

      const img = els.logoModalPreview;

      // If a file was selected, upload it (with optional center crop when slider > 0)
      if (logoSelectedFile) {
        try {
          let blobToUpload = null;
          if (logoCanCrop && logoCropAmount > 0 && img && img.src && img.src !== LOGO_BADGE_PLACEHOLDER && img.naturalWidth) {
            const canvas = getCenterCropCanvas(img, logoCropAmount, 512);
            if (canvas) {
              blobToUpload = await new Promise(function (resolve) {
                canvas.toBlob(resolve, 'image/png', 0.92);
              });
            }
          }

          // If no explicit crop (slider at 0) or crop failed, upload the original file as-is
          if (!blobToUpload) {
            blobToUpload = logoSelectedFile;
          }

          if (blobToUpload) {
            const formData = new FormData();
            formData.append('file', blobToUpload, blobToUpload.name || 'logo.png');
            const response = await fetch('/api/upload-logo', { method: 'POST', body: formData });
            const result = await response.json();
            if (result.ok && result.url) url = result.url;
          }
        } catch (e) {
          console.error('Crop/upload error:', e);
        }

        // Reset file/crop state after upload
        revokeLogoObjectUrl();
        logoSelectedFile = null;
        logoCanCrop = false;
        setLogoCropSlider(0);
      } else if (logoCanCrop && logoCropAmount > 0 && img && img.src && img.src !== LOGO_BADGE_PLACEHOLDER && img.naturalWidth) {
        // Cropping an existing internal upload (imported earlier) using the current preview
        try {
          const canvas = getCenterCropCanvas(img, logoCropAmount, 512);
          if (canvas) {
            const blob = await new Promise(function (resolve) {
              canvas.toBlob(resolve, 'image/png', 0.92);
            });
            if (blob) {
              const formData = new FormData();
              formData.append('file', blob, 'logo.png');
              const response = await fetch('/api/upload-logo', { method: 'POST', body: formData });
              const result = await response.json();
              if (result.ok && result.url) url = result.url;
            }
          }
        } catch (e) {
          console.error('Crop/upload (existing upload) error:', e);
        }

        // Reset crop slider after re-upload
        setLogoCropSlider(0);
      }

      S.booths[S.selected].logo_url = url;
      if (els.logoUrl) els.logoUrl.value = url;
      updateLogoPreview(url);
      updateRemoveLogoButton();
      if (MCPP.draw) MCPP.draw(S.selected);
      if (MCPP.save) await MCPP.save(false);
      boothEdit.capture(S.selected);
      closeLogoModal();
      if (MCPP.postViewportSync) MCPP.postViewportSync();
      if (showToast) showToast('Logo updated', 2000, els.logoModalSave);
    });
  }

  // Handle logo file select: show image in crop UI (upload happens on Save)
  if (els.logoUpload) {
    els.logoUpload.addEventListener('change', () => {
      const fileInput = els.logoUpload;
      if (!fileInput.files || !fileInput.files.length) {
        setFileInputLabel('Select file – no file chosen', false);
        return;
      }
      const file = fileInput.files[0];
      const maxSize = 100 * 1024 * 1024;
      if (file.size > maxSize) {
        setFileInputLabel('Select file – no file chosen', false);
        fileInput.value = '';
        alert(`File is too large. Maximum size is 100MB. Your file is ${(file.size / (1024 * 1024)).toFixed(2)}MB`);
        return;
      }
      setFileInputLabel(file.name, true);
      if (els.logoUrl) els.logoUrl.value = '';
      lastUploadedLogoUrl = '';
      if (logoObjectUrl) try { URL.revokeObjectURL(logoObjectUrl); } catch (e) {}
      logoObjectUrl = URL.createObjectURL(file);
      logoSelectedFile = file;
      logoCanCrop = true;
      setLogoCropSlider(0);
      if (els.logoModalPreview) {
        els.logoModalPreview.removeAttribute('crossOrigin');
        els.logoModalPreview.src = logoObjectUrl;
        els.logoModalPreview.style.display = 'block';
        if (els.logoCropSliderWrap) els.logoCropSliderWrap.style.display = 'block';
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
      if (MCPP.draw) MCPP.draw(id);
      if (MCPP.select) MCPP.select(id);
      if (MCPP.save) await MCPP.save(false);
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
      if (MCPP.draw) MCPP.draw(id);
      if (MCPP.select) MCPP.select(id);
      if (MCPP.save) await MCPP.save(false);
    });
  }

  const normalizeRotation = (value) => {
    let deg = Number(value);
    if (!Number.isFinite(deg)) deg = 0;
    deg = (deg % 360 + 360) % 360;
    if (typeof window.snapRotationToPreset === 'function') return window.snapRotationToPreset(deg);
    return deg;
  };

  if (els.assign) {
    els.assign.addEventListener('click', async () => {
      if (!S.isAdmin || !S.selected) return;
      const booth = S.booths[S.selected];
      booth.biz = (els.biz.value || '').trim();
      booth.vendor_name = (els.vendorName.value || '').trim();
      const fmtPhone = MCPP.formatPhoneNumber ? MCPP.formatPhoneNumber(els.phone.value) : (els.phone.value || '').trim();
      booth.phone = fmtPhone;
      if (els.phone) els.phone.value = fmtPhone;
      booth.email = (els.email.value || '').trim();
      booth.website = (els.website.value || '').trim();
      booth.business_address = (els.businessAddress && els.businessAddress.value || '').trim();
      booth.notes = (els.notes.value || '').trim();
      // Use form logo URL; if form is blank (e.g. logo was set only via modal), keep existing booth logo so we don't overwrite
      const formLogo = (els.logoUrl && els.logoUrl.value || '').trim();
      booth.logo_url = formLogo !== '' ? formLogo : (booth.logo_url || '');
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
        els.rotationDeg.value = String(deg);
      }
      if (booth.center && MCPP.boothAnchorFromCenter) {
        booth.anchor = MCPP.boothAnchorFromCenter(booth.center, booth);
      }
      if (MCPP.normalizeBoothGeometry) {
        MCPP.normalizeBoothGeometry(booth);
      }
      booth.category = getNormalizeKey()(els.category.value || 'standard');
      updateCategoryPill();
      if (MCPP.draw) MCPP.draw(S.selected);
      if (MCPP.save) await MCPP.save(false);
      boothEdit.capture(S.selected);
      // Refresh map logo badges so any logo change is visible immediately
      if (MCPP.postViewportSync) MCPP.postViewportSync();
      
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
      els.rotationDeg.value = String(deg);
      if (MCPP.draw) MCPP.draw(S.selected);
      if (MCPP.postViewportSync) MCPP.postViewportSync();
      boothEdit.markDirty();
    };
    els.rotationDeg.addEventListener('input', applyRotationInput);
    els.rotationDeg.addEventListener('change', applyRotationInput);
  }

  function applyDimensionInputs() {
    if (!S.selected) return;
    const booth = S.booths[S.selected];
    if (!booth) return;
    const w = Math.max(1, parseInt(els.widthFeet.value, 10) || booth.width_feet);
    const l = Math.max(1, parseInt(els.lengthFeet.value, 10) || booth.length_feet);
    booth.width_feet = w;
    booth.length_feet = l;
    if (els.widthFeet) els.widthFeet.value = w;
    if (els.lengthFeet) els.lengthFeet.value = l;
    if (MCPP.draw) MCPP.draw(S.selected);
    if (MCPP.postViewportSync) MCPP.postViewportSync();
    boothEdit.markDirty();
  }
  if (els.widthFeet) {
    els.widthFeet.addEventListener('input', applyDimensionInputs);
    els.widthFeet.addEventListener('change', applyDimensionInputs);
  }
  if (els.lengthFeet) {
    els.lengthFeet.addEventListener('input', applyDimensionInputs);
    els.lengthFeet.addEventListener('change', applyDimensionInputs);
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
      
      if (MCPP.draw) MCPP.draw(S.selected);
      // Refresh logo badges on map so the booth's logo disappears (no auto-save)
      if (MCPP.postViewportSync) MCPP.postViewportSync();
      if (MCPP.updateRemoveLogoButton) MCPP.updateRemoveLogoButton();
      if (MCPP.updateCategoryPill) MCPP.updateCategoryPill();
      if (MCPP.updateAllPanelBadges) MCPP.updateAllPanelBadges();
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
            if (shape.badgeOverlay.remove) shape.badgeOverlay.remove();
            else if (shape.badgeOverlay.setMap) shape.badgeOverlay.setMap(null);
          } catch (e) {}
          shape.badgeOverlay = null;
        }
        
        // Remove category overlay (top-left category emoji badge)
        if (shape.categoryOverlay) {
          try {
            if (shape.categoryOverlay.remove) shape.categoryOverlay.remove();
            else if (shape.categoryOverlay.setMap) shape.categoryOverlay.setMap(null);
          } catch (e) {}
          shape.categoryOverlay = null;
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
      if (MCPP.save) await MCPP.save(false);
      if (MCPP.refreshList) MCPP.refreshList();
      if (MCPP.showList) MCPP.showList();
    });
  }

  if (els.exportCSV) {
    els.exportCSV.addEventListener('click', () => {
      if (MCPP.dl && MCPP.csv) MCPP.dl('booths.csv', MCPP.csv());
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
      if (MCPP.dl) MCPP.dl('booths.json', JSON.stringify(S.booths, null, 2), 'application/json');
    });
  }

  if (els.backToList) {
    els.backToList.addEventListener('click', () => {
      // If admin made changes but didn't save, restore the last captured state
      try { boothEdit.revertIfDirty(); } catch (_) {}
      if (MCPP.clearSelection) MCPP.clearSelection();
    });
  }

  if (els.boothLockBtn && S.selected !== undefined) {
    els.boothLockBtn.addEventListener('click', () => {
      if (!S.isAdmin || !S.selected) return;
      if (!S.boothEditLockedById) S.boothEditLockedById = {};
      S.boothEditLockedById[S.selected] = !S.boothEditLockedById[S.selected];
      if (typeof MCPP.applyEditLockState === 'function') MCPP.applyEditLockState();
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

  // Debounce search input for better performance
  let searchTimeout = null;
  if (els.listSearch) {
    els.listSearch.addEventListener('input', () => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => {
        if (MCPP.refreshList) MCPP.refreshList();
      }, 150);
    });
  }

  if (els.phone && MCPP.formatPhoneNumber) {
    const formatInputPhone = () => {
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
          if (MCPP.who) await MCPP.who();
          if (MCPP.resetToListPanel) MCPP.resetToListPanel();
          if (els.profileMenu) els.profileMenu.classList.add('hidden');
          loginLogoutBtn.textContent = 'Logout';
        } else {
          alert('Invalid PIN');
        }
      } else {
        await fetch('/logout', { method: 'POST' });
        if (MCPP.who) await MCPP.who();
        if (MCPP.resetToListPanel) MCPP.resetToListPanel();
        if (els.profileMenu) els.profileMenu.classList.add('hidden');
        loginLogoutBtn.textContent = 'Login';
      }
    });
  }

  // Initialize autocomplete for business address field
  {
    const initBusinessAddressAutocomplete = () => {
      if (!els.businessAddress) return;
      // Places Autocomplete requires an HTMLInputElement (not textarea)
      if (Object.prototype.toString.call(els.businessAddress) !== '[object HTMLInputElement]') {
        return;
      }
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
          
          // Format as single line for input (API requires HTMLInputElement)
          const line1 = street.trim();
          const line2 = [city, state, zip].filter(Boolean).join(' ').replace(/\s+/g, ' ').replace(/(\w+)\s+(\w{2})\s+/, '$1, $2 ');
          const formattedAddress = [line1, line2].filter(Boolean).join(', ');
          
          els.businessAddress.value = formattedAddress || place.formatted_address;
          // Don't write into booth data until admin clicks Save.
          boothEdit.markDirty();
        } else if (place.formatted_address) {
          els.businessAddress.value = place.formatted_address;
          // Don't write into booth data until admin clicks Save.
          boothEdit.markDirty();
        }
      });
      
    };

    // Try to initialize immediately if API is ready
    if (window.google && google.maps && google.maps.places) {
      initBusinessAddressAutocomplete();
    }
    setTimeout(() => initBusinessAddressAutocomplete(), 1000);
    MCPP.initBusinessAddressAutocomplete = initBusinessAddressAutocomplete;
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
        if (MCPP.postViewportSync) MCPP.postViewportSync();
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
    if (MCPP.draw) MCPP.draw(S.selected);
    if (MCPP.save) MCPP.save(true);
  });
})();
