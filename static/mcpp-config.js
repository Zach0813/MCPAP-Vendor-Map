// ===== Constants & theme =====
const START_ZOOM = 20;
const FT = 0.3048;
const SNAP = 10;
const DEFAULT_CENTER = { lat: 45.783, lng: -108.5 };
const KNOB_RADIUS_PX_FALLBACK = 28;

const CAT = {
  standard:     { f:'#1e392f', s:'#4ea186' },   // Plant Vendor
  collaborator: { f:'#2f3346', s:'#7582d8' },   // Craft Vendor
  foodbeverage: { f:'#4a2c1b', s:'#e28850' },   // Food/Beverage Vendor
  activity:     { f:'#2f1f3f', s:'#c06ae6' },   // Activity/Entertainment
  misc:         { f:'#353535', s:'#8a8a8a' }    // Miscellaneous
};

// Optional: knob icon for classic google.maps.Marker fallback
const ROT_ICON_URL =
  'data:image/svg+xml;utf8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
      <g fill="none" stroke="#101c1b" stroke-width="3">
        <circle cx="11" cy="11" r="9" stroke="#2b4e4c" stroke-width="3" />
      </g>
      <path d="M11 2.5a8.5 8.5 0 0 1 7.7 4.9" stroke="#d6ff2e" stroke-width="2.2" fill="none" />
      <path d="M18.7 5.6l-2.8 0.5 1.2-2.5z" fill="#d6ff2e"/>
      <path d="M11 19.5a8.5 8.5 0 0 1-7.7-4.9" stroke="#d6ff2e" stroke-width="2.2" fill="none" />
      <path d="M3.3 16.4l2.8-0.5-1.2 2.5z" fill="#d6ff2e"/>
    </svg>
  `);

// --- Knob tuning ---
let KNOB_EXTRA_PX = 20;
let KNOB_SELF_OFFSET_PX = { x: -11, y: -20 };
window.mcppSetKnobExtra = (px)=>{ KNOB_EXTRA_PX = +px||0; redraw(); };
window.mcppSetKnobNudge = (x,y)=>{ KNOB_SELF_OFFSET_PX = {x:+x||0,y:+y||0}; redraw(); };

// Hide booth labels when zoomed out below this level
let SHOW_LABELS = true;
const LABEL_HIDE_ZOOM = 19.5;

// === Debug & tuning ===
let SHOW_CENTER_DEBUG = false;
let CENTER_OFFSET_PX = { x: 0, y: 0 }; // used for geometry math/orbit center
let PER_BOOTH_OFFSETS = false;
window.mcppToggleCenterDebug = (v)=>{ SHOW_CENTER_DEBUG = !!v; redraw(); };
window.mcppSetCenterOffset = (x,y)=>{ CENTER_OFFSET_PX = {x:+x||0, y:+y||0}; redraw(); };

// --- Label font scaling (used by updateLabelLayoutForZoom in app-google.js) ---
let LABEL_FONT_BASE_PX    = 12;   // font size at START_ZOOM
let LABEL_FONT_MIN_PX     = 9;    // minimum font size when zoomed out
let LABEL_FONT_SCALE_MULT = 1.0;  // multiplier on zoom-based scaling (1.0 = default)

// Optional runtime tuner from console:
window.mcppSetLabelFont = (base, min, mult = 1.0) => {
  if (base != null) LABEL_FONT_BASE_PX = +base;
  if (min  != null) LABEL_FONT_MIN_PX  = +min;
  if (mult != null) LABEL_FONT_SCALE_MULT = +mult;
  if (typeof redraw === 'function') redraw();
};

/* === Logo Badge Overlay (Trial Feature) === */
let SHOW_LOGO_BADGES = true;   // Toggle to enable/disable booth logo badges
const LOGO_BADGE_MIN_ZOOM    = 20.7;     // Minimum zoom level for displaying badges
const LOGO_BADGE_BASE_PX     = 48;     // Base size in pixels at zoom level 20
const LOGO_BADGE_MIN_PX      = 48;     // Minimum badge size in pixels
const LOGO_BADGE_MAX_PX      = 48;     // Maximum badge size in pixels

// Default placeholder image for vendor logos (SVG, inline base64)
const LOGO_BADGE_PLACEHOLDER = 'data:image/svg+xml;base64,' + btoa(`
  <svg xmlns="http://www.w3.org/2000/svg" width="140" height="140" viewBox="0 0 140 140">
    <rect width="140" height="140" rx="16" ry="16" fill="#0a1514" stroke="#2b4e4c" stroke-width="3"/>
    <text x="50%" y="50%" text-anchor="middle" fill="#2b4e4c" font-size="16" font-family="system-ui" dy=".35em">No Logo</text>
  </svg>
`);

/* Fine-tuning for logo badge centering */

Object.assign(window, {
  START_ZOOM,
  FT,
  SNAP,
  DEFAULT_CENTER,
  SHOW_CENTER_DEBUG
});

window.mcppShowLabels = (v = !SHOW_LABELS) => {
  SHOW_LABELS = !!v;
  window.SHOW_LABELS = SHOW_LABELS;
  if (typeof redraw === "function") redraw();
};

window.mcppShowBadges = (v = !SHOW_LOGO_BADGES) => {
  SHOW_LOGO_BADGES = !!v;
  window.SHOW_LOGO_BADGES = SHOW_LOGO_BADGES;
  if (typeof redraw === "function") redraw();
};

window.SHOW_LABELS = SHOW_LABELS;
window.SHOW_LOGO_BADGES = SHOW_LOGO_BADGES;
