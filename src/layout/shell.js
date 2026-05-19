export function shellTemplate() {
  return `
    <div class="app-shell">
      <header class="app-header" id="appHeader"></header>
      <section class="app-ops-nav" id="appOpsNav"></section>
      <section class="app-banner" id="appBanner"></section>
      <section class="app-theme" id="appTheme"></section>
      <section class="app-search" id="appSearch"></section>
      <section class="app-hero" id="appHero"></section>
      <main class="app-main" id="appPage" role="main"></main>
      <footer class="app-footer" id="appFooter"></footer>
      <div class="app-floating-execution" id="appFloatingExecutionBar"></div>
      <div class="app-overlays">
        <div id="appDrawerHost"></div>
        <div id="appModalHost"></div>
        <div id="appToastHost" aria-live="polite" aria-atomic="true"></div>
      </div>
    </div>
  `;
}

export function minimalShellTemplate() {
  return `
    <div class="app-shell minimal-shell">
      <header class="app-header" id="appHeader"></header>
      <section class="app-ops-nav" id="appOpsNav"></section>
      <main class="app-main" id="appPage" role="main"></main>
      <div class="app-overlays">
        <div id="appDrawerHost"></div>
        <div id="appModalHost"></div>
        <div id="appToastHost" aria-live="polite" aria-atomic="true"></div>
      </div>
    </div>
  `;
}

export function repShellTemplate() {
  return `
    <div class="app-shell rep-shell">
      <header class="app-header" id="appHeader"></header>
      <section class="app-rep-nav" id="appRepNav"></section>
      <main class="app-main" id="appPage" role="main"></main>
      <div class="app-overlays">
        <div id="appDrawerHost"></div>
        <div id="appModalHost"></div>
        <div id="appToastHost" aria-live="polite" aria-atomic="true"></div>
      </div>
    </div>
  `;
}
