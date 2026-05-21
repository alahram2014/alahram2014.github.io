import { dom } from '../core/dom.js';
import { getSessionLabel, getSelectedTier } from '../state/selectors.js';
import { canAccessCustomerManagement, isSalesRepSession, isAdminOnlySession } from '../services/authService.js';
import { canOpenOpsWorkspace } from '../services/opsDashboardService.js';

function isOperationalRoute(routeName) {
  return routeName === 'ops' || routeName === 'sales-manager' || routeName === 'rep';
}

export function patchAuthVisualState(container, state) {
  if (!container) return;
  const session = state.auth.session;
  const sessionLabel = getSessionLabel(state);
  const accountBtn = container.querySelector('.header-chip--account');
  if (accountBtn) {
    accountBtn.textContent = sessionLabel;
  }
  const menuEl = container.querySelector('[data-role="account-menu"]');
  if (menuEl) {
    const canOpenDashboard = canOpenOpsWorkspace(session);
    const isRep = isSalesRepSession(session) && !isAdminOnlySession(session);
    const canOpenCustomers = canAccessCustomerManagement(session);
    menuEl.innerHTML = buildMenuHtml(session, canOpenDashboard, isRep, canOpenCustomers, state.ui.desktopMode, state.ui.accountMenuOpen);
  }
}

export function renderHeader(container, state) {
  var tier = getSelectedTier(state);
  var sessionLabel = getSessionLabel(state);
  var session = state.auth.session;
  var routeName = state.app?.route?.name || 'home';
  var operationalRoute = isOperationalRoute(routeName);
  var canOpenCustomers = canAccessCustomerManagement(session);
  var canOpenDashboard = canOpenOpsWorkspace(session);
  var isRep = isSalesRepSession(session) && !isAdminOnlySession(session);
  var searchValue = state.ui.search || '';

  var cache = container.__headerCache;
  if (cache && cache.routeName === routeName && cache.sessionLabel === sessionLabel && cache.canOpenDashboard === canOpenDashboard && cache.isRep === isRep && cache.tierName === (tier?.tier_name || '') && cache.accountMenuOpen === state.ui.accountMenuOpen) {
    var searchInput = container.querySelector('#globalSearchInput');
    if (searchInput) {
      if (document.activeElement !== searchInput) searchInput.value = searchValue;
    }
    var clearBtn = container.querySelector('.header-search__clear');
    if (clearBtn) clearBtn.classList.toggle('is-hidden', !searchValue);
    container.__headerCache = { routeName: routeName, sessionLabel: sessionLabel, canOpenDashboard: canOpenDashboard, isRep: isRep, tierName: (tier?.tier_name || ''), accountMenuOpen: state.ui.accountMenuOpen };
    return;
  }

  var existingShell = container.querySelector('.header-shell');
  if (existingShell) {
    var searchInput = container.querySelector('#globalSearchInput');
    var isFocused = searchInput && document.activeElement === searchInput;
    if (isFocused) {
      var pBar = existingShell.querySelector('.header-row--primary');
      if (pBar) pBar.innerHTML = buildPrimaryBar(operationalRoute, canOpenDashboard, isRep, tier, sessionLabel);
      var clearBtn = container.querySelector('.header-search__clear');
      if (clearBtn) { clearBtn.classList.toggle('is-hidden', !searchValue); }
      var menuEl = container.querySelector('[data-role="account-menu"]');
      if (menuEl) { menuEl.innerHTML = buildMenuHtml(session, canOpenDashboard, isRep, canOpenCustomers, state.ui.desktopMode, state.ui.accountMenuOpen); }
      container.__headerCache = { routeName: routeName, sessionLabel: sessionLabel, canOpenDashboard: canOpenDashboard, isRep: isRep, tierName: (tier?.tier_name || ''), accountMenuOpen: state.ui.accountMenuOpen };
      return;
    }
    if (searchInput) searchInput.value = searchValue;
    var clearBtn2 = container.querySelector('.header-search__clear');
    if (clearBtn2) { clearBtn2.classList.toggle('is-hidden', !searchValue); }
    var pBar2 = existingShell.querySelector('.header-row--primary');
    if (pBar2) pBar2.innerHTML = buildPrimaryBar(operationalRoute, canOpenDashboard, isRep, tier, sessionLabel);
    var menuEl2 = container.querySelector('[data-role="account-menu"]');
    if (menuEl2) { menuEl2.innerHTML = buildMenuHtml(session, canOpenDashboard, isRep, canOpenCustomers, state.ui.desktopMode, state.ui.accountMenuOpen); }
    container.__headerCache = { routeName: routeName, sessionLabel: sessionLabel, canOpenDashboard: canOpenDashboard, isRep: isRep, tierName: (tier?.tier_name || ''), accountMenuOpen: state.ui.accountMenuOpen };
    return;
  }

  container.innerHTML = buildFullHeader(operationalRoute, canOpenDashboard, isRep, tier, sessionLabel, session, canOpenCustomers, searchValue, state.ui.desktopMode, state.ui.accountMenuOpen);
  container.__headerCache = { routeName: routeName, sessionLabel: sessionLabel, canOpenDashboard: canOpenDashboard, isRep: isRep, tierName: (tier?.tier_name || ''), accountMenuOpen: state.ui.accountMenuOpen };
}

