// // vite.config.js
// const { resolve } = require('path')
// const { defineConfig } = require('vite')

// module.exports = defineConfig({
//   build: {
//     rollupOptions: {
//       input: {
//         main: resolve(__dirname, 'index.html'),
//         loadSelection: resolve(__dirname, 'selectFigure.html'),
//         viewer: resolve(__dirname, 'viewer.html')
//         // main: new URL('./index.html', __dirname).pathname,
//         // loadSelection: new URL('./selectFigure.html', __dirname).pathname,
//         // viewer: new URL('./viewer.html', __dirname).pathname
//       }
//     }
//   }
// })

import basicSsl from '@vitejs/plugin-basic-ssl'
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  // config options
  server: {
    watch: {
      usePolling: true
    },
    hmr: true,
    https: true,
    host: true
  },
  plugins: [basicSsl()],
  publicDir: "assets",
  base: "./",
  build: {
    target: 'esnext',
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        figuren: resolve(__dirname, 'figuren/index.html'),
        dd: resolve(__dirname, '3D/index.html'),
        ar: resolve(__dirname, '3D/AugmentedReality/index.html'),
        ai: resolve(__dirname, '3D/aiAnalysis/index.html')
      }
    }
  }
})