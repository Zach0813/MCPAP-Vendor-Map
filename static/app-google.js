(() => {
  "use strict";
  if (!window.MCPP) {
    console.warn('[MCPP] Legacy app-google.js loaded before modular scripts. Core functionality now lives in static/js/*.js.');
  } else {
    console.warn('[MCPP] app-google.js is now a lightweight shim. All logic has moved into static/js/*.js modules.');
  }
})();
