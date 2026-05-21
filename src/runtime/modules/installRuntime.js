export function detectPlatform() {
  if (window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true) {
    return 'standalone';
  }
  var ua = (navigator.userAgent || '').toLowerCase();
  var isChrome = ua.includes('chrome') && !ua.includes('edge') && !ua.includes('samsung');
  var isEdge = ua.includes('edge');
  var isSamsung = ua.includes('samsung');
  var isFirefox = ua.includes('firefox');
  var isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('edge');
  var isMobile = /mobile|android|iphone|ipad|ipod/i.test(ua);
  var isAndroid = ua.includes('android');
  var isIos = /iphone|ipad|ipod/i.test(ua) && !ua.includes('windows');
  if (isIos && isSafari) return 'ios-safari';
  if (isIos && !isSafari) return 'ios-other';
  if (isAndroid && isSamsung) return 'samsung-internet';
  if (isAndroid && isEdge) return 'android-edge';
  if (isAndroid && isChrome) return 'android-chrome';
  if (isMobile && isChrome) return 'android-chrome';
  if (isMobile && isEdge) return 'android-edge';
  if (!isMobile && isChrome) return 'desktop-chrome';
  if (!isMobile && isEdge) return 'desktop-edge';
  if (!isMobile && isSafari) return 'desktop-safari';
  return 'unsupported';
}

var installOverlayEl = null;

export function showInstallOverlay(message, subtext) {
  hideInstallOverlay();
  installOverlayEl = document.createElement('div');
  installOverlayEl.className = 'install-overlay';
  var html = '<div class="install-overlay__panel">';
  if (message) {
    html += '<div class="install-overlay__message">' + message + '</div>';
  }
  if (subtext) {
    html += '<div class="install-overlay__subtext">' + subtext + '</div>';
  }
  html += '</div>';
  installOverlayEl.innerHTML = html;
  document.body.appendChild(installOverlayEl);
}

export function hideInstallOverlay() {
  if (installOverlayEl && installOverlayEl.parentNode) installOverlayEl.parentNode.removeChild(installOverlayEl);
  installOverlayEl = null;
}

export function showIOSInstallGuide() {
  hideInstallOverlay();
  installOverlayEl = document.createElement('div');
  installOverlayEl.className = 'install-overlay';
  installOverlayEl.innerHTML =
    '<div class="install-overlay__panel install-overlay__panel--guide">' +
      '<div class="install-overlay__guide-title">لتثبيت التطبيق</div>' +
      '<div class="install-overlay__guide-step">' +
        '<span class="install-overlay__guide-icon">1</span>' +
        '<span>اضغط زر المشاركة <span class="install-overlay__guide-share">📤</span></span>' +
      '</div>' +
      '<div class="install-overlay__guide-step">' +
        '<span class="install-overlay__guide-icon">2</span>' +
        '<span>اختر <strong>إضافة إلى الشاشة الرئيسية</strong></span>' +
      '</div>' +
      '<div class="install-overlay__guide-step">' +
        '<span class="install-overlay__guide-icon">3</span>' +
        '<span>اضغط <strong>إضافة</strong> في الزاوية العليا</span>' +
      '</div>' +
      '<button type="button" class="install-overlay__close" data-action="close-install-guide">تم</button>' +
    '</div>';
  document.body.appendChild(installOverlayEl);
}

export async function performInstall(store) {
  var platform = detectPlatform();
  var pwa = window.__ALAHRAM_PWA__ || {};
  if (platform === 'standalone' || pwa.installed) {
    return 'installed';
  }
  if (platform === 'ios-safari' || platform === 'ios-other') {
    showIOSInstallGuide();
    return 'ios-guide';
  }
  if (platform === 'unsupported') {
    return 'unsupported';
  }
  if (pwa.deferredPrompt && typeof pwa.deferredPrompt.prompt === 'function') {
    showInstallOverlay('جارى تجهيز التثبيت...');
    await new Promise(function(r) { setTimeout(r, 300); });
    try {
      pwa.deferredPrompt.prompt();
      var choice = await pwa.deferredPrompt.userChoice;
      pwa.deferredPrompt = null;
      pwa.installAvailable = false;
      if (choice?.outcome === 'accepted') {
        pwa.installed = true;
        hideInstallOverlay();
        return 'accepted';
      }
      hideInstallOverlay();
      return 'dismissed';
    } catch (err) {
      pwa.deferredPrompt = null;
      hideInstallOverlay();
      return 'error';
    }
  }
  return 'no-prompt';
}

export function isInstallable() {
  var platform = detectPlatform();
  return platform === 'android-chrome' || platform === 'android-edge' || platform === 'samsung-internet' || platform === 'desktop-chrome' || platform === 'desktop-edge' || platform === 'ios-safari' || platform === 'ios-other';
}
