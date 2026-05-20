export function adminShellTemplate() {
  return `
    <div class="app-shell admin-shell">
      <style>
        .admin-shell { --sidebar-w: 220px; }
        .admin-header { display:flex; align-items:center; justify-content:space-between; padding:8px 16px; background:var(--surface-primary,#1a1a2e); color:#fff; position:sticky; top:0; z-index:100; }
        .admin-header__brand { display:flex; align-items:center; gap:8px; }
        .admin-header__logo { font-size:1.3rem; }
        .admin-header__title { font-weight:600; font-size:1rem; }
        .admin-header__user { display:flex; align-items:center; gap:8px; font-size:0.85rem; }
        .admin-layout { display:flex; min-height:calc(100vh - 48px); }
        .admin-sidebar { width:var(--sidebar-w); min-width:var(--sidebar-w); background:var(--surface-secondary,#f5f5f5); border-left:1px solid var(--border-color,#ddd); overflow-y:auto; direction:rtl; }
        .admin-sidebar__inner { padding:8px 0; }
        .admin-nav-list { list-style:none; margin:0; padding:0; }
        .admin-nav-item { margin:0; }
        .admin-nav-link { display:flex; align-items:center; gap:10px; padding:10px 16px; color:var(--text-primary,#333); text-decoration:none; font-size:0.9rem; transition:background 0.15s; cursor:pointer; }
        .admin-nav-link:hover { background:var(--surface-hover,#e8e8e8); }
        .admin-nav-item.is-active .admin-nav-link { background:var(--accent-color,#007bff); color:#fff; font-weight:600; }
        .admin-nav-icon { font-size:1.1rem; }
        .admin-nav-label { flex:1; }
        .admin-content { flex:1; padding:16px; overflow-y:auto; }
      </style>
      <header class="admin-header" id="adminHeader"></header>
      <div class="admin-layout">
        <nav class="admin-sidebar" id="adminSidebar"></nav>
        <main class="admin-content" id="adminPage" role="main"></main>
      </div>
      <div class="app-overlays">
        <div id="appModalHost"></div>
        <div id="appToastHost" aria-live="polite" aria-atomic="true"></div>
      </div>
    </div>
  `;
}
