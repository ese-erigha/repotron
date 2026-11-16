import { cloudflare } from '@cloudflare/vite-plugin'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import { fixtureApi } from './fixtures/fixture-api.ts'

// The dev server answers the API from fixtures, so it needs no gateway.
// The build makes the assets of the Worker. The browser calls the gateway.
export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), command === 'serve' ? fixtureApi() : cloudflare()],
  server: {
    port: 5173,
    strictPort: true,
    // A build writes its output here. The dev server does not reload the page for it.
    watch: { ignored: ['**/.cloudflare/**'] },
  },
}))
