import { dom } from '../core/dom.js';

function resolveBannerImage(state) {
  const settings = state.commerce?.catalog?.settingsMap || {};
  return settings.company_banner_image
    || settings.company_banner
    || settings.banner_image
    || settings.home_banner_image
    || settings.hero_banner
    || settings.main_banner
    || '';
}

export function renderBanner(container, state) {
  if (!container) return;
  const banner = resolveBannerImage(state);
  const cache = container.__bannerCache;
  if (cache && cache.banner === banner && (container.innerHTML === '' === !banner)) return;

  if (!banner) {
    container.innerHTML = '';
    container.__bannerCache = { banner: null };
    return;
  }

  container.innerHTML = `
    <section class="banner-shell">
      <img class="banner-shell__image" src="${dom.escape(banner)}" alt="بانر الشركة" loading="eager" />
    </section>
  `;
  container.__bannerCache = { banner: banner };
}
