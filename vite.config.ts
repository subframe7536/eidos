import react from "@vitejs/plugin-react"
import fs from "fs"
import path from "path"
import { visualizer } from "rollup-plugin-visualizer"
import { Plugin, PluginOption, defineConfig } from "vite"
import { VitePWA } from "vite-plugin-pwa"
import electron from 'vite-plugin-electron/simple'

const serviceMode = process.env.EIDOS_SERVICE_MODE || 'web-app'


const iconPath = path.resolve(__dirname, "icons.json")
const iconJson = JSON.parse(fs.readFileSync(iconPath, "utf-8"))

const htmlPlugin = (): Plugin => {
  return {
    name: "html-transform",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler() {
        const entryMap: {
          [key: string]: string
        } = {
          "ink": "/apps/publish/index.tsx",
          "desktop": "/apps/desktop/index.tsx",
          "web-app": "/apps/web-app/index.tsx"
        }
        const src = entryMap[serviceMode]
        return [
          {
            tag: "script",
            attrs: { type: "module", src },
            injectTo: "body",
          },
        ]
      },
    },
  }
}

const config = defineConfig({
  plugins: [
    htmlPlugin(),
    react(),
    serviceMode === 'web-app' ?
      VitePWA({
        srcDir: "apps/web-app",
        filename: "sw.ts",
        strategies: "injectManifest",
        injectManifest: {
          // 7MB
          maximumFileSizeToCacheInBytes: 7 * 1024 * 1024,
          globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
        },
        includeAssets: ["favicon.ico", "apple-touch-icon.png", "mask-icon.svg"],
        manifest: {
          name: "Eidos",
          short_name: "Eidos",
          description:
            "An extensible framework for managing your personal data throughout your lifetime in one place",
          theme_color: "#ffffff",
          icons: iconJson.icons,
          display_override: ["window-controls-overlay"],
          display: "standalone",
          // display: "standalone",
          file_handlers: [
            // not ready yet
            // {
            //   action: "/editor/doc",
            //   accept: {
            //     "text/markdown": [".md", ".markdown"],
            //   },
            // },
          ],
        },
        registerType: "prompt",
        workbox: {
          // globPatterns: ["**/*.{js,css,html,ico,png,svg,wasm}"],
          clientsClaim: true,
          skipWaiting: true,
        },
        devOptions: {
          enabled: true,
          type: "module",
        },
      }) : null,
    serviceMode === 'desktop' ?
      electron({
        main: {
          // Shortcut of `build.lib.entry`
          entry: 'electron/main.ts',
        },
        preload: {
          input: 'electron/preload.ts',
          vite: {
            build: {
              rollupOptions: {
                output: {
                  format: 'es',
                  inlineDynamicImports: true,
                  entryFileNames: '[name].mjs',
                  chunkFileNames: '[name].mjs',
                  assetFileNames: '[name].[ext]',
                },
              },
            },
          },
        },
        // Optional: Use Node.js API in the Renderer process
        // renderer: {},
      }) : null,
    visualizer({
      gzipSize: true,
      brotliSize: true,
      emitFile: false,
      filename: "dev-pkg-vis.html",
      open: true,
    }) as unknown as PluginOption,
  ],
  build: {
    rollupOptions: {
      external: ['electron'],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  server: {
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
    proxy: {
      "/server/api": "http://localhost:8788",
    },
  },
  optimizeDeps: {
    exclude: ["@sqlite.org/sqlite-wasm", "whisper-webgpu"],
  },
})

export default config
