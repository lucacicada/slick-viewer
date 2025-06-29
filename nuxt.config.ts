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

  css: ['~/assets/css/main.css'],

  compatibilityDate: '2025-05-15',

  vite: {
    plugins: <any>[
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
