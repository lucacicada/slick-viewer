import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  modules: [
    '@nuxt/eslint',
    '@vueuse/nuxt',
  ],

  devtools: {
    enabled: true,
  },

  app: {
    rootAttrs: {
      id: 'app',
    },
    head: {
      title: 'Slick Viewer',
      link: [
        { rel: 'icon', href: '/icon.svg', type: 'image/svg+xml' },
      ],
    },
  },

  css: [
    '~/assets/css/main.css',
  ],

  features: {
    inlineStyles: false,
  },

  experimental: {
    payloadExtraction: false,
  },

  compatibilityDate: '2025-05-15',

  nitro: {
    prerender: {
      failOnError: false,
    },
  },

  vite: {
    build: {
      cssCodeSplit: false,
    },

    plugins: [
      tailwindcss(),
    ],
  },

  eslint: {
    config: {
      stylistic: true,
      standalone: false,
    },
  },
})
