import { defineConfig, minimal2023Preset } from '@vite-pwa/assets-generator/config'

// Erzeugt die App-Icons aus public/favicon.svg: `npm run icons` (nur nötig, wenn sich das Logo ändert).
const background = { resizeOptions: { background: '#047857' } }

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    ...minimal2023Preset,
    // Android schneidet „maskable“ Icons rund oder eckig zu – deshalb grüner Rand statt Weiß.
    maskable: { ...minimal2023Preset.maskable, ...background },
    apple: { ...minimal2023Preset.apple, ...background },
  },
  images: ['public/favicon.svg'],
})
