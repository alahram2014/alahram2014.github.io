import { dom } from '../core/dom.js';
import { getSessionLabel, getSelectedTier } from '../state/selectors.js';
import { canAccessCustomerManagement, isSalesRepSession, isAdminOnlySession } from '../services/authService.js';
import { canOpenOpsWorkspace } from '../services/opsDashboardService.js';

function isOperationalRoute(routeName) {
  return routeName === 'ops' || routeName === 'sales-manager' || routeName === 'rep';
}

export function renderHeader(container, state) {
  const tier = getSelectedTier(state);
  const sessionLabel = getSessionLabel(state);
  const session = state.auth.session;
  const routeName = state.app?.route?.name || 'home';
  const operationalRoute = isOperationalRoute(routeName);
  const canOpenCustomers = canAccessCustomerManagement(session);
  const canOpenDashboard = canOpenOpsWorkspace(session);
  const isRep = isSalesRepSession(session) && !isAdminOnlySession(session);
  const searchValue = state.ui.search || '';

  const primaryButtons = operationalRoute
    ? `
        <button class="btn btn--ghost header-chip" type="button" data-action="navigate-home">العودة للمتجر</button>
        ${canOpenDashboard && !isRep ? '<button class="btn btn--ghost header-chip header-chip--active" type="button" data-action="go-ops">لوحة التحكم</button>' : ''}
        ${isRep ? '<button class="btn btn--ghost header-chip header-chip--active" type="button" data-action="go-rep">لوحة المندوب</button>' : ''}
      `
    : `
        <button class="btn btn--ghost header-chip" type="button" data-action="navigate-home">الرئيسية</button>
        <button class="btn btn--ghost header-chip" type="button" data-action="go-tiers">${dom.escape(tier.visible_label || 'الشريحة')}</button>
        <button class="btn btn--ghost header-chip" type="button" data-action="go-offers">العروض</button>
        ${canOpenDashboard && !isRep ? '<button class="btn btn--ghost header-chip" type="button" data-action="go-ops">لوحة التحكم</button>' : ''}
        ${isRep ? '<button class="btn btn--ghost header-chip" type="button" data-action="go-rep">لوحة المندوب</button>' : ''}
      `;

  const desktopMode = state.ui.desktopMode === true;
  const accountMenu = session ? `
      <button type="button" data-action="pwa-install">📲 تثبيت التطبيق</button>
      <button type="button" data-action="toggle-desktop-mode">💻 ${desktopMode ? 'إلغاء' : ''}نسخة الكمبيوتر</button>
      <button type="button" data-action="go-account">👤 حسابي</button>
      <button type="button" data-action="go-invoices">📦 فواتيري</button>
      ${canOpenDashboard && !isRep ? '<button type="button" data-action="go-ops">🧭 لوحة التحكم</button>' : ''}
      ${isRep ? '<button type="button" data-action="go-rep">📋 لوحة المندوب</button>' : ''}
      ${canOpenCustomers ? '<button type="button" data-action="go-customers">👥 عملائي</button>' : ''}
      <button type="button" data-action="logout">🚪 تسجيل الخروج</button>
    ` : `
      <button type="button" data-action="pwa-install">📲 تثبيت التطبيق</button>
      <button type="button" data-action="go-login">تسجيل الدخول</button>
      <button type="button" data-action="go-register">تسجيل عميل جديد</button>
    `;

  container.innerHTML = `
    <div class="header-shell">
      <div class="header-row header-row--primary">
        ${primaryButtons}
        <button class="btn btn--ghost header-chip header-chip--account" type="button" data-action="toggle-account-menu">${dom.escape(sessionLabel)}</button>
      </div>
      <div class="header-row header-row--search">
        <div class="header-search">
          <input type="search" class="header-search__input" id="globalSearchInput" placeholder="ابحث عن منتج أو شركة…" value="${dom.escape(searchValue)}" dir="auto" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" />
          <button class="header-search__clear ${searchValue ? '' : 'is-hidden'}" type="button" data-action="clear-search" aria-label="مسح">✕</button>
        </div>
        <div class="header-search__results is-hidden" id="globalSearchResults"></div>
      </div>
      <div class="header-menu ${state.ui.accountMenuOpen ? 'is-open' : ''}" data-role="account-menu">
        ${accountMenu}
      </div>
    </div>
  `;
}