function buildFullHeader(operationalRoute, canOpenDashboard, isRep, tier, sessionLabel, session, canOpenCustomers, searchValue, desktopMode, accountMenuOpen) {
  return '<div class="header-shell">' +
    '<div class="header-row header-row--primary">' + buildPrimaryBar(operationalRoute, canOpenDashboard, isRep, tier, sessionLabel) + '</div>' +
    '<div class="header-row header-row--search">' +
      '<div class="header-search">' +
        '<input type="search" class="header-search__input" id="globalSearchInput" placeholder="ابحث عن منتج أو شركة…" value="' + dom.escape(searchValue) + '" dir="auto" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />' +
        '<button class="header-search__clear ' + (searchValue ? '' : 'is-hidden') + '" type="button" data-action="clear-search" aria-label="مسح">✕</button>' +
      '</div>' +
      '<div class="header-search__results is-hidden" id="globalSearchResults"></div>' +
    '</div>' +
    buildMenuHtml(session, canOpenDashboard, isRep, canOpenCustomers, desktopMode, accountMenuOpen) +
  '</div>';
}

function buildPrimaryBar(operationalRoute, canOpenDashboard, isRep, tier, sessionLabel) {
  if (operationalRoute) {
    var html = '<button class="btn btn--ghost header-chip" type="button" data-action="navigate-home">العودة للمتجر</button>';
    if (canOpenDashboard && !isRep) html += '<button class="btn btn--ghost header-chip header-chip--active" type="button" data-action="go-ops">لوحة التحكم</button>';
    if (isRep) html += '<button class="btn btn--ghost header-chip header-chip--active" type="button" data-action="go-rep">لوحة المندوب</button>';
    html += '<button class="btn btn--ghost header-chip header-chip--account" type="button" data-action="toggle-account-menu">' + dom.escape(sessionLabel) + '</button>';
    return html;
  }
  var html = '<button class="btn btn--ghost header-chip" type="button" data-action="navigate-home">الرئيسية</button>';
  html += '<button class="btn btn--ghost header-chip" type="button" data-action="go-tiers">' + dom.escape(tier.visible_label || 'الشريحة') + '</button>';
  html += '<button class="btn btn--ghost header-chip" type="button" data-action="go-offers">العروض</button>';
  if (canOpenDashboard && !isRep) html += '<button class="btn btn--ghost header-chip" type="button" data-action="go-ops">لوحة التحكم</button>';
  if (isRep) html += '<button class="btn btn--ghost header-chip" type="button" data-action="go-rep">لوحة المندوب</button>';
  html += '<button class="btn btn--ghost header-chip header-chip--account" type="button" data-action="toggle-account-menu">' + dom.escape(sessionLabel) + '</button>';
  return html;
}

function buildMenuHtml(session, canOpenDashboard, isRep, canOpenCustomers, desktopMode, accountMenuOpen) {
  var menuContent;
  if (session) {
    menuContent =
      '<button type="button" data-action="pwa-install">📲 تثبيت التطبيق</button>' +
      '<button type="button" data-action="toggle-desktop-mode">💻 ' + (desktopMode ? 'إلغاء ' : '') + 'نسخة الكمبيوتر</button>' +
      '<button type="button" data-action="go-account">👤 حسابي</button>' +
      '<button type="button" data-action="go-invoices">📦 فواتيري</button>' +
      ((canOpenDashboard && !isRep) ? '<button type="button" data-action="go-ops">🧭 لوحة التحكم</button>' : '') +
      (isRep ? '<button type="button" data-action="go-rep">📋 لوحة المندوب</button>' : '') +
      (canOpenCustomers ? '<button type="button" data-action="go-customers">👥 عملائي</button>' : '') +
      '<button type="button" data-action="logout">🚪 تسجيل الخروج</button>';
  } else {
    menuContent =
      '<button type="button" data-action="pwa-install">📲 تثبيت التطبيق</button>' +
      '<button type="button" data-action="go-login">تسجيل الدخول</button>' +
      '<button type="button" data-action="go-register">تسجيل عميل جديد</button>';
  }
  return '<div class="header-menu ' + (accountMenuOpen ? 'is-open' : '') + '" data-role="account-menu">' + menuContent + '</div>';
}
