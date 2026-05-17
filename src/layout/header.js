import { dom } from '../core/dom.js';
import { getSessionLabel, getSelectedTier } from '../state/selectors.js';
import { canAccessCustomerManagement, hasOperationalAccess, isSalesRepSession } from '../services/authService.js';
import { canOpenOpsWorkspace } from '../services/opsDashboardService.js';

function isOperationalRoute(routeName) {
  return routeName === 'ops' || routeName === 'sales-manager';
}

export function renderHeader(container, state) {
  const tier = getSelectedTier(state);
  const sessionLabel = getSessionLabel(state);
  const session = state.auth.session;
  const routeName = state.app?.route?.name || 'home';
  const operationalRoute = isOperationalRoute(routeName);
  const canOpenCustomers = canAccessCustomerManagement(session) || isSalesRepSession(session);
  const canOpenDashboard = canOpenOpsWorkspace(session) || hasOperationalAccess(session);

  const primaryButtons = operationalRoute
    ? `
        <button class="btn btn--ghost header-chip" type="button" data-action="navigate-home">العودة للمتجر</button>
        ${canOpenDashboard ? '<button class="btn btn--ghost header-chip header-chip--active" type="button" data-action="go-ops">مركز التشغيل</button>' : ''}
      `
    : `
        <button class="btn btn--ghost header-chip" type="button" data-action="navigate-home">الرئيسية</button>
        <button class="btn btn--ghost header-chip" type="button" data-action="go-tiers">${dom.escape(tier.visible_label || 'الشريحة')}</button>
        <button class="btn btn--ghost header-chip" type="button" data-action="go-offers">العروض</button>
        ${canOpenDashboard ? '<button class="btn btn--ghost header-chip" type="button" data-action="go-ops">مركز التشغيل</button>' : ''}
      `;

  const accountMenu = session ? `
      <button type="button" data-action="pwa-install">📲 تثبيت التطبيق</button>
      <button type="button" data-action="go-account">👤 حسابي</button>
      <button type="button" data-action="go-invoices">📦 فواتيري</button>
      ${canOpenDashboard ? '<button type="button" data-action="go-ops">🧭 مركز التشغيل</button>' : ''}
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
      <div class="header-menu ${state.ui.accountMenuOpen ? 'is-open' : ''}" data-role="account-menu">
        ${accountMenu}
      </div>
    </div>
  `;
}
