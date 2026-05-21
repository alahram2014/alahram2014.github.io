import { dom } from '../core/dom.js';
import { renderOpsAdminCompaniesPage } from './opsAdminCompaniesPage.js';
import { renderOpsProductPage } from './opsProductPage.js';
import { renderAdminOrdersModule, renderAdminCustomersModule, renderAdminRepsModule, renderAdminPricingModule } from './adminModulePages.js';

function renderAdminModuleSurface(state) {
  const moduleKey = String(state?.app?.route?.params?.module || 'products').trim();
  if (moduleKey === 'products') return renderOpsProductPage(state);
  if (moduleKey === 'companies') return renderOpsAdminCompaniesPage(state);
  if (moduleKey === 'customers') return renderAdminCustomersModule(state);
  if (moduleKey === 'orders') return renderAdminOrdersModule(state);
  if (moduleKey === 'reps') return renderAdminRepsModule(state);
  if (moduleKey === 'pricing') return renderAdminPricingModule(state);
  if (moduleKey === 'deals') {
    return `
      <div class="page-stack">
        <section class="page-section">
          <div class="page-section__head"><div><h2>العروض</h2><p>عرض اليوم والعروض الفورية</p></div></div>
          <div class="empty-state">وحدة العروض قيد التطوير</div>
        </section>
      </div>`;
  }
  if (moduleKey === 'stock') {
    return `
      <div class="page-stack">
        <section class="page-section">
          <div class="page-section__head"><div><h2>المخزون</h2><p>مراقبة المخزون وإدارة الحركة</p></div></div>
          <div class="empty-state">وحدة المخزون قيد التطوير</div>
        </section>
      </div>`;
  }
  if (moduleKey === 'users') {
    return `
      <div class="page-stack">
        <section class="page-section">
          <div class="page-section__head"><div><h2>إدارة المستخدمين</h2><p>المستخدمين والصلاحيات</p></div></div>
          <div class="empty-state">وحدة المستخدمين قيد التطوير</div>
        </section>
      </div>`;
  }
  if (moduleKey === 'settings') {
    return `
      <div class="page-stack">
        <section class="page-section">
          <div class="page-section__head"><div><h2>الإعدادات</h2><p>إعدادات التشغيل</p></div></div>
          <div class="empty-state">وحدة الإعدادات قيد التطوير</div>
        </section>
      </div>`;
  }
  return `<div class="empty-state">الوحدة غير معروفة</div>`;
}

export function renderAdminDashboardPage(state) {
  const session = state?.auth?.session;
  if (!session) {
    return `<div class="page-stack"><section class="page-section"><div class="empty-state">يرجى تسجيل الدخول للوصول إلى مركز التحكم</div></section></div>`;
  }
  return renderAdminModuleSurface(state);
}
