import { defineConfig, Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import { configServerPlugin } from './vite-plugins/config-server';

// Generate build ID once at config time
const BUILD_ID = Date.now().toString();

// Plugin to inject build ID into HTML
function htmlCacheBuster(): Plugin {
  return {
    name: 'html-cache-buster',
    transformIndexHtml(html) {
      return html.replace(/%VITE_CONFIG_BUILD_ID%/g, BUILD_ID);
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    configServerPlugin(),
    htmlCacheBuster(),
    viteStaticCopy({
      targets: [
        // ONNX Runtime WASM files (used by both VAD and Transformers)
        {
          src: 'node_modules/onnxruntime-web/dist/*.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/onnxruntime-web/dist/*.mjs',
          dest: 'assets',
        },
        // Hugging Face Transformers WASM files (newer JSEP version)
        {
          src: 'node_modules/@huggingface/transformers/dist/*.wasm',
          dest: 'assets',
        },
        {
          src: 'node_modules/@huggingface/transformers/dist/*.mjs',
          dest: 'assets',
        },
      ],
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
    dedupe: ['three'],
  },
  base: process.env.BASE_PATH || '/',
  define: {
    'import.meta.env.VITE_CONFIG_BUILD_ID': JSON.stringify(BUILD_ID),
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'production'),
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      external: ['sharp', 'onnxruntime-node'],
      onwarn(warning, warn) {
        // Ignore missing source map warnings for onnxruntime files
        if (warning.code === 'SOURCEMAP_ERROR' && warning.message.includes('ort')) {
          return;
        }
        warn(warning);
      },
    },
  },
  server: {
    port: 3000,
    open: true,
    // Enable SharedArrayBuffer support for ONNX Runtime on all browsers including Brave
    // Required for VAD (Voice Activity Detection) to work properly
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
      // Prevent aggressive caching in dev mode
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  },
  optimizeDeps: {
    exclude: ['sharp', 'onnxruntime-node', 'onnxruntime-web'],
  },
  worker: {
    format: 'es',
  },
});
