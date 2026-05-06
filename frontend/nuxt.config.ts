const fallbackSiteUrl = 'https://pokopiawiki.tootaio.com';

function normalizeSiteUrl(value: string | undefined): string {
  return (value?.trim() || fallbackSiteUrl).replace(/\/+$/, '');
}

export default defineNuxtConfig({
  ssr: true,
  devtools: { enabled: false },
  css: ['~/src/styles/main.css'],
  compatibilityDate: '2026-05-06',
  runtimeConfig: {
    serverApiBaseUrl:
      process.env.NUXT_SERVER_API_BASE_URL ??
      process.env.NUXT_API_BASE_URL ??
      process.env.NUXT_PUBLIC_API_BASE_URL ??
      process.env.VITE_API_BASE_URL ??
      'http://localhost:3001',
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
        { name: 'theme-color', content: '#6ccf32' }
      ],
      link: [
        { rel: 'icon', href: '/favicon.ico', sizes: '32x32' }
      ],
      script: [
        {
          async: true,
          src: 'https://umami.tootaio.com/script.js',
          'data-website-id': '6c00a2e5-dc72-41f3-9d5d-aac93aaaf1cb'
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
