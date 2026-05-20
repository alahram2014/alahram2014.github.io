import { dom } from '../core/dom.js';

const ADMIN_MODULES = [
  { key: 'products', label: 'المنتجات', icon: '📦', description: 'إدارة كاملة للمنتجات والتسعير والمخزون' },
  { key: 'companies', label: 'الشركات', icon: '🏢', description: 'إدارة الشركات والظهور' },
  { key: 'customers', label: 'العملاء', icon: '👥', description: 'إدارة العملاء والملكية' },
  { key: 'orders', label: 'الطلبات', icon: '📋', description: 'إدارة الطلبات والحالات' },
  { key: 'reps', label: 'المندوبين', icon: '🤝', description: 'إدارة المندوبين والصلاحيات' },
  { key: 'pricing', label: 'التسعير', icon: '💰', description: 'شرائح الأسعار والتسعير' },
  { key: 'deals', label: 'العروض', icon: '🎯', description: 'عرض اليوم والعروض الفورية' },
  { key: 'stock', label: 'المخزون', icon: '📊', description: 'مراقبة المخزون والحركة' },
  { key: 'users', label: 'المستخدمين', icon: '🛡️', description: 'إدارة المستخدمين والصلاحيات' },
  { key: 'settings', label: 'الإعدادات', icon: '⚙️', description: 'إعدادات التشغيل' },
];

export function getAdminModules() {
  return ADMIN_MODULES.map((m) => ({ ...m }));
}

export function getAdminModuleByKey(key) {
  return ADMIN_MODULES.find((m) => m.key === key) || null;
}

export function renderAdminHeader(state) {
  const session = state?.auth?.session;
  return `
    <div class="admin-header__brand">
      <span class="admin-header__logo">⚙️</span>
      <span class="admin-header__title">مركز التحكم</span>
    </div>
    <div class="admin-header__user">
      <span class="admin-header__name">${session ? dom.escape(session.name || session.username || '') : '—'}</span>
      <button class="btn btn--ghost btn--sm" type="button" data-action="admin-logout">تسجيل الخروج</button>
      <button class="btn btn--ghost btn--sm" type="button" data-action="admin-back-store">العودة للمتجر</button>
    </div>
  `;
}

export function renderAdminSidebar(state) {
  const currentModule = state?.app?.route?.params?.module || 'products';
  return `
    <div class="admin-sidebar__inner">
      <ul class="admin-nav-list">
        ${ADMIN_MODULES.map((mod) => {
          const active = mod.key === currentModule;
          return `
            <li class="admin-nav-item ${active ? 'is-active' : ''}">
              <a class="admin-nav-link" href="#admin/${dom.escape(mod.key)}" data-action="admin-go-module" data-module="${dom.escape(mod.key)}">
                <span class="admin-nav-icon">${mod.icon}</span>
                <span class="admin-nav-label">${dom.escape(mod.label)}</span>
              </a>
            </li>`;
        }).join('')}
      </ul>
    </div>
  `;
}
