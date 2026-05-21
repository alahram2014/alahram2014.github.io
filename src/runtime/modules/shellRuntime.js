import { dom } from '../../core/dom.js';
import { shellTemplate, minimalShellTemplate, repShellTemplate } from '../../layout/shell.js';
import { adminShellTemplate } from '../../layout/adminShell.js';

export function bootstrapShell(root, routeName) {
  if (routeName === 'admin') { root.innerHTML = adminShellTemplate(); return; }
  if (routeName === 'rep') { root.innerHTML = repShellTemplate(); return; }
  if (routeName === 'ops' || routeName === 'sales-manager') { root.innerHTML = minimalShellTemplate(); return; }
  root.innerHTML = shellTemplate();
}

export function getNodes() {
  return {
    header: dom.q('#appHeader'),
    search: dom.q('#appSearch'),
    banner: dom.q('#appBanner'),
    theme: dom.q('#appTheme'),
    hero: dom.q('#appHero'),
    page: dom.q('#appPage'),
    footer: dom.q('#appFooter'),
    opsNav: dom.q('#appOpsNav'),
    repNav: dom.q('#appRepNav'),
    drawerHost: dom.q('#appDrawerHost'),
    modalHost: dom.q('#appModalHost'),
    toastHost: dom.q('#appToastHost'),
    adminHeader: dom.q('#adminHeader'),
    adminSidebar: dom.q('#adminSidebar'),
    adminPage: dom.q('#adminPage'),
  };
}

export function isOperationalRoute(routeName) {
  return routeName === 'ops' || routeName === 'sales-manager' || routeName === 'rep';
}

export function captureSearchFocus() {
  var el = document.activeElement;
  if (!el) return null;
  var id = el.id || el.getAttribute('data-search-input');
  if (id !== 'searchInput' && id !== 'globalSearchInput') return null;
  var snapshot = { id: id };
  if (typeof el.selectionStart === 'number' && typeof el.selectionEnd === 'number') {
    snapshot.selectionStart = el.selectionStart;
    snapshot.selectionEnd = el.selectionEnd;
  }
  snapshot.scrollTop = el.scrollTop || 0;
  return snapshot;
}

export function restoreSearchFocus(snapshot) {
  if (!snapshot || !snapshot.id) return;
  var el = document.getElementById(snapshot.id);
  if (!el) return;
  if (document.activeElement !== el) {
    el.focus({ preventScroll: true });
  }
  if (typeof snapshot.selectionStart === 'number' && typeof snapshot.selectionEnd === 'number' && typeof el.setSelectionRange === 'function') {
    try { el.setSelectionRange(snapshot.selectionStart, snapshot.selectionEnd); } catch (e) { /* ignore */ }
  }
}

var footerObserver = null;
export function syncBodyShellHeight() {
  var footer = dom.q('#appFooter');
  var footerHeight = footer ? Math.ceil(footer.getBoundingClientRect().height || 0) : 0;
  document.documentElement.style.setProperty('--footer-height', footerHeight + 'px');
  if (!footerObserver && footer) {
    try {
      footerObserver = new ResizeObserver(function() {
        var h = Math.ceil(footer.getBoundingClientRect().height || 0);
        document.documentElement.style.setProperty('--footer-height', h + 'px');
      });
      footerObserver.observe(footer);
    } catch (e) { /* ResizeObserver not available */ }
  }
}
