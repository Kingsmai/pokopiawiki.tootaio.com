const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';

function normalizeSiteUrl(value: string | undefined): string {
  return (value?.trim() || fallbackSiteUrl).replace(/\/+$/, '');
}

export default defineNuxtConfig({
  ssr: false,
  devtools: { enabled: false },
  css: ['~/src/styles/main.css'],
  compatibilityDate: '2026-05-06',
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL ?? process.env.VITE_API_BASE_URL ?? 'http://localhost:3001',
      siteUrl: normalizeSiteUrl(process.env.NUXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL)
    }
  },
  app: {
    head: {
      htmlAttrs: {
        lang: 'en'
      },
      title: 'Pokopia Wiki - Pokemon Pokopia Guide',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1.0' },
        {
          name: 'description',
          content:
            'Browse Pokopia Wiki for Pokemon, Event Pokemon, habitats, Event Habitats, items, Event Items, Ancient Artifacts, recipes, daily tasks, and Life community posts for Pokemon Pokopia.'
        },
        { name: 'robots', content: 'index, follow' },
        { name: 'theme-color', content: '#6ccf32' },
        { property: 'og:site_name', content: 'Pokopia Wiki' },
        { property: 'og:type', content: 'website' },
        { property: 'og:title', content: 'Pokopia Wiki - Pokemon Pokopia Guide' },
        {
          property: 'og:description',
          content:
            'Browse Pokopia Wiki for Pokemon, Event Pokemon, habitats, Event Habitats, items, Event Items, Ancient Artifacts, recipes, daily tasks, and Life community posts for Pokemon Pokopia.'
        },
        { property: 'og:image', content: `${normalizeSiteUrl(process.env.NUXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL)}/seo/pokopia-hero.jpg` },
        { property: 'og:locale', content: 'en_US' },
        { name: 'twitter:card', content: 'summary_large_image' },
        { name: 'twitter:title', content: 'Pokopia Wiki - Pokemon Pokopia Guide' },
        {
          name: 'twitter:description',
          content:
            'Browse Pokopia Wiki for Pokemon, Event Pokemon, habitats, Event Habitats, items, Event Items, Ancient Artifacts, recipes, daily tasks, and Life community posts for Pokemon Pokopia.'
        },
        { name: 'twitter:image', content: `${normalizeSiteUrl(process.env.NUXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL)}/seo/pokopia-hero.jpg` }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' },
        { rel: 'canonical', href: `${normalizeSiteUrl(process.env.NUXT_PUBLIC_SITE_URL ?? process.env.VITE_SITE_URL)}/pokemon` }
      ],
      script: [
        {
          innerHTML:
            '(function(){const s=document.createElement("script");s.async=true;s.src="https://umami.tootaio.com/script.js";s.setAttribute("data-website-id","6c00a2e5-dc72-41f3-9d5d-aac93aaaf1cb");document.head.appendChild(s);})();'
        }
      ]
    }
  },
  nitro: {
    prerender: {
      routes: ['/robots.txt', '/sitemap.xml']
    }
  }
});
