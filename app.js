import { bootstrapApp } from './src/runtime/bootstrap.js';
import { detectPlatform } from './src/runtime/modules/installRuntime.js';

bootstrapApp();

const pwaState = window.__ALAHRAM_PWA__ || (window.__ALAHRAM_PWA__ = {
  deferredPrompt: null,
  installAvailable: false,
  installed: Boolean(
    window.matchMedia?.('(display-mode: standalone)')?.matches
    || window.navigator?.standalone === true
  ),
  platform: detectPlatform(),
});

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  pwaState.deferredPrompt = event;
  pwaState.installAvailable = true;
});

window.addEventListener('appinstalled', () => {
  pwaState.deferredPrompt = null;
  pwaState.installAvailable = false;
  pwaState.installed = true;
});

if ('serviceWorker' in navigator) {
  var swRegistration = null;
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('./sw.js').then(function(reg) {
      swRegistration = reg;
      reg.addEventListener('updatefound', function() {
        var installing = reg.installing;
        if (installing) {
          installing.addEventListener('statechange', function() {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              var pwa = window.__ALAHRAM_PWA__ || {};
              pwa.updateAvailable = true;
              pwa.updateRegistration = reg;
              var evt = new CustomEvent('pwa-update-ready', { detail: { registration: reg } });
              window.dispatchEvent(evt);
            }
          });
        }
      });
    }).catch(function() {});
  });
  window.addEventListener('pwa-update-ready', function() {
    var banner = document.querySelector('.app-banner');
    if (banner && !banner.querySelector('.pwa-update-banner')) {
      var updateBanner = document.createElement('div');
      updateBanner.className = 'pwa-update-banner';
      updateBanner.innerHTML = '<span>تحديث متاح</span><button type="button" data-action="pwa-update">تحديث الآن</button>';
      banner.appendChild(updateBanner);
    }
  });
  document.addEventListener('click', function(event) {
    if (event.target.getAttribute && event.target.getAttribute('data-action') === 'pwa-update') {
      var pwa = window.__ALAHRAM_PWA__ || {};
      if (pwa.updateRegistration && pwa.updateRegistration.waiting) {
        pwa.updateRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
        window.location.reload();
      }
    }
  });
}
