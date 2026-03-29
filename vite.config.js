import { defineConfig } from 'vite'
import { createHtmlPlugin } from 'vite-plugin-html'
import { fileURLToPath } from 'url'
import path from 'path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  base: '/',
  server: {
    allowedHosts: true
  },
  plugins: [
    createHtmlPlugin({
      minify: false,
      inject: {
        ejsOptions: {
          filename: path.resolve(__dirname, 'index.html'),
        },
      },
    }),
  ],
})
