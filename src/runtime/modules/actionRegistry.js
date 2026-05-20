export function createActionRegistry(ctx) {
  const { store, api, notify, navigateAuthority, schedule } = ctx;

  const registry = {};

  function register(actions, handler) {
    const list = Array.isArray(actions) ? actions : [actions];
    for (const a of list) registry[a] = handler;
  }

  function loadRepData() {
    const customers = Array.isArray(store.getState().runtime.rep.customers) ? store.getState().runtime.rep.customers : [];
    return customers;
  }

  register('navigate-home', () => navigateAuthority(store, 'home'));
  register('go-companies', () => navigateAuthority(store, 'companies'));
  register('go-offers', () => navigateAuthority(store, 'offers'));
  register('go-tiers', () => navigateAuthority(store, 'tiers'));
  register('go-login', () => navigateAuthority(store, 'login'));
  register('go-register', () => navigateAuthority(store, 'register'));
  register('go-customers', () => navigateAuthority(store, 'customers'));
  register('go-invoices', () => navigateAuthority(store, 'invoices'));
  register('go-account', () => navigateAuthority(store, 'account'));
  register('go-search', () => {
    const resultsEl = document.getElementById('globalSearchResults');
    if (resultsEl) { resultsEl.classList.add('is-hidden'); resultsEl.innerHTML = ''; }
    navigateAuthority(store, 'search');
  });
  register('go-back', () => { if (history.length > 1) history.back(); else navigateAuthority(store, 'home'); });
  register('go-cart', () => { store.patch({ ui: { ...store.getState().ui, drawerOpen: false } }); schedule('drawer', 'header', 'page'); });
  register('go-order-submission', () => navigateAuthority(store, 'checkout'));
  register('go-flash', () => navigateAuthority(store, 'offers'));
  register('navigate-back-home', () => navigateAuthority(store, 'home'));

  register('go-rep', () => navigateAuthority(store, 'rep'));
  register('go-rep-customers', () => navigateAuthority(store, 'rep', { module: 'customers' }));
  register('go-rep-orders', () => navigateAuthority(store, 'rep', { module: 'orders' }));
  register('go-rep-invoices', () => navigateAuthority(store, 'rep', { module: 'invoices' }));

  register('go-checkout', () => {
    const session = store.getState().auth.session;
    const { isSalesRepSession } = ctx.auth;
    const requiresCustomerSelection = isSalesRepSession(session);
    if (requiresCustomerSelection && !store.getState().auth.selectedCustomer) {
      ctx.setPendingFlow(store, { name: 'checkout', resumeRoute: 'checkout', resumeMessage: 'يرجى مراجعة تفاصيل الطلب قبل الإرسال' });
      ctx.notify(store, 'warning', 'يجب اختيار العميل أولًا', 'اختر العميل ثم ستنتقل مباشرة إلى مراجعة الطلب');
      return navigateAuthority(store, 'customers');
    }
    return navigateAuthority(store, 'checkout');
  });

  register('go-ops', () => {
    const session = store.getState().auth.session;
    if (!ctx.canOpenOpsWorkspace(session)) {
      notify(store, 'warning', 'غير مصرح', 'هذه اللوحة متاحة للحسابات التشغيلية فقط');
      return;
    }
    if (ctx.isSalesRepSession(session) && !ctx.isAdminOnlySession(session)) {
      return navigateAuthority(store, 'rep');
    }
    return navigateAuthority(store, 'ops', { module: ctx.getDefaultOperationalModule(session) });
  });

  register('global-search-select', (target) => {
    const productId = target.getAttribute('data-product-id');
    if (productId) {
      store.patch({ ui: { ...store.getState().ui, selectedProductId: productId, activeModal: 'product', search: '' } });
      const resultsEl = document.getElementById('globalSearchResults');
      if (resultsEl) { resultsEl.classList.add('is-hidden'); resultsEl.innerHTML = ''; }
      schedule('modals', 'header', 'searchResults');
    }
  });

  register('go-rep-customer-invoices', (target) => {
    const customerId = target.getAttribute('data-customer-id');
    const customerName = target.getAttribute('data-customer-name') || '';
    if (!customerId) return;
    const customers = loadRepData();
    const customer = customers.find((c) => String(c.id) === String(customerId));
    if (customer) store.patch({ auth: { ...store.getState().auth, selectedCustomer: customer } });
    notify(store, 'info', 'فواتير العميل', customerName);
    navigateAuthority(store, 'rep', { module: 'invoices' });
  });

  register('select-customer', (target) => {
    const customerId = target.getAttribute('data-customer-id');
    if (!customerId) return;
    const customers = loadRepData();
    const customer = customers.find((c) => String(c.id) === String(customerId));
    if (customer) {
      store.patch({ auth: { ...store.getState().auth, selectedCustomer: customer } });
      notify(store, 'success', 'تم اختيار العميل', customer.name || '');
      const pendingFlow = store.getState().ui.pendingFlow;
      if (pendingFlow?.name === 'checkout') {
        ctx.clearPendingFlow(store);
        navigateAuthority(store, 'checkout');
      }
    }
  });

  register('go-ops-module', (target) => {
    const module = String(target.getAttribute('data-module') || '').trim() || 'sales-manager';
    navigateAuthority(store, 'ops', { module });
    if (module === 'products' || module === 'catalog') ctx.loadOpsProductsIntoState(store, api);
    if (module === 'orders' || module === 'customers' || module === 'reps') ctx.loadManagerScopeIntoState(store, api, store.getState().auth.session);
  });

  register(['toggle-account-menu', 'close-modal'], (target, action) => {
    if (action === 'toggle-account-menu') {
      store.patch({ ui: { ...store.getState().ui, accountMenuOpen: !store.getState().ui.accountMenuOpen, activeModal: null } });
      schedule('header', 'modals');
    } else {
      store.patch({ ui: { ...store.getState().ui, activeModal: null, selectedInvoiceId: null, customerLocationBusy: false, customerLocationError: null, customerLocationDraft: { text: '', lat: null, lng: null } } });
      schedule('modals');
    }
  });

  register(['open-cart-drawer', 'close-cart-drawer'], (target, action) => {
    if (action === 'open-cart-drawer') {
      ctx.closeTransientSurfaces(store, { keepDrawer: false });
      store.patch({ ui: { ...store.getState().ui, drawerOpen: true } });
      schedule('drawer', 'header', 'modals');
    } else {
      store.patch({ ui: { ...store.getState().ui, drawerOpen: false } });
      schedule('drawer');
    }
  });

  register('open-customer-modal', () => {
    ctx.closeTransientSurfaces(store, { keepDrawer: false });
    ctx.resetCustomerLocationDraft(store);
    store.patch({ ui: { ...store.getState().ui, activeModal: 'customer' } });
    schedule('modals', 'header');
  });

  register('clear-search', () => {
    store.patch({ ui: { ...store.getState().ui, search: '' } });
    if (typeof ctx.clearSearchTypingTimer === 'function') ctx.clearSearchTypingTimer();
    const resultsEl = document.getElementById('globalSearchResults');
    if (resultsEl) { resultsEl.classList.add('is-hidden'); resultsEl.innerHTML = ''; }
    schedule('header', 'theme', 'banner', 'hero', 'page', 'search', 'searchResults');
  });

  register('toggle-desktop-mode', () => {
    const next = !(store.getState().ui.desktopMode === true);
    store.patch({ ui: { ...store.getState().ui, desktopMode: next } });
    ctx.saveJSON(ctx.storageKeys.desktopMode, next);
    ctx.applyDesktopMode(next);
    schedule('header');
  });

  register('admin-go-module', (target) => {
    const module = String(target.getAttribute('data-module') || '').trim() || 'products';
    navigateAuthority(store, 'admin', { module });
    if (module === 'products') ctx.loadOpsProductsIntoState(store, api);
    if (module === 'orders' || module === 'customers' || module === 'reps') ctx.loadManagerScopeIntoState(store, api, store.getState().auth.session);
  });

  register('admin-logout', () => { ctx.logout(); navigateAuthority(store, 'home'); });
  register('admin-back-store', () => navigateAuthority(store, 'home'));

  register(['ops-company-toggle-visibility', 'ops-product-toggle-status', 'ops-product-toggle-visibility'], async (target, action) => {
    const productId = target.getAttribute('data-product-id') || target.getAttribute('data-product') || '';
    if (!productId) return;
    try {
      if (action === 'ops-product-toggle-status') {
        const currentStatus = target.getAttribute('data-status') || 'active';
        await ctx.toggleOpsProductActive(api, productId, currentStatus);
        notify(store, 'success', 'تم التبديل', '');
      } else if (action === 'ops-product-toggle-visibility') {
        const currentVisible = target.getAttribute('data-visible') !== 'false';
        await ctx.toggleOpsProductVisibility(api, productId, currentVisible);
        notify(store, 'success', 'تم التبديل', '');
      }
      ctx.loadOpsProductsIntoState(store, api);
    } catch { notify(store, 'error', 'تعذر التبديل', ''); }
  });

  register('ops-product-create', () => {
    const modal = document.getElementById('opsProductModal');
    if (!modal) return;
    document.getElementById('opsProductModalTitle').textContent = 'إضافة منتج';
    document.getElementById('opsProductId').value = '';
    document.getElementById('opsProductName').value = '';
    document.getElementById('opsProductCompanyId').value = '';
    document.getElementById('opsProductCategory').value = '';
    document.getElementById('opsProductImage').value = '';
    document.getElementById('opsProductVisible').checked = true;
    document.getElementById('opsProductActive').checked = true;
    modal.style.display = 'flex';
  });

  register('ops-product-edit', (target) => {
    const modal = document.getElementById('opsProductModal');
    if (!modal) return;
    const productId = target.getAttribute('data-product-id') || '';
    document.getElementById('opsProductModalTitle').textContent = 'تعديل المنتج';
    document.getElementById('opsProductId').value = productId;
    document.getElementById('opsProductName').value = target.getAttribute('data-product-name') || '';
    document.getElementById('opsProductCompanyId').value = target.getAttribute('data-company-id') || '';
    document.getElementById('opsProductCategory').value = target.getAttribute('data-product-category') || '';
    document.getElementById('opsProductImage').value = target.getAttribute('data-product-image') || '';
    document.getElementById('opsProductVisible').checked = target.getAttribute('data-product-visible') !== 'false';
    document.getElementById('opsProductActive').checked = target.getAttribute('data-product-status') !== 'inactive';
    const preview = document.getElementById('opsImagePreview');
    const img = target.getAttribute('data-product-image') || '';
    if (preview) { preview.style.display = img ? 'flex' : 'none'; if (img) document.getElementById('opsImagePreviewImg').src = img; }
    const unitPricesEl = document.getElementById('opsProductUnitPrices');
    if (unitPricesEl && productId) {
      const products = store.getState().runtime.opsProducts?.products || [];
      const product = products.find((p) => String(p.product_id) === String(productId));
      if (product && product.unitOrder) {
        const tierSet = new Set();
        product.unitOrder.forEach((uc) => { const u = product.units[uc]; if (u) Object.keys(u.prices || {}).forEach((t) => tierSet.add(t)); });
        const tierNames = Array.from(tierSet);
        unitPricesEl.innerHTML = product.unitOrder.map((uc) => {
          const u = product.units[uc];
          if (!u) return '';
          return `<div class="ops-modal-unit"><strong>${unitBadge(uc)}</strong>${tierNames.map((t) => {
            const price = u.prices?.[t] || 0;
            return `<label class="ops-field ops-field--inline"><span>${ctx.dom.escape(t)}</span><input type="number" min="0" step="0.01" value="${Number(price).toFixed(2)}" data-tier="${ctx.dom.escape(t)}" data-unit="${ctx.dom.escape(uc)}" data-product="${ctx.dom.escape(productId)}" class="ops-inline-input ops-inline-input--price"></label>`;
          }).join('')}</div>`;
        }).join('');
      }
    }
    modal.style.display = 'flex';
  });

  register('ops-product-modal-close', () => {
    const modal = document.getElementById('opsProductModal');
    if (modal) modal.style.display = 'none';
  });

  register('ops-product-image-preview', (target) => {
    const url = target.value.trim();
    const preview = document.getElementById('opsImagePreview');
    if (preview) { preview.style.display = url ? 'flex' : 'none'; if (url) document.getElementById('opsImagePreviewImg').src = url; }
  });

  register('ops-product-save-stock', async (target) => {
    const productId = target.getAttribute('data-product-id');
    const unitCode = target.getAttribute('data-unit-code');
    if (!productId || !unitCode) return;
    const input = document.querySelector(`[data-ops-stock="${CSS.escape(productId)}:${CSS.escape(unitCode)}"]`);
    const value = input ? parseInt(input.value, 10) : 0;
    try {
      await ctx.updateOpsProductUnitStock(api, productId, unitCode, value);
      notify(store, 'success', 'تم تحديث المخزون', `${unitCode}: ${value}`);
      ctx.loadOpsProductsIntoState(store, api);
    } catch { notify(store, 'error', 'تعذر تحديث المخزون', ''); }
  });

  register('ops-product-save-price', async (target) => {
    const productId = target.getAttribute('data-product-id');
    const unitCode = target.getAttribute('data-unit-code');
    const tierName = target.getAttribute('data-tier-name');
    if (!productId || !unitCode || !tierName) return;
    const input = document.querySelector(`[data-ops-price="${CSS.escape(productId)}:${CSS.escape(unitCode)}:${CSS.escape(tierName)}"]`);
    const value = input ? parseFloat(input.value) : 0;
    try {
      await ctx.updateOpsProductUnitPrice(api, productId, unitCode, tierName, value);
      notify(store, 'success', 'تم تحديث السعر', `${unitCode} / ${tierName}: ${value.toFixed(2)}`);
      ctx.loadOpsProductsIntoState(store, api);
    } catch { notify(store, 'error', 'تعذر تحديث السعر', ''); }
  });

  register('ops-product-delete', async (target) => {
    const productId = target.getAttribute('data-product-id');
    const productName = target.getAttribute('data-product-name') || 'هذا المنتج';
    if (!productId) return;
    if (!confirm(`هل أنت متأكد من حذف "${productName}"؟`)) return;
    try {
      await ctx.deleteOpsProduct(api, productId);
      notify(store, 'success', 'تم الحذف', productName);
      ctx.loadOpsProductsIntoState(store, api);
    } catch { notify(store, 'error', 'تعذر حذف المنتج', ''); }
  });

  register(['admin-order-view', 'admin-order-transition', 'admin-customer-view', 'admin-customer-orders', 'admin-rep-view', 'admin-rep-customers', 'admin-pricing-view'], () => {
    notify(store, 'info', 'قيد التطوير', 'هذه الوحدة قيد التطوير حاليًا');
  });

  return { dispatch(action, target) {
    const handler = registry[action];
    if (handler) { handler(target, action); return true; }
    return false;
  }};
}

function unitBadge(code) {
  const labels = { box: 'كرتونة', piece: 'قطعة', pack: 'حزمة', unit: 'وحدة', bundle: 'ربطة', bottle: 'زجاجة', tin: 'علبة', pouch: 'كيس' };
  return labels[code] || code;
}
