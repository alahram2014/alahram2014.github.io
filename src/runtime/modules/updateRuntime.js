export function isSWAvailable() {
  return 'serviceWorker' in navigator && 'caches' in window;
}

var overlayEl = null;

export function showUpdateOverlay(message, subtext) {
  hideUpdateOverlay();
  overlayEl = document.createElement('div');
  overlayEl.className = 'update-overlay';
  overlayEl.innerHTML =
    '<div class="update-overlay__panel">' +
      '<div class="update-overlay__spinner"></div>' +
      '<div class="update-overlay__message">' + message + '</div>' +
      (subtext ? '<div class="update-overlay__subtext">' + subtext + '</div>' : '') +
    '</div>';
  document.body.appendChild(overlayEl);
}

export function hideUpdateOverlay() {
  if (overlayEl && overlayEl.parentNode) overlayEl.parentNode.removeChild(overlayEl);
  overlayEl = null;
}

export async function cleanStaleCaches(currentCacheName) {
  try {
    var keys = await caches.keys();
    var stale = keys.filter(function(k) { return k !== currentCacheName; });
    if (stale.length) await Promise.all(stale.map(function(k) { return caches.delete(k); }));
    return stale.length;
  } catch (e) {
    return 0;
  }
}

export async function updateServiceWorker() {
  var registration = null;
  try {
    registration = await navigator.serviceWorker.getRegistration();
  } catch (e) { /* not available */ }
  if (!registration) {
    try {
      registration = await navigator.serviceWorker.register('./sw.js');
    } catch (e) { return false; }
  }
  try {
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    if (typeof registration.update === 'function') {
      await registration.update();
      await new Promise(function(resolve) {
        if (!registration.installing && !registration.waiting) { resolve(false); return; }
        function onStateChange() {
          if (registration.waiting || (registration.active && !registration.installing)) {
            if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
            resolve(true);
          }
        }
        var target = registration.installing || registration.waiting;
        if (target) target.addEventListener('statechange', onStateChange);
        setTimeout(function() { resolve(!!registration.waiting); }, 5000);
      });
      return true;
    }
  } catch (e) { /* fall through */ }
  return false;
}

export async function performAppUpdate() {
  if (!isSWAvailable()) {
    showUpdateOverlay('جارى تحديث التطبيق...', '');
    await new Promise(function(r) { setTimeout(r, 600); });
    window.location.reload();
    return;
  }
  try {
    showUpdateOverlay('جارى تحديث التطبيق...', 'جارى تحميل آخر إصدار');
    var updated = await updateServiceWorker();
    if (updated) {
      showUpdateOverlay('جارى تحديث التطبيق...', 'جارى تفعيل الإصدار الجديد');
      await new Promise(function(r) { setTimeout(r, 400); });
    }
    var cleaned = await cleanStaleCaches('ahram-co-shell-v2');
    if (cleaned > 0) {
      showUpdateOverlay('جارى تحديث التطبيق...', 'جارى تنظيف التخزين المؤقت');
      await new Promise(function(r) { setTimeout(r, 300); });
    }
    showUpdateOverlay('جارى تحديث التطبيق...', 'جارى إعادة تحميل التطبيق');
    await new Promise(function(r) { setTimeout(r, 500); });
    window.location.reload();
  } catch (e) {
    showUpdateOverlay('جارى تحديث التطبيق...', 'تعذر التحديث حالياً');
    await new Promise(function(r) { setTimeout(r, 1500); });
    hideUpdateOverlay();
  }
}
